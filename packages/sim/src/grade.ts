// Grader (Implementation Plan 2.7; product doc "Grading and scoring"). A call is graded on
// how it changed the chance of the target result, not on whether it worked: at a decision
// moment every option is played to the flag `samples` times from the current state, and
// each option's success rate is compared with the best option's.
//
// Common random numbers: sample i of every option forks the race with the same seed, so the
// options face identical luck and their difference is far less noisy at the same N. Seeds
// derive from the run's seed and the moment's lap, so the server reproduces every grade.
//
// Playouts don't know the future: events starting after the decision lap are replaced by
// SC/VSC periods drawn from base rates, and future retirements are dropped (forkRun's
// blindAfter). The race the player sees still has every real event.
//
// After an option's calls, the player's car follows a "sensible strategist" continuation in
// every playout: the model-planned best of no more stops or one stop (planRemainingStop), or,
// a car owing the race's minimum stops more than one (rules.minStops), the best plan of that
// many (planRemainingStops).
// The spec doesn't define the continuation; this choice is recorded in the implementation
// plan (2.7).
//
// Eras races (sim.ts erasRace: a race with a `rules` or `eras` block; never a Daily or
// Gauntlet file, so their grades are unchanged) differ in three ways (Eras grader fixes, Nov 8
// 2026; docs/eras-grader.md):
// - the continuation is the real team's plan (sim.ts erasContinuation), not the planner's best
//   stop: a "stay out" where the real team boxed doesn't get a perfect later stop for free;
//   the planner steps in only to keep the car legal (two compounds, minimum stops), and a
//   player's own logged plan is followed as called;
// - in a race with a fuel rule (refuelling, a 1984-88 fuel limit) playouts carry the fuel
//   load and the live tank (sim.ts forkRun), so a car can run dry and stop;
// - as everywhere, a playout's result is classified as live play's: a car short of the
//   two-compound rule or the minimum stops is disqualified (classify), and the live incident
//   draws (crashes, failures, punctures) run in playouts too. Storyline retirements and faults
//   still to come are left out (playouts don't know the future).

import type { RivalPolicy } from './eras/config.js';
import type { RivalChoice } from './rivals/react.js';
import { deriveSeed } from './rng.js';
import {
  type Run,
  classify,
  erasContinuation,
  erasRace,
  forkRun,
  initRun,
  isFinished,
  planRemainingStops,
  playerStopsBy,
  realDecisions,
  stepLap,
  teammateOf,
} from './sim.js';
import type { Decision, RaceModel, RaceResult } from './types.js';

export const GRADE_SAMPLES = 300;
export const GRADE_STREAM = 3000;

/** Band edges in percentage points behind the best option (tune on playtests). */
export const BAND_EDGES = { green: 0.5, yellow: 5, orange: 15 } as const;
export type Band = 'green' | 'yellow' | 'orange' | 'red';

/**
 * The result a call is graded against, from the player's side. `beat-rival`: ahead of
 * `rival` (default: the race's rival). `deny` (eras spec 6): `rival` finishes P`position`
 * or worse, or doesn't finish, whatever the player's car does. `team`: the player's car at
 * P`positions[0]` or better and its teammate at P`positions[1]` or better, both classified.
 */
export type Target =
  | { kind: 'win' }
  | { kind: 'beat-rival'; rival?: string }
  | { kind: 'position'; atBest: number }
  | { kind: 'deny'; rival: string; position: number }
  | { kind: 'team'; positions: [number, number] };

export interface GradeOption {
  id: string;
  /** The calls this option makes, for laps not yet run (empty = stay out / no change). */
  decisions: Decision[];
  /**
   * A whole race plan (planner.ts): its calls run to the flag and the sensible-strategist
   * continuation adds nothing (a no-stop plan stays a no-stop plan).
   */
  final?: boolean;
}

export interface OptionGrade {
  id: string;
  /** Share of samples that reached the target. */
  probability: number;
  /** Percentage points behind the best option (0 for the best). */
  behindBest: number;
  band: Band;
}

export interface MomentGrade {
  lap: number;
  samples: number;
  target: Target;
  best: string;
  options: OptionGrade[];
}

export function bandFor(behindBest: number): Band {
  if (behindBest <= BAND_EDGES.green) return 'green';
  if (behindBest <= BAND_EDGES.yellow) return 'yellow';
  if (behindBest <= BAND_EDGES.orange) return 'orange';
  return 'red';
}

export function reachedTarget(
  run: Pick<Run, 'model'>,
  result: RaceResult,
  target: Target,
): boolean {
  const user = run.model.userSide;
  const pos = result.order.indexOf(user);
  if (target.kind === 'win') return pos === 0 && result.finishers.includes(user);
  if (target.kind === 'position')
    return result.finishers.includes(user) && pos + 1 <= target.atBest;
  if (target.kind === 'deny') {
    // A rival that retired or was disqualified isn't a finisher: denied.
    if (!result.finishers.includes(target.rival)) return true;
    return result.order.indexOf(target.rival) + 1 >= target.position;
  }
  if (target.kind === 'team') {
    const mate = teammateOf(run.model);
    if (!mate) throw new Error(`team target: ${user} has no teammate in this race`);
    const [userAtBest, mateAtBest] = target.positions;
    return (
      result.finishers.includes(user) &&
      result.finishers.includes(mate) &&
      pos + 1 <= userAtBest &&
      result.order.indexOf(mate) + 1 <= mateAtBest
    );
  }
  const rivalPos = result.order.indexOf(target.rival ?? run.model.rival);
  return result.finishers.includes(user) && pos < rivalPos;
}

/**
 * The real team's call at this moment, as an option to grade alongside the player's: a stop
 * if the real team boxed on this lap (realDecisions), otherwise staying out.
 */
export function realOption(run: Run, lap: number): GradeOption {
  const calls = realDecisions(run.model).filter((d) => d.lap === lap);
  return { id: 'real', decisions: calls };
}

/** Seed of sample i at this moment: shared by every option (common random numbers). */
export function sampleSeed(run: Run, i: number): number {
  return deriveSeed(deriveSeed(run.seed, GRADE_STREAM + run.state.lap), i);
}

/** True if some option makes a pit call: the moment asks whether to stop. */
export function asksStop(options: readonly GradeOption[]): boolean {
  return options.some((o) => !o.final && o.decisions.some((d) => d.kind === 'pit'));
}

/**
 * Fork the run for one sample of one option: apply the option's calls, run until the last of
 * them has taken effect (a pit call is charged the lap after it), then hand the player's car
 * to the sensible-strategist continuation (planRemainingStops) for the rest of the race.
 */
export function playOption(
  run: Run,
  seed: number,
  option: GradeOption,
  stopQuestion = asksStop([option]),
): Run {
  // The decision lap's own events (e.g. the SC that prompted the call) are known; the rest of
  // the race's future isn't (spec decision Oct 26 2026: grade against the sim, not hindsight).
  const fork = forkRun(run, seed, option.decisions, { blindAfter: run.state.lap + 1 });
  const settled = Math.max(
    run.state.lap,
    ...option.decisions.map((d) => (d.kind === 'pit' ? d.lap + 1 : d.lap)),
  );
  while (fork.state.lap < settled && !isFinished(fork)) stepLap(fork);
  const user = fork.state.cars[fork.model.userSide];
  if (!option.final && user && !isFinished(fork)) {
    const queued = user.strategy.some((s) => s.lap > fork.state.lap);
    if (!erasRace(run.model)) {
      if (!queued)
        for (const stop of planRemainingStops(fork)) user.strategy.push({ ...stop, added: true });
    } else if (!fork.decisions.some((d) => d.kind === 'pit' && d.lap > fork.state.lap)) {
      // Eras: the real team's plan (erasContinuation), unless the player has logged a plan of
      // their own (its later pit calls are in the run and play out as called).
      // A stop question (some option boxes) answers the moment's box-now stop too: staying out
      // there skips it (the real team's stop on that lap isn't made later).
      // A stop already queued (the real call made the lap before the moment) stays, and the
      // remaining real stops follow it (erasContinuation).
      const answered = stopQuestion ? Math.max(settled, run.state.lap + 2) : settled;
      const made = playerStopsBy([...run.decisions, ...option.decisions], fork.state.lap);
      for (const stop of erasContinuation(fork, answered, made)) user.strategy.push(stop);
    }
  }
  return fork;
}

/**
 * Successes per option over samples [from, to). Sample i always uses sampleSeed(run, i), so
 * ranges can be counted separately (e.g. one per Web Worker) and summed exactly.
 */
export function countHits(
  run: Run,
  options: GradeOption[],
  target: Target,
  from: number,
  to: number,
): number[] {
  const hits = new Array<number>(options.length).fill(0);
  const stopQuestion = asksStop(options);
  for (let i = from; i < to; i++) {
    const seed = sampleSeed(run, i);
    for (let k = 0; k < options.length; k++) {
      const fork = playOption(run, seed, options[k] as GradeOption, stopQuestion);
      while (!isFinished(fork)) stepLap(fork);
      if (reachedTarget(fork, classify(fork), target)) hits[k] = (hits[k] ?? 0) + 1;
    }
  }
  return hits;
}

/** Turn per-option success counts into chances, bands and the best option. */
export function gradeFromHits(
  lap: number,
  options: GradeOption[],
  target: Target,
  samples: number,
  hits: number[],
): MomentGrade {
  const probs = hits.map((h) => h / samples);
  const bestP = Math.max(...probs);
  const bestIdx = probs.indexOf(bestP);
  return {
    lap,
    samples,
    target,
    best: (options[bestIdx] as GradeOption).id,
    options: options.map((o, k) => {
      const behindBest = (bestP - (probs[k] as number)) * 100;
      return { id: o.id, probability: probs[k] as number, behindBest, band: bandFor(behindBest) };
    }),
  };
}

/** Grade every option at the run's current lap (a live run paused at a decision moment). */
export function gradeMoment(
  run: Run,
  options: GradeOption[],
  target: Target,
  samples = GRADE_SAMPLES,
): MomentGrade {
  if (options.length === 0) throw new Error('no options to grade');
  return gradeFromHits(
    run.state.lap,
    options,
    target,
    samples,
    countHits(run, options, target, 0, samples),
  );
}

/**
 * A decision moment as plain JSON, for a Web Worker (spec D7): a live Run holds class
 * instances and Maps that don't survive structured cloning, so the worker rebuilds it from the
 * model, seed and calls (deterministically) and grades a range of samples.
 */
export interface GradeJob {
  model: RaceModel;
  /** The run's seed (Run.seed). */
  seed: number;
  /** All the player's calls so far (Run.decisions), including any for laps not yet run. */
  decisions: Decision[];
  /** The last completed lap: the run is paused here (Run.state.lap). */
  pausedAtLap: number;
  options: GradeOption[];
  target: Target;
  samples?: number;
  /** The run's rival policy (Run.rivalPolicy; absent: standard). */
  rivalPolicy?: RivalPolicy;
  /** Expert: the rival's choices so far (rivals/react.ts rivalChoices), replayed, not re-graded. */
  rivalChoices?: RivalChoice[];
  /** Legend difficulty (Run.legend): the run replays with Legend's safety cars. */
  legend?: boolean;
}

export interface GradeJobResult {
  from: number;
  to: number;
  hits: number[];
}

/** Describe a paused live run's decision moment as a GradeJob. */
export function gradeJob(
  run: Run,
  options: GradeOption[],
  target: Target,
  samples = GRADE_SAMPLES,
): GradeJob {
  return {
    model: run.model,
    seed: run.seed,
    decisions: [...run.decisions],
    pausedAtLap: run.state.lap,
    options,
    target,
    samples,
    ...(run.rivalPolicy === 'standard' ? {} : { rivalPolicy: run.rivalPolicy }),
    ...(run.legend ? { legend: true } : {}),
    ...(run.rival
      ? { rivalChoices: run.rival.points.map((p) => ({ lap: p.lap, option: p.chosen })) }
      : {}),
  };
}

/**
 * Rebuild the paused run from a job (deterministic replay), with the job's rival and, for a
 * Legend run, Legend's safety cars. An Expert
 * rival replays its recorded choices and never grades here: a decision point without one
 * waits (a decision at the paused lap stays pending for the rival's own grade job; an earlier
 * one throws).
 */
export function runFromJob(
  job: Pick<
    GradeJob,
    'model' | 'seed' | 'decisions' | 'pausedAtLap' | 'rivalPolicy' | 'rivalChoices' | 'legend'
  >,
): Run {
  const run = initRun(job.model, job.seed, {
    decisions: job.decisions,
    ...(job.rivalPolicy ? { rivalPolicy: job.rivalPolicy } : {}),
    ...(job.legend ? { legend: true } : {}),
    ...(job.rivalPolicy === 'expert'
      ? { rivalChoices: job.rivalChoices ?? [], rivalGrading: 'deferred' as const }
      : {}),
  });
  while (run.state.lap < job.pausedAtLap) stepLap(run);
  return run;
}

/**
 * Worker entry point: count successes for samples [from, to) of a job (default: all).
 * Inputs and outputs are plain JSON.
 */
export function runGradeJob(
  job: GradeJob,
  from = 0,
  to = job.samples ?? GRADE_SAMPLES,
): GradeJobResult {
  return { from, to, hits: countHits(runFromJob(job), job.options, job.target, from, to) };
}

/** Merge workers' ranges (which must cover 0..samples exactly once) into the moment's grade. */
export function mergeGradeJobs(job: GradeJob, results: GradeJobResult[]): MomentGrade {
  const samples = job.samples ?? GRADE_SAMPLES;
  const ranges = [...results].sort((a, b) => a.from - b.from);
  let next = 0;
  for (const r of ranges) {
    if (r.from !== next) throw new Error(`sample ranges must tile 0..${samples}`);
    next = r.to;
  }
  if (next !== samples) throw new Error(`sample ranges must tile 0..${samples}`);
  const hits = job.options.map((_, k) => ranges.reduce((sum, r) => sum + (r.hits[k] ?? 0), 0));
  return gradeFromHits(job.pausedAtLap, job.options, job.target, samples, hits);
}

/** Spec D5: points per call by band; a run's score is the mean over its graded calls. */
export const BAND_POINTS: Record<Band, number> = { green: 100, yellow: 70, orange: 40, red: 0 };

export interface CallScore {
  lap: number;
  optionId: string;
  band: Band;
  points: number;
  /** The chosen option's chance of the target (tie-break). */
  probability: number;
}

export interface RunScore {
  /** 0-100: mean band points over the race's calls. */
  score: number;
  calls: CallScore[];
  /** First tie-break: mean chance of the target over the chosen options. */
  meanProbability: number;
}

/**
 * Score a finished run from its graded moments and the option chosen at each. Ties on
 * `score` break on `meanProbability`, then on the finishing result (the caller's to compare).
 */
export function scoreRun(calls: Array<{ grade: MomentGrade; chosen: string }>): RunScore {
  const scored = calls.map(({ grade, chosen }) => {
    const option = grade.options.find((o) => o.id === chosen);
    if (!option) throw new Error(`option ${chosen} not graded at lap ${grade.lap}`);
    return {
      lap: grade.lap,
      optionId: chosen,
      band: option.band,
      points: BAND_POINTS[option.band],
      probability: option.probability,
    };
  });
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    score: mean(scored.map((c) => c.points)),
    calls: scored,
    meanProbability: mean(scored.map((c) => c.probability)),
  };
}
