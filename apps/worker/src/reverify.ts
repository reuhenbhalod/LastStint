// Nightly re-grading of runs scored from claimed grades (beta spec B6). Grading is
// deterministic, so a run's full re-grade must equal what was stored; if it doesn't, the
// claimed grades were edited and the run gets its true score. Pure: the script
// (scripts/reverify.ts) does the D1 reads and writes.

import { EXPERT_SAMPLES, GRADE_SAMPLES, type RaceModel, verifyRun } from '@laststint/sim';
import {
  type EraAttemptResult,
  type RivalRegradeResult,
  attemptDifficulty,
  evaluateAttempt,
  regradeRival,
  rivalClaimsOf,
} from './erasEval.js';
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

// ---- Eras attempts (eras build plan 7.3) ------------------------------------------------------
//
// The same re-grade for Eras: each submitted, unverified attempt is evaluated again with full
// playouts (erasEval.ts evaluateAttempt without claimed grades). An Expert rival's claimed
// choices are re-graded first (erasEval.ts regradeRival): wrong ones are replaced by the
// choices the rival really makes. A match is marked verified. A mismatch means the claimed
// grades or the rival's claims were edited: the attempt gets its true result, and the player's
// progress on the race is rebuilt from all of their attempts there, so a star earned
// legitimately on another attempt is never lowered. An attempt the Worker stored unevaluated
// (before the server could replay its rival) is evaluated here.

/** A submitted, unverified Eras attempt with its era's play order, as the script reads it. */
export interface UnverifiedAttempt {
  id: string;
  player_id: string;
  race_id: string;
  legend: number;
  seed: number;
  play_order: number;
  decisions: string;
  rival_claims: string | null;
  untimed: number;
  /** Null for an attempt stored unevaluated. */
  result: string | null;
}

export interface AttemptRecheck {
  id: string;
  /** The stored result matched the full re-grade (and an Expert rival's claims were honest). */
  correct: boolean;
  /** The attempt had no stored result (it is evaluated for the first time). */
  pending: boolean;
  /** An Expert rival's re-graded claims (null for any other rival). */
  rival: Omit<RivalRegradeResult, 'choices'> | null;
  result: EraAttemptResult;
}

/**
 * Re-grade one attempt in full: an Expert rival's claims at `rivalSamples` playouts per
 * decision point (the game's grader), then every call at `samples`. A stored log that no
 * longer verifies (it did on submit, so only an edited row) throws.
 */
export function recheckAttempt(
  model: RaceModel,
  a: UnverifiedAttempt,
  samples = GRADE_SAMPLES,
  rivalSamples = EXPERT_SAMPLES,
): AttemptRecheck {
  const legend = a.legend === 1;
  const difficulty = attemptDifficulty(a.play_order, legend);
  const decisions = JSON.parse(a.decisions);
  const stored = a.rival_claims === null ? null : JSON.parse(a.rival_claims);
  const claims = rivalClaimsOf(difficulty.rivalPolicy, stored);
  const regraded = claims
    ? regradeRival(model, a.seed, decisions, claims, legend, rivalSamples)
    : null;
  const result = evaluateAttempt({
    model,
    seed: a.seed,
    legend,
    difficulty,
    decisions,
    grades: undefined,
    rivalClaims: regraded ? regraded.choices : null,
    untimed: a.untimed === 1,
    samples,
  });
  const rival = regraded
    ? { honest: regraded.honest, wrong: regraded.wrong, error: regraded.error }
    : null;
  return {
    id: a.id,
    correct: a.result !== null && JSON.stringify(result) === a.result && (rival?.honest ?? true),
    pending: a.result === null,
    rival,
    result,
  };
}

/**
 * The statements that record an Eras re-check. A correct attempt is marked verified. Otherwise
 * the attempt takes its true result, then the race's progress (normal or Legend, as the
 * attempt) is rebuilt from every attempt of the player's there, and its history book entry
 * follows the player's first attempt that really rewrote the race.
 */
export function recheckAttemptSql(
  r: AttemptRecheck,
  a: UnverifiedAttempt,
  now = new Date().toISOString(),
): string[] {
  if (r.correct) return [`UPDATE era_attempts SET verified = 1 WHERE id = ${sql(r.id)};`];
  const res = r.result;
  const mine = `player_id = ${sql(a.player_id)} AND race_id = ${sql(a.race_id)}`;
  const same = `${mine} AND legend = ${a.legend} AND result IS NOT NULL`;
  const best = (path: string) =>
    `coalesce((SELECT max(json_extract(result, '${path}')) FROM era_attempts WHERE ${same}), 0)`;
  return [
    `UPDATE era_attempts SET verified = 1, corrected = ${r.pending ? 0 : 1}, accuracy = ${
      res.accuracy
    }, result = ${sql(JSON.stringify(res))} WHERE id = ${sql(r.id)};`,
    `INSERT INTO era_progress (player_id, race_id, legend, updated_at) VALUES (${sql(
      a.player_id,
    )}, ${sql(a.race_id)}, ${a.legend}, ${sql(now)}) ON CONFLICT DO NOTHING;`,
    `UPDATE era_progress SET star_result = ${best('$.stars.result')}, star_strategist = ${best(
      '$.stars.strategist',
    )}, star_mastery = ${best('$.stars.mastery')}, best_accuracy = (SELECT max(accuracy) FROM era_attempts WHERE ${same}), updated_at = ${sql(
      now,
    )} WHERE ${mine} AND legend = ${a.legend};`,
    // The hidden objective counts with all three stars (erasEval.ts PROGRESS_UPSERT): it stays
    // done while some attempt met it, and this attempt's true result can complete it.
    `UPDATE era_progress SET hidden_done = CASE WHEN star_result = 1 AND star_strategist = 1 AND star_mastery = 1 AND (hidden_done = 1 OR ${
      res.hidden ? 1 : 0
    } = 1) AND ${best('$.hidden')} = 1 THEN 1 ELSE 0 END WHERE ${mine} AND legend = ${a.legend};`,
    ...(res.rewrite ? [] : [`DELETE FROM history_entries WHERE attempt_id = ${sql(r.id)};`]),
    `INSERT OR IGNORE INTO history_entries (player_id, race_id, attempt_id, achieved_at)
     SELECT player_id, race_id, id, submitted_at FROM era_attempts
     WHERE ${mine} AND result IS NOT NULL AND json_extract(result, '$.rewrite') = 1
     ORDER BY submitted_at, id LIMIT 1;`,
  ];
}
