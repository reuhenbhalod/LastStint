import type { RaceModel } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { EraProvider, eraDailyOf } from './EraProvider.js';
import type { AttemptRequest, ErasApi } from './api.js';
import { ERAS, racesOfEra } from './catalog.js';
import { mockCanStart, mockErasApi } from './mockErasApi.js';

// An Eras race with no race file in this build (the races get files as they're built, so
// the example is looked up, not named).
const NO_FILE = ERAS.flatMap((e) => racesOfEra(e.id))
  .map((r) => r.raceId)
  .find((id) => !mockCanStart(id));

/** A race the mock can start: it has a bundled race file. */
const MOCK_RACE_ID = 'abu-dhabi-2021';

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
      source: 'eras',
      draft: true,
    });
    expect(daily.model.race.id).toBe(MOCK_RACE_ID);
    expect(daily.difficulty).toMatchObject({ information: 'full', decisionTimerSeconds: 45 });
    // Played as the server replays it: the era's rival, and Legend's safety cars.
    expect(daily.run).toEqual({ rivalPolicy: daily.difficulty.rivalPolicy, legend: false });
    expect(daily.modelHash).toBeUndefined();
  });

  it('carries the attempt’s Legend flag, rival and model hash into the run', async () => {
    const { api } = recording({
      startAttempt: async (req) => ({
        ...(await mockErasApi.startAttempt(req)),
        modelHash: 'h1',
      }),
    });
    const daily = await new EraProvider(MOCK_RACE_ID, true, api).today();
    expect(daily.run).toEqual({ rivalPolicy: 'expert', legend: true });
    expect(daily.modelHash).toBe('h1');
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

  it('is an Eras race, not practice, and Draft only when the attempt says so', async () => {
    const { api } = recording({
      startAttempt: async (req) => {
        const { draft: _draft, ...rest } = await mockErasApi.startAttempt(req);
        return rest;
      },
    });
    const daily = await new EraProvider(MOCK_RACE_ID, false, api).today();
    expect(daily.source).toBe('eras');
    expect(daily.practiceReason).toBeUndefined();
    expect(daily.draft).toBe(false);
    expect(eraDailyOf(daily)).toBe(daily);
    expect(eraDailyOf(null)).toBeNull();
    expect(eraDailyOf({ ...daily, source: 'practice' })).toBeNull();
    const { attemptId: _id, ...noAttempt } = daily;
    expect(eraDailyOf(noAttempt)).toBeNull();
  });

  it('fails when the attempt pins a different race', async () => {
    const other = { race: { id: 'bahrain-2021' } } as unknown as RaceModel;
    const { api } = recording({ loadModel: async () => other });
    await expect(new EraProvider(MOCK_RACE_ID, false, api).today()).rejects.toThrow(
      /served bahrain-2021/,
    );
  });

  it('passes on a refused attempt', async () => {
    // Every Eras race has a race file since brazil-1993 and china-2007 were built.
    if (NO_FILE) {
      await expect(new EraProvider(NO_FILE, false, mockErasApi).today()).rejects.toThrow(
        `no race file for ${NO_FILE} in this build yet`,
      );
    }
    await expect(new EraProvider('abu-dhabi-2024', false, mockErasApi).today()).rejects.toThrow(
      /not an Eras race/,
    );
    await expect(new EraProvider('', false, mockErasApi).today()).rejects.toThrow(/no race/);
  });
});

describe('mockErasApi', () => {
  it('lists the ten eras in play order with only Era 10 unlocked, in test mode', async () => {
    const { testMode, eras } = await mockErasApi.eras();
    expect(testMode).toBe(true);
    expect(eras.map((e) => e.eraId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(eras.filter((e) => e.unlocked).map((e) => e.eraId)).toEqual([10]);
    expect(eras.every((e) => e.maxStars === 30 && e.stars === 0)).toBe(true);
  });

  it("lists every era's ten races in position order, all Draft", async () => {
    for (const era of ERAS) {
      const detail = await mockErasApi.era(era.id);
      expect(detail.eraId).toBe(era.id);
      expect(detail.races.map((r) => r.raceId)).toEqual(racesOfEra(era.id).map((r) => r.raceId));
      expect(detail.races.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(detail.races.every((r) => r.draft && r.bestAccuracy === null)).toBe(true);
    }
    // Reconstructed: the 1983–1995 races (spec §4 data table).
    const reconstructed = async (id: number) =>
      (await mockErasApi.era(id)).races.filter((r) => r.reconstructed).map((r) => r.raceId);
    expect(await reconstructed(1)).toHaveLength(10);
    expect(await reconstructed(3)).toEqual(['spain-1994', 'australia-1994', 'belgium-1995']);
    expect(await reconstructed(9)).toEqual([]);
    await expect(mockErasApi.era(42)).rejects.toThrow(/no era/);
    await expect(mockErasApi.loadModel('https://x/y')).rejects.toThrow(/no model/);
    await expect(mockErasApi.loadModel(`mock://races/${NO_FILE}`)).rejects.toThrow(/no model/);
  });

  it('starts attempts only on races with a bundled race file, each loading its own race', async () => {
    const startable = ERAS.flatMap((e) => racesOfEra(e.id))
      .map((r) => r.raceId)
      .filter(mockCanStart);
    expect(startable).toContain(MOCK_RACE_ID);
    expect(startable).not.toContain(NO_FILE);
    for (const raceId of startable) {
      const daily = await new EraProvider(raceId, false, mockErasApi).today();
      expect(daily.model.race.id).toBe(raceId);
    }
  });

  it("gives the era's difficulty, or Legend's", async () => {
    const era10 = await mockErasApi.startAttempt({ raceId: 'hungary-2022', legend: false });
    expect(era10.difficulty).toEqual({
      accuracyThreshold: 70,
      information: 'full',
      rivalPolicy: 'standard',
      decisionTimerSeconds: 45,
    });
    const legend = await mockErasApi.startAttempt({ raceId: 'hungary-2022', legend: true });
    expect(legend.difficulty).toEqual({
      accuracyThreshold: 90,
      information: 'minimal',
      rivalPolicy: 'expert',
      decisionTimerSeconds: 20,
    });
  });
});
