// Survivor mode (docs/survivor-spec.md): races back to back from the survivor pool until the
// first loss. The server deals each race and its seed (one of the race's tuned seeds, at
// random), so a run can't be re-rolled; each race is verified from its call log like a daily
// (the result is replayed exactly; the score uses the game's claimed grades, re-graded nightly).
//
//   POST /api/survivor/start               { anonId } -> the run and its first race
//   GET  /api/survivor/:runId?anonId=      the run as it stands (to resume after a refresh)
//   POST /api/survivor/:runId/round        { anonId, round, decisions, grades } -> won or lost,
//                                          and the next race or the run's summary
//   GET  /api/survivor/leaderboard         the best runs, all time and this week

import { GRADE_SAMPLES, type RaceModel, VerifyError, verifyRun } from '@laststint/sim';
import { displayName } from './names.js';
import { DISPLAY_NAME, NOT_HIDDEN } from './players.js';
import { SURVIVOR_POOL } from './pools.js';
import { getRace } from './races.js';
import { type StoredResult, stored } from './results.js';
import { ApiError, isAnonId } from './runs.js';

const WEEK_MS = 7 * 24 * 3600 * 1000;
export const SURVIVOR_BOARD = 50;

interface RunRow {
  id: string;
  anon_id: string;
  status: 'live' | 'over';
  rounds: number;
  score_sum: number;
  started_at: string;
  ended_at: string | null;
}

interface RoundRow {
  run_id: string;
  round: number;
  race_id: string;
  seed: number;
  model_hash: string;
  score: number | null;
  won: number | null;
  finish_position: number | null;
  result: string | null;
}

/** A race to play: what the game loads. */
export interface SurvivorRace {
  round: number;
  raceId: string;
  seed: number;
}

export interface SurvivorRound {
  round: number;
  raceId: string;
  won: boolean;
  score: number;
  finishPosition: number;
}

export interface SurvivorState {
  runId: string;
  status: 'live' | 'over';
  rounds: number;
  meanScore: number;
  /** The race to play now (a live run). */
  current: SurvivorRace | null;
  history: SurvivorRound[];
  /** Over: where the run ranks all time (1-based) and of how many. */
  rank?: number;
  total?: number;
}

function randomInt(n: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] as number) % n;
}

/**
 * The next race for a run: any survivor race the run hasn't played, at random (once all are
 * played, any but the last one), with one of its seeds at random.
 */
export function dealRace(
  played: string[],
  pool: Readonly<Record<string, number[]>> = SURVIVOR_POOL,
): { raceId: string; seed: number } {
  const all = Object.keys(pool);
  if (all.length === 0) throw new ApiError(503, 'no-survivor-races', 'no survivor races yet');
  let left = all.filter((id) => !played.includes(id));
  if (left.length === 0) left = all.filter((id) => id !== played.at(-1));
  if (left.length === 0) left = all;
  const raceId = left[randomInt(left.length)] as string;
  const seeds = pool[raceId] as number[];
  return { raceId, seed: seeds[randomInt(seeds.length)] as number };
}

/** Won: finished, not disqualified, ahead of the rival (the goal of a beat or defend race). */
export function wonRace(model: RaceModel, order: string[], disqualified: boolean): boolean {
  if (disqualified) return false;
  const me = order.indexOf(model.userSide);
  const rival = order.indexOf(model.rival);
  return me >= 0 && (rival < 0 || me < rival);
}

type Pool = Readonly<Record<string, number[]>>;

async function addRound(
  db: D1Database,
  runId: string,
  round: number,
  played: string[],
  pool: Pool,
) {
  const { raceId, seed } = dealRace(played, pool);
  const race = await getRace(raceId);
  if (!race) throw new ApiError(503, 'model-missing', `race ${raceId} is not bundled`);
  await db
    .prepare(
      'INSERT INTO survivor_rounds (run_id, round, race_id, seed, model_hash) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(runId, round, raceId, seed, race.hash)
    .run();
  return { round, raceId, seed };
}

async function getRun(db: D1Database, runId: string, anonId: string): Promise<RunRow> {
  const run = await db
    .prepare('SELECT * FROM survivor_runs WHERE id = ?')
    .bind(runId)
    .first<RunRow>();
  if (!run || run.anon_id !== anonId) throw new ApiError(404, 'no-run');
  return run;
}

async function rounds(db: D1Database, runId: string): Promise<RoundRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM survivor_rounds WHERE run_id = ? ORDER BY round')
    .bind(runId)
    .all<RoundRow>();
  return results;
}

async function rankOf(db: D1Database, run: RunRow): Promise<{ rank: number; total: number }> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM survivor_runs WHERE rounds > ?1
            OR (rounds = ?1 AND score_sum > ?2)) AS ahead,
         (SELECT COUNT(*) FROM survivor_runs) AS total`,
    )
    .bind(run.rounds, run.score_sum)
    .first<{ ahead: number; total: number }>();
  return { rank: (row?.ahead ?? 0) + 1, total: row?.total ?? 1 };
}

export async function survivorState(db: D1Database, run: RunRow): Promise<SurvivorState> {
  const rows = await rounds(db, run.id);
  const open = rows.find((r) => r.won === null);
  const state: SurvivorState = {
    runId: run.id,
    status: run.status,
    rounds: run.rounds,
    meanScore: run.rounds ? run.score_sum / run.rounds : 0,
    current:
      run.status === 'live' && open
        ? { round: open.round, raceId: open.race_id, seed: open.seed }
        : null,
    history: rows
      .filter((r) => r.won !== null)
      .map((r) => ({
        round: r.round,
        raceId: r.race_id,
        won: r.won === 1,
        score: r.score ?? 0,
        finishPosition: r.finish_position ?? 0,
      })),
  };
  if (run.status === 'over') Object.assign(state, await rankOf(db, run));
  return state;
}

export async function startRun(db: D1Database, body: unknown, now: number, pool: Pool) {
  const { anonId } = (body ?? {}) as Record<string, unknown>;
  if (!isAnonId(anonId)) throw new ApiError(400, 'bad-request', 'anonId must be a UUID');
  const id = crypto.randomUUID();
  const at = new Date(now).toISOString();
  await db
    .prepare('INSERT INTO survivor_runs (id, anon_id, started_at) VALUES (?, ?, ?)')
    .bind(id, anonId, at)
    .run();
  await addRound(db, id, 1, [], pool);
  return survivorState(db, await getRun(db, id, anonId));
}

export async function getState(db: D1Database, runId: string, anonId: unknown) {
  if (!isAnonId(anonId)) throw new ApiError(400, 'bad-request', 'anonId must be a UUID');
  return survivorState(db, await getRun(db, runId, anonId));
}

/** Verify a finished race of a run; on a win deal the next one, on a loss end the run. */
export async function submitRound(
  db: D1Database,
  runId: string,
  body: unknown,
  now: number,
  pool: Pool,
) {
  const { anonId, round, decisions, grades } = (body ?? {}) as Record<string, unknown>;
  if (!isAnonId(anonId)) throw new ApiError(400, 'bad-request', 'anonId must be a UUID');
  const run = await getRun(db, runId, anonId);
  if (run.status !== 'live') throw new ApiError(409, 'run-over');
  const rows = await rounds(db, runId);
  const open = rows.find((r) => r.won === null);
  if (!open || open.round !== round) throw new ApiError(409, 'wrong-round');
  const race = await getRace(open.race_id);
  if (!race || race.hash !== open.model_hash) {
    throw new ApiError(503, 'model-changed', 'this race changed since the run started');
  }

  let result: StoredResult;
  try {
    const v = verifyRun(race.model, open.seed, decisions, GRADE_SAMPLES, grades ?? null);
    result = stored(
      { date: run.started_at.slice(0, 10), number: open.round, race_id: open.race_id },
      v,
    );
  } catch (e) {
    if (e instanceof VerifyError) throw new ApiError(400, e.code, e.message);
    throw e;
  }
  const won = wonRace(race.model, result.result.order, result.disqualified);
  const at = new Date(now).toISOString();
  // Only an open round is written: a second submit of the same round finds it closed.
  const write = await db
    .prepare(
      `UPDATE survivor_rounds SET decisions = ?, grades = ?, score = ?, won = ?,
         finish_position = ?, result = ?, submitted_at = ?
       WHERE run_id = ? AND round = ? AND won IS NULL`,
    )
    .bind(
      JSON.stringify(decisions),
      JSON.stringify(grades ?? []),
      result.score,
      won ? 1 : 0,
      result.finishPosition,
      JSON.stringify(result),
      at,
      runId,
      open.round,
    )
    .run();
  if (!write.meta.changes) throw new ApiError(409, 'wrong-round');

  if (won) {
    await db
      .prepare(
        'UPDATE survivor_runs SET rounds = rounds + 1, score_sum = score_sum + ? WHERE id = ?',
      )
      .bind(result.score, runId)
      .run();
    await addRound(
      db,
      runId,
      open.round + 1,
      rows.map((r) => r.race_id),
      pool,
    );
  } else {
    await db
      .prepare("UPDATE survivor_runs SET status = 'over', ended_at = ? WHERE id = ?")
      .bind(at, runId)
      .run();
  }
  return { won, result, state: await survivorState(db, await getRun(db, runId, anonId)) };
}

export async function survivorBoard(db: D1Database, now: number) {
  const top = async (since: string | null) => {
    const { results } = await db
      .prepare(
        `SELECT anon_id, rounds, score_sum, status, started_at,
                ${DISPLAY_NAME('survivor_runs.anon_id')} AS name FROM survivor_runs
         WHERE rounds > 0 AND ${NOT_HIDDEN('survivor_runs.anon_id')}
           ${since ? 'AND started_at >= ?' : ''}
         ORDER BY rounds DESC, score_sum DESC, started_at LIMIT ${SURVIVOR_BOARD}`,
      )
      .bind(...(since ? [since] : []))
      .all<{
        anon_id: string;
        rounds: number;
        score_sum: number;
        status: string;
        started_at: string;
        name: string;
      }>();
    return results.map((r, i) => ({
      rank: i + 1,
      name: r.name || displayName(r.anon_id),
      rounds: r.rounds,
      meanScore: r.rounds ? Math.round((r.score_sum / r.rounds) * 10) / 10 : 0,
      live: r.status === 'live',
      date: r.started_at.slice(0, 10),
    }));
  };
  return {
    allTime: await top(null),
    week: await top(new Date(now - WEEK_MS).toISOString()),
  };
}
