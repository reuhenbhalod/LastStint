// D1 access (migrations 0001-0004). Every query the API runs lives here (accounts and
// streaks: players.ts).

import { DISPLAY_NAME, NOT_HIDDEN, SAME_PLAYER } from './players.js';

export interface DailyRow {
  date: string;
  number: number;
  race_id: string;
  seed: number;
  side: string;
  model_hash: string;
}

export interface RunRow {
  id: string;
  date: string;
  anon_id: string;
  score: number;
  mean_probability: number;
  finish_position: number;
  disqualified: number;
  result: string;
  created_at: string;
}

export interface NewCall {
  momentId: string;
  optionId: string;
  band: string;
  matchedReal: boolean;
}

export function getDaily(db: D1Database, date: string): Promise<DailyRow | null> {
  return db
    .prepare('SELECT date, number, race_id, seed, side, model_hash FROM daily WHERE date = ?')
    .bind(date)
    .first<DailyRow>();
}

/** The player's run for a date: this anonId's, or any browser's linked to the same account. */
export function getRun(db: D1Database, date: string, anonId: string): Promise<RunRow | null> {
  return db
    .prepare(
      `SELECT * FROM runs WHERE date = ?1 AND anon_id IN ${SAME_PLAYER(2)}
       ORDER BY created_at LIMIT 1`,
    )
    .bind(date, anonId)
    .first<RunRow>();
}

/** Store a verified run and its calls in one batch. Throws on a duplicate (date, anon_id). */
export async function insertRun(
  db: D1Database,
  run: Omit<RunRow, 'disqualified'> & { disqualified: boolean; decisions: string; grades: string },
  calls: NewCall[],
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO runs (id, date, anon_id, decisions, score, result, created_at,
           mean_probability, finish_position, disqualified, grades)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        run.id,
        run.date,
        run.anon_id,
        run.decisions,
        run.score,
        run.result,
        run.created_at,
        run.mean_probability,
        run.finish_position,
        run.disqualified ? 1 : 0,
        run.grades,
      ),
    ...calls.map((c) =>
      db
        .prepare(
          `INSERT INTO run_calls (run_id, date, moment_id, option_id, band, matched_real)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(run.id, run.date, c.momentId, c.optionId, c.band, c.matchedReal ? 1 : 0),
    ),
  ]);
}

export function isUniqueViolation(e: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((e as Error)?.message ?? e));
}

export interface Standing {
  total: number;
  /** Runs that scored strictly lower. */
  lower: number;
  /**
   * Runs ranked ahead: higher score, then the tie-breaks (Phase 4 spec, "Percentile and rank"),
   * and finally insertion order (rowid) for runs stored in the same millisecond.
   */
  ahead: number;
}

export async function standing(db: D1Database, run: RunRow): Promise<Standing> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM runs WHERE date = ?1) AS total,
         (SELECT COUNT(*) FROM runs WHERE date = ?1 AND score < ?2) AS lower,
         (SELECT COUNT(*) FROM runs WHERE date = ?1 AND
            (-score, -mean_probability, finish_position, created_at, rowid)
              < (-?2, -?3, ?4, ?5, (SELECT rowid FROM runs WHERE id = ?6))) AS ahead`,
    )
    .bind(run.date, run.score, run.mean_probability, run.finish_position, run.created_at, run.id)
    .first<Standing>();
  return row ?? { total: 0, lower: 0, ahead: 0 };
}

export const LEADERBOARD_SIZE = 100;

export async function leaderboard(
  db: D1Database,
  date: string,
): Promise<Array<{ anon_id: string; score: number; name: string }>> {
  const { results } = await db
    .prepare(
      `SELECT anon_id, score, ${DISPLAY_NAME('runs.anon_id')} AS name FROM runs
       WHERE date = ? AND ${NOT_HIDDEN('runs.anon_id')}
       ORDER BY score DESC, mean_probability DESC, finish_position, created_at, rowid
       LIMIT ${LEADERBOARD_SIZE}`,
    )
    .bind(date)
    .all<{ anon_id: string; score: number; name: string }>();
  return results;
}

export async function dailyStats(db: D1Database, date: string) {
  const [scores, calls] = await db.batch([
    db
      .prepare(
        'SELECT score, COUNT(*) AS runs FROM runs WHERE date = ? GROUP BY score ORDER BY score',
      )
      .bind(date),
    db
      .prepare(
        `SELECT moment_id, option_id, COUNT(*) AS runs FROM run_calls WHERE date = ?
         GROUP BY moment_id, option_id`,
      )
      .bind(date),
  ]);
  return {
    scores: (scores?.results ?? []) as Array<{ score: number; runs: number }>,
    calls: (calls?.results ?? []) as Array<{ moment_id: string; option_id: string; runs: number }>,
  };
}

/** Scheduled dates from `from` on (ascending), for the queue check. */
export async function scheduledFrom(db: D1Database, from: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT date FROM daily WHERE date >= ? ORDER BY date LIMIT 400')
    .bind(from)
    .all<{ date: string }>();
  return results.map((r) => r.date);
}
