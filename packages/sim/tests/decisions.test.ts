// Player calls, headset modes and the reactive rival (Implementation Plan 2.5-2.6).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import spainJson from '../../../data/races/spain-2021.json';
import {
  decide,
  initRun,
  isFinished,
  realDecisions,
  simulate,
  stepLap,
  validateDecisions,
} from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const spain = spainJson as unknown as RaceModel;

function runTo(model: RaceModel, seed: number, decisions: Decision[], lap: number) {
  const run = initRun(model, seed, { decisions });
  while (run.state.lap < lap && !isFinished(run)) stepLap(run);
  return run;
}

describe('player-controlled car', () => {
  it('drops the real strategy: no calls means no stops', () => {
    // Spain 2021: VER really stopped on laps 25 and 61; as the player's car he stays out.
    const run = runTo(spain, 1, [], spain.race.laps);
    expect(run.state.cars.VER?.tyreAge).toBe(23 + (spain.race.laps - spain.race.takeoverLap));
  });

  it('boxing on lap L charges the stop on lap L + 1', () => {
    const run = runTo(spain, 1, [{ lap: 30, kind: 'pit', compound: 'MEDIUM' }], 31);
    expect(run.state.cars.VER?.pittedThisLap).toBe(true);
    expect(run.state.cars.VER?.compound).toBe('MEDIUM');
    expect(run.state.cars.VER?.tyreAge).toBe(1);
  });

  it("the user's real calls reproduce the scripted race when the rival never reacts", () => {
    // Abu Dhabi 2021: HAM made no stops after takeover, so nothing triggers the rival.
    expect(realDecisions(abu)).toEqual([]);
    expect(simulate(abu, 5, { decisions: realDecisions(abu) })).toEqual(simulate(abu, 5));
  });

  it('realDecisions turns real out-laps into in-lap pit calls', () => {
    expect(realDecisions(spain)).toEqual([
      { lap: 24, kind: 'pit', compound: 'MEDIUM' },
      { lap: 60, kind: 'pit', compound: 'SOFT' },
    ]);
  });

  it('rejects invalid calls', () => {
    const bad: Decision[][] = [
      [{ lap: spain.race.takeoverLap, kind: 'pit', compound: 'SOFT' }],
      [{ lap: 30, kind: 'pit', compound: 'INTERMEDIATE' }],
      [{ lap: spain.race.laps, kind: 'pit', compound: 'SOFT' }],
      [{ lap: 30, kind: 'mode', key: 'pace', value: 'flatout' }],
    ];
    for (const d of bad) expect(() => validateDecisions(spain, d)).toThrow();
  });

  it('decide() logs calls for future laps only', () => {
    const run = runTo(spain, 1, [], 30);
    expect(() => decide(run, { lap: 30, kind: 'pit', compound: 'SOFT' })).toThrow();
    decide(run, { lap: 31, kind: 'pit', compound: 'SOFT' });
    stepLap(run);
    stepLap(run);
    expect(run.state.cars.VER?.compound).toBe('SOFT');
    expect(run.decisions).toHaveLength(1);
  });
});

describe('headset modes', () => {
  it('push wears tyres faster and laps quicker than manage', () => {
    const at = (value: string) =>
      runTo(spain, 3, [{ lap: 21, kind: 'mode', key: 'pace', value }], 30).state.cars.VER;
    const push = at('push');
    const manage = at('manage');
    expect(push?.tyreWear).toBeGreaterThan(push?.tyreAge as number);
    expect(manage?.tyreWear).toBeLessThan(manage?.tyreAge as number);
    expect(push?.totalTime).toBeLessThan(manage?.totalTime as number);
  });

  it('default modes leave the race unchanged', () => {
    const modes: Decision[] = [
      { lap: 21, kind: 'mode', key: 'pace', value: 'standard' },
      { lap: 21, kind: 'mode', key: 'battle', value: 'hold' },
    ];
    expect(simulate(spain, 4, { decisions: modes })).toEqual(simulate(spain, 4, { decisions: [] }));
  });
});

describe('rival policy', () => {
  it('covers a green-flag undercut when its own stop is near', () => {
    // Spain 2021: HAM (rival) really stopped on lap 29. VER boxing on 24 (stop charged on
    // 25) is inside the undercut window and within 4 laps of HAM's stop -> HAM covers on 26.
    const run = runTo(spain, 1, [{ lap: 24, kind: 'pit', compound: 'MEDIUM' }], 26);
    expect(run.notes).toContainEqual({
      lap: 25,
      kind: 'rival-cover',
      driver: 'HAM',
      detail: 'MEDIUM',
    });
    expect(run.state.cars.HAM?.pittedThisLap).toBe(true);
  });

  it('keeps its real strategy when its own stop is far off', () => {
    const run = runTo(spain, 1, [{ lap: 20 + 1, kind: 'pit', compound: 'MEDIUM' }], 30);
    expect(run.notes.filter((n) => n.kind === 'rival-cover')).toEqual([]);
  });

  it('covers a VSC stop when it stays ahead after both stops', () => {
    // Swap sides at Abu Dhabi: the player runs VER, the rival is HAM (leading). VER boxing on
    // lap 35 (stop charged under the lap-36 VSC, which keeps gaps) leaves HAM more than a VSC
    // stop ahead with the VSC still out on 37 -> HAM takes the cheap stop on 37.
    const swapped: RaceModel = { ...abu, userSide: 'VER', rival: 'HAM' };
    const run = runTo(swapped, 1, [{ lap: 35, kind: 'pit', compound: 'HARD' }], 37);
    expect(run.notes).toContainEqual({
      lap: 36,
      kind: 'rival-cover',
      driver: 'HAM',
      detail: 'HARD',
    });
    expect(run.state.cars.HAM?.pittedThisLap).toBe(true);
  });

  it('stays out under a safety car once the train has bunched', () => {
    // Same swap, VER boxing on lap 53: by the time HAM could stop (lap 55) the field has
    // closed up behind the SC, so stopping would lose the lead -> HAM keeps track position.
    const swapped: RaceModel = { ...abu, userSide: 'VER', rival: 'HAM' };
    const run = runTo(swapped, 1, [{ lap: 53, kind: 'pit', compound: 'SOFT' }], 56);
    expect(run.notes.filter((n) => n.kind === 'rival-cover')).toEqual([]);
  });

  it('goes long under a SC to take track position when the user pits from ahead', () => {
    // The flagship call: HAM (player) boxes from the lead on lap 53. VER, behind and due to
    // stop on 54, sees it and stays out to lead the restart (his tyres won't reach the cliff
    // before the flag, so the stop is dropped).
    const run = runTo(abu, 1, [{ lap: 53, kind: 'pit', compound: 'SOFT' }], 56);
    expect(run.notes).toContainEqual({
      lap: 53,
      kind: 'rival-stays-out',
      driver: 'VER',
      detail: 'no stop',
    });
    expect(run.state.cars.VER?.strategy).toEqual([]);
    expect(run.state.order.indexOf('VER')).toBeLessThan(run.state.order.indexOf('HAM'));
  });

  it('only a rival behind the user can go long', () => {
    // Swap sides: the rival HAM leads, so he is past pit entry before VER's call.
    const swapped: RaceModel = { ...abu, userSide: 'VER', rival: 'HAM' };
    const run = runTo(swapped, 1, [{ lap: 53, kind: 'pit', compound: 'SOFT' }], 56);
    expect(run.notes.filter((n) => n.kind === 'rival-stays-out')).toEqual([]);
  });

  it('does not go long under green (the plan covers instead)', () => {
    const run = runTo(spain, 1, [{ lap: 24, kind: 'pit', compound: 'MEDIUM' }], 30);
    expect(run.notes.filter((n) => n.kind === 'rival-stays-out')).toEqual([]);
  });
});
