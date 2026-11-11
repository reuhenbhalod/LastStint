// The fuel load as the screens read it (fuel load spec).

import { type RaceModel, initRun, stepLap } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import abuJson from '../../../../data/races/abu-dhabi-2021.json';
import { fuelReading, liftText, marginText } from './fuel.js';

const abu = abuJson as unknown as RaceModel;

describe('fuel reading', () => {
  it('is null outside live play', () => {
    expect(fuelReading(initRun(abu, 1).state, abu)).toBeNull();
  });

  it('reads the tank, the margin and the laps of lift and coast to make it up', () => {
    const run = initRun(abu, 1, { decisions: [] });
    stepLap(run);
    const f = fuelReading(run.state, abu);
    expect(f).not.toBeNull();
    expect(f?.kg).toBeGreaterThan(0);
    expect(f?.level).toBeGreaterThan(0);
    expect(f?.level).toBeLessThanOrEqual(1);
    if ((f?.margin ?? 0) < 0) expect(f?.liftLaps).toBeGreaterThan(0);
    else expect(f?.liftLaps).toBe(0);
  });

  it('says it in words', () => {
    expect(marginText(-0.84)).toBe('0.8 kg short');
    expect(marginText(0.5)).toBe('0.5 kg spare');
    expect(marginText(0.01)).toBe('on target');
    expect(liftText(1)).toBe('about 1 lap of lift and coast');
    expect(liftText(3)).toBe('about 3 laps of lift and coast');
  });
});
