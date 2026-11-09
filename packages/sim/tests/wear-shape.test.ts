// Quadratic tyre wear (Eras model fix S4; pipeline wear_shape.py): a compound's degQuad adds
// degQuad x wear^2 to the lap. Parity with the Python reference sim on Spain 2021 with degQuad
// entered by hand (pipeline/tests/make_wear_shape_fixture.py), on the real strategies and on
// strategies that leave them, and the tyre life it gives; a compound without it is unchanged.

import { describe, expect, it } from 'vitest';
import spainJson from '../../../data/races/spain-2021.json';
import { simulate, tyreLapTime, tyreLife } from '../src/sim.js';
import type { CompoundModel, PitStop, RaceModel, RaceResult } from '../src/types.js';
import goldenJson from './fixtures/wear-shape-golden.json';

type Runs = Record<
  string,
  Pick<RaceResult, 'order' | 'finishers'> & Record<'gaps' | 'times', Record<string, number>>
>;
const golden = goldenJson as unknown as {
  life: Record<string, number>;
  lifeUnproven: Record<string, number>;
  real: Runs;
  diverged: Runs;
};
const spain = spainJson as unknown as RaceModel;

/** make_wear_shape_fixture.py DEG_QUAD and DIVERGED. */
const DEG_QUAD: Record<string, number> = { SOFT: 0.0011, MEDIUM: 0.0004 };
const DIVERGED: Record<string, PitStop[]> = {
  HAM: [
    { lap: 29, to: 'MEDIUM', loss: 22.778 },
    { lap: 50, to: 'SOFT' },
  ],
  VER: [
    { lap: 24, to: 'MEDIUM', loss: 23.983 },
    { lap: 61, to: 'SOFT' },
  ],
};

const model: RaceModel = {
  ...spain,
  compounds: Object.fromEntries(
    Object.entries(spain.compounds).map(([k, c]) => [
      k,
      DEG_QUAD[k] === undefined ? c : { ...c, degQuad: DEG_QUAD[k] },
    ]),
  ),
};

const VARIANTS: Array<['real' | 'diverged', Record<string, PitStop[]> | undefined]> = [
  ['real', undefined],
  ['diverged', DIVERGED],
];

describe.each(VARIANTS)('%s strategies match the Python reference sim', (name, strategies) => {
  const expected = golden[name];
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

describe('quadratic wear', () => {
  it('adds degQuad x wear^2 to the lap', () => {
    const plain = tyreLapTime(spain, 80, 'SOFT', 20, 30);
    expect(tyreLapTime(model, 80, 'SOFT', 20, 30) - plain).toBeCloseTo(0.0011 * 400, 9);
  });

  it('gives the tyre life the Python reference does', () => {
    for (const [k, c] of Object.entries(model.compounds)) {
      expect(tyreLife(c)).toBe(golden.life[k]);
      const { provenLaps: _, ...unproven } = c;
      expect(tyreLife(unproven as CompoundModel)).toBe(golden.lifeUnproven[k]);
    }
  });

  it('leaves a compound without it as it was', () => {
    const c = spain.compounds.SOFT as CompoundModel;
    expect(tyreLife({ ...c, degQuad: 0 })).toBe(tyreLife(c));
    const r = simulate(spain, 3);
    expect(simulate({ ...spain }, 3).times).toEqual(r.times);
  });

  it('wears the set down sooner', () => {
    const c = { offset: 0, degPerLap: 0.05, cliffLap: 60 };
    expect(tyreLife({ ...c, degQuad: 0.001 })).toBeLessThan(tyreLife(c));
  });
});
