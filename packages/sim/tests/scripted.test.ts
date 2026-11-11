// Eras model fixes M4 (scripted.ts): parity with the Python reference sim (the SC restart and
// scripted team orders; pipeline/tests/fixtures/scripted_parity.json, written by
// pipeline/tests/test_scripted.py), the storyline conditions, the player's team-order call and
// avoidable storyline retirements in live play.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import vectors from '../../../pipeline/tests/fixtures/scripted_parity.json';
import { candidateMoments } from '../src/moments.js';
import {
  type StorylineLap,
  conditionMet,
  restartExtra,
  teamOrdersOf,
  userOrdersOn,
} from '../src/scripted.js';
import { initRun, isFinished, simulate, stepLap, validateDecisions } from '../src/sim.js';
import type {
  Decision,
  RaceEvent,
  RaceModel,
  RestartModel,
  StorylineCondition,
  StorylineRetirement,
} from '../src/types.js';

const ABU = abuJson as unknown as RaceModel;
interface Result {
  order: string[];
  finishers: string[];
  gaps: Record<string, number>;
  times: Record<string, number>;
}
const V = vectors as unknown as {
  restart: RestartModel;
  orders: RaceEvent[];
  results: Record<string, Result>;
  storylineLaps: StorylineLap[];
  conditions: Array<{ condition: StorylineCondition; lap: number; met: boolean }>;
};

function withEvents(model: RaceModel, events: RaceEvent[], restart?: RestartModel): RaceModel {
  return {
    ...model,
    track: restart ? { ...model.track, restart } : model.track,
    events: [...model.events, ...events].sort((a, b) => a.lap - b.lap),
  };
}

describe('parity with the Python reference sim (restart and team orders)', () => {
  const model = withEvents(ABU, V.orders, V.restart);
  it.each(Object.keys(V.results))('seed %s', (seed) => {
    const want = V.results[seed] as Result;
    const got = simulate(model, Number(seed));
    expect(got.order).toEqual(want.order);
    expect(got.finishers).toEqual(want.finishers);
    for (const code of want.finishers) {
      expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
      expect(got.gaps[code]).toBeCloseTo(want.gaps[code] as number, 3);
    }
  });

  it('a race file without them replays as before', () => {
    expect(simulate(ABU, 1)).toEqual(simulate({ ...ABU }, 1));
    expect(simulate(model, 1)).not.toEqual(simulate(ABU, 1));
  });
});

describe('the restart', () => {
  it('spreads the queue behind the leader, capped', () => {
    const r: RestartModel = { jump: 0.15, spread: 0.44, places: 8 };
    expect(restartExtra(r, 0)).toBe(0);
    expect(restartExtra(r, 1)).toBeCloseTo(0.59, 10);
    expect(restartExtra(r, 30)).toBe(restartExtra(r, 8));
  });
});

describe('storyline conditions (parity with storyline.condition_met)', () => {
  it.each(V.conditions.map((c, i) => [i, c] as const))('vector %i', (_i, c) => {
    expect(conditionMet(c.condition, V.storylineLaps, c.lap)).toBe(c.met);
  });
});

describe("team orders to the player's car", () => {
  // Abu Dhabi 2021 from HAM's side: an order on lap 40 for HAM to let BOT by.
  const order: RaceEvent = { lap: 40, type: 'TEAM_ORDER', driver: 'HAM', other: 'BOT' };
  const model = withEvents({ ...ABU, userSide: 'HAM', rival: 'VER' }, [order]);

  it('only a car with an open order can comply', () => {
    expect(userOrdersOn(model.events, 'HAM', 41)).toHaveLength(1);
    expect(userOrdersOn(model.events, 'HAM', 43)).toHaveLength(0);
    expect(() =>
      validateDecisions(model, [{ lap: 40, kind: 'teamOrder', order: 'comply' }]),
    ).not.toThrow();
    expect(() =>
      validateDecisions(model, [{ lap: 45, kind: 'teamOrder', order: 'comply' }]),
    ).toThrow();
    expect(teamOrdersOf(model.events, 'HAM')[0]).toMatchObject({ call: true });
    expect(teamOrdersOf(model.events)[0]?.call).toBeUndefined();
  });

  it('ignored, nothing happens; complied, the car goes by', () => {
    // HAM leads VER at lap 35 in this seed's replay, 5.7 s clear (within the window).
    const vModel = withEvents({ ...ABU, userSide: 'HAM', rival: 'VER' }, [
      { lap: 35, type: 'TEAM_ORDER', driver: 'HAM', other: 'VER' },
    ]);
    const lapTo = (decisions: Decision[]) => {
      const run = initRun(vModel, 1, { decisions, incidents: false });
      while (run.state.lap < 35) stepLap(run);
      return run;
    };
    const ignored = lapTo([]);
    expect(ignored.notes.some((n) => n.kind === 'team-order')).toBe(false);
    expect(ignored.state.order.indexOf('HAM')).toBeLessThan(ignored.state.order.indexOf('VER'));
    const complied = lapTo([{ lap: 35, kind: 'teamOrder', order: 'comply' }]);
    expect(complied.notes).toContainEqual({
      lap: 35,
      kind: 'team-order',
      driver: 'VER',
      detail: 'HAM',
    });
    expect(complied.state.order.indexOf('VER')).toBeLessThan(complied.state.order.indexOf('HAM'));
  });

  it('a scripted car obeys in replays', () => {
    const scripted = withEvents(ABU, [
      { lap: 45, type: 'TEAM_ORDER', driver: 'SAI', other: 'BOT' },
    ]);
    const r = simulate(scripted, 1);
    expect(r.order.indexOf('BOT')).toBeLessThan(r.order.indexOf('SAI'));
  });

  it('the moment finder offers comply / ignore on the order lap', () => {
    const m = candidateMoments(model).find((x) => x.trigger === 'teamOrder');
    expect(m).toMatchObject({ lap: 40, realOptionId: 'comply' });
    expect(m?.options.map((o) => o.id)).toEqual(['comply', 'ignore']);
  });
});

describe('avoidable storyline retirements (live play)', () => {
  // Abu Dhabi 2021 from LAT's side: his lap-54 retirement, with PER's (lap 56) linked.
  const item: StorylineRetirement = {
    driver: 'LAT',
    condition: { type: 'mode', key: 'pace', value: 'push', fromLap: 50 },
    alsoRetires: ['PER'],
    real: 'test',
    source: 'https://example.org',
  };
  const model: RaceModel = {
    ...ABU,
    userSide: 'LAT',
    rival: 'MSC',
    eras: { eraId: 9, order: 10, storylineRetirements: [item] },
  };
  const finish = (decisions: Decision[]) => {
    const run = initRun(model, 1, { decisions, incidents: false });
    while (!isFinished(run)) stepLap(run);
    return run;
  };

  it('repeat the real call and the car retires on its real lap, the linked car too', () => {
    const run = finish([{ lap: 49, kind: 'mode', key: 'pace', value: 'push' }]);
    expect(run.state.cars.LAT).toMatchObject({ retired: true, retiredLap: 54 });
    expect(run.state.cars.PER).toMatchObject({ retired: true, retiredLap: 56 });
    expect(run.notes).toContainEqual({
      lap: 54,
      kind: 'storyline',
      driver: 'LAT',
      detail: 'retired',
    });
  });

  it('avoid it and both run to the flag', () => {
    const run = finish([]);
    expect(run.state.cars.LAT?.retired).toBe(false);
    expect(run.state.cars.PER?.retired).toBe(false);
    expect(run.notes).toContainEqual({
      lap: 54,
      kind: 'storyline',
      driver: 'LAT',
      detail: 'avoided',
    });
  });

  it('a linked car that retired earlier: judged on its lap, each retires on its own', () => {
    // From PER's side (lap 56) with LAT (lap 54) linked: Australia 1994 from Hill's side.
    const per: RaceModel = {
      ...ABU,
      userSide: 'PER',
      rival: 'MSC',
      eras: {
        eraId: 9,
        order: 10,
        storylineRetirements: [{ ...item, driver: 'PER', alsoRetires: ['LAT'] }],
      },
    };
    const play = (decisions: Decision[]) => {
      const run = initRun(per, 1, { decisions, incidents: false });
      while (!isFinished(run)) stepLap(run);
      return run;
    };
    const real = play([{ lap: 49, kind: 'mode', key: 'pace', value: 'push' }]);
    expect(real.state.cars.LAT).toMatchObject({ retired: true, retiredLap: 54 });
    expect(real.state.cars.PER).toMatchObject({ retired: true, retiredLap: 56 });
    const avoided = play([]);
    expect(avoided.state.cars.LAT?.retired).toBe(false);
    expect(avoided.state.cars.PER?.retired).toBe(false);
  });

  it('replays keep every real retirement', () => {
    const run = initRun(model, 1);
    while (!isFinished(run)) stepLap(run);
    expect(run.state.cars.LAT?.retired).toBe(true);
    expect(run.state.cars.PER?.retired).toBe(true);
  });

  it('fuel: the frozen retirement is dropped, the fuel model decides', () => {
    const fuel: RaceModel = {
      ...model,
      eras: {
        eraId: 9,
        order: 10,
        storylineRetirements: [{ ...item, condition: { type: 'fuel' } }],
      },
    };
    const run = initRun(fuel, 1, { decisions: [], incidents: false });
    while (!isFinished(run)) stepLap(run);
    expect(run.state.cars.LAT?.retired).toBe(false);
    expect(run.notes.some((n) => n.kind === 'storyline')).toBe(false);
  });
});
