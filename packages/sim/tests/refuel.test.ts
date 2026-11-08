// Refuelling and fuel limits (eras build plan 4.2, roadmap R4). Parity: the Python reference
// sim's vectors (pipeline/tests/fixtures/refuel_parity.json, written by
// pipeline/tests/test_refuel.py) replay here to the same classification and times, and the
// shared functions (fill choices, takeover tanks, allowances) agree. Race files are re-tagged
// in memory; data/races is left alone.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import canadaJson from '../../../data/races/canada-2024.json';
import vectors from '../../../pipeline/tests/fixtures/refuel_parity.json';
import {
  PRIOR_SECONDS_PER_LAP,
  RESERVE_LAPS,
  fillOptions,
  fillStint,
  limitBurnPerLap,
  refuelAtStop,
  refuelModel,
  takeoverTank,
  tankReading,
} from '../src/refuel.js';
import {
  type Run,
  forkRun,
  fuelConfig,
  initRun,
  isFinished,
  planRemainingStop,
  simulate,
  stepLap,
  validateDecisions,
} from '../src/sim.js';
import type {
  CarState,
  Decision,
  FillChoice,
  PitStop,
  RaceModel,
  RaceRules,
  RefuelModel,
} from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const canada = canadaJson as unknown as RaceModel;
const MODELS: Record<string, RaceModel> = { 'abu-dhabi-2021': abu, 'canada-2024': canada };
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

  it("the grader's playouts keep the tank but never stop the car dry", () => {
    const run = initRun(refuelRace, 1, { decisions: [] });
    const fork = forkRun(run, 7, [], { blindAfter: 35 });
    expect(user(fork).tank).toBe(user(run).tank);
    expect(user(fork).tankLive).toBeUndefined();
    while (!isFinished(fork)) stepLap(fork);
    expect(user(fork).retired).toBe(false);
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
