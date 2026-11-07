// Nightly re-grading of runs scored from claimed grades (beta spec B6). Grading is
// deterministic, so a run's full re-grade must equal what was stored; if it doesn't, the
// claimed grades were edited and the run gets its true score. Pure: the script
// (scripts/reverify.ts) does the D1 reads and writes.

import { GRADE_SAMPLES, type RaceModel, verifyRun } from '@laststint/sim';
import { type StoredResult, stored } from './results.js';

/** An unverified run joined with its daily, as the script reads it from D1. */
export interface UnverifiedRun {
  id: string;
  date: string;
  number: number;
  race_id: string;
  seed: number;
  decisions: string;
  result: string;
}

export interface Recheck {
  id: string;
  /** The stored result matched the full re-grade. */
  correct: boolean;
  /** The full re-grade's result (what the run should store). */
  result: StoredResult;
}

export function recheckRun(model: RaceModel, run: UnverifiedRun, samples = GRADE_SAMPLES): Recheck {
  const full = verifyRun(model, run.seed, JSON.parse(run.decisions), samples);
  const result = stored(run, full);
  return { id: run.id, correct: JSON.stringify(result) === run.result, result };
}

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** The statements that record a re-check: mark it verified, and fix the score if it was off. */
export function recheckSql(r: Recheck): string[] {
  if (r.correct) return [`UPDATE runs SET verified = 1 WHERE id = ${sql(r.id)};`];
  const res = r.result;
  return [
    `UPDATE runs SET verified = 1, corrected = 1, score = ${res.score}, mean_probability = ${
      res.meanProbability
    }, finish_position = ${res.finishPosition}, disqualified = ${res.disqualified ? 1 : 0}, result = ${sql(
      JSON.stringify(res),
    )} WHERE id = ${sql(r.id)};`,
    ...res.calls.map(
      (c) =>
        `UPDATE run_calls SET band = ${sql(c.band)}, matched_real = ${c.matchedReal ? 1 : 0} WHERE run_id = ${sql(
          r.id,
        )} AND moment_id = ${sql(c.momentId)};`,
    ),
  ];
}
