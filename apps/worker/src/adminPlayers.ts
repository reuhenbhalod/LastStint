// The admin page's Players tab: every account that has signed in (the `players` table, migration
// 0004 and 0008), newest first, with how it signs in, how many browsers are linked to it and how
// much it has played. Read-only; registered by registerAdmin (src/admin.ts), so every request
// goes through requireAdmin.
//
//   GET /api/admin/players   { total, players: AdminPlayer[] }

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
}

export async function listPlayers(
  db: D1Database,
  limit = PLAYERS_LIMIT,
): Promise<{ total: number; players: AdminPlayer[] }> {
  const [count, rows] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM players'),
    db
      .prepare(
        `WITH links AS (SELECT player_id, anon_id FROM player_ids),
         daily AS (
           SELECT l.player_id, COUNT(*) AS n, MAX(r.created_at) AS last
           FROM runs r JOIN links l ON l.anon_id = r.anon_id GROUP BY l.player_id),
         gauntlet AS (
           SELECT l.player_id, COUNT(*) AS n, MAX(s.started_at) AS last
           FROM survivor_runs s JOIN links l ON l.anon_id = s.anon_id GROUP BY l.player_id),
         devices AS (SELECT player_id, COUNT(*) AS n FROM links GROUP BY player_id)
         SELECT p.id, p.account_sub, p.name, p.email, p.display_name, p.favourite_team,
                p.created_at,
                COALESCE(dv.n, 0) AS devices,
                COALESCE(d.n, 0) AS daily_runs,
                COALESCE(g.n, 0) AS gauntlet_runs,
                d.last AS last_daily,
                g.last AS last_gauntlet
         FROM players p
         LEFT JOIN devices dv ON dv.player_id = p.id
         LEFT JOIN daily d ON d.player_id = p.id
         LEFT JOIN gauntlet g ON g.player_id = p.id
         ORDER BY p.created_at DESC, p.id
         LIMIT ?`,
      )
      .bind(limit),
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
  }));
  return { total, players };
}

/** The later of two ISO timestamps (either may be missing). */
function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
