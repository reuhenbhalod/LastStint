// The grader turned round for the rival (eras spec §7, Expert: "at each decision point it runs
// the grader for itself and takes the best option"; its target is finishing ahead of the
// player). react.ts calls it at Expert's decision points with rules.ts rivalOptions; the
// RivalGradeJob below runs the same count in the background grading Web Workers.
//
// It follows the player's grader (grade.ts) so the two are comparable:
// - common random numbers: sample i of every option forks with the same seed, derived from
//   the run's seed and the lap (on its own stream), so a server replay reproduces it;
// - blind playouts: events after the decision lap are sampled, not the real ones, and the
//   rival in them is Smart (sim.ts forkRun, policy.ts playoutPolicy: no grading inside grading);
// - the user's car runs only what the rival can see (its calls already charged or under way)
//   and then the sensible-strategist continuation (planRemainingStops; in an Eras race the real
//   team's plan, sim.ts erasContinuation, as the player's grader uses). The player's later calls
//   are dropped: live, the client doesn't have them yet, and a server replay has them all, so
//   reading them would both cheat and make the client and server disagree.

import { GRADE_SAMPLES, type GradeJob, type GradeJobResult, runFromJob } from '../grade.js';
import { deriveSeed } from '../rng.js';
import {
  type Run,
  classify,
  erasContinuation,
  erasRace,
  forkRun,
  isFinished,
  planRemainingStops,
  playerStopsBy,
  stepLap,
} from '../sim.js';
import type { PitStop, RaceResult } from '../types.js';
import { EXPERT_SAMPLES, RivalPolicyError } from './policy.js';
import type { RivalChoice } from './react.js';

/** The rival's grader seeds: its own stream, so they never equal a player's grade's. */
export const RIVAL_GRADE_STREAM = 3500;

export interface RivalOption {
  id: string;
  /** The rival's planned stops from the next lap on, if it takes this option. */
  stops: PitStop[];
}

export interface RivalGrade {
  lap: number;
  samples: number;
  /** The option with the best chance (the first on a tie). */
  best: string;
  /** Each option's share of samples in which the rival finished ahead of the user. */
  probabilities: Record<string, number>;
}

/** Seed of sample i of the rival's call after `run.state.lap` (shared by every option). */
export function rivalSampleSeed(run: Run, i: number): number {
  return deriveSeed(deriveSeed(run.seed, RIVAL_GRADE_STREAM + run.state.lap), i);
}

/** The rival finished ahead of the user (a user who didn't finish counts as behind). */
export function rivalAhead(run: Run, result: RaceResult): boolean {
  const { userSide, rival } = run.model;
  if (!result.finishers.includes(rival)) return false;
  if (!result.finishers.includes(userSide)) return true;
  return result.order.indexOf(rival) < result.order.indexOf(userSide);
}

/** Fork the run for one sample of one of the rival's options, ready to play to the flag. */
export function rivalPlayout(run: Run, seed: number, option: RivalOption): Run {
  if (!run.live) throw new Error('the rival grades only a live run');
  for (const s of option.stops) {
    if (!Number.isInteger(s.lap) || s.lap <= run.state.lap || s.lap > run.model.race.laps)
      throw new Error(`rival option ${option.id}: stop on lap ${s.lap}`);
    if (!run.model.compounds[s.to]) throw new Error(`rival option ${option.id}: no ${s.to}`);
  }
  const fork = forkRun(run, seed, [], { blindAfter: run.state.lap + 1 });
  fork.decisions = [];
  const user = fork.state.cars[fork.model.userSide];
  if (user && !user.retired && !user.strategy.some((s) => s.lap > fork.state.lap)) {
    // An Eras race: the player's car keeps to the real team's plan, as in the player's grader.
    const stops = erasRace(fork.model)
      ? erasContinuation(fork, fork.state.lap, playerStopsBy(run.decisions, fork.state.lap))
      : planRemainingStops(fork).map((stop) => ({ ...stop, added: true }));
    for (const stop of stops) user.strategy.push(stop);
  }
  const rival = fork.state.cars[fork.model.rival];
  if (rival) rival.strategy = option.stops.map((s) => ({ ...s }));
  return fork;
}

/** Samples [from, to) in which each option's rival finished ahead of the user. */
export function countRivalHits(
  run: Run,
  options: RivalOption[],
  from: number,
  to: number,
): number[] {
  const hits = new Array<number>(options.length).fill(0);
  for (let i = from; i < to; i++) {
    const seed = rivalSampleSeed(run, i);
    for (let k = 0; k < options.length; k++) {
      const fork = rivalPlayout(run, seed, options[k] as RivalOption);
      while (!isFinished(fork)) stepLap(fork);
      if (rivalAhead(fork, classify(fork))) hits[k] = (hits[k] ?? 0) + 1;
    }
  }
  return hits;
}

/** Grade the rival's options at the run's current lap. */
export function gradeRivalMoment(
  run: Run,
  options: RivalOption[],
  samples = GRADE_SAMPLES,
): RivalGrade {
  if (options.length === 0) throw new Error('no rival options to grade');
  if (!Number.isInteger(samples) || samples < 1)
    throw new Error(`samples must be a positive integer, got ${samples}`);
  return gradeFromHits(run.state.lap, options, samples, countRivalHits(run, options, 0, samples));
}

/**
 * Expert's decision as plain JSON, for a background grading Web Worker (as grade.ts GradeJob):
 * the worker rebuilds the run paused at the decision (runFromJob, replaying the rival's earlier
 * choices), recomputes the point's options (deterministic) and counts a range of samples.
 */
export interface RivalGradeJob {
  model: GradeJob['model'];
  seed: number;
  /** All the player's calls so far (Run.decisions). */
  decisions: GradeJob['decisions'];
  /** The decision lap (Run.state.lap, with the decision pending). */
  pausedAtLap: number;
  /** The rival's choices before this one (react.ts rivalChoices). */
  rivalChoices: RivalChoice[];
  samples: number;
  /** Legend difficulty (Run.legend): the run replays with Legend's safety cars. */
  legend?: boolean;
}

/** Describe a run's pending Expert decision (rivalGrading 'deferred') as a RivalGradeJob. */
export function rivalGradeJob(
  run: Run,
  samples = run.rival?.samples ?? EXPERT_SAMPLES,
): RivalGradeJob {
  const pending = run.rival?.pending;
  if (!pending || pending.lap !== run.state.lap)
    throw new RivalPolicyError('no rival decision is waiting at this lap');
  return {
    model: run.model,
    seed: run.seed,
    decisions: [...run.decisions],
    pausedAtLap: run.state.lap,
    rivalChoices: (run.rival?.points ?? []).map((p) => ({ lap: p.lap, option: p.chosen })),
    samples,
    ...(run.legend ? { legend: true } : {}),
  };
}

/** The pending decision's run and options, rebuilt from a job. */
function pendingFromJob(job: RivalGradeJob) {
  const run = runFromJob({ ...job, rivalPolicy: 'expert' });
  const pending = run.rival?.pending;
  if (!pending || pending.lap !== job.pausedAtLap)
    throw new RivalPolicyError(`no rival decision after lap ${job.pausedAtLap} in this job`);
  return { run, options: pending.options };
}

/** Worker entry point: the rival's hits per option for samples [from, to) (plain JSON). */
export function runRivalGradeJob(job: RivalGradeJob, from = 0, to = job.samples): GradeJobResult {
  const { run, options } = pendingFromJob(job);
  return { from, to, hits: countRivalHits(run, options, from, to) };
}

/** Merge workers' ranges (which must tile 0..samples) into the rival's grade. */
export function mergeRivalGradeJobs(job: RivalGradeJob, results: GradeJobResult[]): RivalGrade {
  const { options } = pendingFromJob(job);
  const ranges = [...results].sort((a, b) => a.from - b.from);
  let next = 0;
  for (const r of ranges) {
    if (r.from !== next) throw new Error(`sample ranges must tile 0..${job.samples}`);
    next = r.to;
  }
  if (next !== job.samples) throw new Error(`sample ranges must tile 0..${job.samples}`);
  const hits = options.map((_, k) => ranges.reduce((sum, r) => sum + (r.hits[k] ?? 0), 0));
  return gradeFromHits(job.pausedAtLap, options, job.samples, hits);
}

function gradeFromHits(
  lap: number,
  options: RivalOption[],
  samples: number,
  hits: number[],
): RivalGrade {
  const probabilities: Record<string, number> = {};
  let best = 0;
  hits.forEach((h, k) => {
    probabilities[(options[k] as RivalOption).id] = h / samples;
    if (h > (hits[best] as number)) best = k;
  });
  return { lap, samples, best: (options[best] as RivalOption).id, probabilities };
}
