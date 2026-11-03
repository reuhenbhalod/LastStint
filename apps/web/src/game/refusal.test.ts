import type { CarState } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { ignoreRate } from '../data/drivers.js';
import { type LiveCall, refusal, roll } from './refusal.js';

const car = (tyreAge: number) => ({ tyreAge }) as CarState;
const box: LiveCall = { lap: 40, kind: 'pit', compound: 'SOFT' };

/** Share of 4000 seeds on which the call is refused. */
function refused(ignores: number, age = 20, call = box): number {
  let n = 0;
  for (let seed = 0; seed < 4000; seed++) if (refusal(seed, 40, call, car(age), ignores)) n++;
  return n / 4000;
}

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
      expect(refusal(64, lap, box, car(20), 0.15)).toBe(refusal(64, lap, box, car(20), 0.15));
    }
  });

  it("refuses at the driver's researched rate, and only that", () => {
    const ham = ignoreRate('HAM');
    expect(ham).toBe(0.15);
    expect(refused(ham)).toBeGreaterThan(ham - 0.02);
    expect(refused(ham)).toBeLessThan(ham + 0.02);
    // A reason (brand-new tyres) changes what he says, not how often.
    expect(refused(ham, 2)).toBeCloseTo(refused(ham, 20), 5);
    expect(refused(ignoreRate('BOT'))).toBeLessThan(0.02);
    expect(refused(0)).toBe(0);
  });

  it('says why when the tyres are new', () => {
    const seed = Array.from({ length: 400 }, (_, i) => i).find((s) =>
      refusal(s, 40, box, car(2), 0.15),
    );
    expect(refusal(seed as number, 40, box, car(2), 0.15)).toMatch(/brand new/);
  });
});
