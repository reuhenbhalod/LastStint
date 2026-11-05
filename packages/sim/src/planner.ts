// The engineer's race plans (docs/strategy-planner-spec.md). At takeover the engineer offers up
// to three plans that differ in their number of stops: each is the fastest plan of its kind by
// the lap-time model alone (no noise, traffic or rivals), so the offer is deterministic and the
// server rebuilds it from the run. How good each plan really is comes from blind playouts
// (grade.ts, with `final` options: the plan's own calls to the flag, nothing added).

import type { GradeOption, Target } from './grade.js';
import { MIN_STINT, planCalls, stintStarts } from './plan.js';
import {
  DRY_COMPOUNDS,
  type Run,
  freshTyreDelta,
  lifeOf,
  neutralMap,
  ruleSatisfied,
  tyreLapTime,
} from './sim.js';
import type { CarState, PaceMode, PlanId, RacePlan } from './types.js';

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

/**
 * Stint times, worked out once: a stint's time depends only on its tyres, its first lap and its
 * last, so every plan is a sum of table entries (plus the pit losses). `mid` stints can't push;
 * the last stint can (to the flag).
 */
class Stints {
  private readonly fresh = new Map<string, { mid: StintTable; last: StintTable }>();
  private readonly current: { mid: StintTable; last: StintTable };

  constructor(
    private readonly run: Run,
    private readonly car: CarState,
    private readonly known: Map<number, unknown>,
  ) {
    this.current = this.table(car.compound, car.tyreWear, car.tyreAge, run.state.lap + 1);
  }

  /** Best times for laps [from, to] for every `to`, for middle and last stints. */
  private table(compound: string, wear0: number, age0: number, from: number) {
    const laps = this.run.model.race.laps;
    const n = laps - from + 1;
    const mid: StintTable = { time: new Float64Array(n).fill(Number.POSITIVE_INFINITY), pace: [] };
    const last: StintTable = { time: new Float64Array(n).fill(Number.POSITIVE_INFINITY), pace: [] };
    for (const p of ['standard', 'manage', 'push'] as PaceMode[]) {
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
    return { mid, last };
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
    for (let i = 0; i <= stops.length; i++) {
      const from = starts[i] as number;
      const to = i < stops.length ? (stops[i]?.lap as number) : laps;
      const t = i === 0 ? this.current : this.freshFrom(stops[i - 1]?.compound as string, from);
      const table = i === stops.length ? t.last : t.mid;
      time += table.time[to - from] as number;
      pace.push(table.pace[to - from] as PaceMode);
      if (i > 0) time += this.loss(from);
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
    if (!neutral) {
      // Pushing gains nothing on tyres past their life (the sim's modeLapDelta).
      t += tyreLapTime(model, car.basePace, compound, wear, lap) + freshTyreDelta(model, age);
      t += lapDelta < 0 && wear >= life ? 0 : lapDelta;
    }
    out[lap - from] = t;
    wear += neutral ? 1 : wearMult;
    age += 1;
  }
  return out;
}

/** True if the car ends the race with two dry compounds used (or doesn't need to). */
function legal(car: CarState, stops: RacePlan['stops']): boolean {
  if (ruleSatisfied(car)) return true;
  const dry = new Set(
    [...car.compoundsUsed, car.compound, ...stops.map((s) => s.compound)].filter((c) =>
      (DRY_COMPOUNDS as readonly string[]).includes(c),
    ),
  );
  return dry.size >= 2;
}

function differs(a: Omit<RacePlan, 'id'>, b: Omit<RacePlan, 'id'>): boolean {
  if (a.stops.length !== b.stops.length) return true;
  return a.stops.some((s, i) => {
    const t = b.stops[i] as RacePlan['stops'][number];
    return s.compound !== t.compound || Math.abs(s.lap - t.lap) >= DIFFERENT_LAPS;
  });
}

/**
 * The engineer's plans from the run's current lap: the fastest no-stop, one-stop and two-stop
 * plans by the lap-time model, legal under the two-compound rule. Where a kind is missing (no
 * legal no-stop, or too few laps for two stops), the next-best one-stop plan that really
 * differs takes its place. Ids 'a', 'b', 'c' in order of stops, then of the first stop's lap.
 */
export function enginePlans(run: Run): RacePlan[] {
  const { model, state } = run;
  const car = state.cars[model.userSide];
  if (!car || car.retired) return [];
  const known = neutralMap(run.events.filter((e) => e.lap <= state.lap + 1));
  const first = state.lap + 1;
  const last = model.race.laps - 1; // no stop on the final lap
  const compounds = Object.keys(model.compounds);

  const stints = new Stints(run, car, known);
  const none = legal(car, []) ? stints.cost([]) : null;
  const ones: Costed[] = [];
  for (let lap = first; lap <= last; lap++) {
    for (const c of compounds) {
      const stops = [{ lap, compound: c }];
      if (legal(car, stops)) ones.push(stints.cost(stops));
    }
  }
  ones.sort((a, b) => a.time - b.time);
  let two: Costed | null = null;
  if (model.race.laps - state.lap >= TWO_STOP_MIN_LAPS) {
    for (let l1 = first; l1 <= last; l1++) {
      for (let l2 = l1 + MIN_STINT; l2 <= last; l2++) {
        for (const c1 of compounds) {
          for (const c2 of compounds) {
            const stops = [
              { lap: l1, compound: c1 },
              { lap: l2, compound: c2 },
            ];
            if (!legal(car, stops)) continue;
            const p = stints.cost(stops);
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
  for (const p of ones) {
    if (picked.length >= 3) break;
    if (picked.every((q) => differs(p.plan, q.plan))) picked.push(p);
  }
  const ids: PlanId[] = ['a', 'b', 'c'];
  return picked
    .sort(
      (a, b) =>
        a.plan.stops.length - b.plan.stops.length ||
        (a.plan.stops[0]?.lap ?? 0) - (b.plan.stops[0]?.lap ?? 0),
    )
    .map((p, i) => ({ id: ids[i] as PlanId, ...p.plan }));
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
