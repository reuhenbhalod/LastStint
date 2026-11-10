// The e2e mock's production mode (e2e/erasProduction.ts) against the real rules: the sim's unlock
// helper (the one the Worker and the map use) and the Worker's release and attempt checks.
import { ERA_UNLOCK_SHARE, unlockThreshold as simThreshold, unlocksNextEra } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import {
  attemptRefusal,
  releasedForReal,
  seededStars,
  unlockThreshold,
  unlockedEras,
} from '../../e2e/erasProduction.js';
import { racesOfEra } from './catalog.js';

const count = (s: { result: boolean; strategist: boolean; mastery: boolean }) =>
  Number(s.result) + Number(s.strategist) + Number(s.mastery);

describe('e2e eras mock, production mode', () => {
  it('unlocks exactly as the sim does, 21 of 30 at the configured share', () => {
    expect(unlockThreshold(10, ERA_UNLOCK_SHARE)).toBe(21);
    for (const races of [0, 1, 7, 10]) {
      expect(unlockThreshold(races, ERA_UNLOCK_SHARE)).toBe(simThreshold(races));
      for (let stars = 0; stars <= 3 * races; stars++) {
        const map = unlockedEras(
          [
            { eraId: 10, stars, races },
            { eraId: 9, stars: 0, races },
          ],
          ERA_UNLOCK_SHARE,
        );
        expect(map.get(10)).toBe(true);
        expect(map.get(9)).toBe(unlocksNextEra(stars, races));
      }
    }
  });

  it('locks every era after one short of the threshold, by its own predecessor', () => {
    const map = unlockedEras(
      [
        { eraId: 10, stars: 30, races: 10 },
        { eraId: 9, stars: 20, races: 10 },
        { eraId: 8, stars: 30, races: 10 },
        { eraId: 7, stars: 0, races: 10 },
      ],
      ERA_UNLOCK_SHARE,
    );
    expect([...map]).toEqual([
      [10, true],
      [9, true],
      [8, false],
      [7, true],
    ]);
  });

  it('releases an era once released_at is set and reached', () => {
    const now = '2026-11-09T12:00:00.000Z';
    expect(releasedForReal(null, now)).toBe(false);
    expect(releasedForReal(undefined, now)).toBe(false);
    expect(releasedForReal('2026-11-10T00:00:00.000Z', now)).toBe(false);
    expect(releasedForReal(now, now)).toBe(true);
    expect(releasedForReal('2026-01-01T00:00:00.000Z', now)).toBe(true);
  });

  it('seeds an era star count over its races, 3 a race in order', () => {
    const ids = racesOfEra(10).map((r) => r.raceId);
    for (const n of [0, 1, 20, 21, 30]) {
      const stars = seededStars(ids, n);
      expect([...stars.values()].reduce((t, s) => t + count(s), 0)).toBe(n);
    }
    const twenty = [...seededStars(ids, 20).values()].map(count);
    expect(twenty).toEqual([3, 3, 3, 3, 3, 3, 2, 0, 0, 0]);
    expect(seededStars(ids, 2).get(ids[0] as string)).toEqual({
      result: true,
      strategist: true,
      mastery: false,
    });
    expect(() => seededStars(ids, 31)).toThrow(RangeError);
    expect(() => seededStars(ids, -1)).toThrow(RangeError);
    expect(() => seededStars(ids, 1.5)).toThrow(RangeError);
  });

  it("refuses attempts with the Worker's codes, in its order", () => {
    expect(attemptRefusal({ released: false, unlocked: true, published: true })).toBe(
      'era-unreleased',
    );
    expect(attemptRefusal({ released: true, unlocked: true, published: false })).toBe(
      'race-unpublished',
    );
    expect(attemptRefusal({ released: true, unlocked: false, published: true })).toBe('era-locked');
    expect(attemptRefusal({ released: true, unlocked: true, published: true })).toBeNull();
  });
});
