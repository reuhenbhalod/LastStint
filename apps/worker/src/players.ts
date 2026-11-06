// Accounts and streaks (migration 0004, feedback spec D3).

import type { Identity } from './auth.js';
import { addDays } from './dates.js';
import { ApiError } from './runs.js';

export interface Account {
  playerId: string;
  name: string;
  email: string;
  /** The name on the leaderboards ('' until set; docs/auth0-spec.md A4). */
  displayName: string;
  /** The favourite team ('' until set): its colour themes the home page. */
  favouriteTeam: string;
  /** No display name yet: the game asks for the profile. */
  needsProfile: boolean;
  /** Sign-in only: the account was created just now (the game shows how to play once). */
  created?: boolean;
}

export interface Streak {
  /** Days in a row up to today (or yesterday, if today isn't played yet: still alive). */
  current: number;
  best: number;
  /** Days played in all. */
  days: number;
}

/**
 * Sign in: find or create the account for this identity and link the browser's anonId
 * to it. A new account takes the anonId as its player ID, unless that anonId already belongs
 * to another account (a shared browser), in which case it gets a fresh one.
 */
export async function signIn(
  db: D1Database,
  who: Identity,
  anonId: string,
  now: number,
): Promise<Account> {
  const at = new Date(now).toISOString();
  let player = await db
    .prepare(
      `SELECT id, name, email, display_name AS displayName, favourite_team AS favouriteTeam
       FROM players WHERE account_sub = ?`,
    )
    .bind(who.sub)
    .first<{
      id: string;
      name: string;
      email: string;
      displayName: string;
      favouriteTeam: string;
    }>();
  const created = !player;
  if (!player) {
    const taken = await db
      .prepare('SELECT 1 FROM player_ids WHERE anon_id = ?')
      .bind(anonId)
      .first();
    const id = taken ? crypto.randomUUID() : anonId;
    await db
      .prepare(
        'INSERT INTO players (id, account_sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, who.sub, who.email, who.name, at)
      .run();
    player = { id, name: who.name, email: who.email, displayName: '', favouriteTeam: '' };
  } else if (player.name !== who.name || player.email !== who.email) {
    await db
      .prepare('UPDATE players SET name = ?, email = ? WHERE id = ?')
      .bind(who.name, who.email, player.id)
      .run();
  }
  // Link both the browser's ID and the account's own, so the account's first device counts.
  await db.batch(
    [anonId, player.id].map((id) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO player_ids (anon_id, player_id, linked_at) VALUES (?, ?, ?)',
        )
        .bind(id, player.id, at),
    ),
  );
  return {
    playerId: player.id,
    name: who.name,
    email: who.email,
    displayName: player.displayName,
    favouriteTeam: player.favouriteTeam,
    needsProfile: !player.displayName,
    created,
  };
}

/** A display name: 3-20 letters, digits, spaces, `_`, `-` or `.` (trimmed). */
const NAME = /^[\p{L}\p{N} _.-]{3,20}$/u;
/** A team name as the game shows it ("Red Bull Racing", "Kick Sauber"). */
const TEAM = /^[\p{L}\p{N} &.'-]{0,40}$/u;

/**
 * Set the account's profile (docs/auth0-spec.md A4): a display name (unique, ignoring case;
 * 409 `name-taken`) and a favourite team ('' for none). 404 if the identity has no account.
 */
export async function setProfile(
  db: D1Database,
  who: Identity,
  body: unknown,
): Promise<Pick<Account, 'displayName' | 'favouriteTeam'>> {
  const b = (body ?? {}) as Record<string, unknown>;
  const displayName = typeof b.displayName === 'string' ? b.displayName.trim() : '';
  const favouriteTeam = typeof b.favouriteTeam === 'string' ? b.favouriteTeam.trim() : '';
  if (!NAME.test(displayName)) {
    throw new ApiError(400, 'bad-name', 'a display name is 3-20 letters, digits or spaces');
  }
  if (!TEAM.test(favouriteTeam)) throw new ApiError(400, 'bad-team');
  const taken = await db
    .prepare('SELECT 1 FROM players WHERE lower(display_name) = lower(?) AND account_sub != ?')
    .bind(displayName, who.sub)
    .first();
  if (taken) throw new ApiError(409, 'name-taken', `${displayName} is taken`);
  const res = await db
    .prepare('UPDATE players SET display_name = ?, favourite_team = ? WHERE account_sub = ?')
    .bind(displayName, favouriteTeam, who.sub)
    .run();
  if (!res.meta.changes) throw new ApiError(404, 'no-account', 'sign in first');
  return { displayName, favouriteTeam };
}

/** The account an anonId is linked to, if any. */
export async function accountOf(db: D1Database, anonId: string): Promise<Account | null> {
  const row = await db
    .prepare(
      `SELECT p.id AS playerId, p.name, p.email, p.display_name AS displayName,
              p.favourite_team AS favouriteTeam
       FROM player_ids l JOIN players p ON p.id = l.player_id WHERE l.anon_id = ?`,
    )
    .bind(anonId)
    .first<Omit<Account, 'needsProfile'>>();
  return row && { ...row, needsProfile: !row.displayName };
}

/**
 * SQL for the display name a leaderboard shows for `anonCol`'s player ('' when none; the
 * Worker falls back to the generated name). docs/auth0-spec.md A4.
 */
export const DISPLAY_NAME = (anonCol: string) => `COALESCE((
  SELECT p.display_name FROM player_ids l JOIN players p ON p.id = l.player_id
   WHERE l.anon_id = ${anonCol}), '')`;

/**
 * Every anonId whose runs count as this player's: the IDs linked to the same account, or just
 * the anonId itself when it isn't signed in. (SQL fragment; binds the anonId as ?N.)
 */
export const SAME_PLAYER = (n: number) => `(
  SELECT ?${n} UNION
  SELECT anon_id FROM player_ids
   WHERE player_id = (SELECT player_id FROM player_ids WHERE anon_id = ?${n}))`;

/** Days played (distinct dates, ascending) by this player. */
export async function playedDates(db: D1Database, anonId: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT date FROM runs WHERE anon_id IN ${SAME_PLAYER(1)} ORDER BY date LIMIT 4000`,
    )
    .bind(anonId)
    .all<{ date: string }>();
  return results.map((r) => r.date);
}

/** The streak from the days played (ascending), as of the player's local `today`. */
export function streakOf(dates: string[], today: string): Streak {
  const played = new Set(dates);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let day = played.has(today) ? today : addDays(today, -1);
  while (played.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  return { current, best, days: played.size };
}
