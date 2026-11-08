// Refuelling (1994-2009, and 1983) and fuel limits (1984-88): eras build plan 4.2, roadmap
// R4. Mirrors pipeline/src/pipeline/refuel.py (parity: the replay of a refuelling race, the
// fill choices and the fuel-limit figures). Every rule is off unless the race's `rules` block
// says so: a race without one runs exactly as before.
//
// Refuelling. Fuel is counted in laps at the standard burn (`car.tank`), for every car:
// - At the takeover a car carries the fuel to the end of its next stop's in-lap (or to the
//   flag) plus RESERVE_LAPS.
// - A stop fills the tank to the next stint plus the reserve: a scripted car's next stint runs
//   to its next planned stop's in-lap (or the flag); the player's comes from the fill choice
//   (fillLaps: a named choice, fillStint, or an exact number of laps). The weight resets
//   with it. In a refuelling race every pit call carries a fill (owner decision, Nov 7 2026:
//   no default); the real team's calls carry the real one (realFill).
// - The weight: the race's fitted fuel effect is per lap of fuel on board, so a lap costs
//   fuelEffectPerLap x (tank - the single-tank load, laps - lap + 1) over today's model. A
//   single-tank car's tank is that load, so the term is 0 and the model is today's.
// - The stop's time: a real stop keeps its measured loss (the real fill is in it). Any other
//   stop pays the track's pit loss, which holds a typical stop's fill (`refFill`), plus
//   secondsPerLap x (its fill - refFill). A player's fill choice at a real stop pays
//   secondsPerLap x (its target - the real target) over the measured loss.
// - A replay burns one lap of fuel a lap. The player's car in live play (tankLive) burns by
//   its modes (lift and coast 0.85 ...) and the era's neutralBurn under a SC or VSC, and stops
//   (retires) when the tank runs dry, as a car out of fuel did.
//
// Fuel limits. The fuel load spec's tank (`car.fuel`, kg, the player's car in live play) with
// the race's allowance: the standard burn is fuelLimit / laps (the turbo cars were set up to
// use the whole allowance over the distance), and an empty tank stops the car (San Marino
// 1985: "a succession of drivers ran out of fuel in the last few laps", Senna and Johansson
// among them) instead of costing dryLapDelta. Refuelling races have no fuel load: the tank
// replaces it. The allowances by year and their sources are in refuel.py.

import type { CarState, Fill, FillChoice, PitStop, RaceModel, RefuelModel } from './types.js';

/** Laps of fuel every fill (and the takeover load) carries over the stint: a team's margin. */
export const RESERVE_LAPS = 1;

/**
 * The fill rate's physical prior for a race without its own fit (refuel.py
 * PRIOR_SECONDS_PER_LAP): ~3 L a lap of fuel through a ~12 L/s rig, 3 / 12 = 0.25 s per lap
 * of fuel. An estimate (the race's provenance lists fuelLoads); the sources are in refuel.py.
 */
export const PRIOR_SECONDS_PER_LAP = 0.25;

export const FILL_CHOICES: readonly FillChoice[] = ['short', 'standard', 'long'];

/** True if the race's stops refuel. */
export function refuelling(model: RaceModel): boolean {
  return model.rules?.refuelling === true;
}

/** The race's fuel allowance in kg (1984-88), or null. */
export function fuelLimit(model: RaceModel): number | null {
  return model.rules?.fuelLimit ?? null;
}

/** The race's fill model: its fit, or the physical prior with the tank holding the race. */
export function refuelModel(model: RaceModel): RefuelModel {
  return (
    model.track.refuel ?? {
      secondsPerLap: PRIOR_SECONDS_PER_LAP,
      laneBase: 0,
      refFill: 0,
      tankLaps: model.race.laps,
      stops: 0,
    }
  );
}

/**
 * The laps the player's fill fuels, from the out-lap: `remaining` laps to the flag (out-lap
 * included) and a tank of `tankLaps`. n = ceil(remaining / tankLaps) is the fewest stints
 * that reach the flag.
 * - long: brim the tank, min(remaining, tankLaps) (to the flag if it fits);
 * - standard: the fewest stops from here, split evenly: ceil(remaining / n);
 * - short: one stop more than that, split evenly: ceil(remaining / (n + 1)).
 * The fill puts in this plus RESERVE_LAPS, less what is still in the tank.
 */
export function fillStint(choice: FillChoice, remaining: number, tankLaps: number): number {
  const r = Math.max(0, remaining);
  if (r === 0) return 0;
  const cap = Math.max(1, Math.floor(tankLaps));
  const n = Math.ceil(r / cap);
  if (choice === 'long') return Math.min(r, cap);
  if (choice === 'standard') return Math.ceil(r / n);
  return Math.ceil(r / (n + 1));
}

/**
 * The laps a stop's fill fuels from the out-lap, with `remaining` laps to the flag (out-lap
 * included): a named choice by fillStint; an exact fill (`{ laps }`) as it says, but never
 * past the flag.
 */
export function fillLaps(fill: Fill, remaining: number, tankLaps: number): number {
  if (typeof fill === 'string') return fillStint(fill, remaining, tankLaps);
  return Math.min(Math.max(0, remaining), fill.laps);
}

/**
 * The most laps an exact fill may name: the tank (`tankLaps`, the longest real stint of the
 * race's fit), or the longest real stint after a stop in the race file if that is longer (a
 * real fill is never refused, even where the file and the fit's source differ).
 */
export function fillCap(model: RaceModel): number {
  const { laps } = model.race;
  let cap = Math.max(1, Math.floor(refuelModel(model).tankLaps));
  for (const d of model.drivers) {
    for (const s of d.realStrategy) {
      const others = d.realStrategy.filter((o) => o !== s);
      cap = Math.max(cap, stintToNextStop(others, s.lap, laps));
    }
  }
  return cap;
}

/** True if `fill` is a fill this race takes: a named choice, or 1 to fillCap whole laps. */
export function validFill(model: RaceModel, fill: unknown): fill is Fill {
  if (typeof fill === 'string') return (FILL_CHOICES as readonly string[]).includes(fill);
  if (typeof fill !== 'object' || fill === null) return false;
  const keys = Object.keys(fill);
  const n = (fill as { laps?: unknown }).laps;
  return (
    keys.length === 1 &&
    keys[0] === 'laps' &&
    typeof n === 'number' &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= fillCap(model)
  );
}

/**
 * A pit call's fill (this file): required in a refuelling race (owner decision, Nov 7 2026:
 * no default), a named choice or 1 to fillCap laps; none in any other race. Plans' stops too.
 */
export function checkFill(model: RaceModel, fill: unknown): void {
  if (!refuelling(model)) {
    if (fill !== undefined) throw new Error(`no fill ${JSON.stringify(fill)} in this race`);
    return;
  }
  if (fill === undefined) throw new Error('a pit call in a refuelling race needs a fill');
  if (!validFill(model, fill)) throw new Error(`no fill ${JSON.stringify(fill)} in this race`);
}

/**
 * The fuel the real team put in at `code`'s real stop with out-lap `outLap`: its next real
 * stint, to the in-lap of its next real stop or to the flag (the reserve goes on top). What
 * the real team's calls carry (sim.ts realDecisions), so they replay the real race.
 */
export function realFill(model: RaceModel, code: string, outLap: number): { laps: number } {
  const real = model.drivers.find((d) => d.code === code)?.realStrategy ?? [];
  return {
    laps: stintToNextStop(
      real.filter((s) => s.lap !== outLap),
      outLap,
      model.race.laps,
    ),
  };
}

/** Laps of fuel a car fills for at a stop on `outLap`: to the in-lap of its next stop in
 * `strategy` (the stop itself already removed) or to the flag. */
export function stintToNextStop(
  strategy: readonly PitStop[],
  outLap: number,
  laps: number,
): number {
  let next = laps + 1;
  for (const s of strategy) if (s.lap > outLap && s.lap < next) next = s.lap;
  return next - outLap;
}

/** The fuel on board at the takeover (laps): to the end of the next stop's in-lap, plus the
 * reserve. */
export function takeoverTank(strategy: readonly PitStop[], takeover: number, laps: number): number {
  return stintToNextStop(strategy, takeover, laps) - 1 + RESERVE_LAPS;
}

/**
 * Set every car's takeover tank (initRun). `real` gives a car's real strategy: the player's
 * car (`player`, in live play) has no planned stops, but took over with the real load.
 * `liveTank`: the player's tank burns live (live play with incidents).
 */
export function initTanks(
  model: RaceModel,
  cars: Record<string, CarState>,
  real: (code: string) => readonly PitStop[],
  player?: string,
  liveTank = false,
): void {
  if (!refuelling(model)) return;
  const { laps, takeoverLap } = model.race;
  for (const c of Object.values(cars)) {
    const plan = c.code === player ? real(c.code) : c.strategy;
    c.tank = takeoverTank(plan, takeoverLap, laps);
    if (c.code === player && liveTank) c.tankLive = true;
  }
}

/**
 * Refuel at a stop on `outLap` (after the stop is taken off the car's strategy). Returns the
 * time the fill adds over the stop's base cost (s; negative for a small fill). `frozen`: the
 * stop's measured loss is charged (a real stop).
 */
export function refuelAtStop(
  model: RaceModel,
  car: CarState,
  stop: PitStop,
  outLap: number,
  realStrategy: readonly PitStop[],
): number {
  if (!refuelling(model) || car.tank === undefined) return 0;
  const rm = refuelModel(model);
  const { laps } = model.race;
  const stint = stop.fill
    ? fillLaps(stop.fill, laps - outLap + 1, rm.tankLaps)
    : stintToNextStop(car.strategy, outLap, laps);
  const target = stint + RESERVE_LAPS;
  const fill = Math.max(0, target - car.tank);
  car.tank = Math.max(car.tank, target);
  if (stop.loss !== undefined) {
    // A real stop: its real fill is in the measured loss; another fill there is priced
    // against it (the real fill, realFill, prices at 0).
    if (!stop.fill) return 0;
    const real = stintToNextStop(
      realStrategy.filter((s) => s.lap !== outLap),
      outLap,
      laps,
    );
    return rm.secondsPerLap * (stint - real);
  }
  return rm.secondsPerLap * (fill - rm.refFill);
}

/** The weight's lap-time term over today's single-tank model (s; 0 without a tank). */
export function tankWeightDelta(model: RaceModel, car: CarState, lap: number): number {
  if (car.tank === undefined) return 0;
  const single = model.race.laps - lap + 1;
  return model.fuelEffectPerLap * (Math.max(0, car.tank) - single);
}

/**
 * Burn a lap's fuel. A replay burns one lap; a live tank burns `mult` (the modes' burn, or
 * the era's neutralBurn under a SC/VSC). Returns true if the live tank ran dry this lap.
 */
/**
 * The planner's refuelling term (sim.ts predictedRemaining) for running laps (fromLap, laps]
 * with at most `stop`: the tank's weight on the green laps (`neutral` laps are skipped, as
 * there), plus the stop's fill time over the track's pit loss (a planned stop fills to the
 * flag). Infinity if the fuel runs out before the flag at one lap a lap.
 */
export function tankPlanDelta(
  model: RaceModel,
  car: CarState,
  fromLap: number,
  stop: PitStop | null,
  neutral: ReadonlyMap<number, unknown>,
): number {
  if (car.tank === undefined) return 0;
  const rm = refuelModel(model);
  const { laps } = model.race;
  let tank = car.tank;
  let total = 0;
  for (let lap = fromLap + 1; lap <= laps; lap++) {
    if (stop && lap === stop.lap) {
      const target =
        (stop.fill ? fillLaps(stop.fill, laps - lap + 1, rm.tankLaps) : laps - lap + 1) +
        RESERVE_LAPS;
      total += rm.secondsPerLap * (Math.max(0, target - tank) - rm.refFill);
      tank = Math.max(tank, target);
    }
    if (tank < 1 - 1e-9) return Number.POSITIVE_INFINITY; // dry before this lap is run
    if (!neutral.has(lap)) total += model.fuelEffectPerLap * (tank - (laps - lap + 1));
    tank -= 1;
  }
  return total;
}

export function burnTank(car: CarState, mult: number): boolean {
  if (car.tank === undefined) return false;
  const before = car.tank;
  car.tank -= car.tankLive ? mult : 1;
  return !!car.tankLive && before >= 0 && car.tank < -1e-9;
}

/** What the fuel UI shows for a car in a refuelling race (build plan 8.5), after `lap`. */
export interface TankReading {
  /** Fuel on board (laps at the standard burn). */
  laps: number;
  /** Laps the fuel runs at the standard burn before the car is dry (the reserve included). */
  lapsToEmpty: number;
  /** The last lap the car can box at the end of (its last in-lap) at the standard burn. */
  boxBy: number;
  /** True if the fuel on board reaches the flag. */
  toFlag: boolean;
}

export function tankReading(model: RaceModel, car: CarState, lap: number): TankReading | null {
  if (car.tank === undefined) return null;
  const laps = Math.max(0, car.tank);
  const whole = Math.floor(laps + 1e-9);
  return {
    laps,
    lapsToEmpty: whole,
    boxBy: Math.min(model.race.laps, lap + whole),
    toFlag: lap + whole >= model.race.laps,
  };
}

/** The laps of fuel each choice would fuel for at a stop on `outLap` (the pit card). */
export function fillOptions(model: RaceModel, outLap: number): Record<FillChoice, number> {
  const remaining = model.race.laps - outLap + 1;
  const cap = refuelModel(model).tankLaps;
  return {
    short: fillStint('short', remaining, cap),
    standard: fillStint('standard', remaining, cap),
    long: fillStint('long', remaining, cap),
  };
}

// --- Fuel limits (1984-88) -------------------------------------------------------------------

/** The standard burn in a fuel-limit race (kg a lap): the allowance over the distance. */
export function limitBurnPerLap(model: RaceModel): number | null {
  const kg = fuelLimit(model);
  return kg === null ? null : kg / model.race.laps;
}
