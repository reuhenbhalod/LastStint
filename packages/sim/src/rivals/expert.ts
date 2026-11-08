// The grader turned round for the rival (eras spec §7, Expert: "takes the best option for
// itself at each of its own decision points, using the grader"). The mechanism only: given
// the rival's options at a paused live run, the share of playouts each one finishes ahead of
// the user. No policy calls it yet (policy.ts RIVAL_POLICY_GAPS: Expert's decision points,
// options and target are undefined); scripts/bench-rival.ts measures what it would cost.
//
// It follows the player's grader (grade.ts) so the two are comparable:
// - common random numbers: sample i of every option forks with the same seed, derived from
//   the run's seed and the lap (on its own stream), so a server replay reproduces it;
// - blind playouts: events after the decision lap are sampled, not the real ones;
// - the user's car runs only what the rival can see (its calls already charged or under way)
//   and then the sensible-strategist continuation (planRemainingStop). The player's later calls
//   are dropped: live, the client doesn't have them yet, and a server replay has them all, so
//   reading them would both cheat and make the client and server disagree.

import { GRADE_SAMPLES } from '../grade.js';
import { deriveSeed } from '../rng.js';
import { type Run, classify, forkRun, isFinished, planRemainingStop, stepLap } from '../sim.js';
import type { PitStop, RaceResult } from '../types.js';

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
    if (!Number.isInteger(s.lap) || s.lap <= run.state.lap || s.lap >= run.model.race.laps)
      throw new Error(`rival option ${option.id}: stop on lap ${s.lap}`);
    if (!run.model.compounds[s.to]) throw new Error(`rival option ${option.id}: no ${s.to}`);
  }
  const fork = forkRun(run, seed, [], { blindAfter: run.state.lap + 1 });
  fork.decisions = [];
  const user = fork.state.cars[fork.model.userSide];
  if (user && !user.retired && !user.strategy.some((s) => s.lap > fork.state.lap)) {
    const stop = planRemainingStop(fork);
    if (stop) user.strategy.push({ ...stop, added: true });
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
  const hits = countRivalHits(run, options, 0, samples);
  const probabilities: Record<string, number> = {};
  let best = 0;
  hits.forEach((h, k) => {
    probabilities[(options[k] as RivalOption).id] = h / samples;
    if (h > (hits[best] as number)) best = k;
  });
  return { lap: run.state.lap, samples, best: (options[best] as RivalOption).id, probabilities };
}
