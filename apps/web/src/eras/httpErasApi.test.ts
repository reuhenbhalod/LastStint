import { describe, expect, it } from 'vitest';
import { ApiError } from '../api.js';
import type { AttemptResponse, EraDetail, EraLeaderboard, HistoryBook, RaceStats } from './api.js';
import type { ErasResponse } from './api.js';
import { createHttpErasApi } from './httpErasApi.js';

const PLAYER = '11111111-1111-4111-8111-111111111111';

function recorder(responses: Record<string, unknown>) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const answer = <T>(path: string): T => {
    if (!(path in responses)) throw new ApiError(404, 'not-found');
    return responses[path] as T;
  };
  return {
    calls,
    deps: {
      playerId: () => PLAYER,
      get: async <T>(path: string) => {
        calls.push({ method: 'GET', path });
        return answer<T>(path);
      },
      post: async <T>(path: string, body: unknown) => {
        calls.push({ method: 'POST', path, body });
        return answer<T>(path);
      },
    },
  };
}

describe('httpErasApi', () => {
  it('GET /api/eras for the player, returning the mode and the eras', async () => {
    const body: ErasResponse = { testMode: true, eras: [] };
    const r = recorder({ [`/api/eras?anonId=${PLAYER}`]: body });
    expect(await createHttpErasApi(r.deps).eras()).toEqual(body);
    expect(r.calls).toEqual([{ method: 'GET', path: `/api/eras?anonId=${PLAYER}` }]);
  });

  it('GET /api/eras/:eraId for the player', async () => {
    const detail = { eraId: 9, races: [] } as unknown as EraDetail;
    const r = recorder({ [`/api/eras/9?anonId=${PLAYER}`]: detail });
    expect(await createHttpErasApi(r.deps).era(9)).toBe(detail);
  });

  it('refuses a non-integer era id without calling the server', async () => {
    const r = recorder({});
    await expect(createHttpErasApi(r.deps).era(Number.NaN)).rejects.toThrow(RangeError);
    expect(r.calls).toEqual([]);
  });

  it('POST /api/eras/attempts with the player, race and Legend flag', async () => {
    const attempt: AttemptResponse = {
      attemptId: 'a',
      seed: 7,
      modelUrl: 'https://w/api/eras/races/abu-dhabi-2021/model?h=x',
      difficulty: {
        accuracyThreshold: 72,
        information: 'full',
        rivalPolicy: 'standard',
        decisionTimerSeconds: 45,
      },
    };
    const r = recorder({ '/api/eras/attempts': attempt });
    const api = createHttpErasApi(r.deps);
    expect(await api.startAttempt({ raceId: 'abu-dhabi-2021', legend: true })).toBe(attempt);
    expect(r.calls).toEqual([
      {
        method: 'POST',
        path: '/api/eras/attempts',
        body: { anonId: PLAYER, raceId: 'abu-dhabi-2021', legend: true },
      },
    ]);
  });

  it('loads the pinned model from its absolute URL', async () => {
    const url = 'https://w/api/eras/races/abu-dhabi-2021/model?h=x';
    const r = recorder({ [url]: { race: {} } });
    expect(await createHttpErasApi(r.deps).loadModel(url)).toEqual({ race: {} });
    expect(r.calls).toEqual([{ method: 'GET', path: url }]);
  });

  it("passes the server's errors through (a refused attempt)", async () => {
    const r = recorder({});
    await expect(
      createHttpErasApi(r.deps).startAttempt({ raceId: 'x', legend: false }),
    ).rejects.toMatchObject({ status: 404, code: 'not-found' });
  });
  it('GET /api/history for the player', async () => {
    const book = { completion: { collected: 0, total: 830, percent: 0 } } as unknown as HistoryBook;
    const r = recorder({ [`/api/history?anonId=${PLAYER}`]: book });
    expect(await createHttpErasApi(r.deps).history()).toBe(book);
    expect(r.calls).toEqual([{ method: 'GET', path: `/api/history?anonId=${PLAYER}` }]);
  });

  it("GET a race's community stats", async () => {
    const stats = { raceId: 'abu-dhabi-2021' } as unknown as RaceStats;
    const r = recorder({ '/api/eras/races/abu-dhabi-2021/stats': stats });
    expect(await createHttpErasApi(r.deps).raceStats('abu-dhabi-2021')).toBe(stats);
  });

  it('GET the normal and Legend leaderboards with the player, for their rank', async () => {
    const normal = { legend: false } as unknown as EraLeaderboard;
    const legend = { legend: true } as unknown as EraLeaderboard;
    const path = (l: boolean) =>
      `/api/eras/races/abu-dhabi-2021/leaderboard?legend=${l}&anonId=${PLAYER}`;
    const r = recorder({ [path(false)]: normal, [path(true)]: legend });
    const api = createHttpErasApi(r.deps);
    expect(await api.leaderboard('abu-dhabi-2021', false)).toBe(normal);
    expect(await api.leaderboard('abu-dhabi-2021', true)).toBe(legend);
    expect(r.calls.map((c) => c.path)).toEqual([path(false), path(true)]);
  });
});
