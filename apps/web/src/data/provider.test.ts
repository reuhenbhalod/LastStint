import type { RaceModel } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api.js';
import { ApiDailyProvider, ModelError, StaticDailyProvider, practiceReason } from './provider.js';

describe('StaticDailyProvider', () => {
  it('serves the Abu Dhabi 2021 race as practice', async () => {
    const today = await new StaticDailyProvider().today();
    expect(today.raceId).toBe('abu-dhabi-2021');
    expect(today.seed).toBe(today.model.race.seed);
    expect(today.model.userSide).toBe('HAM');
    expect(today.source).toBe('practice');
  });
});

describe('ApiDailyProvider', () => {
  const fixture = async () => (await new StaticDailyProvider().today()).model;
  const daily = {
    date: '2026-11-01',
    number: 3,
    raceId: 'abu-dhabi-2021',
    seed: 64,
    side: 'HAM',
    modelUrl: 'https://w/api/races/abu-dhabi-2021?h=x',
    modelHash: 'x',
  };

  it("serves today's daily from the Worker with its pinned model", async () => {
    const model = await fixture();
    const asked: string[] = [];
    const p = new ApiDailyProvider(
      async (date) => {
        asked.push(date);
        return daily;
      },
      async (url) => {
        asked.push(url);
        return model;
      },
      () => '2026-11-01',
    );
    const today = await p.today();
    expect(asked).toEqual(['2026-11-01', daily.modelUrl]);
    expect(today).toMatchObject({ date: '2026-11-01', number: 3, seed: 64, source: 'live' });
    expect(today.model).toBe(model);
  });

  it('falls back to practice when no daily is scheduled', async () => {
    const p = new ApiDailyProvider(
      async () => {
        throw new ApiError(404, 'no-daily');
      },
      async () => ({}) as RaceModel,
    );
    const today = await p.today();
    expect(today.source).toBe('practice');
    expect(today.practiceReason).toMatch(/No daily/);
  });

  it('falls back to practice when the server is unreachable', async () => {
    const p = new ApiDailyProvider(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await p.today()).practiceReason).toMatch(/reach the server/);
  });

  it('says exactly why there is no live daily', () => {
    expect(practiceReason(new ApiError(503, 'model-changed'))).toBe(
      'Today’s race is being updated on the server.',
    );
    expect(practiceReason(new ApiError(404, 'no-daily'))).toMatch(/No daily race/);
    expect(practiceReason(new ApiError(429, 'rate-limited'))).toMatch(/busy/);
    expect(practiceReason(new ApiError(500, 'internal'))).toBe(
      'The server hit an error loading today’s race (500 internal).',
    );
    expect(practiceReason(new ModelError('HTTP 404'))).toBe(
      'Today’s race file didn’t download (HTTP 404).',
    );
    expect(practiceReason(new TypeError('fetch failed'))).toMatch(/Can’t reach the server/);
  });

  it('never says the server is unreachable when it answered', async () => {
    const p = new ApiDailyProvider(async () => {
      throw new ApiError(503, 'model-changed');
    });
    const today = await p.today();
    expect(today.source).toBe('practice');
    expect(today.practiceReason).not.toMatch(/reach/);
  });
});
