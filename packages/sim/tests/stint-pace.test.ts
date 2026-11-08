// Pace by stint (Eras model fix M2; pipeline pace.stint_offsets): each scripted car runs its
// real stints at their fitted offsets (DriverModel.stintPace), keyed by the lap the stint began.
// Parity with the Python reference sim on Spain 2021 with offsets entered by hand
// (pipeline/tests/make_stint_pace_fixture.py), on the real strategies and on strategies that
// leave them; and the player's car runs at 0 in live play (its effort is the pace modes').

import { describe, expect, it } from 'vitest';
import spainJson from '../../../data/races/spain-2021.json';
import { initRun, isFinished, realDecisions, simulate, stepLap, stintOffset } from '../src/sim.js';
import type { PitStop, RaceModel, RaceResult, StintPace } from '../src/types.js';
import goldenJson from './fixtures/stint-pace-golden.json';

type Golden = Record<
  string,
  Record<
    string,
    Pick<RaceResult, 'order' | 'finishers'> & Record<'gaps' | 'times', Record<string, number>>
  >
>;
const golden = goldenJson as unknown as Golden;
const spain = spainJson as unknown as RaceModel;

/** make_stint_pace_fixture.py STINT_PACE and DIVERGED. */
const STINT_PACE: Record<string, StintPace[]> = {
  VER: [
    { lap: 0, offset: 0.1 },
    { lap: 25, offset: -0.2 },
    { lap: 61, offset: 0.3 },
  ],
  HAM: [
    { lap: 0, offset: -0.1 },
    { lap: 29, offset: 0.15 },
    { lap: 43, offset: -0.4 },
  ],
  OCO: [{ lap: 24, offset: -0.3 }],
  RUS: [{ lap: 0, offset: 0.2 }],
};
const DIVERGED: Record<string, PitStop[]> = {
  HAM: [{ lap: 29, to: 'MEDIUM', loss: 22.778 }],
  OCO: [{ lap: 27, to: 'MEDIUM' }],
  VER: [
    { lap: 25, to: 'MEDIUM', loss: 23.983 },
    { lap: 55, to: 'SOFT' },
  ],
};

function withStintPace(model: RaceModel, pace = STINT_PACE): RaceModel {
  return {
    ...model,
    drivers: model.drivers.map((d) => (pace[d.code] ? { ...d, stintPace: pace[d.code] } : d)),
  };
}

const model = withStintPace(spain);
const VARIANTS: Array<[string, Record<string, PitStop[]> | undefined]> = [
  ['real', undefined],
  ['diverged', DIVERGED],
];

describe.each(VARIANTS)('%s strategies match the Python reference sim', (name, strategies) => {
  const expected = golden[name] ?? {};
  it.each(Object.keys(expected))('seed %s', (seed) => {
    const want = expected[seed];
    if (!want) throw new Error(`missing golden seed ${seed}`);
    const got = simulate(model, Number(seed), strategies ? { strategies } : undefined);
    expect(got.order).toEqual(want.order);
    expect(got.finishers).toEqual(want.finishers);
    for (const code of want.finishers) {
      expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
      expect(got.gaps[code]).toBeCloseTo(want.gaps[code] as number, 3);
    }
  });
});

describe('pace by stint', () => {
  it('looks up a stint by the lap it began', () => {
    expect(stintOffset(model, 'VER', 0)).toBe(0.1);
    expect(stintOffset(model, 'VER', 25)).toBe(-0.2);
    expect(stintOffset(model, 'VER', 26)).toBe(0);
    expect(stintOffset(model, 'OCO', 0)).toBe(0);
    expect(stintOffset(spain, 'VER', 0)).toBe(0);
  });

  it('a race with no stintPace replays exactly as before', () => {
    const zero = withStintPace(spain, { VER: [], HAM: [] });
    for (const seed of [1, 2, 3]) expect(simulate(zero, seed)).toEqual(simulate(spain, seed));
  });

  it('an offset runs only while its stint does: a stint begun on another lap runs at 0', () => {
    const oco = withStintPace(spain, { OCO: [{ lap: 24, offset: -0.3 }] });
    expect(simulate(oco, 1).times.OCO as number).toBeLessThan(
      (simulate(spain, 1).times.OCO as number) - 5,
    );
    const moved = { strategies: { OCO: [{ lap: 27, to: 'MEDIUM' }] } };
    expect(simulate(oco, 1, moved)).toEqual(simulate(spain, 1, moved));
  });

  it("the player's car runs at 0 in live play; the rest keep their offsets", () => {
    // VER is the player's car: with the real calls, live play is the replay of the race with
    // VER's offsets removed (and HAM, the rival, keeps his).
    const live = initRun(model, model.race.seed, {
      decisions: realDecisions(model),
      incidents: false,
    });
    while (!isFinished(live)) stepLap(live);
    const without = withStintPace(spain, { ...STINT_PACE, VER: [] });
    const replay = initRun(without, model.race.seed);
    while (!isFinished(replay)) stepLap(replay);
    for (const [code, car] of Object.entries(replay.state.cars)) {
      expect(live.state.cars[code]?.totalTime).toBeCloseTo(car.totalTime, 9);
    }
    expect(live.state.cars.VER?.stintPace ?? 0).toBe(0);
    expect(live.state.cars.HAM?.stintPace).toBe(-0.4);
  });
});
