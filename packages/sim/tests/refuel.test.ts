// Refuelling and fuel limits (eras build plan 4.2, roadmap R4). Parity: the Python reference
// sim's vectors (pipeline/tests/fixtures/refuel_parity.json, written by
// pipeline/tests/test_refuel.py) replay here to the same classification and times, and the
// shared functions (fill choices, takeover tanks, allowances) agree. Race files are re-tagged
// in memory; data/races is left alone.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import canadaJson from '../../../data/races/canada-2024.json';
import sanMarino2005Json from '../../../data/races/san-marino-2005.json';
import vectors from '../../../pipeline/tests/fixtures/refuel_parity.json';
import { gradeMoment, playOption } from '../src/grade.js';
import { type DecisionMoment, boxCall, candidateMoments, pauseAt } from '../src/moments.js';
import { planCalls, validatePlan } from '../src/plan.js';
import { enginePlans, fuelled, planOption } from '../src/planner.js';
import {
  PRIOR_SECONDS_PER_LAP,
  RESERVE_LAPS,
  fillCap,
  fillLaps,
  fillOptions,
  fillStint,
  limitBurnPerLap,
  realFill,
  refuelAtStop,
  refuelModel,
  takeoverTank,
  tankReading,
} from '../src/refuel.js';
import {
  type Run,
  decide,
  forkRun,
  fuelConfig,
  initRun,
  isFinished,
  planRemainingStop,
  planRemainingStops,
  realDecisions,
  simulate,
  stepLap,
  validateDecisions,
  withinTank,
} from '../src/sim.js';
import type {
  CarState,
  Decision,
  Fill,
  FillChoice,
  PitStop,
  RaceModel,
  RacePlan,
  RaceRules,
  RefuelModel,
} from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const canada = canadaJson as unknown as RaceModel;
const MODELS: Record<string, RaceModel> = {
  'abu-dhabi-2021': abu,
  'canada-2024': canada,
  'san-marino-2005': sanMarino2005Json as unknown as RaceModel,
};
const FILL: RefuelModel = {
  secondsPerLap: 0.3,
  laneBase: 18,
  refFill: 15,
  tankLaps: 30,
  stops: 20,
};

interface Vector {
  name: string;
  race: string;
  rules: RaceRules;
  refuel?: RefuelModel;
  strategies?: Record<string, PitStop[]>;
  /** refuel.py fill_cap of the case's race. */
  fillCap: number;
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
interface Functions {
  fills: [FillChoice, number, number, number][];
  /** fill_laps(fill, remaining, 30): exact fills and named ones. */
  exact: [Fill, number, number][];
  tanks: [PitStop[], number][];
  limits: Record<string, number | null>;
}
const V = vectors as unknown as { cases: Vector[]; functions: Functions };

const tagged = (model: RaceModel, rules: RaceRules, refuel?: RefuelModel): RaceModel => ({
  ...model,
  rules,
  track: refuel ? { ...model.track, refuel } : model.track,
});

describe.each(V.cases.map((c) => [c.name, c] as const))('parity: %s', (_name, c) => {
  const model = tagged(MODELS[c.race] as RaceModel, c.rules, c.refuel);
  it('fillCap matches refuel.py fill_cap', () => expect(fillCap(model)).toBe(c.fillCap));
  it.each(Object.keys(c.results))('seed %s matches the Python reference sim', (seed) => {
    const want = c.results[seed] as Vector['results'][string];
    const strategies = c.strategies ? structuredClone(c.strategies) : undefined;
    const got = simulate(model, Number(seed), { strategies });
    expect(got.order).toEqual(want.order);
    expect(got.finishers).toEqual(want.finishers);
    for (const code of want.finishers) {
      expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
      expect(got.gaps[code]).toBeCloseTo(want.gaps[code] as number, 3);
    }
  });
});

describe('parity: the shared functions', () => {
  it('fill choices', () => {
    for (const [choice, remaining, cap, want] of V.functions.fills) {
      expect(fillStint(choice, remaining, cap), `${choice} ${remaining} ${cap}`).toBe(want);
    }
  });
  it('exact fills (and named ones) through fillLaps', () => {
    expect(V.functions.exact.length).toBeGreaterThan(0);
    for (const [fill, remaining, want] of V.functions.exact) {
      expect(fillLaps(fill, remaining, 30), `${JSON.stringify(fill)} ${remaining}`).toBe(want);
    }
  });
  it('takeover tanks', () => {
    for (const [plan, want] of V.functions.tanks) expect(takeoverTank(plan, 34, 58)).toBe(want);
  });
  it('fuel allowances by year (kg), as the overlays carry them', () => {
    expect(V.functions.limits['1984']).toBe(187);
    expect(V.functions.limits['1988']).toBe(127.5);
    expect(V.functions.limits['1989']).toBeNull();
    for (const [year, kg] of Object.entries(V.functions.limits)) {
      const m = tagged(abu, kg === null ? {} : { fuelLimit: kg });
      expect(limitBurnPerLap(m), year).toBe(kg === null ? null : kg / abu.race.laps);
    }
  });
});

describe('refuelling off', () => {
  it('a race without the rule replays and plays as before', () => {
    const m = tagged(abu, { refuelling: false }, FILL);
    for (const seed of [1, 2]) {
      expect(simulate(m, seed)).toEqual(simulate(abu, seed));
      expect(play(m, seed).notes).toEqual(play(abu, seed).notes);
    }
    expect(fuelConfig(m)).toEqual(fuelConfig(abu));
  });
});

// --- Live play: the player's fill and tank -------------------------------------------------

// VER as the player: the real lap-37 stop is the next, so VER takes over with 2 laps + the
// reserve (the in-lap is 36).
const refuelRace = { ...tagged(abu, { refuelling: true }, FILL), userSide: 'VER', rival: 'HAM' };

function play(model: RaceModel, seed: number, decisions: Decision[] = [], incidents = true): Run {
  const run = initRun(model, seed, { decisions, incidents });
  while (!isFinished(run)) stepLap(run);
  return run;
}
const user = (run: Run) => run.state.cars[run.model.userSide] as CarState;

describe('the player in a refuelling race', () => {
  it('takes over with the real load, and no fuel load (the tank replaces it)', () => {
    const run = initRun(refuelRace, 1, { decisions: [] });
    expect(user(run).tank).toBe(37 - 1 - 34 + RESERVE_LAPS);
    expect(user(run).tankLive).toBe(true);
    expect(user(run).fuel).toBeUndefined();
    expect(fuelConfig(refuelRace)).toBeNull();
    expect(tankReading(refuelRace, user(run), 34)).toEqual({
      laps: 3,
      lapsToEmpty: 3,
      boxBy: 37,
      toFlag: false,
    });
  });

  it('runs dry and stops without a stop; reaches the flag with a long fill', () => {
    for (const seed of [1, 2, 3]) {
      const dry = play(refuelRace, seed);
      expect(user(dry).retired).toBe(true);
      expect(dry.notes.some((n) => n.kind === 'fuel' && n.detail === 'out')).toBe(true);
      const long = play(refuelRace, seed, [
        { lap: 36, kind: 'pit', compound: 'HARD', fill: 'long' },
      ]);
      expect(long.notes.some((n) => n.kind === 'fuel' && n.detail === 'out')).toBe(false);
    }
  });

  it('each fill choice puts in its laps of fuel', () => {
    const opts = fillOptions(refuelRace, 37); // 22 laps to the flag, a 30-lap tank
    expect(opts).toEqual({ short: 11, standard: 22, long: 22 });
    for (const fill of ['short', 'standard', 'long'] as const) {
      const run = initRun(refuelRace, 1, {
        decisions: [{ lap: 36, kind: 'pit', compound: 'HARD', fill }],
      });
      while (run.state.lap < 37) stepLap(run);
      // Filled at the stop to the stint + reserve, then lap 37 burnt (a VSC lap: 0.6 of one).
      expect(user(run).tank).toBeCloseTo(opts[fill] + RESERVE_LAPS - 0.6, 6);
    }
  });

  it('a short fill makes the car lighter, and a long fill costs stop time', () => {
    const at = (fill: FillChoice) => {
      const run = initRun(refuelRace, 1, {
        decisions: [{ lap: 36, kind: 'pit', compound: 'HARD', fill }],
        incidents: false,
      });
      while (run.state.lap < 37) stepLap(run);
      return user(run).totalTime;
    };
    // At the real stop the fill is priced against the real one (17 laps to the lap-53 in-lap),
    // so long against short is 11 laps of fill. Lap 37 is a VSC lap: no weight on it.
    expect(at('long') - at('short')).toBeCloseTo(0.3 * (22 - 11), 6);
  });

  it('only a refuelling race takes a fill', () => {
    const d: Decision = { lap: 36, kind: 'pit', compound: 'HARD', fill: 'short' };
    expect(() => validateDecisions(refuelRace, [d])).not.toThrow();
    expect(() => validateDecisions(abu, [d])).toThrow(/fill/);
    expect(() =>
      validateDecisions(refuelRace, [{ ...d, fill: 'brim' as unknown as FillChoice }]),
    ).toThrow(/fill/);
  });

  it('every pit call in a refuelling race states its fill: there is no default', () => {
    const bare: Decision = { lap: 36, kind: 'pit', compound: 'HARD' };
    expect(() => validateDecisions(refuelRace, [bare])).toThrow(/needs a fill/);
    expect(() => initRun(refuelRace, 1, { decisions: [bare] })).toThrow(/needs a fill/);
    const run = initRun(refuelRace, 1, { decisions: [] });
    expect(() => decide(run, bare)).toThrow(/needs a fill/);
    expect(() => forkRun(run, 3, [bare])).toThrow(/needs a fill/);
    // Without refuelling a call takes no fill, as before.
    expect(() => validateDecisions(abu, [bare])).not.toThrow();
    expect(() => validateDecisions(abu, [{ ...bare, fill: { laps: 10 } }])).toThrow(/fill/);
  });

  it('an exact fill is 1 to fillCap whole laps, and nothing else', () => {
    const at = (fill: unknown) =>
      validateDecisions(refuelRace, [
        { lap: 36, kind: 'pit', compound: 'HARD', fill: fill as Fill },
      ]);
    // The tank is 30 laps; no real stint after a stop is longer (VER's is 17).
    expect(fillCap(refuelRace)).toBe(30);
    for (const ok of [{ laps: 1 }, { laps: 17 }, { laps: 30 }]) expect(() => at(ok)).not.toThrow();
    for (const bad of [
      { laps: 0 },
      { laps: 31 },
      { laps: 2.5 },
      { laps: '5' },
      { laps: 5, extra: 1 },
      {},
      null,
      5,
    ]) {
      expect(() => at(bad), JSON.stringify(bad)).toThrow(/fill/);
    }
    // A real stint longer than the fit's tank still fits: a real fill is never refused.
    const small = tagged(refuelRace, { refuelling: true }, { ...FILL, tankLaps: 10 });
    expect(fillCap({ ...small, userSide: 'VER' })).toBeGreaterThanOrEqual(17);
  });

  it('an exact fill fuels its laps, never past the flag', () => {
    expect(fillLaps({ laps: 12 }, 22, 30)).toBe(12);
    expect(fillLaps({ laps: 30 }, 22, 30)).toBe(22);
    expect(fillLaps('short', 22, 30)).toBe(fillStint('short', 22, 30));
    const run = initRun(refuelRace, 1, {
      decisions: [{ lap: 36, kind: 'pit', compound: 'HARD', fill: { laps: 9 } }],
    });
    while (run.state.lap < 37) stepLap(run);
    expect(user(run).tank).toBeCloseTo(9 + RESERVE_LAPS - 0.6, 6); // lap 37 is a VSC lap
  });

  it('the real calls carry the real fill: the next real stint, to the next stop or the flag', () => {
    const real = realDecisions(refuelRace);
    // VER's real stops: out on 37 (to the lap-53 in-lap: 17 laps) and 54 (to the flag: 5).
    expect(real).toEqual([
      { lap: 36, kind: 'pit', compound: expect.any(String), fill: { laps: 17 } },
      { lap: 53, kind: 'pit', compound: expect.any(String), fill: { laps: 5 } },
    ]);
    expect(realFill(refuelRace, 'VER', 37)).toEqual({ laps: 17 });
    // At a real stop (a measured loss) the real fill prices at nothing over it.
    const car = { tank: 1, strategy: [] as PitStop[] } as unknown as CarState;
    const stop = refuelRace.drivers.find((d) => d.code === 'VER')?.realStrategy[0] as PitStop;
    const realStrategy = refuelRace.drivers.find((d) => d.code === 'VER')?.realStrategy ?? [];
    expect(refuelAtStop(refuelRace, car, { ...stop, fill: { laps: 17 } }, 37, realStrategy)).toBe(
      0,
    );
    expect(car.tank).toBe(17 + RESERVE_LAPS);
    // Outside a refuelling race the calls are as before.
    expect(realDecisions(abu).every((d) => d.kind !== 'pit' || d.fill === undefined)).toBe(true);
  });

  it("the engineer's plans fill exactly to the plan's next stop or the flag", () => {
    const run = initRun(refuelRace, 1, { decisions: [] });
    const plans = enginePlans(run);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      p.stops.forEach((s, i) => {
        const next = p.stops[i + 1]?.lap ?? refuelRace.race.laps;
        expect(s.fill).toEqual({ laps: Math.min(fillCap(refuelRace), next - s.lap) });
      });
      expect(() => validatePlan(refuelRace, p, run.state.lap)).not.toThrow();
      for (const c of planCalls(p, run.state.lap, 'standard')) {
        if (c.kind === 'pit') expect(c.fill).toBeDefined();
      }
    }
    // A plan's stop without a fill is refused in a refuelling race, and its fill elsewhere.
    const bare: RacePlan = {
      id: 'own',
      stops: [{ lap: 40, compound: 'HARD' }],
      pace: ['standard', 'standard'],
    };
    expect(() => validatePlan(refuelRace, bare, 34)).toThrow(/needs a fill/);
    const filled: RacePlan = { ...bare, stops: [{ lap: 40, compound: 'HARD', fill: 'long' }] };
    expect(() => validatePlan(refuelRace, filled, 34)).not.toThrow();
    expect(() => validatePlan(abu, filled, 34)).toThrow(/fill/);
    expect(
      enginePlans(initRun(abu, 1, { decisions: [] })).every((p) =>
        p.stops.every((s) => s.fill === undefined),
      ),
    ).toBe(true);
  });

  it("a plan's fill never passes the tank (fillCap), so every plan is one the race takes", () => {
    // A stint to the flag longer than the tank is filled to the tank, not refused.
    const cap = fillCap(refuelRace);
    const stops = fuelled(refuelRace, [
      { lap: 20, compound: 'HARD' },
      { lap: 24, compound: 'HARD' },
    ]);
    expect(refuelRace.race.laps - 24).toBeGreaterThan(cap);
    expect(stops.map((s) => s.fill)).toEqual([{ laps: 4 }, { laps: cap }]);
    // San Marino 2005 (A1): its one-stop plan from the takeover (lap 21, 41 laps to the flag)
    // asked for more than a 2005 tank holds, so checkFill threw and no plan was graded.
    const sm = sanMarino2005Json as unknown as RaceModel;
    expect(sm.rules?.refuelling).toBe(true);
    const run = initRun(sm, 1, { decisions: [] });
    const plans = enginePlans(run);
    expect(plans.some((p) => p.stops.length > 0)).toBe(true);
    for (const p of plans) {
      for (const s of p.stops) {
        expect(typeof s.fill === 'object' && s.fill.laps <= fillCap(sm)).toBe(true);
      }
      expect(() => validatePlan(sm, p, run.state.lap)).not.toThrow();
      expect(() => playOption(run, 1, planOption(run, p))).not.toThrow();
    }
  });

  it("the engineer's plans run on the fuel they have (B3): San Marino 2005's no longer run dry", () => {
    // Before B3 every San Marino 2005 plan ran dry (a 25-lap tank, 42 laps to go, 8 laps of
    // fuel at the takeover): no stop, a stop on lap 21 to the tank, and 21 + 24 to the tank.
    const sm = sanMarino2005Json as unknown as RaceModel;
    const run = initRun(sm, 1, { decisions: [] });
    const car = user(run);
    const cap = fillCap(sm);
    const plans = enginePlans(run);
    expect(plans).toHaveLength(3);
    for (const p of plans) {
      // The first stint ends before the fuel on board runs out; no later stint passes the tank.
      expect((p.stops[0]?.lap ?? sm.race.laps) - run.state.lap).toBeLessThanOrEqual(
        car.tank as number,
      );
      p.stops.forEach((s, i) => {
        const stint = (p.stops[i + 1]?.lap ?? sm.race.laps) - s.lap;
        expect(stint).toBeLessThanOrEqual(cap);
        expect(s.fill).toEqual({ laps: stint });
      });
      // No stint pushes past what its fuel covers (push burns 6% more: 16 laps on a fill's
      // reserve of one lap).
      p.pace.forEach((pace, i) => {
        const from = i === 0 ? run.state.lap : (p.stops[i - 1]?.lap as number);
        const to = p.stops[i]?.lap ?? sm.race.laps;
        if (pace === 'push') expect(to - from).toBeLessThanOrEqual(16);
      });
      // Played out, no plan runs the car dry.
      for (let i = 0; i < 8; i++) {
        const fork = playOption(run, 100 + i, planOption(run, p));
        while (!isFinished(fork)) stepLap(fork);
        expect(
          fork.notes.some(
            (n) => n.kind === 'fuel' && n.detail === 'out' && n.driver === sm.userSide,
          ),
          `plan ${p.id} sample ${i}`,
        ).toBe(false);
      }
    }
  });

  it('a car whose tank no plan of up to two stops can carry gets the plans as before', () => {
    // Half a lap of fuel: dry before any stop could be made, so no plan runs on it; the
    // engineer still offers the plans made as in any other race (the fills to the tank).
    const run = initRun(refuelRace, 1, { decisions: [] });
    user(run).tank = 0.5;
    const plans = enginePlans(run);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) expect(() => validatePlan(refuelRace, p, run.state.lap)).not.toThrow();
  });

  it('a stop without a fill fills to the next stop or the flag, never past the tank (B3)', () => {
    const sm = sanMarino2005Json as unknown as RaceModel;
    const cap = fillCap(sm);
    expect(cap).toBe(25);
    // Out on lap 30 with 33 laps to the flag and nothing else planned: it fills the tank.
    const car = { tank: 1, strategy: [] as PitStop[] } as unknown as CarState;
    refuelAtStop(sm, car, { lap: 30, to: 'MEDIUM' }, 30, []);
    expect(car.tank).toBe(cap + RESERVE_LAPS);
    // To a next stop within the tank: to that stop, as before.
    const next = { tank: 1, strategy: [{ lap: 50, to: 'MEDIUM' }] } as unknown as CarState;
    refuelAtStop(sm, next, { lap: 30, to: 'MEDIUM' }, 30, []);
    expect(next.tank).toBe(20 + RESERVE_LAPS);
  });

  it("the grader's planner stops keep every stint within the tank (withinTank)", () => {
    const sm = sanMarino2005Json as unknown as RaceModel;
    const cap = fillCap(sm);
    const run = initRun(sm, 1, { decisions: [] });
    const car = user(run);
    // One stop out on lap 28 (35 laps to the flag) becomes two even stints.
    expect(withinTank(sm, car, [{ lap: 28, to: 'MEDIUM' }])).toEqual([
      { lap: 28, to: 'MEDIUM' },
      { lap: 46, to: 'MEDIUM' },
    ]);
    // Within the tank: as it is.
    expect(withinTank(sm, car, [{ lap: 40, to: 'MEDIUM' }])).toEqual([{ lap: 40, to: 'MEDIUM' }]);
    // planRemainingStops: every stint after a stop within the tank, and the car reaches the
    // flag in a playout that follows them.
    const stops = planRemainingStops(run);
    expect(stops.length).toBeGreaterThanOrEqual(2);
    stops.forEach((s, i) => {
      expect((stops[i + 1]?.lap ?? sm.race.laps + 1) - s.lap).toBeLessThanOrEqual(cap);
    });
    const fork = forkRun(run, 7, [], { blindAfter: run.state.lap + 1 });
    for (const s of stops) user(fork).strategy.push({ ...s });
    while (!isFinished(fork)) stepLap(fork);
    expect(user(fork).retired).toBe(false);
    // A race without refuelling: the stops as they are.
    const abuRun = initRun(abu, 1, { decisions: [] });
    const long = [{ lap: 35, to: 'HARD' }];
    expect(withinTank(abu, user(abuRun), long)).toBe(long);
  });

  it('every box option at a moment states its fill; the real call is the real option', () => {
    const moments = candidateMoments(refuelRace);
    const boxes = moments.flatMap((m) => m.options.flatMap((o) => o.decisions));
    expect(boxes.some((d) => d.kind === 'pit')).toBe(true);
    for (const d of boxes) if (d.kind === 'pit') expect(d.fill).toBeDefined();
    const real = realDecisions(refuelRace);
    for (const m of moments) {
      const call = real.find((d) => d.lap === m.lap);
      const option = m.options.find((o) => o.id === m.realOptionId);
      if (call && option) expect(option.decisions).toContainEqual(call);
    }
    // Every other box call fills 'standard'.
    const others = boxes.filter(
      (d) => d.kind === 'pit' && !real.some((r) => JSON.stringify(r) === JSON.stringify(d)),
    );
    for (const d of others) if (d.kind === 'pit') expect(d.fill).toBe('standard');
    // The real call (VER's lap-36 in-lap) carries the real fill; another tyre fills standard.
    const first = real[0] as Extract<Decision, { kind: 'pit' }>;
    expect(boxCall(refuelRace, 36, first.compound)).toEqual(first);
    const other = Object.keys(refuelRace.compounds).find((c) => c !== first.compound) as string;
    expect(boxCall(refuelRace, 36, other)).toMatchObject({ fill: 'standard' });
    expect(boxCall(abu, 36, 'SOFT')).toEqual({ lap: 36, kind: 'pit', compound: 'SOFT' });
    // The moments grade (no option throws for want of a fill).
    const m = moments.find((x) => x.options.some((o) => o.decisions.some((d) => d.kind === 'pit')));
    expect(m).toBeDefined();
    const g = gradeMoment(
      pauseAt(refuelRace, (m as DecisionMoment).lap),
      (m as DecisionMoment).options,
      (m as DecisionMoment).target,
      4,
    );
    expect(g.options).toHaveLength((m as DecisionMoment).options.length);
  });

  it("an Eras race's playouts keep the live tank: a car that doesn't stop runs dry", () => {
    // refuelRace has a rules block, so it is an Eras race (sim.ts erasRace).
    const run = initRun(refuelRace, 1, { decisions: [] });
    const fork = forkRun(run, 7, [], { blindAfter: 35 });
    expect(user(fork).tank).toBe(user(run).tank);
    expect(user(fork).tankLive).toBe(true);
    while (!isFinished(fork)) stepLap(fork);
    expect(user(fork).retired).toBe(true);
    // The grader's continuation (the real team's plan) refuels it, as the real team did.
    const graded = playOption(run, 7, { id: 'stay', decisions: [] });
    while (!isFinished(graded)) stepLap(graded);
    expect(user(graded).retired).toBe(false);
  });

  it('the planner stops a car that is short of the flag, before it runs dry', () => {
    const run = initRun(refuelRace, 1, { decisions: [] });
    const stop = planRemainingStop(run);
    expect(stop).not.toBeNull();
    // The tank (3 laps, the reserve included) runs laps 35-37: the out-lap is 38 at the latest.
    expect((stop as PitStop).lap).toBeLessThanOrEqual(38);
    // HAM's car (no stop to the flag) needs none.
    const ham = initRun({ ...refuelRace, userSide: 'HAM', rival: 'VER' }, 1, { decisions: [] });
    expect(planRemainingStop(ham)).toBeNull();
  });

  it('a race without a fit uses the physical prior and a tank holding the race', () => {
    const m = tagged(abu, { refuelling: true });
    expect(refuelModel(m).tankLaps).toBe(abu.race.laps);
    expect(refuelModel(m).secondsPerLap).toBe(PRIOR_SECONDS_PER_LAP);
    expect(PRIOR_SECONDS_PER_LAP).toBeCloseTo(3 / 12, 12); // ~3 L a lap at ~12 L/s
  });

  it('a long fill costs 4-5 s more than a short one at a typical stop', () => {
    // Hungary 1998's shape (refuel.py's test): 77 laps, a 33-lap tank, the rate at the
    // physical prior. A first stop out on lap 30 (48 laps to go): long brims the tank (33),
    // short splits the 48 over three stints (16).
    const m: RaceModel = {
      ...tagged(abu, { refuelling: true }),
      race: { ...abu.race, laps: 77 },
      track: {
        ...abu.track,
        refuel: {
          secondsPerLap: PRIOR_SECONDS_PER_LAP,
          laneBase: 25,
          refFill: 23.6,
          tankLaps: 33,
          stops: 31,
        },
      },
    };
    const cost = (fill: FillChoice) => {
      const car = { tank: 1, strategy: [] as PitStop[] } as unknown as CarState;
      return refuelAtStop(m, car, { lap: 29, to: 'HARD', fill }, 30, []);
    };
    const delta = cost('long') - cost('short');
    expect(delta).toBeCloseTo(PRIOR_SECONDS_PER_LAP * (33 - 16), 9);
    expect(delta).toBeGreaterThanOrEqual(4);
    expect(delta).toBeLessThanOrEqual(5);
  });
});

// --- Fuel limits (1984-88): a fixture race with the 1988 allowance ---------------------------

// Abu Dhabi 2021 re-tagged with monaco-1988's 127.5 kg (150 L at 0.85 kg/L): the standard
// burn is the allowance over the 58 laps. Its SC and VSC are taken out (a neutralized lap
// burns 0.6 of one, which would save the pushing car).
const limited: RaceModel = {
  ...tagged(abu, { refuelling: false, fuelLimit: 127.5 }),
  events: abu.events.filter((e) => e.type !== 'SC' && e.type !== 'VSC'),
};

describe('a fuel-limit race', () => {
  it('burns the allowance over the distance', () => {
    expect(fuelConfig(limited)?.burnPerLap).toBeCloseTo(127.5 / 58, 9);
    const run = initRun(limited, 1, { decisions: [] });
    const fuel = user(run).fuel as number;
    const need = (127.5 / 58) * (58 - 34);
    expect(fuel).toBeGreaterThanOrEqual(need - 1.5 - 1e-9);
    expect(fuel).toBeLessThanOrEqual(need + 1 + 1e-9);
  });

  it('pushing to the flag runs the tank dry, and the car stops (San Marino 1985)', () => {
    const push: Decision = { lap: 35, kind: 'mode', key: 'pace', value: 'push' };
    for (const seed of [1, 2, 3]) {
      const run = play(limited, seed, [push]);
      const out = run.notes.find((n) => n.kind === 'fuel' && n.detail === 'out');
      expect(out).toBeDefined();
      expect(user(run).retired).toBe(true);
      expect(user(run).retiredLap).toBe(out?.lap);
    }
  });

  it('lift and coast from the takeover reaches the flag', () => {
    const save: Decision = { lap: 35, kind: 'mode', key: 'fuel', value: 'liftAndCoast' };
    for (const seed of [1, 2, 3]) {
      const run = play(limited, seed, [save]);
      expect(run.notes.some((n) => n.kind === 'fuel' && n.detail === 'out')).toBe(false);
    }
  });

  it('a race without the cap still costs dryLapDelta instead of stopping', () => {
    const push: Decision = { lap: 35, kind: 'mode', key: 'pace', value: 'push' };
    const run = play(abu, 1, [push]);
    expect(run.notes.some((n) => n.kind === 'fuel' && n.detail === 'out')).toBe(false);
  });
});
