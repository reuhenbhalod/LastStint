// Eras sim fixes: a stop with no tyre change (DriverModel.serviceStops) and the Eras SC queue,
// mirroring pipeline/tests/test_sim_fixes.py. Parity on real races: the golden files of the
// rebuilt Eras races (azerbaijan-2017, hungary-2015) carry service stops.

import { describe, expect, it } from 'vitest';
import spainJson from '../../../data/races/spain-2021.json';
import { SC_QUEUE_KEEP, SC_QUEUE_SPACING, serviceStopLoss, simulate } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const spain = spainJson as unknown as RaceModel;

describe('stops with no tyre change', () => {
  it('charges the measured loss on the out-lap, whatever the strategy, and keeps the set', () => {
    const lap = spain.race.takeoverLap + 3;
    const short = { ...spain, race: { ...spain.race, laps: lap } };
    const first = spain.drivers[0];
    if (!first) throw new Error('no drivers');
    const served: RaceModel = {
      ...short,
      drivers: [{ ...first, serviceStops: [{ lap, loss: 25 }] }, ...spain.drivers.slice(1)],
    };
    expect(serviceStopLoss(served, first.code, lap)).toBe(25);
    expect(serviceStopLoss(served, first.code, lap - 1)).toBeUndefined();
    const base = simulate(short, 1);
    const got = simulate(served, 1);
    expect(got.times[first.code]).toBeCloseTo((base.times[first.code] as number) + 25, 6);
    // A player's own plan doesn't drop it.
    const planned = simulate(served, 1, { strategies: { [first.code]: [] } });
    const plain = simulate(short, 1, { strategies: { [first.code]: [] } });
    expect(planned.times[first.code]).toBeCloseTo((plain.times[first.code] as number) + 25, 6);
  });

  it('the Eras SC queue constants are the pipeline fit (sc_queue.py)', () => {
    expect(SC_QUEUE_SPACING).toBe(1.7);
    expect(SC_QUEUE_KEEP).toBe(0.34);
  });
});
