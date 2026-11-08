// Era rules: a race's minimum of stops (rules.minStops; Monaco 2025: two). A car that reaches
// the flag with fewer is disqualified, like the two-compound rule; the grader's continuation,
// the engineer's plans and the rivals keep to it, and the evaluator counts the car out. The race
// file is re-tagged in memory with its data/eras overlay's rules; data/races is left alone.

import { describe, expect, it } from 'vitest';
import overlay from '../../../data/eras/monaco-2025.json';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import monacoJson from '../../../data/races/monaco-2025.json';
import { objectiveMet, targetMet } from '../src/eras/evaluate.js';
import type { ErasRaceLog } from '../src/eras/race-log.js';
import { playOption } from '../src/grade.js';
import { enginePlans, planOption } from '../src/planner.js';
import { resolveRules, stopsBeforeTakeover, stopsOwed } from '../src/rules.js';
import {
  type Run,
  classify,
  initRun,
  isFinished,
  planRemainingStop,
  planRemainingStops,
  realDecisions,
  simulate,
  stepLap,
} from '../src/sim.js';
import type { Decision, RaceModel, RaceRules } from '../src/types.js';

const plain = monacoJson as unknown as RaceModel;
const monaco: RaceModel = { ...plain, rules: overlay.rules as RaceRules };
const abu = abuJson as unknown as RaceModel;

function play(model: RaceModel, seed: number, decisions: Decision[], incidents = false): Run {
  const run = initRun(model, seed, { decisions, incidents });
  while (!isFinished(run)) stepLap(run);
  return run;
}

function pausedAt(model: RaceModel, lap: number, decisions: Decision[] = []): Run {
  const run = initRun(model, 1, { decisions, incidents: false });
  while (run.state.lap < lap) stepLap(run);
  return run;
}

const pit = (lap: number, compound: string): Decision => ({ lap, kind: 'pit', compound });

describe('minStops: the rule and the count', () => {
  it("Monaco 2025's overlay requires two stops", () => {
    expect(resolveRules(monaco).minStops).toBe(2);
    expect(resolveRules(plain).minStops).toBeUndefined();
  });

  it('counts the stops before the takeover from the compounds run, and every stop after', () => {
    const before = Object.fromEntries(monaco.drivers.map((d) => [d.code, stopsBeforeTakeover(d)]));
    expect(before.HAD).toBe(1);
    expect(before.NOR).toBe(0);
    const run = initRun(monaco, 1, { decisions: [pit(30, 'HARD')], incidents: false });
    expect(run.state.cars.NOR?.stops).toBe(0);
    expect(run.state.cars.HAD?.stops).toBe(1);
    while (run.state.lap < 32) stepLap(run);
    expect(run.state.cars.NOR?.stops).toBe(1);
    expect(stopsOwed(monaco.rules, run.state.cars.NOR as never)).toBe(1);
    // Without the rule the count isn't kept at all (the state is as before).
    expect(initRun(plain, 1).state.cars.NOR).not.toHaveProperty('stops');
  });

  it('wet tyres waive it', () => {
    const car = { compound: 'MEDIUM', compoundsUsed: ['MEDIUM', 'INTERMEDIATE'], stops: 0 };
    expect(stopsOwed({ minStops: 2 }, car)).toBe(0);
    expect(stopsOwed({ minStops: 2 }, { ...car, compoundsUsed: ['MEDIUM'] })).toBe(2);
    expect(stopsOwed(undefined, { ...car, compoundsUsed: ['MEDIUM'] })).toBe(0);
  });
});

describe('minStops: disqualification', () => {
  it('disqualifies a player who finishes with one stop; two stops are legal', () => {
    // One stop, MEDIUM to HARD: legal under the two-compound rule, short of Monaco's two.
    expect(classify(play(monaco, 1, [pit(30, 'HARD')])).disqualified).toEqual(['NOR']);
    expect(classify(play(plain, 1, [pit(30, 'HARD')])).disqualified).toEqual([]);
    expect(classify(play(monaco, 1, [pit(30, 'HARD')])).order.at(-1)).toBe('NOR'); // listed last
    const two = classify(play(monaco, 1, [pit(25, 'HARD'), pit(50, 'HARD')]));
    expect(two.disqualified).toEqual([]);
  });

  it("the real calls are legal, and a replay (the real race) doesn't change", () => {
    expect(classify(play(monaco, 1, realDecisions(monaco))).disqualified).toEqual([]);
    for (const seed of [1, 2, 3]) expect(simulate(monaco, seed)).toEqual(simulate(plain, seed));
  });

  it('only the player can fall short: the field keeps to it, incidents and all', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const calls of [[pit(30, 'HARD')], [pit(20, 'HARD'), pit(45, 'HARD')], []]) {
        const result = classify(play(monaco, seed, calls, true));
        expect(result.disqualified.filter((c) => c !== 'NOR')).toEqual([]);
      }
    }
  });

  it("the Standard rival doesn't go long on a stop it needs for the minimum", () => {
    // decisions.test.ts's flagship call: HAM boxes from the lead under the SC with VER 8s
    // behind; VER drops his lap-54 stop. VER has made two stops by then (one before the
    // takeover), so with a minimum of three he keeps it; with two he still goes long.
    const goesLong = (minStops: number) => {
      const model: RaceModel = { ...abu, rules: { minStops } };
      const run = initRun(model, 1, { decisions: [pit(53, 'SOFT')], incidents: false });
      while (run.state.lap < 52) stepLap(run);
      expect(run.state.cars.VER?.stops).toBe(2);
      const ham = run.state.cars.HAM as { totalTime: number };
      (run.state.cars.VER as { totalTime: number }).totalTime = ham.totalTime + 8;
      while (run.state.lap < 56) stepLap(run);
      return run.notes.some((n) => n.kind === 'rival-stays-out' && n.driver === 'VER');
    };
    expect(goesLong(2)).toBe(true);
    expect(goesLong(3)).toBe(false);
  });
});

describe("minStops: the grader's continuation", () => {
  it('owing two stops, the continuation plans two; owing one, it must stop', () => {
    const run = pausedAt(monaco, 20);
    const stops = planRemainingStops(run);
    expect(stops).toHaveLength(2);
    expect((stops[0]?.lap as number) < (stops[1]?.lap as number)).toBe(true);
    expect(stops.every((s) => s.lap > 20 && s.lap <= monaco.race.laps)).toBe(true);
    const once = pausedAt(monaco, 40, [pit(25, 'HARD')]);
    expect(once.state.cars.NOR?.stops).toBe(1);
    expect(planRemainingStop(once)).not.toBeNull();
    expect(planRemainingStops(once)).toHaveLength(1);
    // Without the rule: planRemainingStop's answer, unchanged.
    const free = pausedAt(plain, 40, [pit(25, 'HARD')]);
    const stop = planRemainingStop(free);
    expect(planRemainingStops(free)).toEqual(stop ? [stop] : []);
  });

  it("no playout of a moment's options leaves the player short", () => {
    const run = pausedAt(monaco, 20);
    run.decisions = [];
    const options = [
      { id: 'stay-out', decisions: [] },
      { id: 'box-hard', decisions: [pit(21, 'HARD')] },
      { id: 'box-soft', decisions: [pit(21, 'SOFT')] },
    ];
    for (const seed of [11, 12, 13]) {
      for (const option of options) {
        const fork = playOption(run, seed, option);
        while (!isFinished(fork)) stepLap(fork);
        expect(classify(fork).disqualified, `${option.id} seed ${seed}`).not.toContain('NOR');
      }
    }
  });
});

describe("minStops: the engineer's plans", () => {
  it('offers only plans that reach the minimum, three of them, each legal to the flag', () => {
    const run = pausedAt(monaco, monaco.race.takeoverLap);
    const plans = enginePlans(run);
    expect(plans.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(plans.every((p) => p.stops.length >= 2)).toBe(true);
    for (const plan of plans) {
      const fork = playOption(run, 7, planOption(run, plan));
      while (!isFinished(fork)) stepLap(fork);
      // (ALO, a real retirement the blind playout races on, is short of both rules already.)
      expect(classify(fork).disqualified, plan.id).not.toContain('NOR');
    }
    // Without the rule a one-stop plan leads the offer, as before.
    expect(
      enginePlans(pausedAt(plain, plain.race.takeoverLap)).some((p) => p.stops.length < 2),
    ).toBe(true);
  });
});

describe('minStops: the evaluator', () => {
  const log: ErasRaceLog = {
    driver: 'NOR',
    takeoverLap: monaco.race.takeoverLap,
    laps: [],
  } as unknown as ErasRaceLog;

  it('a disqualified player meets no target', () => {
    const short = { model: monaco, result: classify(play(monaco, 1, [pit(30, 'HARD')])), log };
    const legal = {
      model: monaco,
      result: classify(play(monaco, 1, [pit(25, 'HARD'), pit(50, 'HARD')])),
      log,
    };
    expect(targetMet(short, { type: 'position', position: 20 })).toBe(false);
    expect(targetMet(legal, { type: 'position', position: 20 })).toBe(true);
  });

  it('a stop_count objective the minimum makes impossible is an authoring error', () => {
    const race = { model: monaco, result: classify(play(monaco, 1, [])), log };
    expect(() => objectiveMet(race, { label: 'One stop', type: 'stop_count', max: 1 })).toThrow(
      /minimum/,
    );
    expect(() => objectiveMet(race, { label: 'One stop', type: 'stop_count', exact: 1 })).toThrow(
      /minimum/,
    );
    // Without the rule the same objective is fine to evaluate (the log check fails next).
    expect(() =>
      objectiveMet({ ...race, model: plain }, { label: 'One stop', type: 'stop_count', max: 1 }),
    ).not.toThrow(/minimum/);
  });
});
