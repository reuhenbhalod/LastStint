// The launch-state e2e's production-mode mock (e2e/launch.ts) against the Worker's rules
// (apps/worker/src/eras.ts), and the map and detail state the app builds from it.
import { STARS_PER_RACE, unlocksNextEra } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import {
  LAUNCH,
  STARS_PER_RACE as LAUNCH_STARS_PER_RACE,
  RELEASED_AT,
  launchEraDetail,
  launchEras,
  launchModelServed,
  launchRefusal,
  unlocksNextEra as launchUnlocks,
} from '../../e2e/launch.js';
import { racesOfEra } from './catalog.js';
import { eraNodes } from './eraMapState.js';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const STAR = { result: true, strategist: true, mastery: true };
const ONE = { result: true, strategist: false, mastery: false };
const era10 = racesOfEra(10).map((r) => r.raceId);
const era9 = racesOfEra(9).map((r) => r.raceId);

/** Era 10 at `n` stars (whole races first, then a single star). */
function era10Stars(n: number): Record<string, typeof STAR> {
  const out: Record<string, typeof STAR> = {};
  for (const [i, id] of era10.entries()) {
    const left = n - 3 * i;
    if (left >= 3) out[id] = STAR;
    else if (left > 0) out[id] = left === 1 ? ONE : { ...STAR, mastery: false };
  }
  return out;
}

describe('launch unlock rule', () => {
  it('matches the sim helper', () => {
    expect(LAUNCH_STARS_PER_RACE).toBe(STARS_PER_RACE);
    for (const races of [0, 1, 3, 7, 10])
      for (let stars = 0; stars <= 3 * races; stars++)
        expect(launchUnlocks(stars, races)).toBe(unlocksNextEra(stars, races));
  });
});

describe('launchEras', () => {
  it('reports production mode with Eras 10 and 9 released and the rest coming soon', () => {
    const res = launchEras(LAUNCH, NOW);
    expect(res.testMode).toBe(false);
    expect(res.eras.map((e) => [e.eraId, e.released])).toEqual([
      [10, true],
      [9, true],
      [8, false],
      [7, false],
      [6, false],
      [5, false],
      [4, false],
      [3, false],
      [2, false],
      [1, false],
    ]);
    expect(res.eras.every((e) => e.maxStars === 30)).toBe(true);
  });

  it('keeps an era with a future released_at coming soon', () => {
    const seed = { ...LAUNCH, releasedAt: { 10: RELEASED_AT, 9: '2026-12-01T00:00:00.000Z' } };
    expect(launchEras(seed, NOW).eras.find((e) => e.eraId === 9)?.released).toBe(false);
  });

  it('unlocks Era 9 at 21 stars in Era 10, not 20', () => {
    const at = (n: number) =>
      launchEras({ ...LAUNCH, stars: era10Stars(n) }, NOW).eras.find((e) => e.eraId === 9);
    expect(at(20)).toMatchObject({ unlocked: false });
    expect(at(21)).toMatchObject({ unlocked: true });
    expect(launchEras({ ...LAUNCH, stars: era10Stars(21) }, NOW).eras[0]?.stars).toBe(21);
  });

  it('gives the map Era 10 open, Era 9 locked and the others coming soon', () => {
    const nodes = eraNodes(launchEras(LAUNCH, NOW));
    expect(nodes.map((n) => [n.era.eraId, n.open, n.locked, n.comingSoon])).toEqual([
      [10, true, false, false],
      [9, false, true, false],
      ...[8, 7, 6, 5, 4, 3, 2, 1].map((id) => [id, false, true, true]),
    ]);
  });
});

describe('launchEraDetail', () => {
  it('lists every published race of a released era, none of them draft', () => {
    const d = launchEraDetail(LAUNCH, 10, NOW);
    expect(d?.races.map((r) => r.raceId)).toEqual(era10);
    expect(d?.races.some((r) => r.draft)).toBe(false);
    expect(d?.legendUnlocked).toBe(false);
  });

  it('leaves unpublished races out', () => {
    const seed = { ...LAUNCH, published: ['hungary-2022', 'belgium-2023'] };
    expect(launchEraDetail(seed, 10, NOW)?.races.map((r) => r.raceId)).toEqual([
      'hungary-2022',
      'belgium-2023',
    ]);
    // As the Worker: maxStars still counts every race row of the era.
    expect(launchEraDetail(seed, 10, NOW)?.maxStars).toBe(30);
  });

  it('lists nothing in an unreleased era, even a published race', () => {
    const seed = { ...LAUNCH, published: [...LAUNCH.published, racesOfEra(8)[0]?.raceId ?? ''] };
    expect(launchEraDetail(seed, 8, NOW)?.races).toEqual([]);
  });

  it('is null for an era that does not exist', () => {
    expect(launchEraDetail(LAUNCH, 11, NOW)).toBeNull();
  });
});

describe('launchRefusal', () => {
  const partial = { ...LAUNCH, published: LAUNCH.published.filter((id) => id !== 'bahrain-2023') };

  it('starts a published race in the open era', () => {
    expect(launchRefusal(LAUNCH, 'hungary-2022', false, NOW)).toBeNull();
  });

  it('refuses in the Worker order', () => {
    expect(launchRefusal(LAUNCH, 'nowhere-2000', false, NOW)).toEqual({
      status: 404,
      error: 'no-race',
    });
    expect(launchRefusal(LAUNCH, 'monaco-1984', false, NOW)).toEqual({
      status: 403,
      error: 'era-unreleased',
    });
    expect(launchRefusal(partial, 'bahrain-2023', false, NOW)).toEqual({
      status: 403,
      error: 'race-unpublished',
    });
    expect(launchRefusal(LAUNCH, era9[0] as string, false, NOW)).toEqual({
      status: 403,
      error: 'era-locked',
    });
    expect(launchRefusal(LAUNCH, 'hungary-2022', true, NOW)).toEqual({
      status: 403,
      error: 'legend-locked',
    });
  });

  it('opens Era 9 at the threshold and Legend once Era 10 is cleared', () => {
    const seed = { ...LAUNCH, stars: era10Stars(21) };
    expect(launchRefusal(seed, era9[0] as string, false, NOW)).toBeNull();
    const cleared = { ...LAUNCH, stars: Object.fromEntries(era10.map((id) => [id, ONE])) };
    expect(launchRefusal(cleared, 'hungary-2022', true, NOW)).toBeNull();
  });

  it('serves models of published races in released eras only', () => {
    expect(launchModelServed(LAUNCH, 'hungary-2022', NOW)).toBe(true);
    expect(launchModelServed(partial, 'bahrain-2023', NOW)).toBe(false);
    expect(launchModelServed(LAUNCH, 'monaco-1984', NOW)).toBe(false);
  });
});
