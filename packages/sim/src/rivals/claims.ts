// The server's check of an Expert race (eras spec §7, "Server check"; the claimed-grades
// pattern): the client submits the option the rival took at each of its decision points
// (react.ts rivalChoices), and the server replays the attempt with them instead of re-grading
// 100 samples per point. Each claim must be one of the legal options at a real decision point
// of that replay, and every decision point must have one; the nightly job re-grades in full
// (regradeRivalPoints) and flags attempts whose claims the grader wouldn't have picked.
// Pure and deterministic: the same race, seed, calls and claims give the same race.

import { type Run, classify, initRun, isFinished, stepLap } from '../sim.js';
import type { Decision, RaceModel, RaceResult } from '../types.js';
import { gradeRivalMoment } from './expert.js';
import {
  type RivalChoice,
  RivalClaimError,
  type RivalPoint,
  type RivalRunState,
  resolveRivalDecision,
} from './react.js';
import type { RivalOptionId } from './rules.js';

/** The verified replay of an Expert race from its claims. */
export interface RivalClaimReplay {
  run: Run;
  result: RaceResult;
  /** Every decision point, with its legal options and the claimed choice. */
  points: RivalPoint[];
}

/**
 * Replay an Expert race with the claimed rival choices: throws RivalClaimError when a claim is
 * malformed or duplicated ('bad-claim', 'duplicate-claim'), names an option that isn't legal
 * at its point ('illegal-option'), is for a lap that isn't one of the rival's decision points
 * ('not-a-decision-point'), or a decision point has no claim ('missing-claim'). Errors in the
 * player's calls throw as initRun does. `incidents`, `legend`: as RunOptions (a Legend attempt
 * replays with Legend's safety cars).
 */
export function replayWithRivalClaims(
  model: RaceModel,
  seed: number,
  decisions: Decision[],
  claims: RivalChoice[],
  options: { incidents?: boolean; legend?: boolean } = {},
): RivalClaimReplay {
  const run = initRun(model, seed, {
    decisions,
    rivalPolicy: 'expert',
    rivalChoices: claims,
    rivalGrading: 'claims',
    ...(options.incidents === undefined ? {} : { incidents: options.incidents }),
    ...(options.legend === undefined ? {} : { legend: options.legend }),
  });
  while (!isFinished(run)) stepLap(run);
  const state = run.rival as RivalRunState;
  const unused = [...state.claims.keys()].sort((a, b) => a - b);
  if (unused.length)
    throw new RivalClaimError(
      'not-a-decision-point',
      `rival choices after laps ${unused.join(', ')}, which are not its decision points`,
    );
  return { run, result: classify(run), points: state.points };
}

/** One re-graded decision point (the nightly job). */
export interface RivalRegrade {
  lap: number;
  claimed: RivalOptionId;
  best: RivalOptionId;
  probabilities: Partial<Record<RivalOptionId, number>>;
}

/**
 * The nightly re-grade: replay with the claims, and at each decision point grade the options
 * as the client should have (same seeds, so an honest claim is the grader's best).
 */
export function regradeRivalPoints(
  model: RaceModel,
  seed: number,
  decisions: Decision[],
  claims: RivalChoice[],
  options: { incidents?: boolean; legend?: boolean; samples?: number } = {},
): RivalRegrade[] {
  const replay = replayWithRivalClaims(model, seed, decisions, claims, options);
  const claimed = new Map(replay.points.map((p) => [p.lap, p.chosen]));
  const run = initRun(model, seed, {
    decisions,
    rivalPolicy: 'expert',
    rivalGrading: 'deferred',
    ...(options.incidents === undefined ? {} : { incidents: options.incidents }),
    ...(options.legend === undefined ? {} : { legend: options.legend }),
  });
  const samples = options.samples ?? (run.rival as RivalRunState).samples;
  const out: RivalRegrade[] = [];
  while (!isFinished(run)) {
    stepLap(run);
    const pending = run.rival?.pending;
    if (!pending) continue;
    const choice = claimed.get(pending.lap);
    if (!choice)
      throw new Error(`the re-grade found a decision after lap ${pending.lap} the replay didn't`);
    const grade = gradeRivalMoment(run, pending.options, samples);
    out.push({
      lap: pending.lap,
      claimed: choice,
      best: grade.best as RivalOptionId,
      probabilities: grade.probabilities,
    });
    resolveRivalDecision(run, choice, grade.probabilities);
  }
  return out;
}
