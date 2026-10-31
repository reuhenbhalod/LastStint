import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from './provider.js';

describe('StaticDailyProvider', () => {
  it('serves the Abu Dhabi 2021 fixture', async () => {
    const today = await new StaticDailyProvider().today();
    expect(today.raceId).toBe('abu-dhabi-2021');
    expect(today.seed).toBe(today.model.race.seed);
    expect(today.model.userSide).toBe('HAM');
    expect(today.model.drivers.length).toBeGreaterThan(0);
  });
});
