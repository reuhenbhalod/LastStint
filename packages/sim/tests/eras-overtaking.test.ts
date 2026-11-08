// Eras overtake model (pipeline overtaking.py): an Eras build's overtakeModel carries
// trainCoef, pooled slopes per era group and an intercept per track layout. Parity with the
// Python reference sim on two fresh Eras builds (spain-2021 with DRS, brazil-2006 refuelling);
// the fixture comes from pipeline/tests/make_overtaking_fixture.py.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { TRAIN_GAP, initRun, passProbability, simulate, stepLap } from '../src/sim.js';
import type { RaceModel, RaceResult } from '../src/types.js';
import fixtureJson from './fixtures/eras-overtaking.json';

type Golden = Record<
  string,
  Record<
    string,
    Pick<RaceResult, 'order' | 'finishers'> & Record<'gaps' | 'times', Record<string, number>>
  >
>;
const fixture = fixtureJson as unknown as { models: Record<string, RaceModel>; golden: Golden };

describe.each(Object.keys(fixture.models))('%s (Eras overtake model)', (id) => {
  const model = fixture.models[id] as RaceModel;
  it('carries the train term', () => {
    expect(model.track.overtakeModel.trainCoef).toBeTypeOf('number');
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

describe('the train term', () => {
  const abu = abuJson as unknown as RaceModel;
  const lap = abu.race.takeoverLap;

  /** VER leads, HAM right behind and 1 s a lap faster, BOT right behind HAM, none stopping. */
  function three(trainCoef: number | undefined, verGap: number): RaceModel {
    const ver = abu.drivers.find((d) => d.code === 'VER');
    if (!ver) throw new Error('VER');
    const front = ['VER', 'HAM', 'BOT'];
    const drivers = abu.drivers.map((d) => {
      const i = front.indexOf(d.code);
      return {
        ...d,
        realStrategy: i >= 0 ? [] : d.realStrategy,
        basePace: d.code === 'BOT' ? ver.basePace - 1 : d.basePace,
        stateAtTakeover: {
          ...d.stateAtTakeover,
          position: i >= 0 ? i + 1 : d.stateAtTakeover.position + 3,
          gapAhead: d.code === 'HAM' ? verGap : d.code === 'BOT' ? 0.3 : 30,
        },
      };
    });
    const overtakeModel = { ...abu.track.overtakeModel, ...(trainCoef ? { trainCoef } : {}) };
    return { ...abu, drivers, track: { ...abu.track, overtakeModel } };
  }

  const botPasses = (model: RaceModel) =>
    Array.from({ length: 200 }, (_, seed) => {
      const run = initRun(model, seed);
      stepLap(run);
      return run.state.order.indexOf('BOT') < run.state.order.indexOf('HAM');
    }).filter(Boolean).length;

  it('is 1 s', () => expect(TRAIN_GAP).toBe(1.0));

  it('makes a car in a train harder to pass, and only then', () => {
    expect(lap).toBeGreaterThan(0);
    const inTrain = botPasses(three(-2, 0.5));
    const free = botPasses(three(-2, 1.5));
    const classic = botPasses(three(undefined, 0.5));
    expect(inTrain).toBeLessThan(classic);
    expect(free).toBeGreaterThan(inTrain);
  });

  it('leaves the classic odds alone', () => {
    const o = abu.track.overtakeModel;
    expect(passProbability({ ...o, trainCoef: -1 }, 0.5, 0.5)).toBe(passProbability(o, 0.5, 0.5));
  });
});
