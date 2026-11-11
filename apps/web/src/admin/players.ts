// The Players tab's data (PlayersPage.tsx): the accounts from GET /api/admin/players
// (apps/worker/src/adminPlayers.ts), and how the tab searches, sorts and sums them up.

import { adminCall } from './session.js';

export interface AdminPlayer {
  id: string;
  name: string;
  email: string;
  /** The leaderboard name ('' until the player sets it). */
  displayName: string;
  favouriteTeam: string;
  /** 'google', 'email' (Auth0 email and password), or another issuer. */
  provider: string;
  createdAt: string;
  devices: number;
  dailyRuns: number;
  gauntletRuns: number;
  lastPlayed: string | null;
  /** Left off every leaderboard (the player's page hides and shows them). */
  hidden?: boolean;
}

export interface PlayerList {
  total: number;
  players: AdminPlayer[];
}

export async function listPlayers(): Promise<PlayerList> {
  return adminCall<PlayerList>('/api/admin/players');
}

export type PlayerSort = 'newest' | 'last-played' | 'most-played';

export const SORT_LABELS: Record<PlayerSort, string> = {
  newest: 'Newest',
  'last-played': 'Last played',
  'most-played': 'Most played',
};

/** A player whose names or email contain every word of the query (any case). */
export function matchesPlayer(p: AdminPlayer, query: string): boolean {
  const text = `${p.displayName} ${p.name} ${p.email} ${p.favouriteTeam}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => text.includes(w));
}

/** The players the tab shows: matching the query, in the chosen order (ties: newest first). */
export function arrangePlayers(
  players: AdminPlayer[],
  query: string,
  sort: PlayerSort,
): AdminPlayer[] {
  const newest = (a: AdminPlayer, b: AdminPlayer) => b.createdAt.localeCompare(a.createdAt);
  const by: Record<PlayerSort, (a: AdminPlayer, b: AdminPlayer) => number> = {
    newest,
    'last-played': (a, b) => (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') || newest(a, b),
    'most-played': (a, b) =>
      b.dailyRuns + b.gauntletRuns - (a.dailyRuns + a.gauntletRuns) || newest(a, b),
  };
  return players.filter((p) => matchesPlayer(p, query)).sort(by[sort]);
}

export interface PlayerSummary {
  total: number;
  /** Accounts created in the last 7 days. */
  lastWeek: number;
  /** Accounts that have set a leaderboard name. */
  withProfile: number;
  /** Accounts that have played at least once (daily or Gauntlet). */
  played: number;
}

export function summarise(list: PlayerList, now: number): PlayerSummary {
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const { players } = list;
  return {
    total: list.total,
    lastWeek: players.filter((p) => p.createdAt >= weekAgo).length,
    withProfile: players.filter((p) => p.displayName).length,
    played: players.filter((p) => p.dailyRuns + p.gauntletRuns > 0).length,
  };
}

export const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  email: 'Email',
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** "12 Mar 2026" in UTC, or '—' for none. */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
