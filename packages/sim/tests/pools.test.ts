// The game modes' race pools (data/pools.json, survivor spec D3): daily and survivor races are
// separate, every pool race is playable, and every playable race is in a pool.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RaceModel } from '../src/types.js';

const data = join(__dirname, '..', '..', '..', 'data');
const pools = JSON.parse(readFileSync(join(data, 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, number[]>;
};
const race = (id: string) =>
  JSON.parse(readFileSync(join(data, 'races', `${id}.json`), 'utf8')) as RaceModel;

describe('race pools', () => {
  it('keeps daily and survivor races apart', () => {
    const survivor = Object.keys(pools.survivor);
    expect(pools.daily.filter((id) => survivor.includes(id))).toEqual([]);
    expect(new Set(pools.daily).size).toBe(pools.daily.length);
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
    const pooled = new Set([...pools.daily, ...Object.keys(pools.survivor)]);
    const playable = readdirSync(join(data, 'races'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter((id) => race(id).decisionMoments.length > 0);
    expect(playable.filter((id) => !pooled.has(id))).toEqual([]);
  });
});
