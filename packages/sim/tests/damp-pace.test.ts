// Model fix M1 (Eras builds): a driver's pace on a damp track (DriverModel.dampPace) and on a
// wet one (wetPace), mirroring pipeline/tests/test_wet.py's driver_wet. A race file without
// dampPace (every Daily/Gauntlet race) runs exactly as before.

import { describe, expect, it } from 'vitest';
import canadaJson from '../../../data/races/canada-2024.json';
import { cleanLap, simulate } from '../src/sim.js';
import type { CarState, RaceModel } from '../src/types.js';
import { DAMP_EDGE, wetFactor, wetPenalty } from '../src/weather.js';

const canada = canadaJson as unknown as RaceModel;

describe('damp and wet driver pace', () => {
  const weather = canada.weather;
  if (!weather) throw new Error('canada-2024 is a wet race');

  it('uses dampPace under DAMP_EDGE and wetPace from it, fading in to wetness 0.1', () => {
    expect(DAMP_EDGE).toBe(0.15);
    const pen = (w: number) => wetPenalty(weather, 'MEDIUM', w);
    expect(wetFactor(weather, 'MEDIUM', 0.05, 0.02, -0.01)).toBeCloseTo(1 + pen(0.05) - 0.005, 12);
    expect(wetFactor(weather, 'MEDIUM', 0.12, 0.02, -0.01)).toBeCloseTo(1 + pen(0.12) - 0.01, 12);
    expect(wetFactor(weather, 'MEDIUM', 0.15, 0.02, -0.01)).toBeCloseTo(1 + pen(0.15) + 0.02, 12);
    // No dampPace: wetPace at any wetness (the pre-M1 lap), and a dampPace of 0 still counts.
    expect(wetFactor(weather, 'MEDIUM', 0.05, 0.02)).toBeCloseTo(1 + pen(0.05) + 0.01, 12);
    expect(wetFactor(weather, 'MEDIUM', 0.05, 0.02, 0)).toBeCloseTo(1 + pen(0.05), 12);
  });

  it('the clean lap reads the car state', () => {
    const lap = weather.wetness.findIndex((w) => w > 0 && w < DAMP_EDGE) + 1;
    expect(lap).toBeGreaterThan(0);
    const car = {
      basePace: 75,
      compound: 'INTERMEDIATE',
      tyreWear: 2,
      tyreAge: 2,
      wetPace: 0.01,
    } as CarState;
    const damp = { ...car, dampPace: -0.02 } as CarState;
    expect(cleanLap(canada, damp, lap)).toBeLessThan(cleanLap(canada, car, lap));
  });

  it('a race file with no dampPace replays as before; one with it changes the result', () => {
    const takeover = canada.race.takeoverLap;
    const wetAfter = weather.wetness.slice(takeover).some((w) => w > 0 && w < DAMP_EDGE);
    expect(wetAfter).toBe(true);
    const base = simulate(canada, 3);
    const same = simulate(
      { ...canada, drivers: canada.drivers.map((d) => ({ ...d, dampPace: d.wetPace ?? 0 })) },
      3,
    );
    // dampPace equal to wetPace: identical laps.
    for (const code of base.finishers) {
      expect(same.times[code]).toBeCloseTo(base.times[code] as number, 9);
    }
    const code = base.finishers[0];
    if (!code) throw new Error('no finishers');
    const quicker: RaceModel = {
      ...canada,
      drivers: canada.drivers.map((d) => (d.code === code ? { ...d, dampPace: -0.03 } : d)),
    };
    const got = simulate(quicker, 3);
    expect(got.times[code]).toBeLessThan(base.times[code] as number);
  });
});
