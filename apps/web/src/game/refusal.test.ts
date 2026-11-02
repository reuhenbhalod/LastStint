import type { CarState } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { type LiveCall, REFUSE_BASE, refusal, roll } from './refusal.js';

const car = (tyreAge: number) => ({ tyreAge }) as CarState;
const box: LiveCall = { lap: 40, kind: 'pit', compound: 'SOFT' };

describe('driver refusals', () => {
  it('rolls in [0, 1) and is deterministic', () => {
    expect(roll('a')).toBe(roll('a'));
    expect(roll('a')).not.toBe(roll('b'));
    for (const s of ['', 'x', '64|40|pit:SOFT']) {
      expect(roll(s)).toBeGreaterThanOrEqual(0);
      expect(roll(s)).toBeLessThan(1);
    }
  });

  it('gives the same answer to the same call on the same lap', () => {
    for (let lap = 34; lap < 58; lap++) {
      expect(refusal(64, lap, box, car(20))).toBe(refusal(64, lap, box, car(20)));
    }
  });

  it('refuses about the base rate of calls, and more often with a reason', () => {
    let base = 0;
    let fresh = 0;
    const n = 4000;
    for (let seed = 0; seed < n; seed++) {
      if (refusal(seed, 40, box, car(20))) base++;
      if (refusal(seed, 40, box, car(2))) fresh++;
    }
    expect(base / n).toBeGreaterThan(REFUSE_BASE - 0.03);
    expect(base / n).toBeLessThan(REFUSE_BASE + 0.03);
    expect(fresh / n).toBeGreaterThan(0.3);
  });

  it('says why when the tyres are new', () => {
    const seed = Array.from({ length: 200 }, (_, i) => i).find((s) => refusal(s, 40, box, car(2)));
    expect(refusal(seed as number, 40, box, car(2))).toMatch(/brand new/);
  });
});
