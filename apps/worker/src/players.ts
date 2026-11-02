// Accounts and streaks (migration 0004, feedback spec D3).

import type { GoogleIdentity } from './auth.js';
import { addDays } from './dates.js';

export interface Account {
  playerId: string;
  name: string;
  email: string;
}

export interface Streak {
  /** Days in a row up to today (or yesterday, if today isn't played yet: still alive). */
  current: number;
  best: number;
  /** Days played in all. */
  days: number;
}

/**
 * Sign in: find or create the account for this Google identity and link the browser's anonId
 * to it. A new account takes the anonId as its player ID, unless that anonId already belongs
 * to another account (a shared browser), in which case it gets a fresh one.
 */
export async function signIn(
  db: D1Database,
  who: GoogleIdentity,
  anonId: string,
  now: number,
): Promise<Account> {
  const at = new Date(now).toISOString();
  let player = await db
    .prepare('SELECT id, name, email FROM players WHERE google_sub = ?')
    .bind(who.sub)
    .first<{ id: string; name: string; email: string }>();
  if (!player) {
    const taken = await db
      .prepare('SELECT 1 FROM player_ids WHERE anon_id = ?')
      .bind(anonId)
      .first();
    const id = taken ? crypto.randomUUID() : anonId;
    await db
      .prepare(
        'INSERT INTO players (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, who.sub, who.email, who.name, at)
      .run();
    player = { id, name: who.name, email: who.email };
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
  return { playerId: player.id, name: who.name, email: who.email };
}

/** The account an anonId is linked to, if any. */
export function accountOf(db: D1Database, anonId: string): Promise<Account | null> {
  return db
    .prepare(
      `SELECT p.id AS playerId, p.name, p.email FROM player_ids l
       JOIN players p ON p.id = l.player_id WHERE l.anon_id = ?`,
    )
    .bind(anonId)
    .first<Account>();
}

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
