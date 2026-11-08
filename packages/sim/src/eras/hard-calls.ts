// Hard-call counter (eras build plan 1.5; eras spec §4, "Which driver the player runs").
//
// For each storyline driver (the race's userSide and its rival) the race is replayed from
// that driver's side: the model's userSide and rival are swapped, the moment finder lists the
// candidate moments, and the grader grades each from the real race's state. A moment counts
// as a hard call when it passes the moment finder's quality bar (verdict 'keep', so it is a
// moment the player would be offered) and its best two options are within HARD_CALL_EDGE
// (isHardCall). The Eras userSide is the driver with more hard calls.
//
// Tie rule ("the side whose real calls gave up the most chance"), defined exactly:
//   gaveUp(side) = Σ over every candidate moment from that side of
//                  max(0, bestOptionChance − realCallChance) × 100   (percentage points)
// where bestOptionChance is the highest chance of meeting the target among the moment's
// options and realCallChance is the chance of the real team's call at that lap: the matching
// option if one matches (realOptionId), otherwise the real call graded alongside the options
// on the same samples (common random numbers). Every candidate counts, not only kept ones:
// it measures the real calls across the race. The higher gaveUp wins the tie; if gaveUp also
// ties (within GAVE_UP_EPSILON), the race file's own userSide is kept, so the result is
// always deterministic.

import { GRADE_SAMPLES, type GradeOption, countHits, gradeFromHits } from '../grade.js';
import { type Verdict, candidateMoments, pauseAt, verdictFor } from '../moments.js';
import { realDecisions } from '../sim.js';
import type { RaceModel } from '../types.js';
import { ERAS_CONFIG, type ErasConfig, isHardCall } from './config.js';

/** Two gaveUp sums closer than this (percentage points) are a tie. */
export const GAVE_UP_EPSILON = 1e-9;

/** One graded moment from one side, reduced to what the counter needs. */
export interface SideMoment {
  lap: number;
  /** Chance of meeting the target (0–1) per option, as the moment finder offers them. */
  chances: Record<string, number>;
  /** The real call's chance (0–1). */
  realChance: number;
  verdict: Verdict;
}

export interface SideTally {
  hardCalls: number;
  /** Percentage points of chance the real calls gave up against the best option. */
  gaveUp: number;
}

export interface HardCallResult {
  hardCalls: Record<string, number>;
  gaveUp: Record<string, number>;
  userSide: string;
  /** How userSide was chosen. */
  decidedBy: 'hard-calls' | 'gave-up' | 'race-file';
}

/** The model seen from `driver`'s side: driver is the userSide and the other the rival. */
export function fromSide(model: RaceModel, driver: string): RaceModel {
  const storyline = [model.userSide, model.rival];
  if (!storyline.includes(driver))
    throw new Error(`fromSide: ${driver} is not a storyline driver (${storyline.join(', ')})`);
  if (driver === model.userSide) return model;
  return { ...model, userSide: model.rival, rival: model.userSide };
}

/** Grade every candidate moment from the model's userSide, with the real call's chance. */
export function gradeSide(model: RaceModel, samples = GRADE_SAMPLES): SideMoment[] {
  return candidateMoments(model).map((m) => {
    const run = pauseAt(model, m.lap);
    const real: GradeOption | null = m.realOptionId
      ? null
      : { id: 'real', decisions: realDecisions(model).filter((d) => d.lap === m.lap) };
    const graded = real ? [...m.options, real] : m.options;
    const hits = countHits(run, graded, m.target, 0, samples);
    const grade = gradeFromHits(
      m.lap,
      m.options,
      m.target,
      samples,
      hits.slice(0, m.options.length),
    );
    const chances = Object.fromEntries(grade.options.map((o) => [o.id, o.probability]));
    const realChance = real
      ? (hits[m.options.length] as number) / samples
      : (chances[m.realOptionId as string] as number);
    return { lap: m.lap, chances, realChance, verdict: verdictFor(grade) };
  });
}

/** Hard calls and chance given up over one side's graded moments. */
export function tallySide(moments: SideMoment[], config: ErasConfig = ERAS_CONFIG): SideTally {
  let hardCalls = 0;
  let gaveUp = 0;
  for (const m of moments) {
    const sorted = Object.values(m.chances).sort((a, b) => b - a);
    const best = sorted[0] ?? 0;
    const second = sorted[1] ?? 0;
    if (m.verdict === 'keep' && isHardCall((best - second) * 100, config)) hardCalls++;
    gaveUp += Math.max(0, best - m.realChance) * 100;
  }
  return { hardCalls, gaveUp };
}

/**
 * The Eras userSide from each storyline driver's tally: more hard calls; a tie goes to the
 * higher gaveUp; a tie on both keeps `fallback` (the race file's userSide).
 */
export function chooseUserSide(
  tallies: Record<string, SideTally>,
  fallback: string,
): Pick<HardCallResult, 'userSide' | 'decidedBy'> {
  const codes = Object.keys(tallies);
  if (codes.length !== 2) throw new Error(`chooseUserSide: need 2 sides, got ${codes.length}`);
  if (!codes.includes(fallback))
    throw new Error(`chooseUserSide: fallback ${fallback} is not one of ${codes.join(', ')}`);
  const [a, b] = codes as [string, string];
  const ta = tallies[a] as SideTally;
  const tb = tallies[b] as SideTally;
  if (ta.hardCalls !== tb.hardCalls)
    return { userSide: ta.hardCalls > tb.hardCalls ? a : b, decidedBy: 'hard-calls' };
  if (Math.abs(ta.gaveUp - tb.gaveUp) > GAVE_UP_EPSILON)
    return { userSide: ta.gaveUp > tb.gaveUp ? a : b, decidedBy: 'gave-up' };
  return { userSide: fallback, decidedBy: 'race-file' };
}

/** Count hard calls from both storyline drivers' sides and choose the Eras userSide. */
export function countHardCalls(
  model: RaceModel,
  samples = GRADE_SAMPLES,
  config: ErasConfig = ERAS_CONFIG,
): HardCallResult {
  const tallies: Record<string, SideTally> = {};
  for (const driver of [model.userSide, model.rival]) {
    tallies[driver] = tallySide(gradeSide(fromSide(model, driver), samples), config);
  }
  return {
    hardCalls: Object.fromEntries(Object.entries(tallies).map(([k, t]) => [k, t.hardCalls])),
    gaveUp: Object.fromEntries(Object.entries(tallies).map(([k, t]) => [k, t.gaveUp])),
    ...chooseUserSide(tallies, model.userSide),
  };
}
