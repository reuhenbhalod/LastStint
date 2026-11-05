// GameSession: the headless driver that connects the mutable sim engine to the pure state
// machine. It decides when to pause (at the race's approved decision moments), grades each
// moment off-thread as it pauses, advances the engine lap by lap, applies the player's calls,
// and serialises/resumes a run. The React layer (useGame) wraps it with timers and the
// network; this class is fully testable headless.

import {
  type Decision,
  type DecisionMoment,
  type RaceNote,
  type RaceState,
  engineerConfig,
  moodOf,
  scoreRun,
} from '@boxthislap/sim';
import type { RunResponse, RunSubmission } from '../data/api.js';
import { ignoreRate } from '../data/drivers.js';
import type { Daily } from '../data/types.js';
import { GameEngine, decisionMoments } from '../engine/engine.js';
import { type GradedMoment, type Grader, gradedFromHits, inlineGrader } from '../engine/grading.js';
import { autoStay, boxingAt } from '../game/autoStay.js';
import { ownMove } from '../game/engineerCalls.js';
import { engineerRadio } from '../game/engineerRadio.js';
import { neutralCause } from '../game/neutral.js';
import { MOOD_REFUSALS, acknowledge, refusal } from '../game/refusal.js';
import { overtakingCorners } from '../track/corners.js';
import { outlineFor } from '../track/outlines.js';
import {
  type Action,
  type GameMeta,
  type GameState,
  type Phase,
  type Speed,
  type Submission,
  reducer,
} from './machine.js';

export interface PersistedRun {
  date: string;
  raceId: string;
  seed: number;
  speed: Speed;
  phase: Phase;
  lap: number;
  decisions: Decision[];
  resolved: string[];
  grades?: Record<string, GradedMoment>;
  submission?: Submission;
}

function metaOf(daily: Daily): GameMeta {
  const m = daily.model;
  return {
    raceId: m.race.id,
    number: daily.number,
    source: daily.source,
    practiceReason: daily.practiceReason,
    date: daily.date,
    totalLaps: m.race.laps,
    takeoverLap: m.race.takeoverLap,
    userSide: m.userSide,
    rival: m.rival,
  };
}

/** The unresolved moment to pause at from a given lap: the game pauses after lap - 1. */
function momentAt(
  moments: DecisionMoment[],
  lap: number,
  resolved: string[],
): DecisionMoment | null {
  return moments.find((m) => m.lap === lap + 1 && !resolved.includes(m.id)) ?? null;
}

/** The engineer's radio for each team order (to the team-mate, or to your driver). */
const ORDER_COPY: Record<Extract<Decision, { kind: 'teamOrder' }>['order'], string> = {
  holdUp: 'Team-mate told: hold him up when he gets to you.',
  release: 'Team-mate released: race your own race.',
  teammateLetsYouPast: 'Team-mate told to let you through.',
  letTeammatePast: 'Let your team-mate through, please.',
};

export class GameSession {
  private readonly engine: GameEngine;
  private readonly daily: Daily;
  private readonly grader: Grader;
  private readonly grading = new Map<string, Promise<void>>();
  state: GameState;
  /** Called after a change that happens outside a method call (a grade arriving). */
  onChange: () => void = () => {};

  constructor(
    daily: Daily,
    options: { engine?: GameEngine; state?: GameState; grader?: Grader } = {},
  ) {
    this.daily = daily;
    this.grader = options.grader ?? inlineGrader;
    this.engine = options.engine ?? new GameEngine(daily.model, daily.seed, { decisions: [] });
    this.state = options.state ?? {
      phase: 'intro',
      speed: 1,
      race: this.engine.state,
      moments: decisionMoments(daily.model),
      currentMoment: null,
      resolved: [],
      decisions: this.engine.decisions,
      result: null,
      grades: {},
      submission: { status: daily.source === 'live' ? 'none' : 'practice' },
      meta: metaOf(daily),
      radio: [],
    };
  }

  private dispatch(action: Action): void {
    this.state = reducer(this.state, action);
  }

  /** Recompute the phase from the engine's current lap (pause / keep racing / finish). */
  private sync(): void {
    const finished = this.engine.isFinished();
    const moment = finished
      ? null
      : momentAt(this.state.moments, this.engine.lap, this.state.resolved);
    const result = finished ? this.engine.result() : null;
    this.dispatch({ type: 'SYNC', race: this.engine.state, moment, finished, result });
    if (!moment) return;
    this.startGrading(moment, this.engine);
    // Your car is out: nothing left to call, so each moment takes its first (do-nothing) option.
    if (this.engine.state.cars[this.state.meta.userSide]?.retired) {
      const none = moment.options.find((o) => o.decisions.length === 0) ?? moment.options[0];
      if (none) this.choose(none.id);
      return;
    }
    // A stop booked, or just made: the wall stays out without asking (game/autoStay.ts).
    const stay = autoStay(moment, this.engine.decisions);
    if (stay) {
      this.dispatch({
        type: 'RADIO',
        message: {
          lap: moment.lap,
          from: 'Engineer',
          text: boxingAt(moment, this.engine.decisions)
            ? 'We’re boxing already. No change to the plan.'
            : 'We’ve just stopped. Staying out.',
          refused: false,
        },
      });
      this.choose(stay);
    }
  }

  /**
   * Grade a moment from the run paused at it (before the answer: the server rebuilds the grade
   * from the calls made before the pause). The worker runs while the player reads.
   */
  private startGrading(moment: DecisionMoment, paused: GameEngine): void {
    if (this.state.grades[moment.id] || this.grading.has(moment.id)) return;
    const job = paused.gradingJob(moment);
    const done = this.grader.hits(job.job).then((hits) => {
      this.dispatch({
        type: 'GRADED',
        momentId: moment.id,
        graded: gradedFromHits(moment, job, hits),
      });
      this.grading.delete(moment.id);
      this.onChange();
    });
    this.grading.set(moment.id, done);
  }

  /** Every moment's grade, once all are in (for submitting). */
  async allGraded(): Promise<Record<string, GradedMoment>> {
    await Promise.all(this.grading.values());
    return this.state.grades;
  }

  start(): void {
    this.dispatch({ type: 'START' });
    this.sync(); // pause immediately if a moment sits at takeoverLap + 1
  }

  /** Advance one lap (no-op unless racing), then settle the phase. */
  tick(): void {
    if (this.state.phase !== 'racing') return;
    this.engine.step();
    this.reportIncidents();
    this.reportNeutral();
    this.reportEngineer();
    this.sync();
  }

  /** Race control and the driver on the radio for the lap's crashes, failures and punctures. */
  private reportIncidents(): void {
    const lap = this.engine.lap;
    const race = this.engine.state;
    const side = this.state.meta.userSide;
    for (const n of this.engine.notes) {
      if (n.kind !== 'incident' || n.lap !== lap) continue;
      const mine = n.driver === side;
      const text =
        n.detail === 'puncture'
          ? mine
            ? 'Puncture! I’ve got a puncture! Coming in.'
            : `${n.driver} has a puncture and is limping to the pits.`
          : n.detail === 'crash'
            ? mine
              ? 'I’m in the wall. I’m sorry, guys.'
              : `${n.driver} has crashed out.${race.nextFlag === 'sc' ? ' Safety car.' : race.nextFlag === 'vsc' ? ' Virtual safety car.' : ''}`
            : mine
              ? 'I’ve lost power… the car’s stopped. It’s over.'
              : `${n.driver} has stopped on track with a failure.`;
      this.say(mine ? side : 'Race control', text, false, lap);
    }
  }

  /**
   * Race control as a safety car or VSC is called for the next lap, and why (game/neutral.ts).
   * A crash in live play already said so with its own line.
   */
  private reportNeutral(): void {
    const race = this.engine.state;
    const lap = this.engine.lap;
    const next = race.nextFlag;
    if ((next !== 'sc' && next !== 'vsc') || race.flag === next) return;
    const crashed = this.engine.notes.some(
      (n) => n.kind === 'incident' && n.detail === 'crash' && n.lap === lap,
    );
    if (crashed) return;
    const why = neutralCause(this.daily.model, this.engine.notes, lap + 1, next);
    const name = next === 'sc' ? 'Safety car' : 'Virtual safety car';
    this.say('Race control', `${name}${why ? `: ${why}.` : '.'}`, false, lap);
  }

  /** What the race model noted so far (battles, contact, trust...). */
  get notes() {
    return this.engine.notes;
  }

  /**
   * The lap being shown, run ahead (battles and trust spec): a replay of the call log to the
   * end of it. The race model is deterministic, so this is exactly what the lap will give if
   * no more calls are made for it (a battle's result shown at its corner). Null at the flag.
   */
  previewLap(): { race: RaceState; notes: RaceNote[] } | null {
    if (this.engine.isFinished()) return null;
    const lap = this.engine.lap + 1;
    const replay = new GameEngine(this.daily.model, this.daily.seed, {
      decisions: this.engine.decisions,
    });
    while (replay.lap < lap && !replay.isFinished()) replay.step();
    return { race: replay.state, notes: replay.notes.filter((n) => n.lap === lap) };
  }

  /** The radio for the race engineer side of the lap: battles, contact, track limits, trust. */
  private reportEngineer(): void {
    const model = this.daily.model;
    const lap = this.engine.lap;
    const corner = overtakingCorners(outlineFor(model.race.id))[0] ?? 1;
    const lines = engineerRadio(
      this.engine.notes,
      lap,
      this.state.meta.userSide,
      this.engine.state,
      engineerConfig(model),
      corner,
    );
    // The same line from the same voice within a few laps is left out (a long battle).
    const recent = this.state.radio.filter((m) => m.lap >= lap - 3);
    for (const l of lines) {
      if (recent.some((m) => m.from === l.from && m.text === l.text)) continue;
      this.say(l.from, l.text, false, lap);
    }
  }

  /** Answer the current decision moment with one of its options, then resume. */
  choose(optionId: string): void {
    const moment = this.state.currentMoment;
    if (this.state.phase !== 'decision' || !moment) return;
    if (!moment.options.some((o) => o.id === optionId)) {
      throw new Error(`unknown option '${optionId}' for moment '${moment.id}'`);
    }
    this.engine.answer(moment, optionId);
    this.dispatch({ type: 'RESOLVE', momentId: moment.id, decisions: this.engine.decisions });
    this.sync();
  }

  /**
   * A standing-mode flip or BOX call mid-lap; never pauses. The driver may refuse it, at their
   * researched rate (game/refusal.ts, data/drivers.json): a refused call is not applied, so it
   * never reaches the call log. A call already booked for the coming lap is ignored. An answer
   * to a quick call (`asked`: the driver or engineer asked for the order) is always followed.
   */
  call(decision: Decision, options: { asked?: boolean; quiet?: boolean } = {}): void {
    if (this.state.phase !== 'racing') return;
    const side = this.state.meta.userSide;
    const car = this.engine.state.cars[side];
    if (decision.kind !== 'radio' && (!car || car.retired)) return;
    if (decision.kind === 'pit') {
      // One stop at a time: none while one is called or under way (pit fix).
      const lap = this.engine.lap;
      const called = this.engine.decisions.some((d) => d.kind === 'pit' && d.lap > lap);
      if (called || car?.strategy.some((s) => s.lap > lap)) return;
      if (decision.lap >= this.daily.model.race.laps) {
        this.say('Engineer', 'Too late to box: this is the last lap.', false, decision.lap);
        return;
      }
    }
    // One call of a kind per lap (a mode: one per key).
    const booked = this.engine.decisions.some(
      (d) =>
        d.lap === decision.lap &&
        d.kind === decision.kind &&
        (d.kind !== 'mode' || (decision.kind === 'mode' && d.key === decision.key)),
    );
    if (booked) return;
    if (
      car &&
      (decision.kind === 'pit' || decision.kind === 'mode' || decision.kind === 'battle')
    ) {
      // The driver may refuse the wall's orders, more so the angrier he is.
      const cfg = engineerConfig(this.daily.model);
      const eng = this.engine.state.engineer;
      const mood = eng && cfg ? moodOf(cfg, eng.trust) : 'tense';
      const rate = Math.min(0.9, ignoreRate(side) * MOOD_REFUSALS[mood]);
      const no =
        options.asked || (decision.kind === 'battle' && decision.driver)
          ? null
          : refusal(this.daily.seed, this.engine.lap, decision, car, rate);
      // A stop booked past this lap's pit entry is for the next one: say so.
      const copy =
        decision.kind === 'pit' && decision.lap > this.engine.lap + 1
          ? `Copy, box next lap for ${decision.compound.toLowerCase()}s.`
          : acknowledge(decision);
      if (!options.quiet || no) this.say(side, no ?? copy, !!no, decision.lap);
      if (no) {
        // Refusing a battle call, he makes his own move.
        if (decision.kind === 'battle') {
          const own = ownMove(
            side,
            ['dive-inside', 'round-outside', 'wait-drs', 'overtake-button'].includes(decision.move),
          );
          this.engine.apply({ lap: decision.lap, kind: 'battle', move: own, driver: true });
          this.dispatch({
            type: 'CALL',
            race: this.engine.state,
            decisions: this.engine.decisions,
          });
        }
        return;
      }
    }
    this.engine.apply(decision);
    this.dispatch({ type: 'CALL', race: this.engine.state, decisions: this.engine.decisions });
    if (decision.kind === 'teamOrder')
      this.say('Engineer', ORDER_COPY[decision.order], false, decision.lap);
  }

  private say(from: string, text: string, refused: boolean, lap: number): void {
    this.dispatch({ type: 'RADIO', message: { lap, from, text, refused } });
  }

  /** A radio line with no call behind it (an unanswered quick call). */
  radio(text: string): void {
    this.say('Engineer', text, false, this.engine.lap + 1);
  }

  setSpeed(speed: Speed): void {
    this.dispatch({ type: 'SET_SPEED', speed });
  }

  /** Move to submitting; then `submission()` builds the body and `finish()` takes the answer. */
  beginSubmit(): void {
    this.dispatch({ type: 'SUBMIT' });
  }

  /** The POST /api/runs body: the call log and each moment's claim, in lap order. */
  async submission(anonId: string): Promise<RunSubmission> {
    const grades = await this.allGraded();
    return {
      date: this.daily.date,
      anonId,
      decisions: this.engine.decisions,
      grades: this.state.moments.map((m) => (grades[m.id] as GradedMoment).claim),
    };
  }

  /** Show the results: the server's response, a practice run, or a failed submission. */
  finish(submission: Submission): void {
    this.dispatch({ type: 'RESULT', result: this.engine.result(), submission });
  }

  /** Today's run was already submitted: go straight to its results. */
  alreadyPlayed(response: RunResponse): void {
    this.dispatch({ type: 'ALREADY_PLAYED', response });
  }

  /** The game's own score from its grades (practice mode, or until the server answers). */
  localScore() {
    const calls = this.state.moments.flatMap((m) => {
      const graded = this.state.grades[m.id];
      const radio = this.engine.decisions.find((d) => d.kind === 'radio' && d.momentId === m.id) as
        | Extract<Decision, { kind: 'radio' }>
        | undefined;
      return graded && radio ? [{ grade: graded.grade, chosen: radio.optionId }] : [];
    });
    return scoreRun(calls);
  }

  /** Serialisable run: a run is fully defined by (model, seed, decisions); lap/phase let
   * resume land back on the exact same frame. */
  persist(): PersistedRun {
    return {
      date: this.daily.date,
      raceId: this.state.meta.raceId,
      seed: this.daily.seed,
      speed: this.state.speed,
      phase: this.state.phase,
      lap: this.engine.lap,
      decisions: this.engine.decisions,
      resolved: this.state.resolved,
      grades: this.state.grades,
      submission: this.state.submission,
    };
  }

  /** Rebuild a session from a saved run by replaying its decisions to the saved lap. Returns
   * null if the save is for a different race/day/seed. Deterministic, so it lands exactly.
   * Moments graded before the refresh keep their grades; any still missing are re-graded from
   * a replay to their pause. */
  static restore(daily: Daily, saved: PersistedRun, grader?: Grader): GameSession | null {
    if (
      saved.raceId !== daily.model.race.id ||
      saved.date !== daily.date ||
      saved.seed !== daily.seed
    ) {
      return null;
    }
    const engine = new GameEngine(daily.model, daily.seed, { decisions: saved.decisions });
    while (engine.lap < saved.lap && !engine.isFinished()) engine.step();

    const moments = decisionMoments(daily.model);
    const finished = engine.isFinished();
    // A save made mid-submit resumes at the finish, to submit again.
    const phase = saved.phase === 'submitting' ? 'finished' : saved.phase;
    const state: GameState = {
      phase,
      speed: saved.speed,
      race: engine.state as RaceState,
      moments,
      currentMoment: phase === 'decision' ? momentAt(moments, engine.lap, saved.resolved) : null,
      resolved: saved.resolved,
      decisions: engine.decisions,
      result: finished ? engine.result() : null,
      grades: saved.grades ?? {},
      submission:
        saved.submission && saved.submission.status !== 'sending'
          ? saved.submission
          : { status: daily.source === 'live' ? 'none' : 'practice' },
      meta: metaOf(daily),
      radio: [],
    };
    const session = new GameSession(daily, { engine, state, grader });
    for (const m of moments) {
      const reached = saved.resolved.includes(m.id) || state.currentMoment?.id === m.id;
      if (reached) session.startGrading(m, session.pausedAt(m, saved.decisions));
    }
    return session;
  }

  /** A replay paused before `moment`, holding only the calls made before that pause. */
  private pausedAt(moment: DecisionMoment, decisions: Decision[]): GameEngine {
    const known = decisions.filter((d) => (d.at as number) < moment.lap - 1);
    const engine = new GameEngine(this.daily.model, this.daily.seed, { decisions: known });
    while (engine.lap < moment.lap - 1) engine.step();
    return engine;
  }
}
