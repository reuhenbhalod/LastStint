import type { RaceModel } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { EraProvider } from './EraProvider.js';
import type { AttemptRequest, ErasApi } from './api.js';
import { MOCK_RACE_ID, mockErasApi } from './mockErasApi.js';

/** The mock, recording the attempts asked for. */
function recording(overrides: Partial<ErasApi> = {}) {
  const asked: AttemptRequest[] = [];
  const api: ErasApi = {
    ...mockErasApi,
    startAttempt: (req) => {
      asked.push(req);
      return mockErasApi.startAttempt(req);
    },
    ...overrides,
  };
  return { api, asked };
}

describe('EraProvider', () => {
  it("loads the attempt's race on the attempt's seed", async () => {
    const { api } = recording({
      startAttempt: async (req) => ({
        ...(await mockErasApi.startAttempt(req)),
        attemptId: 'a1',
        seed: 1234,
      }),
    });
    const daily = await new EraProvider(MOCK_RACE_ID, false, api).today();
    expect(daily).toMatchObject({
      raceId: MOCK_RACE_ID,
      seed: 1234,
      date: 'eras:a1',
      attemptId: 'a1',
      legend: false,
      source: 'practice',
    });
    expect(daily.model.race.id).toBe(MOCK_RACE_ID);
    expect(daily.difficulty).toMatchObject({ information: 'full', decisionTimerSeconds: 45 });
  });

  it('starts a fresh attempt on every load, with Legend passed through', async () => {
    const { api, asked } = recording();
    const p = new EraProvider(MOCK_RACE_ID, true, api);
    const a = await p.today();
    const b = await p.today();
    expect(asked).toEqual([
      { raceId: MOCK_RACE_ID, legend: true },
      { raceId: MOCK_RACE_ID, legend: true },
    ]);
    expect(a.attemptId).not.toBe(b.attemptId);
    expect(a.date).not.toBe(b.date);
    expect(a.legend).toBe(true);
  });

  it('fails when the attempt pins a different race', async () => {
    const other = { race: { id: 'bahrain-2021' } } as unknown as RaceModel;
    const { api } = recording({ loadModel: async () => other });
    await expect(new EraProvider(MOCK_RACE_ID, false, api).today()).rejects.toThrow(
      /served bahrain-2021/,
    );
  });

  it('passes on a refused attempt', async () => {
    await expect(new EraProvider('monaco-2022', false, mockErasApi).today()).rejects.toThrow(
      /only serves/,
    );
    await expect(new EraProvider('', false, mockErasApi).today()).rejects.toThrow(/no race/);
  });
});

describe('mockErasApi', () => {
  it('lists the ten eras in play order with only Era 10 unlocked', async () => {
    const eras = await mockErasApi.eras();
    expect(eras.map((e) => e.eraId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(eras.filter((e) => e.unlocked).map((e) => e.eraId)).toEqual([10]);
    expect(eras.every((e) => e.maxStars === 30 && e.stars === 0)).toBe(true);
  });

  it('serves its one race in Era 9', async () => {
    expect((await mockErasApi.era(9)).races.map((r) => r.raceId)).toEqual([MOCK_RACE_ID]);
    expect((await mockErasApi.era(10)).races).toEqual([]);
    await expect(mockErasApi.era(42)).rejects.toThrow(/no era/);
    await expect(mockErasApi.loadModel('https://x/y')).rejects.toThrow(/no model/);
  });
});
