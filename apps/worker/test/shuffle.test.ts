// The daily schedule's shuffle (src/shuffle.ts): random order, every race once per pass, and
// no two days in a row alike.
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/dates.js';
import { DAILY_POOL } from '../src/pools.js';
import { getRace } from '../src/races.js';
import { type RaceFacts, circuitOf, clash, pickRaces, usedThisPass } from '../src/shuffle.js';

/** A seeded random source, so a failure can be replayed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const dates = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

async function dailyPool(): Promise<RaceFacts[]> {
  const out: RaceFacts[] = [];
  for (const id of DAILY_POOL) {
    const race = await getRace(id);
    if (race) out.push({ id, userSide: race.model.userSide, rival: race.model.rival });
  }
  return out;
}

describe('daily shuffle', () => {
  it('names circuits across id spellings', () => {
    expect(circuitOf('mexico-2021')).toBe('mexico');
    expect(circuitOf('united-states-2019')).toBe(circuitOf('united-states-2022'));
    expect(circuitOf('styria-2021')).toBe(circuitOf('austria-2019'));
    expect(circuitOf('saudi-arabia-2025')).toBe(circuitOf('saudi-arabia-2022'));
  });

  it('plays every race once before any repeats', async () => {
    const pool = await dailyPool();
    const picks = pickRaces(pool, [], dates('2026-12-01', pool.length * 3), seeded(1));
    for (let pass = 0; pass < 3; pass++) {
      const ids = picks.slice(pass * pool.length, (pass + 1) * pool.length).map((p) => p.raceId);
      expect(new Set(ids).size).toBe(pool.length);
    }
  });

  it('is not alphabetical, and differs from one shuffle to the next', async () => {
    const pool = await dailyPool();
    const days = dates('2026-12-01', pool.length);
    const a = pickRaces(pool, [], days, seeded(1)).map((p) => p.raceId);
    const b = pickRaces(pool, [], days, seeded(2)).map((p) => p.raceId);
    expect(a).not.toEqual([...a].sort());
    expect(a).not.toEqual(b);
  });

  it('never puts the same circuit on consecutive days', async () => {
    const pool = await dailyPool();
    for (let seed = 1; seed <= 50; seed++) {
      const ids = pickRaces(pool, [], dates('2026-12-01', 60), seeded(seed)).map((p) => p.raceId);
      for (let i = 1; i < ids.length; i++) {
        expect(circuitOf(ids[i] as string), `seed ${seed}, day ${i}`).not.toBe(
          circuitOf(ids[i - 1] as string),
        );
      }
    }
  }, 300_000);

  it('keeps a race from coming straight back where one pass meets the next', async () => {
    const pool = await dailyPool();
    const half = Math.floor(pool.length / 2);
    for (let seed = 1; seed <= 50; seed++) {
      const ids = pickRaces(pool, [], dates('2026-12-01', 120), seeded(seed)).map((p) => p.raceId);
      ids.forEach((id, i) => {
        const back = ids.slice(Math.max(0, i - half), i);
        expect(back, `seed ${seed}, day ${i}`).not.toContain(id);
      });
    }
  }, 300_000); // 68 races x 50 seeds: about 17 s on a laptop, over a minute on a CI runner

  it('keeps scheduled days, counts them in the bag, and avoids their neighbours', () => {
    const pool: RaceFacts[] = [
      { id: 'mexico-2019', rival: 'HAM', userSide: 'VET' },
      { id: 'mexico-2021', rival: 'HAM', userSide: 'PER' },
      { id: 'italy-2024', rival: 'LEC', userSide: 'PIA' },
      { id: 'spain-2020', rival: 'BOT', userSide: 'VER' },
    ];
    const existing = [
      { date: '2026-12-01', raceId: 'mexico-2019' },
      { date: '2026-12-03', raceId: 'italy-2024' },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const picks = pickRaces(pool, existing, ['2026-12-02', '2026-12-04'], seeded(seed));
      expect(picks.map((p) => p.date)).toEqual(['2026-12-02', '2026-12-04']);
      // Between Mexico and Italy, with Mexico and Italy already used this pass: Spain fits
      // best on the 2nd (no circuit or rival in common); the other Mexico takes the 4th.
      expect(picks.map((p) => p.raceId)).toEqual(['spain-2020', 'mexico-2021']);
    }
  });

  it('starts a new pass once every race has played', () => {
    const pool: RaceFacts[] = [{ id: 'a-2020' }, { id: 'b-2020' }];
    expect(usedThisPass(pool, ['a-2020', 'b-2020'])).toEqual(new Set());
    expect(usedThisPass(pool, ['a-2020', 'b-2020', 'b-2020'])).toEqual(new Set(['b-2020']));
    expect(usedThisPass(pool, ['gone-2019', 'a-2020'])).toEqual(new Set(['a-2020']));
  });

  it('scores a clash by circuit, then rival, then driver', () => {
    const a = { id: 'mexico-2019', rival: 'HAM', userSide: 'VET' };
    expect(clash(a, { id: 'mexico-2021', rival: 'HAM', userSide: 'PER' })).toBe(6);
    expect(clash(a, { id: 'italy-2019', rival: 'HAM', userSide: 'VET' })).toBe(3);
    expect(clash(a, undefined)).toBe(0);
  });
});
