// The mock's history book and leaderboards (VITE_ERAS_MOCK=1), from this page's attempts. The
// bundled race files have no Eras objectives yet, so the evaluation is stubbed here: what's
// tested is how the mock counts and ranks what it's told.
import { describe, expect, it, vi } from 'vitest';
import type { AttemptResult } from './api.js';
import type { MockEvaluation } from './mockEvaluate.js';

const next: { result: MockEvaluation | null } = { result: null };
vi.mock('./mockEvaluate.js', () => ({
  mockEvaluate: () => {
    if (!next.result) throw new Error('no evaluation set');
    return next.result;
  },
}));

const { mockErasApi } = await import('./mockErasApi.js');
const { attemptResult } = await import('./erasFixture.js');

const ALL = { result: true, strategist: true, mastery: true };

/** What `mockEvaluate` gives: an attempt result without the fields the mock adds itself. */
function evaluation(raceId: string, legend: boolean, edit: Partial<MockEvaluation>) {
  const result: Partial<AttemptResult> = attemptResult({ raceId, legend });
  for (const key of ['attemptId', 'newStars', 'historyEntry', 'progress', 'rank', 'total'] as const)
    delete result[key];
  return { ...(result as MockEvaluation), ...edit };
}

async function play(raceId: string, legend: boolean, edit: Partial<MockEvaluation>) {
  next.result = evaluation(raceId, legend, edit);
  const { attemptId } = await mockErasApi.startAttempt({ raceId, legend });
  return mockErasApi.submitAttempt(attemptId, { decisions: [], grades: [], untimed: false });
}

describe('the mock’s history book and leaderboards', () => {
  // 830 less the twenty-two races the Eras side really won (no rewrite condition: the Worker's
  // hasRewrite), one rewrite each.
  it('starts empty: 808 to collect, nothing on any board', async () => {
    const book = await mockErasApi.history();
    expect(book.completion).toEqual({ collected: 0, total: 808, percent: 0 });
    expect(book.eras.map((e) => e.eraId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(book.entries).toEqual([]);
    expect(await mockErasApi.leaderboard('abu-dhabi-2021', false)).toEqual({
      raceId: 'abu-dhabi-2021',
      legend: false,
      size: 100,
      total: 0,
      entries: [],
      me: null,
    });
    await expect(mockErasApi.leaderboard('nowhere-1999', false)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('counts stars and the first rewrite, and puts the player on the board', async () => {
    const first = await play('abu-dhabi-2021', false, {
      accuracy: 80,
      stars: { result: true, strategist: true, mastery: false },
      rewrite: true,
    });
    expect(first.historyEntry).toBe(true);
    // A second rewrite of the same race doesn't write another entry.
    const again = await play('abu-dhabi-2021', false, { accuracy: 90, stars: ALL, rewrite: true });
    expect(again.historyEntry).toBe(false);

    const book = await mockErasApi.history();
    const era9 = book.eras.find((e) => e.eraId === 9);
    expect(era9?.stars).toEqual({ have: 3, total: 30 });
    expect(era9?.rewrites).toEqual({ have: 1, total: 10 }); // every Era 9 race has a rewrite
    expect(era9?.badges).toEqual({ cleared: false, mastered: false, legend: false });
    expect(book.completion.collected).toBe(4);
    expect(book.collectibles.stars).toEqual({ have: 3, total: 300 });
    expect(book.entries).toHaveLength(1);
    expect(book.entries[0]).toMatchObject({
      raceId: 'abu-dhabi-2021',
      eraId: 9,
      position: 10,
      accuracy: 80,
      legend: false,
    });

    const board = await mockErasApi.leaderboard('abu-dhabi-2021', false);
    expect(board.me).toEqual({ rank: 1, accuracy: 90 });
    expect(board.entries).toEqual([{ rank: 1, name: 'You (mock)', accuracy: 90 }]);
    // Legend has its own board.
    expect((await mockErasApi.leaderboard('abu-dhabi-2021', true)).me).toBeNull();
  });

  it('keeps Legend stars apart', async () => {
    await play('abu-dhabi-2021', true, { accuracy: 70, stars: ALL, rewrite: false });
    const era9 = (await mockErasApi.history()).eras.find((e) => e.eraId === 9);
    expect(era9?.legendStars).toEqual({ have: 3, total: 30 });
    expect(era9?.stars).toEqual({ have: 3, total: 30 });
    expect((await mockErasApi.leaderboard('abu-dhabi-2021', true)).me).toEqual({
      rank: 1,
      accuracy: 70,
    });
  });
});
