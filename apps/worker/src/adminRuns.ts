// The admin page's Runs tab (docs/admin-v2-spec.md A3): find runs by date, player or mode, see
// a run's calls with their grades, mark runs for the nightly re-check, and delete a daily run.
//
//   GET  /api/admin/runs?date=&player=&mode=    newest first, RUNS_LIMIT at most
//        date: YYYY-MM-DD (UTC; default today unless a player is given), player: a name,
//        email, player ID or anonId, mode: daily / gauntlet / eras (default all three)
//   GET  /api/admin/runs/:mode/:id              one run, with its calls (and Gauntlet rounds)
//   POST /api/admin/runs/reverify               { mode, id } one run, or { date, mode? } every
//                                               run submitted that day (UTC) in every mode, or
//                                               just `mode`: verified = 0, so the nightly
//                                               check (scripts/reverify.ts) grades it again
//   POST /api/admin/runs/delete                 { id }: a daily run and its calls
//
// A Gauntlet "run" is the whole run (survivor_runs) with its rounds; an Eras run is one
// submitted attempt (era_attempts).

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import { logStatement } from './adminLog.js';
import { isDate, todayUtc } from './dates.js';
import { getErasRace } from './eras.js';
import type { Env } from './index.js';
import { displayName } from './names.js';
import { getRace } from './races.js';
import { ApiError } from './runs.js';

export const RUNS_LIMIT = 200;
export const RUN_MODES = ['daily', 'gauntlet', 'eras'] as const;
export type RunMode = (typeof RUN_MODES)[number];

export interface AdminRun {
  mode: RunMode;
  id: string;
  /** The daily's date, or the day a Gauntlet started / an attempt was submitted (UTC). */
  date: string;
  at: string;
  raceId: string;
  raceName: string;
  /** The browser (daily, Gauntlet) or player ID (Eras) the run is stored under. */
  playerKey: string;
  /** The account behind it, if signed in. */
  player: { id: string; name: string; email: string } | null;
  /** What the board shows: a leaderboard name, or the generated one. */
  name: string;
  /** Daily score, Gauntlet mean score, or Eras accuracy (0-100). */
  score: number | null;
  /** In words: "P1", "3 rounds", "2 stars". */
  result: string;
  verified: boolean;
  corrected: boolean;
  disqualified: boolean;
}

export interface AdminCall {
  momentId: string;
  lap: number;
  chosen: string;
  band: string;
  points: number | null;
  best: string;
  real: string | null;
  matchedReal: boolean;
}

interface Who {
  key: string;
  player_id: string | null;
  player_name: string | null;
  player_email: string | null;
  display_name: string | null;
}

/** SQL columns naming the account behind `col` (an anonId or a player ID). */
const WHO = (col: string) => `${col} AS key,
  (SELECT p.id FROM player_ids l JOIN players p ON p.id = l.player_id WHERE l.anon_id = ${col}) AS player_id,
  (SELECT p.name FROM player_ids l JOIN players p ON p.id = l.player_id WHERE l.anon_id = ${col}) AS player_name,
  (SELECT p.email FROM player_ids l JOIN players p ON p.id = l.player_id WHERE l.anon_id = ${col}) AS player_email,
  (SELECT p.display_name FROM player_ids l JOIN players p ON p.id = l.player_id WHERE l.anon_id = ${col}) AS display_name`;

/**
 * SQL: `col` belongs to a player matching the search (?N): their player ID, an anonId linked
 * to them, or a name, leaderboard name or email containing it.
 */
const MATCHES = (col: string, n: number) => `(${col} = ?${n} OR ${col} IN (
  SELECT l.anon_id FROM player_ids l JOIN players p ON p.id = l.player_id
   WHERE p.id = ?${n} OR p.id = (SELECT player_id FROM player_ids WHERE anon_id = ?${n})
      OR instr(lower(p.email), lower(?${n})) > 0 OR instr(lower(p.name), lower(?${n})) > 0
      OR instr(lower(p.display_name), lower(?${n})) > 0))`;

function whoOf(r: Who): Pick<AdminRun, 'playerKey' | 'player' | 'name'> {
  return {
    playerKey: r.key,
    player: r.player_id
      ? { id: r.player_id, name: r.player_name ?? '', email: r.player_email ?? '' }
      : null,
    name: r.display_name || displayName(r.key),
  };
}

async function raceName(raceId: string): Promise<string> {
  return (await getErasRace(raceId))?.model.race.name ?? raceId;
}

function parse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function callsOf(result: string | null): AdminCall[] {
  const r = parse<{ calls?: Array<Record<string, unknown>> }>(result);
  return (r?.calls ?? []).map((c) => ({
    momentId: String(c.momentId ?? ''),
    lap: Number(c.lap ?? 0),
    chosen: String(c.chosen ?? ''),
    band: String(c.band ?? ''),
    points: typeof c.points === 'number' ? c.points : null,
    best: String(c.best ?? ''),
    real: ((c.real as { optionId?: string | null } | undefined)?.optionId ?? null) as string | null,
    matchedReal: !!c.matchedReal,
  }));
}

function starsOf(result: string | null): number {
  const s = parse<{ stars?: Record<string, boolean> }>(result)?.stars ?? {};
  return (s.result ? 1 : 0) + (s.strategist ? 1 : 0) + (s.mastery ? 1 : 0);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface DailyRow extends Who {
  id: string;
  date: string;
  created_at: string;
  race_id: string | null;
  score: number;
  finish_position: number;
  verified: number;
  corrected: number;
  disqualified: number;
  result: string;
}

async function dailyRun(r: DailyRow): Promise<AdminRun> {
  const raceId = r.race_id ?? parse<{ raceId?: string }>(r.result)?.raceId ?? '';
  return {
    mode: 'daily',
    id: r.id,
    date: r.date,
    at: r.created_at,
    raceId,
    raceName: (await getRace(raceId))?.model.race.name ?? raceId,
    ...whoOf(r),
    score: r.score,
    result: r.disqualified ? 'Disqualified' : `P${r.finish_position}`,
    verified: r.verified === 1,
    corrected: r.corrected === 1,
    disqualified: r.disqualified === 1,
  };
}

interface GauntletRow extends Who {
  id: string;
  status: string;
  rounds: number;
  score_sum: number;
  started_at: string;
  races: string | null;
  unverified: number;
  corrected: number;
}

function gauntletRun(r: GauntletRow): AdminRun {
  return {
    mode: 'gauntlet',
    id: r.id,
    date: r.started_at.slice(0, 10),
    at: r.started_at,
    raceId: '',
    raceName: r.races ?? '',
    ...whoOf(r),
    score: r.rounds ? Math.round((r.score_sum / r.rounds) * 10) / 10 : null,
    result: `${plural(r.rounds, 'round')}${r.status === 'live' ? ', still live' : ''}`,
    verified: r.unverified === 0,
    corrected: r.corrected > 0,
    disqualified: false,
  };
}

interface ErasRow extends Who {
  id: string;
  race_id: string;
  legend: number;
  accuracy: number | null;
  result: string | null;
  submitted_at: string;
  verified: number;
  corrected: number;
}

async function erasRun(r: ErasRow): Promise<AdminRun> {
  const stars = starsOf(r.result);
  const dq = !!parse<{ disqualified?: boolean }>(r.result)?.disqualified;
  return {
    mode: 'eras',
    id: r.id,
    date: r.submitted_at.slice(0, 10),
    at: r.submitted_at,
    raceId: r.race_id,
    raceName: await raceName(r.race_id),
    ...whoOf(r),
    score: r.accuracy,
    result: `${plural(stars, 'star')}${r.legend ? ', Legend' : ''}`,
    verified: r.verified === 1,
    corrected: r.corrected === 1,
    disqualified: dq,
  };
}

const DAILY_SELECT = (who: string) => `SELECT r.id, r.date, r.created_at, r.score,
  r.finish_position, r.verified, r.corrected, r.disqualified, r.result,
  (SELECT race_id FROM daily d WHERE d.date = r.date) AS race_id, ${WHO(who)}
  FROM runs r`;

const GAUNTLET_SELECT = `SELECT s.id, s.status, s.rounds, s.score_sum, s.started_at,
  (SELECT group_concat(race_id, ', ') FROM survivor_rounds x WHERE x.run_id = s.id) AS races,
  (SELECT COUNT(*) FROM survivor_rounds x
    WHERE x.run_id = s.id AND x.submitted_at IS NOT NULL AND x.verified = 0) AS unverified,
  (SELECT COUNT(*) FROM survivor_rounds x WHERE x.run_id = s.id AND x.corrected = 1) AS corrected,
  ${WHO('s.anon_id')}
  FROM survivor_runs s`;

const ERAS_SELECT = `SELECT a.id, a.race_id, a.legend, a.accuracy, a.result, a.submitted_at,
  a.verified, a.corrected, ${WHO('a.player_id')}
  FROM era_attempts a`;

export interface RunSearch {
  date?: string;
  player?: string;
  mode?: RunMode;
}

/** Runs matching the search, newest first (RUNS_LIMIT at most across the modes). */
export async function searchRuns(db: D1Database, q: RunSearch): Promise<AdminRun[]> {
  const modes = q.mode ? [q.mode] : RUN_MODES;
  const out: AdminRun[] = [];
  const binds: string[] = [];
  const where = (dateExpr: string, col: string) => {
    const parts: string[] = [];
    binds.length = 0;
    if (q.date) {
      binds.push(q.date);
      parts.push(`${dateExpr} = ?${binds.length}`);
    }
    if (q.player) {
      binds.push(q.player);
      parts.push(MATCHES(col, binds.length));
    }
    return parts.length ? parts.join(' AND ') : '1 = 1';
  };
  if (modes.includes('daily')) {
    const w = where('r.date', 'r.anon_id');
    const { results } = await db
      .prepare(
        `${DAILY_SELECT('r.anon_id')} WHERE ${w} ORDER BY r.created_at DESC LIMIT ${RUNS_LIMIT}`,
      )
      .bind(...binds)
      .all<DailyRow>();
    for (const r of results) out.push(await dailyRun(r));
  }
  if (modes.includes('gauntlet')) {
    const w = where('substr(s.started_at, 1, 10)', 's.anon_id');
    const { results } = await db
      .prepare(`${GAUNTLET_SELECT} WHERE ${w} ORDER BY s.started_at DESC LIMIT ${RUNS_LIMIT}`)
      .bind(...binds)
      .all<GauntletRow>();
    out.push(...results.map(gauntletRun));
  }
  if (modes.includes('eras')) {
    const w = where('substr(a.submitted_at, 1, 10)', 'a.player_id');
    const { results } = await db
      .prepare(
        `${ERAS_SELECT} WHERE a.submitted_at IS NOT NULL AND ${w}
         ORDER BY a.submitted_at DESC LIMIT ${RUNS_LIMIT}`,
      )
      .bind(...binds)
      .all<ErasRow>();
    for (const r of results) out.push(await erasRun(r));
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, RUNS_LIMIT);
}

export interface RunDetail {
  run: AdminRun;
  calls: AdminCall[];
  /** Gauntlet only: each round's race, score and calls. */
  rounds?: Array<{
    round: number;
    raceId: string;
    raceName: string;
    score: number | null;
    won: boolean | null;
    verified: boolean;
    corrected: boolean;
    calls: AdminCall[];
  }>;
}

export async function runDetail(db: D1Database, mode: RunMode, id: string): Promise<RunDetail> {
  if (mode === 'daily') {
    const r = await db
      .prepare(`${DAILY_SELECT('r.anon_id')} WHERE r.id = ?`)
      .bind(id)
      .first<DailyRow>();
    if (!r) throw new ApiError(404, 'no-run');
    return { run: await dailyRun(r), calls: callsOf(r.result) };
  }
  if (mode === 'eras') {
    const r = await db
      .prepare(`${ERAS_SELECT} WHERE a.id = ? AND a.submitted_at IS NOT NULL`)
      .bind(id)
      .first<ErasRow>();
    if (!r) throw new ApiError(404, 'no-run');
    return { run: await erasRun(r), calls: callsOf(r.result) };
  }
  const r = await db.prepare(`${GAUNTLET_SELECT} WHERE s.id = ?`).bind(id).first<GauntletRow>();
  if (!r) throw new ApiError(404, 'no-run');
  const { results } = await db
    .prepare(
      `SELECT round, race_id, score, won, result, verified, corrected FROM survivor_rounds
       WHERE run_id = ? ORDER BY round`,
    )
    .bind(id)
    .all<{
      round: number;
      race_id: string;
      score: number | null;
      won: number | null;
      result: string | null;
      verified: number;
      corrected: number;
    }>();
  const rounds = [];
  for (const x of results) {
    rounds.push({
      round: x.round,
      raceId: x.race_id,
      raceName: (await getRace(x.race_id))?.model.race.name ?? x.race_id,
      score: x.score,
      won: x.won === null ? null : x.won === 1,
      verified: x.verified === 1,
      corrected: x.corrected === 1,
      calls: callsOf(x.result),
    });
  }
  return { run: gauntletRun(r), calls: [], rounds };
}

/** Mark runs for the nightly re-check (verified = 0). Returns how many rows changed. */
export async function reverify(
  db: D1Database,
  email: string,
  target: { mode: RunMode; id: string } | { date: string; mode?: RunMode },
): Promise<{ marked: number }> {
  if ('date' in target) {
    const day = (mode: RunMode) =>
      mode === 'daily'
        ? db.prepare('UPDATE runs SET verified = 0 WHERE date = ?').bind(target.date)
        : db
            .prepare(
              `UPDATE ${mode === 'gauntlet' ? 'survivor_rounds' : 'era_attempts'} SET verified = 0
               WHERE submitted_at IS NOT NULL AND substr(submitted_at, 1, 10) = ?`,
            )
            .bind(target.date);
    const modes = target.mode ? [target.mode] : [...RUN_MODES];
    const done = await db.batch(modes.map(day));
    const marked = done.reduce((n, res) => n + (res.meta.changes ?? 0), 0);
    await logStatement(db, email, 'reverify', { ...target, marked }).run();
    return { marked };
  }
  const stmt =
    target.mode === 'daily'
      ? db.prepare('UPDATE runs SET verified = 0 WHERE id = ?').bind(target.id)
      : target.mode === 'gauntlet'
        ? db
            .prepare(
              'UPDATE survivor_rounds SET verified = 0 WHERE run_id = ? AND submitted_at IS NOT NULL',
            )
            .bind(target.id)
        : db
            .prepare(
              'UPDATE era_attempts SET verified = 0 WHERE id = ? AND submitted_at IS NOT NULL',
            )
            .bind(target.id);
  const [res] = await db.batch([stmt]);
  const marked = res?.meta.changes ?? 0;
  await logStatement(db, email, 'reverify', { ...target, marked }).run();
  return { marked };
}

/** Delete one daily run and its calls. */
export async function deleteDailyRun(db: D1Database, email: string, id: string) {
  const run = await db
    .prepare('SELECT id, date, anon_id, score FROM runs WHERE id = ?')
    .bind(id)
    .first<{ id: string; date: string; anon_id: string; score: number }>();
  if (!run) throw new ApiError(404, 'no-run');
  await db.batch([
    db.prepare('DELETE FROM run_calls WHERE run_id = ?').bind(id),
    db.prepare('DELETE FROM runs WHERE id = ?').bind(id),
    logStatement(db, email, 'delete-run', {
      id,
      date: run.date,
      anonId: run.anon_id,
      score: run.score,
    }),
  ]);
  return { deleted: id };
}

const isMode = (m: unknown): m is RunMode =>
  typeof m === 'string' && (RUN_MODES as readonly string[]).includes(m);

export function registerAdminRuns(app: Hono<{ Bindings: Env }>) {
  const body = async (c: { req: { json: () => Promise<unknown> } }) =>
    ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  app.get('/api/admin/runs', async (c) => {
    await requireAdmin(c);
    const player = (c.req.query('player') ?? '').trim().slice(0, 200) || undefined;
    const rawDate = c.req.query('date');
    const date = rawDate === undefined ? (player ? undefined : todayUtc(Date.now())) : rawDate;
    const mode = c.req.query('mode') || undefined;
    if ((date && !isDate(date)) || (mode !== undefined && !isMode(mode))) {
      throw new ApiError(400, 'bad-request', 'date is YYYY-MM-DD and mode daily, gauntlet or eras');
    }
    const runs = await searchRuns(c.env.DB, { date: date || undefined, player, mode });
    return c.json({ runs, limit: RUNS_LIMIT });
  });

  app.get('/api/admin/runs/:mode/:id', async (c) => {
    await requireAdmin(c);
    const mode = c.req.param('mode');
    if (!isMode(mode)) throw new ApiError(404, 'not-found');
    return c.json(await runDetail(c.env.DB, mode, c.req.param('id')));
  });

  app.post('/api/admin/runs/reverify', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    if (isDate(b.date)) {
      if (b.mode !== undefined && !isMode(b.mode)) {
        throw new ApiError(400, 'bad-request', 'mode is daily, gauntlet or eras');
      }
      const target = isMode(b.mode) ? { date: b.date, mode: b.mode } : { date: b.date };
      return c.json(await reverify(c.env.DB, who.email, target));
    }
    if (!isMode(b.mode) || typeof b.id !== 'string' || !b.id) {
      throw new ApiError(400, 'bad-request', 'send { mode, id } or { date, mode? }');
    }
    return c.json(await reverify(c.env.DB, who.email, { mode: b.mode, id: b.id }));
  });

  app.post('/api/admin/runs/delete', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    if (typeof b.id !== 'string' || !b.id) throw new ApiError(400, 'bad-request', 'id is required');
    return c.json(await deleteDailyRun(c.env.DB, who.email, b.id));
  });
}
