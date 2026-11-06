// POST /api/runs: verify a finished run from its call log and rank it (Phase 4 spec,
// "Verifying a run" and "Percentile and rank"). The client sends calls, never a score.
// On the free plan (10 ms CPU) the run is scored from the grades the game claims, checked for
// shape; a nightly job re-grades it with full playouts (scripts/reverify.ts, beta spec B6).

import { GRADE_SAMPLES, type VerifiedRun, VerifyError, verifyRun } from '@boxthislap/sim';
import { isDate, isSubmittable } from './dates.js';
import {
  type DailyRow,
  type RunRow,
  getDaily,
  getRun,
  insertRun,
  isUniqueViolation,
  standing,
} from './db.js';
import { getRace } from './races.js';
import { type StoredResult, stored } from './results.js';

export type { CallResult, StoredResult } from './results.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAnonId(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}

export interface RunResponse extends StoredResult {
  runId: string;
  /** Share of the day's runs that scored strictly lower, 0-100. */
  percentile: number;
  rank: number;
  total: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ?? code);
  }
}

/** The day's daily and its pinned race model; refuses a model that changed since scheduling. */
export async function dailyWithModel(db: D1Database, date: string) {
  const daily = await getDaily(db, date);
  if (!daily) throw new ApiError(404, 'no-daily', `no daily for ${date}`);
  const race = await getRace(daily.race_id);
  if (!race || race.hash !== daily.model_hash) {
    console.error(`daily ${date}: race ${daily.race_id} model changed since it was scheduled`);
    throw new ApiError(503, 'model-changed', 'this daily is unavailable');
  }
  return { daily, race };
}

export async function withStanding(db: D1Database, row: RunRow): Promise<RunResponse> {
  const s = await standing(db, row);
  return {
    ...(JSON.parse(row.result) as StoredResult),
    runId: row.id,
    percentile: s.total ? Math.floor((s.lower * 100) / s.total) : 0,
    rank: s.ahead + 1,
    total: s.total,
  };
}

export async function submitRun(db: D1Database, body: unknown, now: number): Promise<RunResponse> {
  const { date, anonId, decisions, grades } = (body ?? {}) as Record<string, unknown>;
  if (!isDate(date)) throw new ApiError(400, 'bad-request', 'date must be YYYY-MM-DD');
  if (!isAnonId(anonId)) throw new ApiError(400, 'bad-request', 'anonId must be a UUID');
  if (!isSubmittable(date, now)) throw new ApiError(404, 'no-daily', `${date} is not playable now`);
  const { daily, race } = await dailyWithModel(db, date);
  if (await getRun(db, date, anonId)) throw new ApiError(409, 'already-submitted');

  let verified: VerifiedRun;
  try {
    verified = verifyRun(race.model, daily.seed, decisions, GRADE_SAMPLES, grades ?? null);
  } catch (e) {
    if (e instanceof VerifyError) throw new ApiError(400, e.code, e.message);
    throw e;
  }

  const result = stored(daily, verified);
  const row: RunRow = {
    id: crypto.randomUUID(),
    date,
    anon_id: anonId,
    score: result.score,
    mean_probability: result.meanProbability,
    finish_position: result.finishPosition,
    disqualified: result.disqualified ? 1 : 0,
    result: JSON.stringify(result),
    created_at: new Date(now).toISOString(),
  };
  try {
    await insertRun(
      db,
      {
        ...row,
        disqualified: result.disqualified,
        decisions: JSON.stringify(decisions),
        grades: JSON.stringify(grades),
      },
      result.calls.map((c) => ({
        momentId: c.momentId,
        optionId: c.chosen,
        band: c.band,
        matchedReal: c.matchedReal,
      })),
    );
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, 'already-submitted');
    throw e;
  }
  return withStanding(db, row);
}
