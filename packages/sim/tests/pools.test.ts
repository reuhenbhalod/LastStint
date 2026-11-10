// The game modes' race pools (data/pools.json, survivor spec D3; Eras spec §4–5): daily and
// survivor (Gauntlet) races are separate, a race may also be in Eras, every daily and survivor
// race is playable, and every playable race is in a pool. Eras races need no race file yet:
// they're built era by era, and stay Draft until they pass validation.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RaceModel } from '../src/types.js';

const data = join(__dirname, '..', '..', '..', 'data');
const pools = JSON.parse(readFileSync(join(data, 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, number[]>;
  eras: Record<string, string[]>;
};
const erasRaces = Object.values(pools.eras).flat();
const race = (id: string) =>
  JSON.parse(readFileSync(join(data, 'races', `${id}.json`), 'utf8')) as RaceModel;

describe('race pools', () => {
  it('keeps daily and survivor races apart', () => {
    const survivor = Object.keys(pools.survivor);
    expect(pools.daily.filter((id) => survivor.includes(id))).toEqual([]);
    expect(new Set(pools.daily).size).toBe(pools.daily.length);
  });

  it('lets a daily race be in Eras too: the five shared ones', () => {
    const shared = ['abu-dhabi-2021', 'bahrain-2021', 'france-2021', 'russia-2021', 'hungary-2019'];
    for (const id of shared) {
      expect(pools.daily, id).toContain(id);
      expect(erasRaces, id).toContain(id);
    }
  });

  it('lets a Gauntlet race be in Eras too: portugal-2021 (Era 9 swap, Nov 9)', () => {
    const survivor = Object.keys(pools.survivor);
    const shared = erasRaces.filter((id) => survivor.includes(id));
    expect(shared).toEqual(['portugal-2021']);
    expect(pools.eras['9']?.[4]).toBe('portugal-2021');
  });

  it('lists the ten eras, ten distinct races each', () => {
    expect(Object.keys(pools.eras).sort((a, b) => Number(a) - Number(b))).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    );
    for (const [era, ids] of Object.entries(pools.eras)) {
      expect(ids.length, `era ${era}`).toBe(10);
      for (const id of ids) expect(id, `era ${era}`).toMatch(/^[a-z]+(-[a-z]+)*-\d{4}$/);
    }
    expect(new Set(erasRaces).size).toBe(100);
  });

  it('only has playable races, survivor ones with seeds to deal', () => {
    for (const id of [...pools.daily, ...Object.keys(pools.survivor)]) {
      expect(race(id).decisionMoments.length, id).toBeGreaterThan(0);
    }
    for (const [id, seeds] of Object.entries(pools.survivor)) {
      expect(seeds.length, id).toBeGreaterThan(0);
      expect(
        seeds.every((s) => Number.isInteger(s) && s > 0),
        id,
      ).toBe(true);
    }
  });

  it('puts every playable race in a pool', () => {
    // Authored Eras races swapped out of the pools (Era 6 second round, Nov 9) keep their
    // overlays, moments and race files as Eras-build fixtures; they aren't served.
    const swappedOut = ['china-2011', 'spain-2013'];
    const pooled = new Set([
      ...pools.daily,
      ...Object.keys(pools.survivor),
      ...erasRaces,
      ...swappedOut,
    ]);
    expect(swappedOut.filter((id) => erasRaces.includes(id))).toEqual([]);
    const playable = readdirSync(join(data, 'races'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter((id) => race(id).decisionMoments.length > 0);
    expect(playable.filter((id) => !pooled.has(id))).toEqual([]);
  });
});
