// The offline grader's pause (moments.ts pauseAt) burns the player's fuel live in an Eras race
// with a fuel rule (sim.ts liveFuelFrom): the hard-call counter and the author grade from it,
// so a skipped fill or a missed lift must run dry there as in live play. The laps before the
// pause stay the real race's replay; Daily and Gauntlet pauses are unchanged.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import germany1986Json from '../../../data/races/germany-1986.json';
import japan2000Json from '../../../data/races/japan-2000.json';
import { fromSide } from '../src/eras/hard-calls.js';
import { gradeMoment, playOption } from '../src/grade.js';
import { candidateMoments, pauseAt } from '../src/moments.js';
import {
  type Run,
  erasFuelRule,
  fuelConfig,
  initRun,
  isFinished,
  liveFuelFrom,
  realDecisions,
  stepLap,
} from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const germany1986 = germany1986Json as unknown as RaceModel;
const japan2000 = japan2000Json as unknown as RaceModel;

const user = (run: Run) =>
  run.state.cars[run.model.userSide] as NonNullable<Run['state']['cars'][string]>;

/** The real race replayed to just before `lap` with the fuel replay only (the old pause). */
function replayTo(model: RaceModel, lap: number): Run {
  const before = realDecisions(model).filter((d) => d.lap < lap && d.lap > model.race.takeoverLap);
  const run = initRun(model, model.race.seed, { decisions: before, incidents: false });
  const first = model.drivers
    .find((d) => d.code === model.userSide)
    ?.realStrategy.find((s) => s.lap === model.race.takeoverLap + 1);
  if (first) throw new Error('test helper: no takeover-lap stop expected');
  while (run.state.lap < lap - 1) stepLap(run);
  return run;
}

describe('pauseAt: refuelling (japan-2000)', () => {
  // Schumacher's side: his real stop is the out-lap of lap 24, so paused before lap 22 his
  // tank holds laps 22 and 23 plus the reserve.
  const msc = fromSide(japan2000, 'MSCM');

  it('keeps the real race to the pause and turns the tank live from there', () => {
    const run = pauseAt(msc, 22);
    const old = replayTo(msc, 22);
    expect(user(run).tankLive).toBe(true);
    expect(user(run).tank).toBe(user(old).tank);
    expect(user(run).tank).toBeCloseTo(3, 9);
    // The laps run are the real race's: every car's time and order as before.
    expect(run.state.order).toEqual(old.state.order);
    for (const [code, c] of Object.entries(run.state.cars)) {
      expect(c.totalTime, code).toBe(old.state.cars[code]?.totalTime);
    }
  });

  it('pushing to the real stop runs dry and stops the car; the real call does not', () => {
    const run = pauseAt(msc, 22);
    const push = playOption(run, 1, {
      id: 'push',
      decisions: [{ lap: 22, kind: 'mode', key: 'pace', value: 'push' }],
    });
    while (!isFinished(push)) stepLap(push);
    expect(user(push).retired).toBe(true);
    expect(push.notes.some((n) => n.kind === 'fuel' && n.detail === 'out')).toBe(true);
    const stay = playOption(run, 1, { id: 'stay-out', decisions: [] });
    while (!isFinished(stay)) stepLap(stay);
    expect(user(stay).retired).toBe(false);
  });

  it('grades the push at the lap-22 moment as running dry (it graded 94% fuel-blind)', () => {
    const m = candidateMoments(msc).find((x) => x.lap === 22);
    expect(m).toBeDefined();
    if (!m) return;
    const g = gradeMoment(pauseAt(msc, 22), m.options, m.target, 40);
    const p = (id: string) => g.options.find((o) => o.id === id)?.probability ?? -1;
    expect(p('push')).toBeLessThan(0.2);
    expect(p('stay-out')).toBeGreaterThan(p('push'));
  });
});

describe('pauseAt: a fuel limit (germany-1986)', () => {
  it("gives the car live play's load less the laps run, and burns it live", () => {
    const run = pauseAt(germany1986, 30);
    const f = fuelConfig(germany1986);
    expect(f).not.toBeNull();
    if (!f) return;
    // Live play's takeover load from the same seed, less the standard burn of the laps run
    // (no SC or VSC in this race).
    const live = initRun(germany1986, germany1986.race.seed, { decisions: [] });
    const load = user(live).fuel as number;
    const ran = run.state.lap - germany1986.race.takeoverLap;
    expect(run.liveFuel).toBe(true);
    expect(user(run).fuel).toBeCloseTo(load - f.burnPerLap * ran, 9);
    // The replay before the pause is the real race's (no fuel weight in it).
    const old = replayTo(germany1986, 30);
    for (const [code, c] of Object.entries(run.state.cars)) {
      expect(c.totalTime, code).toBe(old.state.cars[code]?.totalTime);
    }
    // A playout burns it: short of the flag at the standard burn, the car stops.
    const short =
      (user(run).fuel as number) < f.burnPerLap * (germany1986.race.laps - run.state.lap);
    const keep = playOption(run, 1, { id: 'keep', decisions: [] });
    while (!isFinished(keep)) stepLap(keep);
    expect(user(keep).retired).toBe(short);
    expect(user(keep).fuel).toBeDefined();
  });

  it('liveFuelFrom does not draw a second load on a run that already burns live', () => {
    const live = initRun(germany1986, 3, { decisions: [] });
    for (let i = 0; i < 5; i++) stepLap(live);
    const fuel = user(live).fuel;
    liveFuelFrom(live);
    expect(user(live).fuel).toBe(fuel);
  });
});

describe('pauseAt: Daily and Gauntlet are unchanged', () => {
  it('no Daily or Gauntlet pool race has a fuel rule', () => {
    const data = join(import.meta.dirname, '../../../data');
    const pools = JSON.parse(readFileSync(join(data, 'pools.json'), 'utf8')) as {
      daily: string[];
      survivor: Record<string, unknown>;
    };
    const ids = [...pools.daily, ...Object.keys(pools.survivor)];
    expect(ids.length).toBeGreaterThan(30);
    for (const id of ids) {
      const m = JSON.parse(readFileSync(join(data, 'races', `${id}.json`), 'utf8')) as RaceModel;
      expect(erasFuelRule(m), id).toBe(false);
    }
  });

  it("a Daily pause has no live fuel: no load, no live tank, the replay's state", () => {
    const run = pauseAt(abu, 36);
    expect(run.liveFuel).toBe(false);
    expect(user(run).fuel).toBeUndefined();
    expect(user(run).tankLive).toBeUndefined();
    expect(JSON.stringify(run.state)).toBe(JSON.stringify(replayTo(abu, 36).state));
    // liveFuelFrom is a no-op outside an Eras fuel-rule race.
    liveFuelFrom(run);
    expect(run.liveFuel).toBe(false);
    expect(user(run).fuel).toBeUndefined();
  });
});
