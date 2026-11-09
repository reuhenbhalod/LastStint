// Car faults (eras build plan 4.4; simulator roadmap R2): the lap rule, parity with the
// Python reference sim (pipeline/tests/fixtures/fault_parity.json), the run's notes, grader
// forks that don't know a fault still to come, and the fault decision moments.

import { describe, expect, it } from 'vitest';
import abuModel from '../../../data/races/abu-dhabi-2021.json';
import vectors from '../../../pipeline/tests/fixtures/fault_parity.json';
import { cloneFaults, faultCost, faultTable } from '../src/faults.js';
import { candidateMoments } from '../src/moments.js';
import { forkRun, initRun, simulate, stepLap } from '../src/sim.js';
import type { RaceEvent, RaceModel } from '../src/types.js';

const ABU = abuModel as unknown as RaceModel;

function withFaults(model: RaceModel, faults: RaceEvent[]): RaceModel {
  const events = [...model.events, ...faults].sort(
    (a, b) => a.lap - b.lap || a.type.localeCompare(b.type),
  );
  return { ...model, events };
}

type Result = {
  order: string[];
  finishers: string[];
  times: Record<string, number>;
  gaps: Record<string, number>;
};
const V = vectors as unknown as {
  race: string;
  faults: RaceEvent[];
  results: Record<string, Result>;
};

describe('faultCost', () => {
  const puncture: RaceEvent = {
    lap: 10,
    type: 'FAULT',
    driver: 'AAA',
    fault: 'puncture',
    paceLoss: 2,
    slowLap: 5,
    untilStop: true,
  };
  const gear: RaceEvent = {
    lap: 10,
    type: 'FAULT',
    driver: 'BBB',
    fault: 'gear-stuck',
    paceLoss: 1,
    laps: 2,
  };

  it('matches the reference sim rule (FaultState)', () => {
    const t = faultTable([puncture, gear, { lap: 3, type: 'SC', laps: 2 }]);
    const c = (code: string, lap: number, pitted: boolean, green: boolean) => {
      const f = faultCost(t, code, lap, pitted, green);
      return [f.pace, f.extra];
    };
    expect(c('AAA', 9, false, true)).toEqual([0, 0]);
    expect(c('AAA', 10, true, true)).toEqual([2, 5]); // a stop on its own lap doesn't fix it
    expect(c('AAA', 11, false, false)).toEqual([0, 0]); // neutralized: no pace loss
    expect(c('AAA', 12, false, true)).toEqual([2, 0]);
    expect(c('AAA', 13, true, true)).toEqual([0, 0]); // new tyres
    expect(c('AAA', 14, false, true)).toEqual([0, 0]);
    expect([10, 11, 12].map((lap) => c('BBB', lap, false, true))).toEqual([
      [1, 0],
      [1, 0],
      [0, 0],
    ]);
    expect(c('CCC', 10, false, true)).toEqual([0, 0]);
  });

  it('a contact (damage) lap is flagged, so the car is out of its pass rolls', () => {
    const spin: RaceEvent = { ...gear, fault: 'damage', paceLoss: 0, laps: 1, slowLap: 8 };
    const t = faultTable([spin, puncture]);
    expect(faultCost(t, 'BBB', 10, false, true)).toEqual({
      pace: 0,
      extra: 8,
      struck: 'damage',
      contact: true,
    });
    expect(faultCost(t, 'BBB', 11, false, true).contact).toBeUndefined();
    expect(faultCost(t, 'AAA', 10, false, true).contact).toBeUndefined(); // a puncture
  });

  it('a spun car does not hold up the car behind it', () => {
    // VER leads SAI by 0.5 s; VER spins on lap 35 (10 s). As a puncture SAI is held behind
    // (its slow lap isn't in its model pace); as a contact SAI is by on the time order.
    const drivers = ABU.drivers
      .filter((d) => d.code === 'VER' || d.code === 'SAI')
      .map((d) => {
        const lead = d.code === 'VER';
        const at = { ...d.stateAtTakeover, position: lead ? 1 : 2, gapAhead: lead ? 0 : 0.5 };
        return { ...d, noise: 0, stateAtTakeover: at };
      });
    const verBehind = (fault: 'damage' | 'puncture') => {
      const spin: RaceEvent = {
        lap: 35,
        type: 'FAULT',
        driver: 'VER',
        fault,
        paceLoss: 0,
        laps: 1,
        slowLap: 10,
      };
      const model = { ...ABU, drivers, events: [spin], race: { ...ABU.race, laps: 35 } };
      const { times } = simulate(model, 1);
      return (times.VER ?? 0) - (times.SAI ?? 0);
    };
    expect(verBehind('damage')).toBeGreaterThan(5);
    expect(verBehind('puncture')).toBeLessThan(0);
  });

  it('names the fault on the lap it struck', () => {
    const t = faultTable([puncture]);
    expect(faultCost(t, 'AAA', 10, false, true).struck).toBe('puncture');
    expect(faultCost(t, 'AAA', 11, false, true).struck).toBeUndefined();
  });

  it('a blind copy drops the faults still to come and keeps its own state', () => {
    const t = faultTable([puncture, { ...gear, lap: 20 }]);
    const blind = cloneFaults(t, 15);
    expect([...blind.keys()]).toEqual(['AAA']);
    faultCost(t, 'AAA', 12, true, true); // the parent's stop fixes it
    expect(faultCost(blind, 'AAA', 12, false, true).pace).toBe(2);
    expect(faultTable([puncture, { ...gear, lap: 20 }], 15).has('BBB')).toBe(false);
  });
});

describe('fault parity with the Python reference sim', () => {
  const model = withFaults(ABU, V.faults);
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

  it('the faults change the race', () => {
    expect(simulate(model, 1).times.SAI).toBeGreaterThan((simulate(ABU, 1).times.SAI ?? 0) + 4);
  });
});

describe('fault runs', () => {
  const fault: RaceEvent = {
    lap: 40,
    type: 'FAULT',
    driver: 'HAM',
    fault: 'power-loss',
    paceLoss: 1.5,
    storylineEvent: true,
  };

  it('notes the fault on its lap, in replay and live play', () => {
    const model = withFaults(ABU, [fault]);
    for (const run of [initRun(model, 1), initRun(model, 1, { decisions: [] })]) {
      while (run.state.lap < 41) stepLap(run);
      expect(run.notes.filter((n) => n.kind === 'fault')).toEqual([
        { lap: 40, kind: 'fault', driver: 'HAM', detail: 'power-loss' },
      ]);
    }
  });

  it("a grader playout before the fault doesn't know it; one after it does", () => {
    const model = withFaults(ABU, [fault]);
    const run = initRun(model, 1, { decisions: [] });
    while (run.state.lap < 38) stepLap(run);
    expect(forkRun(run, 7, [], { blindAfter: 38 }).faults.has('HAM')).toBe(false);
    expect(forkRun(run, 7).faults.has('HAM')).toBe(true);
    while (run.state.lap < 41) stepLap(run);
    expect(forkRun(run, 7, [], { blindAfter: 41 }).faults.has('HAM')).toBe(true);
  });

  it('a race without faults runs as before', () => {
    expect(initRun(ABU, 1).faults.size).toBe(0);
  });
});

describe('fault moments', () => {
  it('a power loss: nurse the car or push', () => {
    const model = withFaults(ABU, [
      { lap: 44, type: 'FAULT', driver: 'HAM', fault: 'power-loss', paceLoss: 1.5 },
    ]);
    const m = candidateMoments(model).find((x) => x.trigger === 'fault');
    expect(m?.lap).toBe(45);
    expect(m?.options.map((o) => o.id)).toEqual(['stay-out', 'nurse', 'push', 'box-soft']);
    expect(m?.options.find((o) => o.id === 'nurse')?.decisions).toEqual([
      { lap: 45, kind: 'mode', key: 'pace', value: 'manage' },
    ]);
    expect(m?.realOptionId).toBe('stay-out');
  });

  it('a puncture: pit now or limp on', () => {
    const model = withFaults(ABU, [
      {
        lap: 44,
        type: 'FAULT',
        driver: 'HAM',
        fault: 'puncture',
        paceLoss: 5,
        slowLap: 12,
        untilStop: true,
      },
    ]);
    const m = candidateMoments(model).find((x) => x.trigger === 'fault');
    expect(m?.options.map((o) => o.label)).toEqual([
      'Limp on',
      'Box for softs',
      'Box for mediums',
      'Limp on and nurse it',
    ]);
  });

  it('a contact over in its own lap brings no moment', () => {
    const model = withFaults(ABU, [
      { lap: 44, type: 'FAULT', driver: 'HAM', fault: 'damage', paceLoss: 0, laps: 1, slowLap: 5 },
    ]);
    expect(candidateMoments(model).some((x) => x.trigger === 'fault')).toBe(false);
  });

  it("only the user's car's faults bring a moment", () => {
    const model = withFaults(ABU, [
      { lap: 44, type: 'FAULT', driver: 'NOR', fault: 'power-loss', paceLoss: 1.5 },
    ]);
    expect(candidateMoments(model).some((x) => x.trigger === 'fault')).toBe(false);
  });
});
