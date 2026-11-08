import { describe, expect, it } from 'vitest';
import { NEUTRAL_REWRITE } from './EraResults.js';
import type { ErasBookApi } from './api.js';
import { historyBook, historyEntry, leaderboard } from './erasFixture.js';
import {
  checkHistory,
  displayPercent,
  entriesNewestFirst,
  entryDate,
  entryHeadline,
  loadHistory,
  loadLeaderboard,
  myPlace,
} from './historyState.js';

const api = (edit: Partial<ErasBookApi>): ErasBookApi => ({
  history: async () => historyBook(),
  leaderboard: async (raceId, legend) => leaderboard(3, 2, { raceId, legend }),
  ...edit,
});

describe('displayPercent', () => {
  it('rounds to whole numbers', () => {
    expect(displayPercent(12.4, 103, 830)).toBe(12);
    expect(displayPercent(12.5, 104, 830)).toBe(13);
    expect(displayPercent(0, 0, 830)).toBe(0);
    expect(displayPercent(100, 830, 830)).toBe(100);
  });

  it('never shows 0% once something is collected, nor 100% before everything is', () => {
    expect(displayPercent((1 / 830) * 100, 1, 830)).toBe(1);
    expect(displayPercent((829 / 830) * 100, 829, 830)).toBe(99);
  });

  it('shows 0% for nonsense', () => {
    expect(displayPercent(Number.NaN, 1, 830)).toBe(0);
    expect(displayPercent(50, 0, 0)).toBe(0);
  });
});

describe('a rewrite entry', () => {
  it('uses the race’s authored headline, or the neutral line, never anything else', () => {
    expect(entryHeadline({ headline: 'An authored headline' })).toBe('An authored headline');
    expect(entryHeadline({ headline: null })).toBe(NEUTRAL_REWRITE);
    expect(entryHeadline({ headline: '   ' })).toBe(NEUTRAL_REWRITE);
  });

  it('dates the entry, in UTC, or not at all if the date is unreadable', () => {
    expect(entryDate('2026-11-07T23:30:00.000Z')).toBe('7 Nov 2026');
    expect(entryDate('2026-11-07 23:30:00')).not.toBeNull(); // SQLite's own format
    expect(entryDate('not a date')).toBeNull();
  });

  it('lists the newest rewrite first', () => {
    const old = historyEntry({ raceId: 'monaco-2022', achievedAt: '2026-01-01T00:00:00Z' });
    const mid = historyEntry({ raceId: 'hungary-2022', achievedAt: '2026-06-01T00:00:00Z' });
    const now = historyEntry({ raceId: 'miami-2024', achievedAt: '2026-11-01T00:00:00Z' });
    expect(entriesNewestFirst([old, mid, now]).map((e) => e.raceId)).toEqual([
      'miami-2024',
      'hungary-2022',
      'monaco-2022',
    ]);
  });
});

describe('loading the history book', () => {
  it('is ready with the server’s book', async () => {
    const book = historyBook();
    expect(await loadHistory(api({ history: async () => book }))).toEqual({ kind: 'ready', book });
  });

  it('is an error, never a rejection, when the call fails', async () => {
    const state = await loadHistory(api({ history: () => Promise.reject(new Error('offline')) }));
    expect(state).toEqual({
      kind: 'error',
      message: 'Couldn’t load your history book (offline).',
    });
  });

  it('rejects a book that does not add up', () => {
    const book = historyBook();
    expect(() =>
      checkHistory({ ...book, completion: { ...book.completion, collected: 900 } }),
    ).toThrow(/900 collected of 830/);
    expect(() => checkHistory({ ...book, eras: undefined } as never)).toThrow(/missing/);
    expect(() =>
      checkHistory({ ...book, completion: { ...book.completion, collected: -1 } }),
    ).toThrow(/bad completion/);
  });
});

describe('loading a leaderboard', () => {
  it('asks for the board of the tab, normal or Legend', async () => {
    const asked: Array<[string, boolean]> = [];
    const client = api({
      leaderboard: async (raceId, legend) => {
        asked.push([raceId, legend]);
        return leaderboard(1, null, { raceId, legend });
      },
    });
    expect(await loadLeaderboard(client, 'abu-dhabi-2021', true)).toMatchObject({
      kind: 'ready',
      board: { legend: true },
    });
    await loadLeaderboard(client, 'abu-dhabi-2021', false);
    expect(asked).toEqual([
      ['abu-dhabi-2021', true],
      ['abu-dhabi-2021', false],
    ]);
  });

  it('is an error when the call fails or answers with another board', async () => {
    const failing = api({ leaderboard: () => Promise.reject(new Error('503')) });
    expect(await loadLeaderboard(failing, 'abu-dhabi-2021', true)).toEqual({
      kind: 'error',
      message: 'Couldn’t load the Legend leaderboard (503).',
    });
    const wrong = api({ leaderboard: async () => leaderboard(1, null, { legend: true }) });
    expect(await loadLeaderboard(wrong, 'abu-dhabi-2021', false)).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('another board'),
    });
  });

  it('places the player in the list, below it, or nowhere', () => {
    expect(myPlace(leaderboard(150, 12))).toBe('listed');
    expect(myPlace(leaderboard(150, 140))).toBe('below');
    expect(myPlace(leaderboard(150, null))).toBe('none');
  });
});
