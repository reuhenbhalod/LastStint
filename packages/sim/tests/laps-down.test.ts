// Job 1.5 (redflag.ts realLapsDown / roadOrder): a no-unlapping race's SC and red-flag queues
// take the scripted cars' real laps down. Parity with the Python reference sim
// (pipeline/tests/fixtures/laps_down_parity.json, written by pipeline/tests/test_laps_down.py).

import { describe, expect, it } from 'vitest';
import monacoJson from '../../../data/races/monaco-2011.json';
import vectors from '../../../pipeline/tests/fixtures/laps_down_parity.json';
import { lineUp, realLapsDown, roadOrder } from '../src/redflag.js';
import { simulate } from '../src/sim.js';
import type { CarState, RaceModel } from '../src/types.js';

interface Result {
  order: string[];
  finishers: string[];
  gaps: Record<string, number>;
  times: Record<string, number>;
}
const V = vectors as unknown as {
  lapsDown: Record<string, Record<string, number>>;
  results: Record<string, Result>;
  overridden: Record<string, Result>;
};

function withLapsDown(model: RaceModel): RaceModel {
  return {
    ...model,
    events: model.events.map((e, i) => {
      const { lapsDown: _, ...rest } = e;
      const down = V.lapsDown[String(i)];
      return down ? { ...rest, lapsDown: down } : rest;
    }),
  };
}

const MODEL = withLapsDown(monacoJson as unknown as RaceModel);

function expectSame(got: Result, want: Result): void {
  expect(got.order).toEqual(want.order);
  expect(got.finishers).toEqual(want.finishers);
  for (const code of want.finishers) {
    expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
  }
}

describe('parity with the Python reference sim (monaco-2011 with its real laps down)', () => {
  it.each(Object.keys(V.results))('seed %s', (seed) => {
    expectSame(simulate(MODEL, Number(seed)), V.results[seed] as Result);
  });
  it.each(Object.keys(V.overridden))('seed %s, HAM overridden', (seed) => {
    const ham = MODEL.drivers.find((d) => d.code === 'HAM')?.realStrategy ?? [];
    const got = simulate(MODEL, Number(seed), { strategies: { HAM: [...ham] } });
    expectSame(got, V.overridden[seed] as Result);
  });
});

function cars(times: Record<string, number>): Record<string, CarState> {
  return Object.fromEntries(
    Object.entries(times).map(([code, totalTime]) => [code, { code, totalTime } as CarState]),
  );
}

describe('roadOrder and lineUp with known laps down (redflag.py road_order)', () => {
  it('a car really on the lead lap joins the back; one really lapped keeps its road place', () => {
    const c = cars({ A: 0, B: 10, H: 95, L: 30 });
    const order = Object.keys(c);
    expect(roadOrder(order, c, 90).road).toEqual(['A', 'H', 'B', 'L']);
    const known = new Map([
      ['H', 0],
      ['L', 1],
    ]);
    const { road, down, onRoad } = roadOrder(order, c, 90, known);
    expect(road).toEqual(['A', 'B', 'L', 'H']);
    expect([down.get('H'), down.get('L'), onRoad.get('H'), onRoad.get('L')]).toEqual([
      0, 1, 95, 30,
    ]);
    lineUp(order, c, 0.5, 90, known);
    expect(Object.fromEntries(order.map((k) => [k, c[k]?.totalTime]))).toEqual({
      A: 0,
      B: 0.5,
      L: 91,
      H: 1.5,
    });
  });
  it('realLapsDown skips overridden cars', () => {
    const got = realLapsDown(
      [
        { lap: 5, type: 'SC', laps: 2, lapsDown: { A: 0, B: 1 } },
        { lap: 9, type: 'RED', lapsDown: { B: 2 } },
        { lap: 12, type: 'SC', laps: 1 },
      ],
      (code) => code === 'B',
    );
    expect([...got.keys()]).toEqual([5, 6, 9]);
    expect(Object.fromEntries(got.get(5) ?? [])).toEqual({ A: 0 });
    expect(got.get(9)?.size).toBe(0);
  });
});
