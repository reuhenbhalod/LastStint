// Grading a versus race (docs/versus-spec.md V4): the winner is whoever is first past the flag
// (action spec A5); the strategy calls are graded as a breakdown. Each strategy call is graded as in solo (grade.ts): from the pause it was asked at, the race is
// played out many times with each option and the chance of finishing ahead of the other car is
// counted. The other car runs its real calls, all of them; the caller's later calls are
// replaced by a sensible continuation (one stop if it still owes one), so a call is graded on
// what it did, not on what came after. The future is unknown to the grade: random draws after
// the pause, and any SC or VSC not yet showing, are resampled for each sample (common random
// numbers across options).

import { type MomentGrade, type RunScore, bandFor, scoreRun } from './grade.js';
import { deriveSeed, mulberry32 } from './rng.js';
import { DRY_COMPOUNDS, lifeOf } from './sim.js';
import type { Compound, RaceModel } from './types.js';
import {
  type BattlePick,
  GRADED_KINDS,
  NEUTRAL_CHANCE,
  NEUTRAL_FROM,
  NEUTRAL_TO,
  type PlayerIndex,
  VERSUS_LAPS,
  type VersusCall,
  type VersusMoment,
  type VersusMomentKind,
  type VersusResult,
  type VersusRun,
  type VersusSetup,
  callVersus,
  classifyVersus,
  initVersus,
  stepVersus,
  versusCallsDue,
  versusFinished,
} from './versus.js';

export const VERSUS_GRADE_SAMPLES = 400;
const VERSUS_GRADE_STREAM = 9000;

/** A player's answer to a big call: the moment, and the option picked ('stay', 'box-HARD',
 * 'attack'...). */
export interface VersusAnswer {
  player: PlayerIndex;
  /** The lap the moment acted on (VersusMoment.lap). */
  lap: number;
  kind: VersusMomentKind;
  option: string;
}

/** A moment's options as graded: staying out and each dry tyre, or the three stances. */
export function versusOptions(moment: Pick<VersusMoment, 'options'>): string[] {
  return moment.options.flatMap((o) => (o === 'box' ? DRY_COMPOUNDS.map((c) => `box-${c}`) : [o]));
}

/** Whether `option` answers `moment`: one of its options, or (a battle) one with "+boost"
 * when the car has a boost to spend. */
export function validOption(
  moment: Pick<VersusMoment, 'options' | 'battle'>,
  option: string,
): boolean {
  const [base, extra] = option.split('+');
  if (!versusOptions(moment).includes(base as string)) return false;
  if (extra === undefined) return true;
  return extra === 'boost' && !!moment.battle?.canBoost;
}

/** The calls an option makes. */
export function optionCalls(player: PlayerIndex, lap: number, option: string): VersusCall[] {
  if (option.startsWith('box-'))
    return [{ player, lap, kind: 'pit', compound: option.slice(4) as Compound }];
  if (option === 'early' || option === 'normal')
    return [{ player, lap, kind: 'restart', jump: option }];
  if (option === 'stay') return [];
  const [pick, extra] = option.split('+');
  return [{ player, lap, kind: 'battle', pick: pick as BattlePick, boost: extra === 'boost' }];
}

/** The race paused before `lap` ran: every call made by then, the other player's all. */
function pausedAt(
  model: RaceModel,
  setup: VersusSetup,
  calls: VersusCall[],
  player: PlayerIndex,
  lap: number,
): VersusRun {
  const run = initVersus(model, setup);
  // The other car's calls all stand; the caller's own count up to (not including) this lap's.
  for (const c of calls) if (c.player !== player || c.lap < lap) callVersus(run, c);
  while (run.state.lap < lap - 1) {
    versusCallsDue(run);
    stepVersus(run);
  }
  return run;
}

/** One sample's copy of the paused race: a new random future (draws and any SC/VSC not yet
 * showing), the same for every option at this sample. */
function forkVersus(run: VersusRun, seed: number): VersusRun {
  const lap = run.state.lap;
  const known = new Map([...run.neutral].filter(([l]) => l <= lap + 1));
  const fork: VersusRun = {
    ...run,
    setup: { ...run.setup, seed },
    calls: [...run.calls],
    state: structuredClone(run.state),
    neutral: known,
    rng: new Map(),
    passedAt: [...run.passedAt] as [number, number],
    asked: new Set(run.asked),
  };
  // No SC or VSC yet (and none showing): it may still come, at the chance left for the laps
  // still in its window.
  if (known.size === 0) {
    const from = Math.max(NEUTRAL_FROM, lap + 2);
    const window = NEUTRAL_TO - NEUTRAL_FROM + 1;
    const left = Math.max(0, NEUTRAL_TO - from + 1);
    const gone = window - left;
    const chance = (NEUTRAL_CHANCE * left) / window / (1 - (NEUTRAL_CHANCE * gone) / window);
    const r = mulberry32(deriveSeed(seed, 1));
    if (left > 0 && r.next() < chance) {
      const at = from + Math.floor(r.next() * left);
      const n = run.headset.neutralization;
      const flag = r.next() < n.scPerLap / (n.scPerLap + n.vscPerLap) ? 'sc' : 'vsc';
      const laps = flag === 'sc' ? 3 + Math.floor(r.next() * 2) : n.vscLaps;
      for (let k = 0; k < laps && at + k <= VERSUS_LAPS; k++) fork.neutral.set(at + k, flag);
    }
  }
  return fork;
}

/** The caller's sensible continuation: a car that still owes its stop makes it when its tyres
 * run out (or at half distance of what's left), onto the hardest tyre that reaches the flag. */
function continueSensibly(run: VersusRun, player: PlayerIndex): void {
  const car = run.state.cars[player];
  const planned = run.calls.some(
    (c) => c.player === player && c.kind === 'pit' && c.lap >= run.state.lap,
  );
  const dry = new Set(
    car.compoundsUsed.filter((c) => (DRY_COMPOUNDS as readonly string[]).includes(c)),
  );
  if (planned || dry.size >= 2) return;
  const left = VERSUS_LAPS - run.state.lap;
  if (left < 2) return;
  const lifeLeft = Math.floor(lifeOf(run.model, car.compound) - car.tyreWear);
  const lap = run.state.lap + Math.max(1, Math.min(left - 1, lifeLeft, Math.ceil(left / 2)));
  const after = VERSUS_LAPS - lap;
  const others = DRY_COMPOUNDS.filter((c) => c !== car.compound && run.model.compounds[c]);
  const to =
    [...others].reverse().find((c) => lifeOf(run.model, c) >= after) ?? others.at(-1) ?? 'HARD';
  callVersus(run, { player, lap, kind: 'pit', compound: to });
}

function finishedAhead(result: VersusResult, player: PlayerIndex): boolean {
  return result.order[0] === player;
}

/** Grade one big call: each option's chance of finishing ahead of the other car. */
export function gradeVersusCall(
  model: RaceModel,
  setup: VersusSetup,
  calls: VersusCall[],
  answer: VersusAnswer,
  options: string[],
  samples = VERSUS_GRADE_SAMPLES,
): MomentGrade {
  const paused = pausedAt(model, setup, calls, answer.player, answer.lap);
  const hits = options.map(() => 0);
  for (let i = 0; i < samples; i++) {
    const seed = deriveSeed(deriveSeed(setup.seed, VERSUS_GRADE_STREAM + answer.lap), i);
    options.forEach((option, k) => {
      const fork = forkVersus(paused, seed);
      for (const c of optionCalls(answer.player, answer.lap, option)) callVersus(fork, c);
      while (!versusFinished(fork)) {
        // A stop takes effect the lap after its call: plan the continuation once it has.
        if (fork.state.lap >= answer.lap) continueSensibly(fork, answer.player);
        stepVersus(fork);
      }
      if (finishedAhead(classifyVersus(fork), answer.player)) hits[k] = (hits[k] ?? 0) + 1;
    });
  }
  const probs = hits.map((h) => h / samples);
  const bestP = Math.max(...probs);
  return {
    lap: answer.lap,
    samples,
    target: { kind: 'beat-rival' },
    best: options[probs.indexOf(bestP)] as string,
    options: options.map((id, k) => {
      const behindBest = (bestP - (probs[k] as number)) * 100;
      return { id, probability: probs[k] as number, behindBest, band: bandFor(behindBest) };
    }),
  };
}

export interface VersusScore {
  scores: [RunScore, RunScore];
  /** First past the flag (a car that never stopped is classified last). */
  winner: PlayerIndex;
  /** What decided it. */
  by: 'score' | 'chance' | 'road';
  road: VersusResult;
}

/**
 * Grade a finished versus race (the server's job, spec V4): every answered big call of both
 * players, then the winner. `answers` holds each player's answers in the order asked.
 */
export function gradeVersus(
  model: RaceModel,
  setup: VersusSetup,
  calls: VersusCall[],
  answers: VersusAnswer[],
  samples = VERSUS_GRADE_SAMPLES,
): VersusScore {
  const score = (player: PlayerIndex) =>
    scoreRun(
      answers
        .filter((a) => a.player === player && GRADED_KINDS.includes(a.kind))
        .map((a) => {
          const options = versusOptions({ options: ['box', 'stay'] });
          return {
            grade: gradeVersusCall(model, setup, calls, a, options, samples),
            chosen: a.option,
          };
        }),
    );
  const scores: [RunScore, RunScore] = [score(0), score(1)];
  const run = initVersus(model, setup, calls);
  while (!versusFinished(run)) stepVersus(run);
  const road = classifyVersus(run);
  // First past the flag wins (action spec A5); the calls are the breakdown.
  return { scores, winner: road.order[0] as PlayerIndex, by: 'road', road };
}
