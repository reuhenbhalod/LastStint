// The admin page's Players tab: every account that has signed in (the `players` table, migration
// 0004 and 0008), newest first, with how it signs in, how many browsers are linked to it and how
// much it has played. The list is registered by registerAdmin (src/admin.ts); a player's page
// and the two player actions (docs/admin-v2-spec.md A6) by registerAdminPlayers below. Every
// request goes through requireAdmin, and every change is logged.
//
//   GET  /api/admin/players              { total, players: AdminPlayer[] }
//   GET  /api/admin/players/:id          PlayerDetail: runs, streak and the days behind it,
//                                        linked browsers
//   POST /api/admin/players/:id/name     { displayName }: set it, or '' to clear a bad name
//   POST /api/admin/players/:id/hide     { hidden }: hide from (or show on) every leaderboard

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import { logStatement } from './adminLog.js';
import { type AdminRun, searchRuns } from './adminRuns.js';
import { todayUtc } from './dates.js';
import type { Env } from './index.js';
import { NAME, type Streak, playedDates, streakOf } from './players.js';
import { ApiError } from './runs.js';

/** At most this many accounts in one response (newest first); `total` still counts them all. */
export const PLAYERS_LIMIT = 5000;

export interface AdminPlayer {
  id: string;
  /** The name and email from the sign-in (Google or Auth0). */
  name: string;
  email: string;
  /** The leaderboard name ('' until the player sets it). */
  displayName: string;
  favouriteTeam: string;
  /** How the account signs in: 'google', 'email' (Auth0 email and password), or the issuer. */
  provider: string;
  createdAt: string;
  /** Browsers (anonIds) linked to the account. */
  devices: number;
  dailyRuns: number;
  gauntletRuns: number;
  /** The latest daily run or Gauntlet start on any linked browser, or null. */
  lastPlayed: string | null;
  /** Left off every leaderboard (players.hidden). */
  hidden: boolean;
}

/** The sign-in provider behind an account key (src/auth.ts accountKey: bare Google IDs). */
export function providerOf(accountSub: string): string {
  const bar = accountSub.indexOf('|');
  if (bar < 0) return 'google';
  const issuer = accountSub.slice(0, bar);
  return issuer === 'auth0' ? 'email' : issuer;
}

interface Row {
  id: string;
  account_sub: string;
  name: string;
  email: string;
  display_name: string;
  favourite_team: string;
  created_at: string;
  devices: number;
  daily_runs: number;
  gauntlet_runs: number;
  last_daily: string | null;
  last_gauntlet: string | null;
  hidden: number;
}

/** The players, newest first (or with `id`, just that one, whatever its age). */
export async function listPlayers(
  db: D1Database,
  limit = PLAYERS_LIMIT,
  id: string | null = null,
): Promise<{ total: number; players: AdminPlayer[] }> {
  const [count, rows] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM players'),
    db
      .prepare(
        `WITH links AS (SELECT player_id, anon_id FROM player_ids WHERE ?2 IS NULL OR player_id = ?2),
         daily AS (
           SELECT l.player_id, COUNT(*) AS n, MAX(r.created_at) AS last
           FROM runs r JOIN links l ON l.anon_id = r.anon_id GROUP BY l.player_id),
         gauntlet AS (
           SELECT l.player_id, COUNT(*) AS n, MAX(s.started_at) AS last
           FROM survivor_runs s JOIN links l ON l.anon_id = s.anon_id GROUP BY l.player_id),
         devices AS (SELECT player_id, COUNT(*) AS n FROM links GROUP BY player_id)
         SELECT p.id, p.account_sub, p.name, p.email, p.display_name, p.favourite_team,
                p.created_at, p.hidden,
                COALESCE(dv.n, 0) AS devices,
                COALESCE(d.n, 0) AS daily_runs,
                COALESCE(g.n, 0) AS gauntlet_runs,
                d.last AS last_daily,
                g.last AS last_gauntlet
         FROM players p
         LEFT JOIN devices dv ON dv.player_id = p.id
         LEFT JOIN daily d ON d.player_id = p.id
         LEFT JOIN gauntlet g ON g.player_id = p.id
         WHERE ?2 IS NULL OR p.id = ?2
         ORDER BY p.created_at DESC, p.id
         LIMIT ?1`,
      )
      .bind(limit, id),
  ]);
  const total = (count?.results[0] as { n: number } | undefined)?.n ?? 0;
  const players = ((rows?.results ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    displayName: r.display_name,
    favouriteTeam: r.favourite_team,
    provider: providerOf(r.account_sub),
    createdAt: r.created_at,
    devices: r.devices,
    dailyRuns: r.daily_runs,
    gauntletRuns: r.gauntlet_runs,
    lastPlayed: latest(r.last_daily, r.last_gauntlet),
    hidden: r.hidden === 1,
  }));
  return { total, players };
}

/** The later of two ISO timestamps (either may be missing). */
function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export interface PlayerDetail {
  player: AdminPlayer;
  /** Browsers (anonIds) linked to the account, and when. */
  browsers: Array<{ anonId: string; linkedAt: string }>;
  /** Worked out from the days played (never stored), as of today (UTC). */
  streak: Streak;
  /** Every day with a daily run, newest first. */
  days: string[];
  runs: AdminRun[];
}

export async function playerDetail(db: D1Database, id: string, now: number): Promise<PlayerDetail> {
  const { players } = await listPlayers(db, 1, id);
  const player = players[0];
  if (!player) throw new ApiError(404, 'no-player');
  const [{ results: links }, dates, runs] = await Promise.all([
    db
      .prepare('SELECT anon_id, linked_at FROM player_ids WHERE player_id = ? ORDER BY linked_at')
      .bind(id)
      .all<{ anon_id: string; linked_at: string }>(),
    playedDates(db, id),
    searchRuns(db, { player: id }),
  ]);
  return {
    player,
    browsers: links.map((l) => ({ anonId: l.anon_id, linkedAt: l.linked_at })),
    streak: streakOf(dates, todayUtc(now)),
    days: [...dates].reverse(),
    runs,
  };
}

/** Set (or with '' clear) a player's leaderboard name. Unique, ignoring case, like setProfile. */
export async function setPlayerName(db: D1Database, email: string, id: string, raw: unknown) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name && !NAME.test(name)) {
    throw new ApiError(400, 'bad-name', 'a display name is 3-20 letters, digits or spaces');
  }
  const row = await db
    .prepare('SELECT display_name FROM players WHERE id = ?')
    .bind(id)
    .first<{ display_name: string }>();
  if (!row) throw new ApiError(404, 'no-player');
  if (name) {
    const taken = await db
      .prepare('SELECT 1 FROM players WHERE lower(display_name) = lower(?) AND id != ?')
      .bind(name, id)
      .first();
    if (taken) throw new ApiError(409, 'name-taken', `${name} is taken`);
  }
  await db.batch([
    db.prepare('UPDATE players SET display_name = ? WHERE id = ?').bind(name, id),
    logStatement(db, email, 'player-name', { id, from: row.display_name, to: name }),
  ]);
  return { id, displayName: name };
}

/** Hide a player from every leaderboard, or show them again. */
export async function setHidden(db: D1Database, email: string, id: string, hidden: boolean) {
  const row = await db.prepare('SELECT 1 FROM players WHERE id = ?').bind(id).first();
  if (!row) throw new ApiError(404, 'no-player');
  // The change and its log row commit together.
  await db.batch([
    db.prepare('UPDATE players SET hidden = ? WHERE id = ?').bind(hidden ? 1 : 0, id),
    logStatement(db, email, 'hide', { id, hidden }),
  ]);
  return { id, hidden };
}

export function registerAdminPlayers(app: Hono<{ Bindings: Env }>) {
  const body = async (c: { req: { json: () => Promise<unknown> } }) =>
    ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  app.get('/api/admin/players/:id', async (c) => {
    await requireAdmin(c);
    return c.json(await playerDetail(c.env.DB, c.req.param('id'), Date.now()));
  });

  app.post('/api/admin/players/:id/name', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    if (typeof b.displayName !== 'string') {
      throw new ApiError(400, 'bad-request', 'displayName is required');
    }
    return c.json(await setPlayerName(c.env.DB, who.email, c.req.param('id'), b.displayName));
  });

  app.post('/api/admin/players/:id/hide', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    if (typeof b.hidden !== 'boolean') throw new ApiError(400, 'bad-request', 'hidden is required');
    return c.json(await setHidden(c.env.DB, who.email, c.req.param('id'), b.hidden));
  });
}
