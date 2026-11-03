// Feedback round 2: crashes, failures and punctures across the field, and the ERS battery.
// Live play only; replays (and so parity and G1) never see them.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { forkRun, initRun, isFinished, simulate, stepLap } from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;

function race(seed: number, decisions: Decision[] = [], incidents?: boolean) {
  const run = initRun(abu, seed, { decisions, incidents });
  const events = run.events.length;
  while (!isFinished(run)) stepLap(run);
  return { run, added: run.events.length - events };
}

const incidentsOf = (r: ReturnType<typeof race>) =>
  r.run.notes.filter((n) => n.kind === 'incident');

describe('incidents', () => {
  it('never happen in a replay, or with incidents off', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(simulate(abu, seed)).toEqual(simulate(abu, seed));
      expect(incidentsOf(race(seed, [], false))).toEqual([]);
    }
  });

  it('are the same for the same seed and calls', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(race(seed).run.notes).toEqual(race(seed).run.notes);
    }
  });

  it('happen in some races, and pushing makes them likelier for your car', () => {
    const n = 600;
    let any = 0;
    let ham = 0;
    let hamPush = 0;
    const push: Decision[] = [{ lap: 35, kind: 'mode', key: 'pace', value: 'push' }];
    for (let seed = 0; seed < n; seed++) {
      const r = race(seed);
      if (incidentsOf(r).length) any++;
      if (incidentsOf(r).some((x) => x.driver === 'HAM')) ham++;
      if (incidentsOf(race(seed, push)).some((x) => x.driver === 'HAM')) hamPush++;
    }
    expect(any / n).toBeGreaterThan(0.15);
    expect(any / n).toBeLessThan(0.45);
    expect(ham / n).toBeLessThan(0.07);
    expect(hamPush).toBeGreaterThan(ham);
  });

  it('a crash retires the car and can bring out a neutralization from the next lap', () => {
    const seed = Array.from({ length: 400 }, (_, i) => i).find((s) => race(s).added > 0);
    expect(seed).toBeDefined();
    const r = race(seed as number);
    const crash = incidentsOf(r).find((x) => x.detail === 'crash');
    expect(crash).toBeDefined();
    const car = r.run.state.cars[crash?.driver as string];
    expect(car?.retired).toBe(true);
    expect(car?.retiredLap).toBe(crash?.lap);
    expect(r.run.events.some((e) => e.lap === (crash?.lap as number) + 1)).toBe(true);
  });

  it('a puncture costs time and forces a stop next lap', () => {
    for (let seed = 0; seed < 400; seed++) {
      const run = initRun(abu, seed, { decisions: [] });
      while (!isFinished(run)) {
        stepLap(run);
        const p = run.notes.find((n) => n.detail === 'puncture' && n.lap === run.state.lap);
        if (!p || run.state.lap >= abu.race.laps) continue;
        stepLap(run);
        expect(run.state.cars[p.driver]?.pittedThisLap).toBe(true);
        return;
      }
    }
    throw new Error('no puncture in 400 races');
  });

  it("grader playouts don't add neutralizations (they sample their own)", () => {
    const run = initRun(abu, 1, { decisions: [] });
    while (run.state.lap < 40) stepLap(run);
    const fork = forkRun(run, 7, [], { blindAfter: 40 });
    expect(fork.incidentFlags).toBe(false);
    expect(forkRun(run, 7).incidentFlags).toBe(true);
  });
});

describe('ERS', () => {
  const lapsFrom = (decisions: Decision[], to: number) => {
    const run = initRun(abu, 1, { decisions, incidents: false });
    const battery: number[] = [];
    while (run.state.lap < to) {
      stepLap(run);
      battery.push(run.state.cars.HAM?.battery as number);
    }
    return { run, battery };
  };

  it('starts the player car with a charge; other cars have no battery', () => {
    const run = initRun(abu, 1, { decisions: [] });
    expect(run.state.cars.HAM?.battery).toBe(60);
    expect(run.state.cars.VER?.battery).toBeUndefined();
    expect(initRun(abu, 1).state.cars.HAM?.battery).toBeUndefined();
  });

  it('deploy drains it, harvest refills it, a VSC lap recharges it', () => {
    const deploy = lapsFrom([{ lap: 35, kind: 'mode', key: 'ers', value: 'deploy' }], 39);
    // Lap 35 green (-15); laps 36-38 VSC (+20 each, capped at 100); lap 39 green (-15).
    expect(deploy.battery).toEqual([45, 65, 85, 100, 85]);
    const harvest = lapsFrom([{ lap: 35, kind: 'mode', key: 'ers', value: 'harvest' }], 35);
    expect(harvest.battery).toEqual([75]);
  });

  it('an empty battery gives no deploy time', () => {
    const overtake = lapsFrom([{ lap: 39, kind: 'mode', key: 'ers', value: 'overtake' }], 50);
    expect(Math.min(...overtake.battery)).toBe(0);
    const balanced = lapsFrom([], 50);
    // Once empty, laps are no quicker than balanced: same time gained over the last lap.
    const lap = (r: ReturnType<typeof lapsFrom>) => r.run.state.cars.HAM?.totalTime as number;
    expect(lap(overtake)).toBeLessThan(lap(balanced));
  });
});
