import { describe, expect, it } from 'vitest';
import vectorsJson from '../../../data/golden/rng-vectors.json';
import { deriveSeed, mulberry32 } from '../src/rng.js';

// Cross-language contract: data/golden/rng-vectors.json is generated from the Python port
// (pipeline/src/pipeline/rng.py) and must match this implementation bit for bit.
const vectors: {
  mulberry32: Record<string, number[]>;
  deriveSeed: Array<{ daily: number; stream: number; seed: number }>;
  normal: Record<string, number[]>;
} = vectorsJson;

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

describe('parity with the Python port', () => {
  it('mulberry32 streams match bit for bit', () => {
    for (const [seed, expected] of Object.entries(vectors.mulberry32)) {
      const r = mulberry32(Number(seed));
      expect(Array.from({ length: expected.length }, () => r.next())).toEqual(expected);
    }
  });

  it('deriveSeed matches', () => {
    for (const v of vectors.deriveSeed) expect(deriveSeed(v.daily, v.stream)).toBe(v.seed);
  });

  it('normal draws match to 1e-12', () => {
    for (const [seed, expected] of Object.entries(vectors.normal)) {
      const r = mulberry32(Number(seed));
      for (const x of expected) expect(r.normal(0.5)).toBeCloseTo(x, 12);
    }
  });
});
