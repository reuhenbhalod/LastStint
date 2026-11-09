// The engineer's race plans (docs/strategy-planner-spec.md). At takeover the engineer offers up
// to three plans that differ in their number of stops: each is the fastest plan of its kind by
// the lap-time model alone (no noise, traffic or rivals), so the offer is deterministic and the
// server rebuilds it from the run. How good each plan really is comes from blind playouts
// (grade.ts, with `final` options: the plan's own calls to the flag, nothing added).
//
// Era rules (rules.ts): every plan is one the player could call. With no tyre changes (2005) a
// stop names only the set the car is on or a wet tyre (illegalPitCompound), and a dry stop
// keeps its set (it only refuels), so the next stint goes on with the same tyres. A race with a
// minimum of stops (rules.minStops) offers only plans that reach it. A refuelling race's plans
// state each stop's fill (required there): exactly to the plan's next stop or the flag, capped
// at the tank (fillCap). Its plans also run on the fuel they have (enginePlans: no stint past
// the tank on board or the tank's capacity), priced with the tank's weight and fill times.

import type { GradeOption, Target } from './grade.js';
import { MIN_STINT, planCalls, stintStarts } from './plan.js';
import { RESERVE_LAPS, fillCap, refuelModel, refuelling } from './refuel.js';
import { illegalPitCompound, minStopsRule, stopChangesTyres, stopsOwed } from './rules.js';
import {
  DRY_COMPOUNDS,
  type Run,
  freshTyreDelta,
  lifeOf,
  neutralMap,
  ruleSatisfied,
  tyreLapTime,
} from './sim.js';
import type { CarState, PaceMode, PlanId, RaceModel, RacePlan } from './types.js';
import { isWetTyre, weatherWear, wetFactor, wetnessOn } from './weather.js';

/** Plans are graded on beating the rival (or holding them off in a defend race). */
export const PLAN_TARGET: Target = { kind: 'beat-rival' };

/** Fewer laps to go than this and no two-stop plan is offered. */
const TWO_STOP_MIN_LAPS = 18;
/** Two plans with the same stops count as different if a stop is this many laps apart. */
const DIFFERENT_LAPS = 6;

interface Costed {
  plan: Omit<RacePlan, 'id'>;
  time: number;
}

/** A stint's best time to each end lap, and the pace that gives it. */
interface StintTable {
  time: Float64Array;
  pace: PaceMode[];
}

/** Paces in the order the tables try them (an equal time keeps the earlier one). */
const PACE_ORDER: readonly PaceMode[] = ['standard', 'manage', 'push'];

/**
 * A refuelling race's tank (refuel.ts), as the planner prices it: the fuel on board now
 * (laps), the most laps a fill may name (fillCap), the fill rate, the fuel effect and each
 * pace's burn. Null in any other race (and the plans are priced as before).
 */
interface TankPlan {
  tank: number;
  cap: number;
  secondsPerLap: number;
  refFill: number;
  fuelEffect: number;
  burn: Record<PaceMode, number>;
  /** green[i]: laps before lap `first + i` that aren't under a known SC/VSC. */
  green: Int32Array;
  first: number;
}

/**
 * Stint times, worked out once: a stint's time depends only on its tyres, its first lap and its
 * last, so every plan is a sum of table entries (plus the pit losses). `mid` stints can't push;
 * the last stint can (to the flag).
 */
type Tables = {
  mid: StintTable;
  last: StintTable;
  /** Each pace's times (a refuelling race picks the pace the tank allows). */
  byPace: Record<PaceMode, Float64Array>;
};

class Stints {
  private readonly fresh = new Map<string, Tables>();
  private readonly kept = new Map<string, Tables>();
  private readonly current: Tables;

  constructor(
    private readonly run: Run,
    private readonly car: CarState,
    private readonly known: Map<number, unknown>,
    private readonly tank: TankPlan | null = null,
  ) {
    this.current = this.table(car.compound, car.tyreWear, car.tyreAge, run.state.lap + 1);
  }

  /** Best times for laps [from, to] for every `to`, for middle and last stints. */
  private table(compound: string, wear0: number, age0: number, from: number): Tables {
    const laps = this.run.model.race.laps;
    const n = laps - from + 1;
    const mid: StintTable = { time: new Float64Array(n).fill(Number.POSITIVE_INFINITY), pace: [] };
    const last: StintTable = { time: new Float64Array(n).fill(Number.POSITIVE_INFINITY), pace: [] };
    const byPace = {} as Record<PaceMode, Float64Array>;
    for (const p of PACE_ORDER) {
      const times = stintTimes(
        this.run,
        this.car,
        compound,
        wear0,
        age0,
        from,
        laps,
        p,
        this.known,
      );
      byPace[p] = times;
      for (let i = 0; i < n; i++) {
        const t = times[i] as number;
        if (p !== 'push' && t < (mid.time[i] as number) - 1e-9) {
          mid.time[i] = t;
          mid.pace[i] = p;
        }
        if (t < (last.time[i] as number) - 1e-9) {
          last.time[i] = t;
          last.pace[i] = p;
        }
      }
    }
    return { mid, last, byPace };
  }

  private freshFrom(compound: string, from: number) {
    const key = `${compound}@${from}`;
    let t = this.fresh.get(key);
    if (!t) {
      t = this.table(compound, 0, 0, from);
      this.fresh.set(key, t);
    }
    return t;
  }

  /** A set run on after a stop that kept it (no tyre changes): its wear and age carry on. */
  private keptFrom(compound: string, wear0: number, age0: number, from: number) {
    const key = `${compound}@${from}@${wear0}@${age0}`;
    let t = this.kept.get(key);
    if (!t) {
      t = this.table(compound, wear0, age0, from);
      this.kept.set(key, t);
    }
    return t;
  }

  /** The pit loss of a stop whose out-lap is `outLap`. */
  private loss(outLap: number): number {
    const { track } = this.run.model;
    const flag = this.known.get(outLap);
    return flag === 'sc'
      ? track.pitLossUnderSC
      : flag === 'vsc'
        ? track.pitLossUnderVSC
        : track.pitLoss;
  }

  cost(stops: RacePlan['stops']): Costed {
    const { run } = this;
    const laps = run.model.race.laps;
    const starts = stintStarts({ id: 'own', stops, pace: [] }, run.state.lap);
    const pace: PaceMode[] = [];
    let time = 0;
    // The set on the car, followed only while a stop may keep it (rules.tyreChanges false).
    const keeps = run.model.rules?.tyreChanges === false;
    let set = { compound: this.car.compound, wear: this.car.tyreWear, age: this.car.tyreAge };
    const tank = this.tank;
    // A refuelling race: the fuel on board at the stint's first lap (laps).
    let fuel = tank?.tank ?? 0;
    for (let i = 0; i <= stops.length; i++) {
      const from = starts[i] as number;
      const to = i < stops.length ? (stops[i]?.lap as number) : laps;
      let t = this.current;
      if (i > 0) {
        const fit = stops[i - 1]?.compound as string;
        if (!keeps || stopChangesTyres(run.model.rules, set.compound, { to: fit })) {
          t = this.freshFrom(fit, from);
          set = { compound: fit, wear: 0, age: 0 };
        } else {
          t = this.keptFrom(set.compound, set.wear, set.age, from);
        }
      }
      const final = i === stops.length;
      let p: PaceMode;
      if (!tank) {
        const table = final ? t.last : t.mid;
        p = table.pace[to - from] as PaceMode;
        time += table.time[to - from] as number;
      } else {
        // The tank: a stop fills exactly this stint (fuelled), the reserve on top, and no
        // fill passes the tank; the stint runs at the quickest pace whose burn the fuel on
        // board covers (a middle stint doesn't push). Out of reach: no plan.
        const len = to - from + 1;
        if (i > 0) {
          if (len > tank.cap) return { plan: { stops, pace }, time: Number.POSITIVE_INFINITY };
          const left = fuel;
          fuel = Math.max(left, len + RESERVE_LAPS);
          time += tank.secondsPerLap * (Math.max(0, len + RESERVE_LAPS - left) - tank.refFill);
        }
        let best = Number.POSITIVE_INFINITY;
        let bestPace: PaceMode | null = null;
        for (const q of PACE_ORDER) {
          if (q === 'push' && !final) continue;
          if (len * tank.burn[q] > fuel + 1e-9) continue;
          const tq = t.byPace[q][to - from] as number;
          if (tq < best - 1e-9) {
            best = tq;
            bestPace = q;
          }
        }
        if (bestPace === null) return { plan: { stops, pace }, time: Number.POSITIVE_INFINITY };
        p = bestPace;
        time += best;
        // The weight (refuel.ts tankWeightDelta) on the stint's green laps: fuel - (laps - lap
        // + 1) with fuel burnt a lap a lap, the same on every lap of the stint.
        const green =
          (tank.green[to + 1 - tank.first] as number) - (tank.green[from - tank.first] as number);
        time += tank.fuelEffect * (fuel + from - laps - 1) * green;
        fuel -= len * tank.burn[p]; // what's left at the in-lap (the live tank burns by pace)
      }
      pace.push(p);
      if (i > 0) time += this.loss(from);
      if (keeps) {
        set = {
          ...set,
          wear: stintWear(run, set.compound, set.wear, from, to, p, this.known),
          age: set.age + to - from + 1,
        };
      }
    }
    return { plan: { stops, pace }, time };
  }
}

/**
 * Lap-time model times of laps [from, k] for every k up to `to`, on `compound` from `wear` and
 * `age`, at `pace`. Laps under a known SC/VSC cost the same whatever the tyres and are skipped
 * (they still age the tyres a lap), as in the sim's own planner.
 */
function stintTimes(
  run: Run,
  car: CarState,
  compound: string,
  wear0: number,
  age0: number,
  from: number,
  to: number,
  pace: PaceMode,
  known: Map<number, unknown>,
): Float64Array {
  let wear = wear0;
  let age = age0;
  const { model } = run;
  const e = pace === 'standard' ? null : run.headset?.modes.pace?.[pace];
  const wearMult = e?.wearMult ?? 1;
  const lapDelta = e?.lapDelta ?? 0;
  const life = lifeOf(model, compound);
  const out = new Float64Array(Math.max(0, to - from + 1));
  let t = 0;
  for (let lap = from; lap <= to; lap++) {
    const neutral = known.has(lap);
    // A wet race: the weather the run knows (the real race's, as a radar would show it; a
    // grader fork's forecast).
    const wet = wetnessOn(run.wetness, lap);
    if (!neutral) {
      // Pushing gains nothing on tyres past their life (the sim's modeLapDelta).
      const dry =
        tyreLapTime(model, car.basePace, compound, wear, lap) + freshTyreDelta(model, age);
      t += dry * wetFactor(model.weather, compound, wet, car.wetPace ?? 0, car.dampPace);
      t += lapDelta < 0 && wear >= life ? 0 : lapDelta;
    }
    out[lap - from] = t;
    wear += (neutral ? 1 : wearMult) * weatherWear(model.weather, compound, wet);
    age += 1;
  }
  return out;
}

/** The wear of a set after laps [from, to] at `pace`, as stintTimes wears it. */
function stintWear(
  run: Run,
  compound: string,
  wear0: number,
  from: number,
  to: number,
  pace: PaceMode,
  known: Map<number, unknown>,
): number {
  const e = pace === 'standard' ? null : run.headset?.modes.pace?.[pace];
  const wearMult = e?.wearMult ?? 1;
  let wear = wear0;
  for (let lap = from; lap <= to; lap++) {
    const wet = wetnessOn(run.wetness, lap);
    wear += (known.has(lap) ? 1 : wearMult) * weatherWear(run.model.weather, compound, wet);
  }
  return wear;
}

/**
 * True if the plan is legal at the flag: the car ends with two dry compounds used (or doesn't
 * need to) and with the race's minimum of stops (rules.minStops). Wet tyres anywhere in the
 * plan waive both rules.
 */
function legal(car: CarState, stops: RacePlan['stops'], rules?: RaceModel['rules']): boolean {
  if (stops.some((s) => isWetTyre(s.compound))) return true;
  if (stops.length < stopsOwed(rules, car)) return false;
  if (ruleSatisfied(car, rules)) return true;
  const dry = new Set(
    [...car.compoundsUsed, car.compound, ...stops.map((s) => s.compound)].filter((c) =>
      (DRY_COMPOUNDS as readonly string[]).includes(c),
    ),
  );
  return dry.size >= 2;
}

function differs(
  a: Omit<RacePlan, 'id'>,
  b: Omit<RacePlan, 'id'>,
  apart: number = DIFFERENT_LAPS,
): boolean {
  if (a.stops.length !== b.stops.length) return true;
  return a.stops.some((s, i) => {
    const t = b.stops[i] as RacePlan['stops'][number];
    return s.compound !== t.compound || Math.abs(s.lap - t.lap) >= apart;
  });
}

/**
 * The engineer's plans from the run's current lap: the fastest no-stop, one-stop and two-stop
 * plans by the lap-time model, legal under the two-compound rule and the race's minimum of
 * stops, and naming only the tyres a pit call may (illegalPitCompound). Where a kind is missing
 * (no legal no-stop, or too few laps for two stops), the next-best one-stop plan that really
 * differs takes its place; in a race with a minimum of stops, then the next-best two-stop plans
 * (Monaco 2025: two stops owed at takeover, so only two-stop plans are legal). Ids 'a', 'b',
 * 'c' in order of stops, then of the first stop's lap.
 *
 * A refuelling race (Eras; tankPlan): every plan runs on the fuel it has. The first stint ends
 * before the tank on board runs dry, each stop fills exactly to the next stop or the flag and
 * no fill passes the tank (fillCap), and a stint pushes only if its fuel covers push's burn.
 * Plans are priced with the tank's weight and each stop's fill time, as the sim charges them.
 * Where that leaves fewer than three plans of the usual kinds, the next-best two-stop plans
 * fill the offer (San Marino 2005: a 25-lap tank and 42 laps to go from the takeover, so only
 * two-stop plans reach the flag). If no plan of up to two stops reaches the flag on the tank,
 * the plans are made as in any other race.
 */
export function enginePlans(run: Run): RacePlan[] {
  const { model, state } = run;
  const car = state.cars[model.userSide];
  if (!car || car.retired) return [];
  const known = neutralMap(run.events.filter((e) => e.lap <= state.lap + 1));
  const tank = tankPlan(run, car, known);
  let picked = tank ? offer(run, car, known, tank) : [];
  if (!picked.length) picked = offer(run, car, known, null);
  const ids: PlanId[] = ['a', 'b', 'c'];
  return picked
    .sort(
      (a, b) =>
        a.plan.stops.length - b.plan.stops.length ||
        (a.plan.stops[0]?.lap ?? 0) - (b.plan.stops[0]?.lap ?? 0),
    )
    .map((p, i) => ({ id: ids[i] as PlanId, ...p.plan, stops: fuelled(model, p.plan.stops) }));
}

/** enginePlans' pick (unsorted), with the tank (a refuelling race) or without it. */
function offer(
  run: Run,
  car: CarState,
  known: Map<number, unknown>,
  tank: TankPlan | null,
): Costed[] {
  const { model, state } = run;
  const first = state.lap + 1;
  const last = model.race.laps - 1; // no stop on the final lap
  // Era rules: only the tyres a pit call may name (no tyre changes: the set it's on, or wets).
  const compounds = Object.keys(model.compounds).filter((c) => !illegalPitCompound(model, c));
  const minimum = minStopsRule(model.rules) > 0;
  // The tank rules plans out (an infinite time); without it every plan is in.
  const ok = (p: Costed) => p.time < Number.POSITIVE_INFINITY;

  const stints = new Stints(run, car, known, tank);
  const noStop = legal(car, [], model.rules) ? stints.cost([]) : null;
  const none = noStop && ok(noStop) ? noStop : null;
  const ones: Costed[] = [];
  for (let lap = first; lap <= last; lap++) {
    for (const c of compounds) {
      const stops = [{ lap, compound: c }];
      if (!legal(car, stops, model.rules)) continue;
      const p = stints.cost(stops);
      if (ok(p)) ones.push(p);
    }
  }
  ones.sort((a, b) => a.time - b.time);
  let two: Costed | null = null;
  // A race with a minimum of stops, or a tank, keeps every legal two-stop plan, to fill the
  // offer with.
  const keepTwos = minimum || tank !== null;
  const twos: Costed[] = [];
  if (
    model.race.laps - state.lap >= TWO_STOP_MIN_LAPS ||
    (minimum && !ones.length) ||
    (tank && !ones.length && !none)
  ) {
    for (let l1 = first; l1 <= last; l1++) {
      for (let l2 = l1 + MIN_STINT; l2 <= last; l2++) {
        for (const c1 of compounds) {
          for (const c2 of compounds) {
            const stops = [
              { lap: l1, compound: c1 },
              { lap: l2, compound: c2 },
            ];
            if (!legal(car, stops, model.rules)) continue;
            const p = stints.cost(stops);
            if (!ok(p)) continue;
            if (keepTwos) twos.push(p);
            if (!two || p.time < two.time - 1e-9) two = p;
          }
        }
      }
    }
  }

  const picked: Costed[] = [];
  if (none) picked.push(none);
  if (ones[0]) picked.push(ones[0]);
  if (two) picked.push(two);
  // Stable sort: equal times keep the enumeration order, as the strict `<` above does.
  const fill = keepTwos ? [...ones, ...twos.sort((a, b) => a.time - b.time)] : ones;
  for (const p of fill) {
    if (picked.length >= 3) break;
    if (picked.every((q) => differs(p.plan, q.plan))) picked.push(p);
  }
  // The tank can leave only one window for each stop (europe-1997: the first stop by lap 24,
  // the second 42-51): then plans that move a stop by a shorter stint count as different.
  if (tank) {
    for (const p of fill) {
      if (picked.length >= 3) break;
      if (picked.every((q) => differs(p.plan, q.plan, MIN_STINT))) picked.push(p);
    }
  }
  return picked;
}

/** The planner's view of the car's tank in a refuelling race (refuel.ts); null otherwise. */
function tankPlan(run: Run, car: CarState, known: Map<number, unknown>): TankPlan | null {
  const { model, state } = run;
  if (!refuelling(model) || car.tank === undefined) return null;
  const rm = refuelModel(model);
  const pace = run.headset?.modes.pace;
  const burn = (p: PaceMode) => (p === 'standard' ? 1 : (pace?.[p]?.burnMult ?? 1));
  const first = state.lap + 1;
  const laps = model.race.laps;
  const green = new Int32Array(Math.max(1, laps - first + 2));
  for (let lap = first; lap <= laps; lap++) {
    green[lap - first + 1] = (green[lap - first] as number) + (known.has(lap) ? 0 : 1);
  }
  return {
    tank: car.tank,
    cap: fillCap(model),
    secondsPerLap: rm.secondsPerLap,
    refFill: rm.refFill,
    fuelEffect: model.fuelEffectPerLap,
    burn: { standard: burn('standard'), manage: burn('manage'), push: burn('push') },
    green,
    first,
  };
}

/**
 * A refuelling race: each planned stop fills exactly to the plan's next stop or the flag
 * (refuel.ts: `{ laps }` from the out-lap, the reserve on top), as a team planning those stops
 * would, but never more than the tank holds (refuel.ts fillCap: San Marino 2005's one-stop
 * plan from the takeover is 41 laps to the flag on a 25-lap tank, a fill checkFill refuses).
 * Any other race: the stops as they are.
 */
export function fuelled(model: RaceModel, stops: RacePlan['stops']): RacePlan['stops'] {
  if (!refuelling(model)) return stops;
  const cap = fillCap(model);
  return stops.map((s, i) => ({
    ...s,
    fill: { laps: Math.min(cap, (stops[i + 1]?.lap ?? model.race.laps) - s.lap) },
  }));
}

/** A plan as a grading option: its own calls, played to the flag with nothing added. */
export function planOption(run: Run, plan: RacePlan): GradeOption {
  const car = run.state.cars[run.model.userSide];
  return {
    id: plan.id,
    decisions: planCalls(plan, run.state.lap, car?.modes.pace ?? 'standard'),
    final: true,
  };
}
