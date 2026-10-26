// Grader (Implementation Plan 2.7; product doc "Grading and scoring"). A call is graded on
// how it changed the chance of the target result, not on whether it worked: at a decision
// moment every option is played to the flag `samples` times from the current state, and
// each option's success rate is compared with the best option's.
//
// Common random numbers: sample i of every option forks the race with the same seed, so the
// options face identical luck and their difference is far less noisy at the same N. Seeds
// derive from the run's seed and the moment's lap, so the server reproduces every grade.

import { deriveSeed } from './rng.js';
import { type Run, classify, forkRun, isFinished, stepLap } from './sim.js';
import type { Decision, RaceResult } from './types.js';

export const GRADE_SAMPLES = 300;
export const GRADE_STREAM = 3000;

/** Band edges in percentage points behind the best option (tune on playtests). */
export const BAND_EDGES = { green: 0.5, yellow: 5, orange: 15 } as const;
export type Band = 'green' | 'yellow' | 'orange' | 'red';

export type Target =
  | { kind: 'win' }
  | { kind: 'beat-rival' }
  | { kind: 'position'; atBest: number };

export interface GradeOption {
  id: string;
  /** The calls this option makes, for laps not yet run (empty = stay out / no change). */
  decisions: Decision[];
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

export function reachedTarget(run: Run, result: RaceResult, target: Target): boolean {
  const user = run.model.userSide;
  const pos = result.order.indexOf(user);
  if (target.kind === 'win') return pos === 0 && result.finishers.includes(user);
  if (target.kind === 'position')
    return result.finishers.includes(user) && pos + 1 <= target.atBest;
  const rivalPos = result.order.indexOf(run.model.rival);
  return result.finishers.includes(user) && pos < rivalPos;
}

/** Seed of sample i at this moment: shared by every option (common random numbers). */
export function sampleSeed(run: Run, i: number): number {
  return deriveSeed(deriveSeed(run.seed, GRADE_STREAM + run.state.lap), i);
}

/** Grade every option at the run's current lap (a live run paused at a decision moment). */
export function gradeMoment(
  run: Run,
  options: GradeOption[],
  target: Target,
  samples = GRADE_SAMPLES,
): MomentGrade {
  if (options.length === 0) throw new Error('no options to grade');
  const hits = new Array<number>(options.length).fill(0);
  for (let i = 0; i < samples; i++) {
    const seed = sampleSeed(run, i);
    options.forEach((option, k) => {
      const fork = forkRun(run, seed, option.decisions);
      while (!isFinished(fork)) stepLap(fork);
      if (reachedTarget(fork, classify(fork), target)) hits[k] = (hits[k] ?? 0) + 1;
    });
  }
  const probs = hits.map((h) => h / samples);
  const bestP = Math.max(...probs);
  const bestIdx = probs.indexOf(bestP);
  return {
    lap: run.state.lap,
    samples,
    target,
    best: (options[bestIdx] as GradeOption).id,
    options: options.map((o, k) => {
      const behindBest = (bestP - (probs[k] as number)) * 100;
      return { id: o.id, probability: probs[k] as number, behindBest, band: bandFor(behindBest) };
    }),
  };
}
