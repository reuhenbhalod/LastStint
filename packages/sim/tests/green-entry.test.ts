// Green-entry stops (model v3 stage 9): a new call whose out-lap is the first lap of an
// SC/VSC was boxed on the green lap before the deployment, so it pays the green-flag price.
// Saudi 2022: PER pitted at the end of lap 15, the SC came out on lap 16, and LEC, VER and SAI
// pitted under it for half the cost.

import { describe, expect, it } from 'vitest';
import saudiJson from '../../../data/races/saudi-arabia-2022.json';
import { initRun, stepLap } from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const saudi = { ...(saudiJson as unknown as RaceModel), userSide: 'LEC', rival: 'VER' };
const { pitLoss, pitLossUnderSC, pitLossDeviations = [] } = saudi.track;

/** What LEC's stop (out-lap = `boxLap` + 1) cost, against VER, who doesn't stop that lap. */
function stopCost(boxLap: number): number {
  const decisions: Decision[] = [{ lap: boxLap, kind: 'pit', compound: 'HARD' }];
  const run = initRun(saudi, 1, { decisions });
  while (run.state.lap < boxLap) stepLap(run);
  const before = {
    lec: run.state.cars.LEC?.totalTime ?? 0,
    ver: run.state.cars.VER?.totalTime ?? 0,
  };
  stepLap(run);
  const lec = (run.state.cars.LEC?.totalTime ?? 0) - before.lec;
  const ver = (run.state.cars.VER?.totalTime ?? 0) - before.ver;
  return lec - ver;
}

const priced = (cost: number, base: number) =>
  [0, ...pitLossDeviations].some((d) => Math.abs(cost - (base + d)) < 1e-6);

describe('green-entry stops', () => {
  it('the SC comes out on lap 16', () => {
    expect(saudi.events.find((e) => e.type === 'SC')?.lap).toBe(16);
  });

  it('boxing on lap 15, before the SC, pays the green price', () => {
    const cost = stopCost(15);
    expect(priced(cost, pitLoss)).toBe(true);
    expect(priced(cost, pitLossUnderSC)).toBe(false);
  });
});
