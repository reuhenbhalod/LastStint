// Pace by stint (Eras model fix M2; pipeline pace.stint_offsets): each scripted car runs its
// real stints at their fitted offsets (DriverModel.stintPace), keyed by the lap the stint began.
// Parity with the Python reference sim on Spain 2021 with offsets entered by hand
// (pipeline/tests/make_stint_pace_fixture.py), on the real strategies and on strategies that
// leave them; and the player's car in live play runs its race-wide mean offset in every stint
// (sim.ts playerStintOffset).

import { describe, expect, it } from 'vitest';
import spainJson from '../../../data/races/spain-2021.json';
import {
  initRun,
  isFinished,
  playerStintOffset,
  realDecisions,
  simulate,
  stepLap,
  stintOffset,
} from '../src/sim.js';
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
/** Spain 2021 with no pace by stint (the rebuilt file carries its own fitted offsets). */
const bare: RaceModel = {
  ...spain,
  drivers: spain.drivers.map(({ stintPace: _, ...d }) => d),
};

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
    expect(stintOffset(bare, 'VER', 0)).toBe(0);
  });

  it('a race with no stintPace replays exactly as before', () => {
    const zero = withStintPace(bare, { VER: [], HAM: [] });
    for (const seed of [1, 2, 3]) expect(simulate(zero, seed)).toEqual(simulate(bare, seed));
  });

  it('an offset runs only while its stint does: a stint begun on another lap runs at 0', () => {
    const oco = withStintPace(spain, { OCO: [{ lap: 24, offset: -0.3 }] });
    expect(simulate(oco, 1).times.OCO as number).toBeLessThan(
      (simulate(spain, 1).times.OCO as number) - 5,
    );
    const moved = { strategies: { OCO: [{ lap: 27, to: 'MEDIUM' }] } };
    expect(simulate(oco, 1, moved)).toEqual(simulate(spain, 1, moved));
  });

  it("the player's car in live play runs its race-wide offset; the rest keep their offsets", () => {
    // VER is the player's car: its stints run laps 21-24 at +0.1, 25-60 at -0.2 and 61-66 at
    // +0.3, so live play with the real calls is the replay with VER at the laps-weighted mean
    // in every stint (and HAM, the rival, keeps his).
    const mean = (4 * 0.1 + 36 * -0.2 + 6 * 0.3) / 46;
    expect(playerStintOffset(model)).toBeCloseTo(mean, 12);
    const live = initRun(model, model.race.seed, {
      decisions: realDecisions(model),
      incidents: false,
    });
    expect(live.state.cars.VER?.stintPace).toBe(playerStintOffset(model));
    while (!isFinished(live)) stepLap(live);
    const flat = [0, 25, 61].map((lap) => ({ lap, offset: playerStintOffset(model) }));
    const replay = initRun(withStintPace(spain, { ...STINT_PACE, VER: flat }), model.race.seed);
    while (!isFinished(replay)) stepLap(replay);
    for (const [code, car] of Object.entries(replay.state.cars)) {
      expect(live.state.cars[code]?.totalTime).toBeCloseTo(car.totalTime, 9);
    }
    expect(live.state.cars.VER?.stintPace).toBe(playerStintOffset(model));
    expect(live.state.cars.HAM?.stintPace).toBe(-0.4);
  });

  it("a stop on another lap keeps the player's race-wide offset", () => {
    const live = initRun(model, model.race.seed, {
      decisions: [{ lap: 29, kind: 'pit', compound: 'MEDIUM' }],
      incidents: false,
    });
    while (live.state.lap < 31) stepLap(live);
    expect(live.state.cars.VER?.stintPace).toBe(playerStintOffset(model));
  });

  it("outside an Eras race the player's car runs at 0", () => {
    const { rules: _, ...plain } = model;
    expect(playerStintOffset(plain as RaceModel)).toBe(0);
    const live = initRun(plain as RaceModel, model.race.seed, { decisions: [], incidents: false });
    expect(live.state.cars.VER?.stintPace).toBeUndefined();
  });
});
