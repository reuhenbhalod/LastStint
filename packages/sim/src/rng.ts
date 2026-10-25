// Seeded PRNG (Implementation Plan 2.2).
// Small, fast, deterministic — never Math.random, so runs are reproducible and the Worker
// can replay them. One stream per car, derived from the daily seed, so a user's decision
// for their car does not shift the random draws of every other car.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
}

/** mulberry32: a 32-bit seeded generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Derive a per-stream seed from the daily seed and a stream index (e.g. a car index). */
export function deriveSeed(dailySeed: number, stream: number): number {
  // xmur3-style mix so nearby (seed, stream) pairs produce well-separated streams.
  let h = (dailySeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ stream, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
