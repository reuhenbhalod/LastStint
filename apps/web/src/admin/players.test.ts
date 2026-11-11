// How the Players tab searches, sorts and sums up the accounts (players.ts).

import { describe, expect, it } from 'vitest';
import {
  type AdminPlayer,
  arrangePlayers,
  matchesPlayer,
  providerLabel,
  shortDate,
  summarise,
} from './players.js';

function player(over: Partial<AdminPlayer> = {}): AdminPlayer {
  return {
    id: 'p',
    name: 'Ann Lee',
    email: 'ann@example.com',
    displayName: '',
    favouriteTeam: '',
    provider: 'google',
    createdAt: '2026-01-01T00:00:00.000Z',
    devices: 1,
    dailyRuns: 0,
    gauntletRuns: 0,
    lastPlayed: null,
    ...over,
  };
}

describe('players tab', () => {
  it('searches names, email and team by every word, any case', () => {
    const p = player({ displayName: 'Boxbox', favouriteTeam: 'McLaren' });
    expect(matchesPlayer(p, '')).toBe(true);
    expect(matchesPlayer(p, 'ANN')).toBe(true);
    expect(matchesPlayer(p, 'boxbox mclaren')).toBe(true);
    expect(matchesPlayer(p, 'example.com')).toBe(true);
    expect(matchesPlayer(p, 'ann ferrari')).toBe(false);
  });

  it('sorts by newest, last played or most played, ties newest first', () => {
    const a = player({ id: 'a', createdAt: '2026-01-01T00:00:00Z', dailyRuns: 3 });
    const b = player({
      id: 'b',
      createdAt: '2026-02-01T00:00:00Z',
      lastPlayed: '2026-02-03T00:00:00Z',
      gauntletRuns: 1,
    });
    const c = player({
      id: 'c',
      createdAt: '2026-03-01T00:00:00Z',
      lastPlayed: '2026-03-02T00:00:00Z',
      dailyRuns: 1,
    });
    const ids = (s: Parameters<typeof arrangePlayers>[2]) =>
      arrangePlayers([a, b, c], '', s).map((p) => p.id);
    expect(ids('newest')).toEqual(['c', 'b', 'a']);
    expect(ids('last-played')).toEqual(['c', 'b', 'a']);
    expect(ids('most-played')).toEqual(['a', 'c', 'b']);
  });

  it('sums up the list', () => {
    const now = Date.parse('2026-03-10T00:00:00Z');
    const list = {
      total: 3,
      players: [
        player({ createdAt: '2026-03-09T00:00:00.000Z', displayName: 'X', dailyRuns: 1 }),
        player({ createdAt: '2026-03-01T00:00:00.000Z', gauntletRuns: 2 }),
        player({ createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
    };
    expect(summarise(list, now)).toEqual({ total: 3, lastWeek: 1, withProfile: 1, played: 2 });
  });

  it('labels providers and dates', () => {
    expect(providerLabel('google')).toBe('Google');
    expect(providerLabel('email')).toBe('Email');
    expect(providerLabel('apple')).toBe('apple');
    expect(shortDate('2026-03-12T23:30:00.000Z')).toBe('12 Mar 2026');
    expect(shortDate(null)).toBe('—');
  });
});
