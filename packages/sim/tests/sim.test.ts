import { describe, expect, it } from 'vitest';
import abuModel from '../../../data/races/abu-dhabi-2021.json';
import { classify, initRun, isFinished, passProbability, simulate, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const model = abuModel as unknown as RaceModel;

describe('simulator mechanics', () => {
  it('is deterministic for a seed', () => {
    expect(simulate(model, 7)).toEqual(simulate(model, 7));
  });

  it('different seeds vary', () => {
    expect(simulate(model, 1).times).not.toEqual(simulate(model, 2).times);
  });

  it('stepping lap by lap equals simulate()', () => {
    const run = initRun(model, 3);
    let laps = 0;
    while (!isFinished(run)) {
      stepLap(run);
      laps++;
    }
    expect(laps).toBe(model.race.laps - model.race.takeoverLap);
    expect(run.state.lap).toBe(model.race.laps);
    expect(classify(run)).toEqual(simulate(model, 3));
  });

  it('reports the flag of each lap (VSC 36-38, SC 53-57 at Abu Dhabi 2021)', () => {
    const run = initRun(model, 1);
    const flags: Record<number, string> = {};
    while (!isFinished(run)) flags[stepLap(run).lap] = run.state.flag;
    expect([flags[36], flags[38], flags[39]]).toEqual(['vsc', 'vsc', 'green']);
    expect([flags[53], flags[57], flags[58]]).toEqual(['sc', 'sc', 'green']);
  });

  it("one car's strategy does not shift another car's draws", () => {
    const base = simulate(model, 11);
    const changed = simulate(model, 11, { strategies: { HAM: [{ lap: 40, to: 'MEDIUM' }] } });
    expect(changed.times.HAM).not.toBe(base.times.HAM);
    expect(changed.times.MSC).toBe(base.times.MSC);
  });

  it('pass probability rises with pace edge and falls with gap', () => {
    const o = model.track.overtakeModel;
    expect(passProbability(o, 1, 0.5)).toBeGreaterThan(passProbability(o, 0.2, 0.5));
    expect(passProbability(o, 1, 0.5)).toBeGreaterThan(passProbability(o, 1, 1.5));
  });
});
