// Admin controls (races batch 1): for the people running the game, signed in with Google and
// listed in ADMIN_EMAILS (wrangler.jsonc vars, comma-separated). Every request carries the
// Google ID token as a Bearer token; the email must be on the list and verified by Google.
//
//   GET  /api/admin/me                 who you are (and that you're an admin)
//   GET  /api/admin/races              the playable races (with decision moments) and hashes
//   GET  /api/admin/schedule           the scheduled days around today, with run counts and
//                                      whether each still pins the race file's current hash
//   POST /api/admin/schedule           { from, days, raceId? }: schedule days, rotating the
//                                      playable races (or one race); scheduled days are kept
//   POST /api/admin/day                { date, raceId }: set one day's race (no runs on it yet)
//   POST /api/admin/repin              re-pin today's and later days to their race file's
//                                      current hash (days that have runs are left alone)
//   POST /api/admin/runs/clear         { date }: delete your own run(s) on a day, to replay it

import type { Context } from 'hono';
import { authConfigured, verifyCredential } from './auth.js';
import { addDays, isDate, todayUtc } from './dates.js';
import type { Env } from './index.js';
import { DAILY_POOL } from './pools.js';
import { getRace } from './races.js';
import { ApiError } from './runs.js';

type Ctx = Context<{ Bindings: Env }>;

export function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** The signed-in admin, or an ApiError (401 no or bad token, 403 not an admin). */
export async function requireAdmin(c: Ctx): Promise<{ email: string; sub: string }> {
  if (!authConfigured(c.env)) throw new ApiError(503, 'auth-off', 'sign-in is not set up');
  const token = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '')?.[1];
  if (!token || token.length > 8192) throw new ApiError(401, 'sign-in-required');
  const who = await verifyCredential(c.env, token, Date.now());
  if (!who) throw new ApiError(401, 'bad-credential');
  const email = who.email.toLowerCase();
  if (!who.emailVerified || !adminEmails(c.env).includes(email)) {
    throw new ApiError(403, 'not-admin', `${who.email || 'this account'} is not an admin`);
  }
  return { email, sub: who.sub };
}

/** Races that can be played as a daily: the daily pool's (data/pools.json), with moments. */
export async function playableRaces() {
  const out = [];
  for (const id of [...DAILY_POOL].sort()) {
    const race = await getRace(id);
    if (!race || race.model.decisionMoments.length === 0) continue;
    const m = race.model;
    out.push({
      id,
      name: m.race.name ?? id,
      userSide: m.userSide,
      rival: m.rival,
      moments: m.decisionMoments.length,
      seed: m.race.seed,
      hash: race.hash,
    });
  }
  return out;
}

interface DayRow {
  date: string;
  number: number;
  race_id: string;
  model_hash: string;
  runs: number;
}

export async function schedule(db: D1Database, from: string, to: string) {
  const { results } = await db
    .prepare(
      `SELECT d.date, d.number, d.race_id, d.model_hash,
              (SELECT COUNT(*) FROM runs r WHERE r.date = d.date) AS runs
       FROM daily d WHERE d.date BETWEEN ? AND ? ORDER BY d.date`,
    )
    .bind(from, to)
    .all<DayRow>();
  const days = [];
  for (const r of results) {
    const race = await getRace(r.race_id);
    days.push({
      date: r.date,
      number: r.number,
      raceId: r.race_id,
      name: race?.model.race.name ?? r.race_id,
      runs: r.runs,
      current: !!race && race.hash === r.model_hash,
    });
  }
  return days;
}

async function insertDay(db: D1Database, date: string, raceId: string, number: number) {
  const race = await getRace(raceId);
  if (!race || race.model.decisionMoments.length === 0) {
    throw new ApiError(400, 'bad-race', `${raceId} is not a playable race`);
  }
  await db
    .prepare(
      `INSERT INTO daily (date, race_id, seed, side, published_at, number, model_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      date,
      raceId,
      race.model.race.seed,
      race.model.userSide,
      new Date().toISOString(),
      number,
      race.hash,
    )
    .run();
}

async function maxNumber(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT MAX(number) AS n FROM daily').first<{ n: number | null }>();
  return row?.n ?? 0;
}

/** Schedule `days` days from `from`, rotating the playable races (or always `raceId`). */
export async function scheduleDays(db: D1Database, from: string, days: number, raceId?: string) {
  const pool = raceId ? [raceId] : (await playableRaces()).map((r) => r.id);
  if (pool.length === 0) throw new ApiError(400, 'no-races');
  const { results: taken } = await db
    .prepare('SELECT date, race_id FROM daily ORDER BY number')
    .all<{ date: string; race_id: string }>();
  const scheduled = new Set(taken.map((r) => r.date));
  const last = taken.at(-1)?.race_id;
  let next = last && pool.includes(last) ? pool.indexOf(last) + 1 : 0;
  let number = await maxNumber(db);
  const added: Array<{ date: string; raceId: string; number: number }> = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (scheduled.has(date)) continue;
    const id = pool[next++ % pool.length] as string;
    number++;
    await insertDay(db, date, id, number);
    added.push({ date, raceId: id, number });
  }
  return added;
}

/** Set one day's race: a new day, or one nobody has played yet. */
export async function setDay(db: D1Database, date: string, raceId: string) {
  const row = await db
    .prepare(
      'SELECT number, (SELECT COUNT(*) FROM runs r WHERE r.date = daily.date) AS runs FROM daily WHERE date = ?',
    )
    .bind(date)
    .first<{ number: number; runs: number }>();
  if (row && row.runs > 0) {
    throw new ApiError(409, 'day-has-runs', `${date} has ${row.runs} runs; clear them first`);
  }
  const number = row?.number ?? (await maxNumber(db)) + 1;
  if (row) await db.prepare('DELETE FROM daily WHERE date = ?').bind(date).run();
  await insertDay(db, date, raceId, number);
  return { date, raceId, number };
}

/** Re-pin today's and later days to the current race files (days with runs are skipped). */
export async function repin(db: D1Database, today: string) {
  const days = await schedule(db, today, addDays(today, 3650));
  const repinned: string[] = [];
  const skipped: string[] = [];
  for (const d of days) {
    if (d.current) continue;
    if (d.runs > 0) {
      skipped.push(d.date);
      continue;
    }
    const race = await getRace(d.raceId);
    if (!race) continue;
    await db
      .prepare('UPDATE daily SET model_hash = ?, seed = ?, side = ? WHERE date = ?')
      .bind(race.hash, race.model.race.seed, race.model.userSide, d.date)
      .run();
    repinned.push(d.date);
  }
  return { repinned, skipped };
}

/** Delete the admin's own runs on a day (every browser linked to their account). */
export async function clearOwnRuns(db: D1Database, sub: string, date: string) {
  const { results } = await db
    .prepare(
      `SELECT r.id FROM runs r JOIN player_ids p ON p.anon_id = r.anon_id
       JOIN players pl ON pl.id = p.player_id
       WHERE pl.account_sub = ? AND r.date = ?`,
    )
    .bind(sub, date)
    .all<{ id: string }>();
  for (const { id } of results) {
    await db.batch([
      db.prepare('DELETE FROM run_calls WHERE run_id = ?').bind(id),
      db.prepare('DELETE FROM runs WHERE id = ?').bind(id),
    ]);
  }
  return { cleared: results.length };
}

export function registerAdmin(app: import('hono').Hono<{ Bindings: Env }>) {
  const body = async (c: Ctx) =>
    ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  app.get('/api/admin/me', async (c) => c.json({ admin: true, ...(await requireAdmin(c)) }));

  app.get('/api/admin/races', async (c) => {
    await requireAdmin(c);
    return c.json({ races: await playableRaces() });
  });

  app.get('/api/admin/schedule', async (c) => {
    await requireAdmin(c);
    const today = todayUtc(Date.now());
    const from = c.req.query('from') ?? addDays(today, -7);
    const to = c.req.query('to') ?? addDays(today, 60);
    if (!isDate(from) || !isDate(to)) throw new ApiError(400, 'bad-request');
    return c.json({ today, days: await schedule(c.env.DB, from, to) });
  });

  app.post('/api/admin/schedule', async (c) => {
    await requireAdmin(c);
    const b = await body(c);
    const from = typeof b.from === 'string' ? b.from : todayUtc(Date.now());
    const days = Number(b.days ?? 14);
    const raceId = typeof b.raceId === 'string' && b.raceId ? b.raceId : undefined;
    if (!isDate(from) || !Number.isInteger(days) || days < 1 || days > 366) {
      throw new ApiError(400, 'bad-request', 'from must be YYYY-MM-DD and days 1-366');
    }
    return c.json({ added: await scheduleDays(c.env.DB, from, days, raceId) });
  });

  app.post('/api/admin/day', async (c) => {
    await requireAdmin(c);
    const b = await body(c);
    if (!isDate(b.date) || typeof b.raceId !== 'string') throw new ApiError(400, 'bad-request');
    return c.json(await setDay(c.env.DB, b.date as string, b.raceId));
  });

  app.post('/api/admin/repin', async (c) => {
    await requireAdmin(c);
    return c.json(await repin(c.env.DB, todayUtc(Date.now())));
  });

  app.post('/api/admin/runs/clear', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    if (!isDate(b.date)) throw new ApiError(400, 'bad-request');
    return c.json(await clearOwnRuns(c.env.DB, who.sub, b.date as string));
  });
}
