// TS <-> Python parity (Implementation Plan 2.9, Gate G2): for every race with a golden file,
// the TS sim run with the same seed must reproduce the Python reference sim's classification
// exactly and its times to the golden files' 3-decimal rounding.

import { describe, expect, it } from 'vitest';
import abuGolden from '../../../data/golden/abu-dhabi-2021.json';
import spainGolden from '../../../data/golden/spain-2021.json';
import abuModel from '../../../data/races/abu-dhabi-2021.json';
import spainModel from '../../../data/races/spain-2021.json';
import { simulate } from '../src/sim.js';
import type { RaceModel, RaceResult } from '../src/types.js';

type Golden = Record<
  string,
  Omit<RaceResult, 'gaps' | 'times'> & Record<'gaps' | 'times', Record<string, number>>
>;

const RACES: Array<[string, RaceModel, Golden]> = [
  ['abu-dhabi-2021', abuModel as unknown as RaceModel, abuGolden as Golden],
  ['spain-2021', spainModel as unknown as RaceModel, spainGolden as Golden],
];

describe.each(RACES)('%s matches the Python reference sim', (_id, model, golden) => {
  it.each(Object.keys(golden))('seed %s', (seed) => {
    const expected = golden[seed];
    if (!expected) throw new Error(`missing golden seed ${seed}`);
    const got = simulate(model, Number(seed));
    expect(got.order).toEqual(expected.order);
    expect(got.finishers).toEqual(expected.finishers);
    for (const code of expected.finishers) {
      expect(got.times[code]).toBeCloseTo(expected.times[code] as number, 3);
      expect(got.gaps[code]).toBeCloseTo(expected.gaps[code] as number, 3);
    }
  });
});
