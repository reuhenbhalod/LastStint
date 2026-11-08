// The history book's and the race leaderboards' state (eras spec §8, §14 screen 6; build plan
// 8.8): loading them through the Eras API, and the few numbers the screens work out for display.
// Every count is the server's (GET /api/history); the screens only round and label them.

import { NEUTRAL_REWRITE } from './EraResults.js';
import type { EraLeaderboard, ErasBookApi, HistoryBook, HistoryEntry } from './api.js';

/**
 * A completion percentage as shown: whole numbers, but never "0%" once something is collected
 * and never "100%" until everything is (1 of 830 shows 1%, 829 of 830 shows 99%).
 */
export function displayPercent(percent: number, collected: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(percent)) return 0;
  const rounded = Math.round(Math.min(100, Math.max(0, percent)));
  if (collected > 0 && rounded === 0) return 1;
  if (collected < total && rounded === 100) return 99;
  return rounded;
}

/** A rewrite's headline: the race's authored one, or a neutral line (never invented copy). */
export function entryHeadline(entry: Pick<HistoryEntry, 'headline'>): string {
  const authored = entry.headline?.trim();
  return authored ? authored : NEUTRAL_REWRITE;
}

/** When a rewrite was written, as "7 Nov 2026" (the date the server recorded); null if unreadable. */
export function entryDate(achievedAt: string): string | null {
  const at = new Date(achievedAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The rewrites to show: newest first. */
export function entriesNewestFirst(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return entries
    .map((entry, i) => ({ entry, i, at: Date.parse(entry.achievedAt) }))
    .sort((a, b) => (b.at || 0) - (a.at || 0) || b.i - a.i)
    .map(({ entry }) => entry);
}

function invalid(why: string): never {
  throw new Error(`history response: ${why}`);
}

/** Throws on a book that doesn't add up, so a bad payload shows as an error, not wrong counts. */
export function checkHistory(book: HistoryBook): HistoryBook {
  const { completion, eras, entries } = book ?? ({} as HistoryBook);
  if (!completion || !Array.isArray(eras) || !Array.isArray(entries)) invalid('missing fields');
  const { collected, total } = completion;
  if (!Number.isInteger(collected) || !Number.isInteger(total) || collected < 0)
    invalid('bad completion counts');
  if (collected > total) invalid(`${collected} collected of ${total}`);
  return book;
}

export type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; book: HistoryBook };

const detail = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Loads the history book. Never rejects: a failure is an `error` state. */
export async function loadHistory(api: ErasBookApi): Promise<HistoryState> {
  try {
    return { kind: 'ready', book: checkHistory(await api.history()) };
  } catch (e) {
    return { kind: 'error', message: `Couldn’t load your history book (${detail(e)}).` };
  }
}

export type LeaderboardState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; board: EraLeaderboard };

/** Loads a race's normal or Legend board. Never rejects: a failure is an `error` state. */
export async function loadLeaderboard(
  api: ErasBookApi,
  raceId: string,
  legend: boolean,
): Promise<LeaderboardState> {
  try {
    const board = await api.leaderboard(raceId, legend);
    if (!board || !Array.isArray(board.entries))
      throw new Error('leaderboard response: no entries');
    if (board.raceId !== raceId || board.legend !== legend)
      throw new Error('leaderboard response: another board');
    return { kind: 'ready', board };
  } catch (e) {
    return {
      kind: 'error',
      message: `Couldn’t load the ${legend ? 'Legend ' : ''}leaderboard (${detail(e)}).`,
    };
  }
}

/** Where the player is on a board: in the shown entries (`listed`), below them, or not on it. */
export function myPlace(board: EraLeaderboard): 'listed' | 'below' | 'none' {
  if (!board.me) return 'none';
  const rank = board.me.rank;
  return board.entries.some((e) => e.rank === rank) ? 'listed' : 'below';
}
