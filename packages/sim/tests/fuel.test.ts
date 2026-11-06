// The fuel load (fuel load spec): the player's car takes over with the fuel to the flag plus a
// seeded margin; lift and coast burns less, pushing more; a dry tank costs time to the flag.
// Live play only: replays, incidents-off runs and the grader's playouts never carry it.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { forkRun, fuelConfig, fuelMargin, initRun, isFinished, stepLap } from '../src/sim.js';
import type { FuelConfig } from '../src/sim.js';
import type { CarState, Decision, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const ham = abu.userSide;
const cfg = fuelConfig(abu) as FuelConfig;

function race(seed: number, decisions: Decision[] = [], incidents?: boolean) {
  const run = initRun(abu, seed, { decisions, incidents });
  while (!isFinished(run)) stepLap(run);
  return run;
}

describe('fuel load', () => {
  it('has a config for the hybrid era', () => {
    expect(cfg).not.toBeNull();
  });

  it('starts with the fuel to the flag plus a margin in the range, the same for a seed', () => {
    const margins = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const run = initRun(abu, seed, { decisions: [] });
      const car = run.state.cars[ham];
      const m = fuelMargin(abu, car as CarState, run.state.lap) as number;
      expect(m).toBeGreaterThanOrEqual(cfg.marginMin);
      expect(m).toBeLessThanOrEqual(cfg.marginMax);
      expect(
        fuelMargin(
          abu,
          initRun(abu, seed, { decisions: [] }).state.cars[ham] as CarState,
          run.state.lap,
        ),
      ).toBe(m);
      margins.add(Math.round(m * 10));
    }
    expect(margins.size).toBeGreaterThan(5);
  });

  it('is left out of replays and incidents-off runs', () => {
    expect(initRun(abu, 1).state.cars[ham]?.fuel).toBeUndefined();
    expect(
      initRun(abu, 1, { decisions: [], incidents: false }).state.cars[ham]?.fuel,
    ).toBeUndefined();
    expect(race(1, [], false).state.cars[ham]?.fuel).toBeUndefined();
  });

  it('is left out of the grader’s blind playouts', () => {
    const run = initRun(abu, 3, { decisions: [] });
    stepLap(run);
    expect(run.state.cars[ham]?.fuel).toBeGreaterThan(0);
    const fork = forkRun(run, 9, [], { blindAfter: run.state.lap + 1 });
    expect(fork.state.cars[ham]?.fuel).toBeUndefined();
    expect(run.state.cars[ham]?.fuel).toBeGreaterThan(0);
  });

  it('burns less on lift and coast and more when pushing', () => {
    const lap = abu.race.takeoverLap + 1;
    const lift: Decision[] = [{ lap, kind: 'mode', key: 'fuel', value: 'liftAndCoast' }];
    const push: Decision[] = [{ lap, kind: 'mode', key: 'pace', value: 'push' }];
    for (const seed of [2, 5, 8]) {
      const left = (d: Decision[]) => {
        const run = initRun(abu, seed, { decisions: d });
        for (let i = 0; i < 5; i++) stepLap(run);
        return run.state.cars[ham]?.fuel as number;
      };
      expect(left(lift)).toBeGreaterThan(left([]));
      expect(left(push)).toBeLessThan(left([]));
    }
  });

  it('a dry tank is noted once and costs time to the flag', () => {
    for (const seed of [2, 6, 9]) {
      const run = (kg: number) => {
        const r = initRun(abu, seed, { decisions: [] });
        (r.state.cars[ham] as { fuel?: number }).fuel = kg;
        for (let i = 0; i < 9; i++) stepLap(r);
        return r;
      };
      const dry = run(1);
      const full = run(40);
      expect(dry.state.cars[ham]?.fuel).toBe(0);
      expect(dry.notes.filter((n) => n.kind === 'fuel')).toHaveLength(1);
      // Lighter at first, then a dry tank's lift on every green lap after it.
      expect(dry.state.cars[ham]?.totalTime as number).toBeGreaterThan(
        (full.state.cars[ham]?.totalTime as number) + cfg.dryLapDelta,
      );
    }
  });

  it('is the same for the same seed and calls (the server’s replay)', () => {
    for (const seed of [4, 11]) {
      const a = race(seed);
      const b = race(seed);
      expect(a.state.cars[ham]?.fuel).toBe(b.state.cars[ham]?.fuel);
      expect(a.state.cars[ham]?.totalTime).toBe(b.state.cars[ham]?.totalTime);
    }
  });
});
