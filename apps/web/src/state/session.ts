// GameSession: the headless driver that connects the mutable sim engine to the pure state
// machine. It decides when to pause (at the race's approved decision moments), grades each
// moment off-thread as it pauses, advances the engine lap by lap, applies the player's calls,
// and serialises/resumes a run. The React layer (useGame) wraps it with timers and the
// network; this class is fully testable headless.

import { type Decision, type DecisionMoment, type RaceState, scoreRun } from '@boxthislap/sim';
import type { RunResponse, RunSubmission } from '../data/api.js';
import { attitudeOf } from '../data/drivers.js';
import type { Daily } from '../data/types.js';
import { GameEngine, decisionMoments } from '../engine/engine.js';
import { type GradedMoment, type Grader, gradedFromHits, inlineGrader } from '../engine/grading.js';
import { autoStay } from '../game/autoStay.js';
import { acknowledge, respond } from '../game/refusal.js';
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
    // Just stopped: the wall stays out without asking (game/autoStay.ts).
    const stay = autoStay(moment, this.engine.decisions);
    if (stay) {
      this.dispatch({
        type: 'RADIO',
        message: {
          lap: moment.lap,
          from: 'Engineer',
          text: 'We’ve just stopped. Staying out.',
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
    this.sync();
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
   * A standing-mode flip or BOX call mid-lap; never pauses. The driver answers by attitude
   * (game/refusal.ts): a refused call is not applied, so it never reaches the call log; a
   * questioned one waits for `confirm`. A call already booked for the coming lap is ignored.
   * An answer to a quick call (`asked`: the driver or engineer asked for the order) and a
   * confirmed question are always followed.
   */
  call(decision: Decision, options: { asked?: boolean; confirmed?: boolean } = {}): void {
    if (this.state.phase !== 'racing') return;
    if (decision.kind === 'pit' || decision.kind === 'mode') {
      const side = this.state.meta.userSide;
      const car = this.engine.state.cars[side];
      if (!car || car.retired) return;
      const booked = this.engine.decisions.some(
        (d) =>
          d.lap === decision.lap &&
          d.kind === decision.kind &&
          (d.kind === 'pit' ||
            (decision.kind === 'mode' && d.kind === 'mode' && d.key === decision.key)),
      );
      if (booked) return;
      const answer =
        options.asked || options.confirmed
          ? ({ kind: 'ok' } as const)
          : respond(this.daily.seed, this.engine.lap, decision, car, attitudeOf(side));
      if (answer.kind === 'question') {
        this.dispatch({ type: 'QUESTION', question: { decision, text: answer.text } });
        this.say(side, answer.text, false, decision.lap);
        return;
      }
      if (this.state.question) this.dispatch({ type: 'QUESTION', question: null });
      const no = answer.kind === 'refuse';
      this.say(side, no ? answer.text : acknowledge(decision), no, decision.lap);
      if (no) return;
    }
    this.engine.apply(decision);
    this.dispatch({ type: 'CALL', race: this.engine.state, decisions: this.engine.decisions });
  }

  /** The wall's answer to a questioned call: do it (on the coming lap) or drop it. */
  confirm(yes: boolean): void {
    const q = this.state.question;
    if (!q) return;
    this.dispatch({ type: 'QUESTION', question: null });
    if (yes) this.call({ ...q.decision, lap: this.engine.lap + 1 }, { confirmed: true });
    else this.say('Engineer', 'Okay, forget it. Stay as you are.', false, this.engine.lap + 1);
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
