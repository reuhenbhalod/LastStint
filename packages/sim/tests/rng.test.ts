import { describe, expect, it } from 'vitest';
import { deriveSeed, mulberry32 } from '../src/rng.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces floats in [0, 1)', () => {
    const r = mulberry32(81723);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a.next()).not.toEqual(b.next());
  });
});

describe('deriveSeed', () => {
  it('is stable for the same (daily seed, stream)', () => {
    expect(deriveSeed(81723, 3)).toEqual(deriveSeed(81723, 3));
  });

  it('separates streams so one car does not share another car draws', () => {
    const daily = 81723;
    const seeds = new Set([0, 1, 2, 3, 4].map((s) => deriveSeed(daily, s)));
    expect(seeds.size).toBe(5);
  });
});
