// Eras sim fix W3 (pipeline dirty_air.py): the dirty-air cost by start-of-lap gap band
// (track.dirtyAirBands), the held gap of a failed follower (overtakeModel.heldGap) and no pass
// without a won roll (overtakeModel.rollOnly). Parity with the Python reference sim on fresh
// Eras builds carrying them; the fixture comes from pipeline/tests/make_dirty_air_fixture.py.

import { describe, expect, it } from 'vitest';
import { dirtyAirCost, simulate } from '../src/sim.js';
import type { RaceModel, RaceResult } from '../src/types.js';
import fixtureJson from './fixtures/eras-dirty-air.json';

type Golden = Record<
  string,
  Record<
    string,
    Pick<RaceResult, 'order' | 'finishers'> & Record<'gaps' | 'times', Record<string, number>>
  >
>;
const fixture = fixtureJson as unknown as { models: Record<string, RaceModel>; golden: Golden };

describe.each(Object.keys(fixture.models))('%s (Eras dirty-air model)', (id) => {
  const model = fixture.models[id] as RaceModel;
  it('carries the bands', () => {
    expect(model.track.dirtyAirBands?.map((b) => b.upTo)).toEqual([0.5, 1, 1.5, 2]);
  });
  it.each(Object.keys(fixture.golden[id] ?? {}))('seed %s matches the Python sim', (seed) => {
    const expected = fixture.golden[id]?.[seed];
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

describe('dirtyAirCost', () => {
  const track = { dirtyAirPenalty: 0.3 } as RaceModel['track'];
  it('is the flat penalty within 1 s without bands', () => {
    expect(dirtyAirCost(track, 0.5)).toBe(0.3);
    expect(dirtyAirCost(track, 1.0)).toBe(0);
    expect(dirtyAirCost(track, 0)).toBe(0);
  });
  it('follows the bands when the file has them', () => {
    const banded = {
      ...track,
      dirtyAirBands: [
        { upTo: 0.5, penalty: 0.9 },
        { upTo: 2.0, penalty: 0.1 },
      ],
    };
    expect(dirtyAirCost(banded, 0.2)).toBe(0.9);
    expect(dirtyAirCost(banded, 1.5)).toBe(0.1);
    expect(dirtyAirCost(banded, 2.0)).toBe(0);
  });
});
