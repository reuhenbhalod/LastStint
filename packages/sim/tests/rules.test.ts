// Era rules (eras build plan 4.1, roadmap R5): the race's `rules` block and scUnlap 'none'.
// Parity: the Python reference sim's vectors (pipeline/tests/fixtures/race_rules_parity.json,
// written by pipeline/tests/test_race_rules.py) replay here to the same classification and
// times. Race files are re-tagged in memory; data/races is left alone.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import canadaJson from '../../../data/races/canada-2024.json';
import vectors from '../../../pipeline/tests/fixtures/race_rules_parity.json';
import headset from '../src/headset.json';
import {
  allowedFlag,
  headsetFor,
  pitLaneClosed,
  raceYear,
  resolveRules,
  safetyCarRule,
  scQueue,
  stopChangesTyres,
  stopGoCost,
} from '../src/rules.js';
import {
  type Run,
  classify,
  forkRun,
  initRun,
  isFinished,
  modeEffects,
  neutralMap,
  planRemainingStop,
  ruleSatisfied,
  simulate,
  stepLap,
  validateDecisions,
} from '../src/sim.js';
import type { Decision, Era, PitStop, RaceModel, RaceRules } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const canada = canadaJson as unknown as RaceModel;
const MODELS: Record<string, RaceModel> = { 'abu-dhabi-2021': abu, 'canada-2024': canada };

const ruled = (
  model: RaceModel,
  rules: RaceRules,
  extra: Partial<RaceModel> = {},
  scUnlap?: RaceModel['race']['scUnlap'],
): RaceModel => ({
  ...model,
  ...extra,
  rules,
  race: scUnlap ? { ...model.race, scUnlap } : model.race,
});

function play(model: RaceModel, seed: number, decisions: Decision[] = []): Run {
  const run = initRun(model, seed, { decisions });
  while (!isFinished(run)) stepLap(run);
  return run;
}

interface Vector {
  name: string;
  race: string;
  rules?: RaceRules;
  scUnlap?: RaceModel['race']['scUnlap'];
  strategies?: Record<string, PitStop[]>;
  results: Record<
    string,
    {
      order: string[];
      finishers: string[];
      times: Record<string, number>;
      gaps: Record<string, number>;
    }
  >;
}

describe.each((vectors as unknown as { cases: Vector[] }).cases.map((c) => [c.name, c] as const))(
  'parity: %s',
  (_name, c) => {
    const base = MODELS[c.race] as RaceModel;
    const model: RaceModel = {
      ...base,
      ...(c.rules ? { rules: c.rules } : {}),
      race: c.scUnlap ? { ...base.race, scUnlap: c.scUnlap } : base.race,
    };
    it.each(Object.keys(c.results))('seed %s matches the Python reference sim', (seed) => {
      const want = c.results[seed] as Vector['results'][string];
      const got = simulate(model, Number(seed), { strategies: c.strategies });
      expect(got.order).toEqual(want.order);
      expect(got.finishers).toEqual(want.finishers);
      for (const code of want.finishers) {
        expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
        expect(got.gaps[code]).toBeCloseTo(want.gaps[code] as number, 3);
      }
    });
  },
);

describe('no rules block', () => {
  it('resolves to the defaults, and the era block is used as it is', () => {
    expect(resolveRules(abu)).toEqual({
      twoCompound: true,
      tyreChanges: true,
      refuelling: false,
      pitLaneClosedUnderSC: false,
      vsc: true,
      safetyCar: true,
    });
    const blocks = headset as unknown as Record<string, { drs?: boolean; modes: object }>;
    expect(headsetFor(blocks as never, abu)).toBe(blocks[abu.era]);
    expect(scQueue(abu)).toEqual(['HAM', 'VER']);
    expect(scQueue(canada)).toBeNull();
  });

  it('a block of defaults replays and plays exactly as no block', () => {
    const m = ruled(abu, { twoCompound: true, tyreChanges: true, pitLaneClosedUnderSC: false });
    for (const seed of [1, 2, 3]) {
      expect(simulate(m, seed)).toEqual(simulate(abu, seed));
      expect(play(m, seed).notes).toEqual(play(abu, seed).notes);
    }
  });
});

describe('drs and ers override the era block', () => {
  const lap = abu.race.takeoverLap + 1;
  const ok = (m: RaceModel, d: Decision) => () => validateDecisions(m, [d]);
  const wait: Decision = { lap, kind: 'battle', move: 'wait-drs' };
  const button: Decision = { lap, kind: 'battle', move: 'overtake-button' };
  const deploy: Decision = { lap, kind: 'mode', key: 'ers', value: 'deploy' };

  it('drs false drops wait-drs in a DRS era; drs true adds it to one without', () => {
    expect(ok(ruled(abu, { drs: false }), wait)).toThrow(/wait-drs/);
    expect(ok(abu, wait)).not.toThrow();
    const old = { ...abu, era: '1994-2009' as Era };
    expect(ok(old, wait)).toThrow(/wait-drs/);
    expect(ok(ruled(old, { drs: true }), wait)).not.toThrow();
  });

  it("ers 'none' removes the battery: no ERS modes, no overtake button, no charge", () => {
    const m = ruled(abu, { ers: 'none' });
    expect(ok(m, button)).toThrow(/overtake-button/);
    expect(ok(m, deploy)).toThrow(/unknown mode/);
    expect(modeEffects(m)?.ers).toBeUndefined();
    expect(initRun(m, 1, { decisions: [] }).state.cars.HAM?.battery).toBeUndefined();
    // The race engineer and incidents still run.
    expect(initRun(m, 1, { decisions: [] }).state.engineer).toBeDefined();
  });

  it("ers 'kers' gives a 2009 race (1994-2009 era, no battery) one", () => {
    const old = { ...abu, era: '1994-2009' as Era };
    expect(ok(old, deploy)).toThrow(/unknown mode/);
    const m = ruled(old, { ers: 'kers' });
    expect(ok(m, deploy)).not.toThrow();
    expect(ok(m, button)).not.toThrow();
    expect(initRun(m, 1, { decisions: [] }).state.cars.HAM?.battery).toBeTypeOf('number');
  });

  it('only touches live play: replays are unchanged', () => {
    const m = ruled(abu, { drs: false, ers: 'none' });
    for (const seed of [1, 2]) expect(simulate(m, seed)).toEqual(simulate(abu, seed));
  });
});

describe('vsc false: nothing makes a VSC', () => {
  const m = ruled(abu, { vsc: false });

  it("the headset's VSC base rate is 0 and every crash is a SC", () => {
    const h = initRun(m, 1, { decisions: [] }).headset;
    expect(h?.neutralization?.vscPerLap).toBe(0);
    expect(h?.incidents?.scShare).toBe(1);
    expect(allowedFlag(m, 'vsc')).toBe('sc');
    expect(allowedFlag(abu, 'vsc')).toBe('vsc');
  });

  it('no live race or grader playout adds a VSC (crashes still bring out SCs)', () => {
    const real = abu.events.filter((e) => e.type === 'VSC').length;
    let added = 0;
    let addedVsc = 0;
    let forkSc = 0;
    for (let seed = 0; seed < 300; seed++) {
      const run = play(m, seed);
      const extra = run.events.slice(abu.events.filter((e) => e.type !== 'RETIREMENT').length);
      added += extra.length;
      addedVsc += extra.filter((e) => e.flag === 'vsc').length;
      expect(run.events.filter((e) => e.flag === 'vsc').length).toBe(real);
      const live = initRun(m, seed, { decisions: [] });
      while (live.state.lap < 40) stepLap(live);
      const fork = forkRun(live, seed, [], { blindAfter: 40 });
      const drawn = fork.events.filter((e) => e.lap > 40);
      expect(drawn.some((e) => e.flag === 'vsc')).toBe(false);
      forkSc += drawn.length;
    }
    expect(added).toBeGreaterThan(0);
    expect(addedVsc).toBe(0);
    expect(forkSc).toBeGreaterThan(0);
  });

  it('with the VSC on, the same seeds do draw VSCs (the test can see one)', () => {
    let vsc = 0;
    for (let seed = 0; seed < 300 && !vsc; seed++) {
      const live = initRun(abu, seed, { decisions: [] });
      while (live.state.lap < 40) stepLap(live);
      const fork = forkRun(live, seed, [], { blindAfter: 40 });
      vsc += fork.events.filter((e) => e.lap > 40 && e.flag === 'vsc').length;
    }
    expect(vsc).toBeGreaterThan(0);
  });
});

describe('twoCompound', () => {
  it('false: a one-compound finish is legal (no disqualification, no forced stop)', () => {
    // HAM as if his takeover set were his only dry compound so far; no stop at all.
    const oneSet = {
      ...abu,
      drivers: abu.drivers.map((d) =>
        d.code === 'HAM'
          ? { ...d, stateAtTakeover: { ...d.stateAtTakeover, compoundsUsed: ['HARD'] } }
          : d,
      ),
    };
    const m = ruled(oneSet, { twoCompound: false });
    const on = play(oneSet, 1);
    const off = play(m, 1);
    expect(classify(on).disqualified).toContain('HAM');
    expect(classify(off).disqualified).toEqual([]);
    const car = off.state.cars.HAM as never;
    expect(ruleSatisfied(car)).toBe(false);
    expect(ruleSatisfied(car, m.rules)).toBe(true);
    // The grader's continuation no longer has to stop for a new compound.
    const run = initRun(m, 1, { decisions: [] });
    while (run.state.lap < 54) stepLap(run);
    expect(planRemainingStop(run)).toBeNull();
  });
});

describe('tyreChanges false (2005)', () => {
  const m = ruled(canada, { tyreChanges: false });

  it('a dry stop keeps the set; a wet change or a damaged tyre fits new ones', () => {
    expect(stopChangesTyres(m.rules, 'MEDIUM', { to: 'HARD' })).toBe(false);
    expect(stopChangesTyres(m.rules, 'MEDIUM', { to: 'INTERMEDIATE' })).toBe(true);
    expect(stopChangesTyres(m.rules, 'INTERMEDIATE', { to: 'MEDIUM' })).toBe(true);
    expect(stopChangesTyres(m.rules, 'MEDIUM', { to: 'MEDIUM', damaged: true })).toBe(true);
    expect(stopChangesTyres(undefined, 'MEDIUM', { to: 'HARD' })).toBe(true);
  });

  it("HAM's lap-55 MEDIUM to HARD stop leaves him on worn mediums", () => {
    const run = initRun(m, 1);
    while (run.state.lap < 55) stepLap(run);
    const ham = run.state.cars.HAM;
    expect(ham?.compound).toBe('MEDIUM');
    expect(ham?.tyreAge).toBeGreaterThan(5);
    expect(ham?.compoundsUsed).not.toContain('HARD');
  });

  it('a pit call for another dry compound is illegal; the same one (a refuel) is not', () => {
    const dry = { ...abu, rules: { tyreChanges: false } };
    const lap = abu.race.takeoverLap + 2;
    expect(() => validateDecisions(dry, [{ lap, kind: 'pit', compound: 'SOFT' }])).toThrow(
      /no tyre changes/,
    );
    expect(() => validateDecisions(dry, [{ lap, kind: 'pit', compound: 'HARD' }])).not.toThrow();
    // Canada's takeover is on inters: any dry tyre is a weather change.
    expect(() => validateDecisions(m, [{ lap: 30, kind: 'pit', compound: 'HARD' }])).not.toThrow();
  });

  it("the player's same-compound stop keeps tyre age; the rival never covers", () => {
    const dry = { ...abu, rules: { tyreChanges: false, twoCompound: false } };
    const run = play(dry, 2, [{ lap: 40, kind: 'pit', compound: 'HARD' }]);
    const start = abu.drivers.find((d) => d.code === 'HAM')?.stateAtTakeover.tyreAge as number;
    expect(run.state.cars.HAM?.tyreAge).toBe(start + abu.race.laps - abu.race.takeoverLap);
    expect(run.notes.some((n) => n.kind === 'rival-cover' || n.kind === 'rival-stays-out')).toBe(
      false,
    );
  });
});

describe('pitLaneClosedUnderSC (2007-08)', () => {
  const m = ruled(abu, { pitLaneClosedUnderSC: true });
  const neutral = neutralMap([{ lap: 53, laps: 5, flag: 'sc' }]);

  it('closes the pit entry at the end of the deployment lap only', () => {
    expect(pitLaneClosed(m, neutral, 53, 'SOFT')).toBe(false); // entered before the SC
    expect(pitLaneClosed(m, neutral, 54, 'SOFT')).toBe(true);
    expect(pitLaneClosed(m, neutral, 55, 'SOFT')).toBe(false); // queued: open
    expect(pitLaneClosed(m, neutral, 54, 'INTERMEDIATE')).toBe(false); // wet tyres only
    expect(pitLaneClosed(abu, neutral, 54, 'SOFT')).toBe(false);
    expect(pitLaneClosed(m, neutralMap([{ lap: 36, laps: 3, flag: 'vsc' }]), 37, 'SOFT')).toBe(
      false,
    );
  });

  it("the player's stop into the closed lane owes a stop-go, served on the first green lap", () => {
    const call: Decision[] = [{ lap: 53, kind: 'pit', compound: 'SOFT' }]; // out-lap 54
    const run = play(m, 3, call);
    const notes = run.notes.filter((n) => n.kind === 'stop-go');
    expect(notes.map((n) => [n.lap, n.detail])).toEqual([
      [54, 'owed'],
      [58, 'served'],
    ]);
    expect(notes[1]?.value).toBeCloseTo(stopGoCost(m), 9);
    const open = play(abu, 3, call);
    expect(open.notes.some((n) => n.kind === 'stop-go')).toBe(false);
    const t = (r: Run) => r.state.cars.HAM?.totalTime as number;
    expect(t(run) - t(open)).toBeGreaterThan(stopGoCost(m) - 3);
  });

  it('a stop one lap later (pit lane open) costs nothing extra', () => {
    const call: Decision[] = [{ lap: 54, kind: 'pit', compound: 'SOFT' }];
    expect(play(m, 3, call).notes.some((n) => n.kind === 'stop-go')).toBe(false);
  });

  it('real stops are never penalised (their cost is in the data)', () => {
    for (const seed of [1, 2, 3]) expect(simulate(m, seed)).toEqual(simulate(abu, seed));
  });
});

describe("scUnlap 'none'", () => {
  it('lapped cars stay a lap down behind the SC', () => {
    const all = { ...abu, race: { ...abu.race, scUnlap: 'all' as const } };
    const none = { ...abu, race: { ...abu.race, scUnlap: 'none' as const } };
    expect(scQueue(none)).toBe('none');
    const green = abu.track.greenLapTime as number;
    for (const seed of [1, 2, 3]) {
      expect(Math.max(...Object.values(simulate(all, seed).gaps))).toBeLessThan(green);
      expect(Math.max(...Object.values(simulate(none, seed).gaps))).toBeGreaterThan(green);
    }
  });
});

describe('every rule combination plays without crashing', () => {
  const flags = ['twoCompound', 'tyreChanges', 'pitLaneClosedUnderSC', 'vsc', 'drs'] as const;
  const ers = ['none', 'kers', 'hybrid', undefined] as const;
  const unlaps = ['all', 'duel', 'none'] as const;
  const eras: Era[] = ['1988-1993', '1994-2009', '2010-2013', '2014-2025'];
  const combos: Array<[string, RaceModel]> = [];
  for (let mask = 0; mask < 1 << flags.length; mask++) {
    const rules: RaceRules = {};
    flags.forEach((f, i) => {
      rules[f] = !!(mask & (1 << i));
    });
    const e = ers[mask % ers.length];
    if (e) rules.ers = e;
    const base = mask % 2 ? canada : abu;
    const model = ruled(
      { ...base, era: eras[mask % eras.length] as Era },
      rules,
      {},
      unlaps[mask % unlaps.length],
    );
    combos.push([JSON.stringify({ rules, era: model.era, scUnlap: model.race.scUnlap }), model]);
  }

  it.each(combos)('%s', (_name, model) => {
    simulate(model, 1);
    const lap = model.race.takeoverLap + 3;
    const on = model.drivers.find((d) => d.code === model.userSide)?.stateAtTakeover.compound;
    const compound = model.rules?.tyreChanges === false ? (on as string) : 'HARD';
    for (const seed of [1, 2]) {
      const run = play(model, seed, [{ lap, kind: 'pit', compound }]);
      expect(isFinished(run)).toBe(true);
      const r = classify(run);
      expect(r.order.length).toBe(model.drivers.length);
      if (model.rules?.vsc === false) {
        const real = model.events.filter((e) => e.type === 'VSC').length;
        expect(run.events.filter((e) => e.flag === 'vsc').length).toBe(real);
      }
      // A grader fork plans and plays to the flag too.
      const live = initRun(model, seed, { decisions: [] });
      while (live.state.lap < lap) stepLap(live);
      const fork = forkRun(live, seed, [], { blindAfter: lap });
      planRemainingStop(fork, { exact: true });
      while (!isFinished(fork)) stepLap(fork);
    }
  });
});

describe('the safety car: from 1993', () => {
  const at = (id: string) => ({ ...abu, race: { ...abu.race, id } });

  it('reads the year off the race id', () => {
    expect(raceYear('abu-dhabi-2021')).toBe(2021);
    expect(raceYear('spain-1994-pits')).toBe(1994);
    expect(raceYear('fixture')).toBeNull();
  });

  it('exists from 1993 (and for an id without a year), not before', () => {
    expect(safetyCarRule(at('brazil-1992'))).toBe(false);
    expect(safetyCarRule(at('brazil-1993'))).toBe(true);
    expect(safetyCarRule(at('fixture'))).toBe(true);
    expect(resolveRules(at('japan-1990')).safetyCar).toBe(false);
    expect(resolveRules(abu).safetyCar).toBe(true);
  });

  it('a made-up SC or VSC has no flag before 1993; a red flag still does', () => {
    const m = at('japan-1990');
    expect(allowedFlag(m, 'sc')).toBeNull();
    expect(allowedFlag(m, 'vsc')).toBeNull();
    expect(allowedFlag(m, 'red')).toBe('red');
    expect(allowedFlag(at('japan-1993'), 'sc')).toBe('sc');
  });
});
