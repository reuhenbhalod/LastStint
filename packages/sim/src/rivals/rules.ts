// The rival policies' rule functions (eras spec §7 "Rival policies", decided Nov 7): pure
// functions of the race model and a car, so the Python reference (rival_policy.py) mirrors each
// one and both are checked against the same vectors (pipeline/tests/fixtures/rival_rules.json).
// react.ts runs them each lap in a live run; nothing here reads or changes a Run.
//
// Stops are out-laps, as everywhere in the sim: a stop on lap L is charged on lap L, so a rival
// deciding at the end of lap `lap` can box on lap + 1 at the earliest.

import { COVER_WINDOW, GO_LONG_MARGIN, cleanLap, lifeOf, ruleSatisfied } from '../sim.js';
import type { CarState, Compound, FlagState, PitStop, RaceModel } from '../types.js';
import { isWetTyre, weatherWear, wetnessOn } from '../weather.js';
import { wetCrossover } from './wet.js';

/** Neutralized laps a rule may know about (lap -> 'sc' | 'vsc' | 'red'). */
export type KnownFlags = ReadonlyMap<number, Exclude<FlagState, 'green'>>;

const NONE: KnownFlags = new Map();

/** A car's planned stops after `lap`, in lap order. */
export function plannedAfter(stops: readonly PitStop[], lap: number): PitStop[] {
  return stops.filter((s) => s.lap > lap).sort((a, b) => a.lap - b.lap);
}

function pitLossFor(model: RaceModel, flag: FlagState | undefined): number {
  const { track } = model;
  return flag === 'sc'
    ? track.pitLossUnderSC
    : flag === 'vsc'
      ? track.pitLossUnderVSC
      : track.pitLoss;
}

/**
 * The lap-time model's time for `car` to run laps (fromLap, laps] on the plan `stops` (only
 * those after fromLap count): no noise, traffic or rivals. A stop pays the pit loss for its
 * lap's known flag; neutralized laps cost the same whatever the tyres, so they add nothing;
 * wear advances as in stepLap for a car on default modes. `wetness`: the timeline the car
 * races under (default the race's real one). Mirrors rival_policy.plan_time.
 */
export function planTime(
  model: RaceModel,
  car: CarState,
  fromLap: number,
  stops: readonly PitStop[],
  known: KnownFlags = NONE,
  wetness: readonly number[] = model.weather?.wetness ?? [],
): number {
  const byLap = new Map<number, PitStop>();
  for (const s of stops) if (s.lap > fromLap && !byLap.has(s.lap)) byLap.set(s.lap, s);
  const scratch: CarState = { ...car };
  let total = 0;
  for (let lap = fromLap + 1; lap <= model.race.laps; lap++) {
    const flag = known.get(lap);
    const stop = byLap.get(lap);
    if (stop) {
      scratch.compound = stop.to;
      scratch.tyreWear = 0;
      scratch.tyreAge = 0;
      total += pitLossFor(model, flag);
    }
    const w = wetnessOn(wetness, lap);
    if (!flag) total += cleanLap(model, scratch, lap, w);
    scratch.tyreWear += weatherWear(model.weather, scratch.compound, w);
    scratch.tyreAge += 1;
  }
  return total;
}

/**
 * The last out-lap a car may stop on when it stretches its stint (Smart's overcut): its tyres
 * may run no further than their life minus GO_LONG_MARGIN laps (the same margin as Standard's
 * going long), and the next lap is always allowed. Mirrors rival_policy.latest_stop.
 */
export function latestStop(model: RaceModel, car: CarState, lap: number): number {
  const life = lifeOf(model, car.compound);
  if (!Number.isFinite(life)) return model.race.laps;
  return lap + 1 + Math.max(0, Math.floor(life - GO_LONG_MARGIN - car.tyreWear));
}

/**
 * Smart's overcut (eras spec §7): the player pitted under green and the rival didn't cover,
 * so the rival moves its next planned stop to the out-lap the lap-time model predicts gives it
 * the lowest remaining race time (planTime, with the rest of its plan unchanged), between the
 * next lap and the earliest of latestStop, the lap before its following planned stop, and the
 * penultimate lap. The earliest lap wins a tie. Returns the new out-lap, or null when the stop
 * stays where it is (or there is no planned stop to move). Mirrors rival_policy.overcut_lap.
 */
export function overcutLap(
  model: RaceModel,
  car: CarState,
  lap: number,
  known: KnownFlags = NONE,
  wetness: readonly number[] = model.weather?.wetness ?? [],
): number | null {
  const plan = plannedAfter(car.strategy, lap);
  const next = plan[0];
  if (!next) return null;
  const following = plan[1]?.lap ?? Number.POSITIVE_INFINITY;
  const hi = Math.min(latestStop(model, car, lap), following - 1, model.race.laps - 1);
  let best: number | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (let at = lap + 1; at <= hi; at++) {
    const stops = [{ ...next, lap: at }, ...plan.slice(1)];
    const t = planTime(model, car, lap, stops, known, wetness);
    if (t < bestTime) {
      bestTime = t;
      best = at;
    }
  }
  return best === null || best === next.lap ? null : best;
}

/**
 * Smart's wet-tyre rule, and Expert's a lap earlier (eras spec §7): decided at the end of lap
 * `lap`, the wet tyre a car on slicks boxes for on lap + 1, or null. Smart (lead 0) switches on
 * the crossover lap: lap + 1 is the first lap a fresh set of a wet tyre is faster than its
 * slicks (wetCrossover; pit loss excluded, a tie keeps the slicks). Expert (lead 1) also
 * switches when the crossover is lap + 2, one lap before it. Mirrors rival_policy.wet_switch.
 */
export function wetSwitch(
  model: RaceModel,
  car: CarState,
  lap: number,
  lead: 0 | 1,
  wetness: readonly number[] = model.weather?.wetness ?? [],
): Compound | null {
  if (!model.weather || isWetTyre(car.compound)) return null;
  for (let k = 1; k <= 1 + lead; k++) {
    const at = lap + k;
    if (at > model.race.laps) break;
    const wet = wetCrossover(model, car, at, wetnessOn(wetness, at));
    if (wet) return wet;
  }
  return null;
}

/** The user's stop on `outLap` is the real team's call (the rival's real answer is its plan). */
export function isRealUserStop(model: RaceModel, outLap: number, compound: string): boolean {
  return !!model.drivers
    .find((d) => d.code === model.userSide)
    ?.realStrategy.some((s) => s.lap === outLap && s.to === compound);
}

/**
 * Expert's earlier green-flag cover (eras spec §7, "covers on the same lap the player stops"):
 * at the end of lap `lap`, the player's stop is due on lap + 1 under green, and the rival boxes
 * on the same lap if the two are within a pit loss of each other (`gap`, s, now) and its own
 * next planned stop is within `window` laps of lap + 1 (Standard+'s 7). It takes that stop's
 * compound. Null under a SC/VSC (`nextFlag`), for the real team's call (as Standard), when the
 * rival is already stopping on lap + 1, or past the flag. Mirrors rival_policy.same_lap_cover.
 */
export function sameLapCover(
  model: RaceModel,
  car: CarState,
  at: {
    lap: number;
    gap: number;
    userStop: { to: string };
    nextFlag: FlagState | undefined;
    window?: number;
  },
): string | null {
  const outLap = at.lap + 1;
  if (at.nextFlag && at.nextFlag !== 'green') return null;
  if (outLap > model.race.laps) return null;
  if (isRealUserStop(model, outLap, at.userStop.to)) return null;
  if (car.strategy.some((s) => s.lap === outLap)) return null;
  const next = plannedAfter(car.strategy, at.lap)[0];
  if (!next || Math.abs(at.gap) >= model.track.pitLoss) return null;
  return next.lap - outLap <= (at.window ?? COVER_WINDOW) ? next.to : null;
}

/**
 * The tyre the rival fits if it boxes now (Expert's "box now" option) at the end of `lap`:
 * the wet tyre of a wet switch; else its next planned stop's compound; else the compound that
 * the lap-time model says runs the rest of the race fastest from a stop on lap + 1 (a new dry
 * compound when the two-compound rule still needs one; the first in the model's order on a
 * tie). Null when no compound qualifies. Mirrors rival_policy.box_now_compound.
 */
export function boxNowCompound(
  model: RaceModel,
  car: CarState,
  lap: number,
  wet: Compound | null,
  known: KnownFlags = NONE,
  wetness: readonly number[] = model.weather?.wetness ?? [],
): string | null {
  if (wet) return wet;
  const next = plannedAfter(car.strategy, lap)[0];
  if (next) return next.to;
  const mustChange = !ruleSatisfied(car);
  let best: string | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (const to of Object.keys(model.compounds)) {
    if (mustChange && (car.compoundsUsed.includes(to) || isWetTyre(to))) continue;
    const t = planTime(model, car, lap, [{ lap: lap + 1, to }], known, wetness);
    if (t < bestTime) {
      bestTime = t;
      best = to;
    }
  }
  return best;
}

/** Expert's options at a decision point (eras spec §7). */
export const RIVAL_OPTION_IDS = ['smart', 'stay-out', 'box-now'] as const;
export type RivalOptionId = (typeof RIVAL_OPTION_IDS)[number];

/** Why lap `lap` is one of Expert's decision points (eras spec §7). */
export type RivalDecisionReason = 'player-stop' | 'neutral-next' | 'own-stop' | 'wet-crossover';

/**
 * Expert's decision points (eras spec §7), at the end of lap `lap`: the player's stop is due
 * next lap (it has been called), a SC or VSC starts next lap, the rival's own planned stop is
 * next lap, or its wet switch fires. Never after the penultimate lap but one: a decision must
 * leave a lap to box on before the flag. Mirrors rival_policy.decision_reasons.
 */
export function decisionReasons(at: {
  lap: number;
  laps: number;
  userStopsNext: boolean;
  flagNow: FlagState | undefined;
  flagNext: FlagState | undefined;
  rivalStopsNext: boolean;
  wetSwitch: boolean;
}): RivalDecisionReason[] {
  if (at.lap > at.laps - 2) return [];
  const neutral = (f: FlagState | undefined) => f === 'sc' || f === 'vsc';
  const out: RivalDecisionReason[] = [];
  if (at.userStopsNext) out.push('player-stop');
  if (neutral(at.flagNext) && !neutral(at.flagNow)) out.push('neutral-next');
  if (at.rivalStopsNext) out.push('own-stop');
  if (at.wetSwitch) out.push('wet-crossover');
  return out;
}

/** One of the rival's options: its planned stops after the decision lap if it takes it. */
export interface RivalPlanOption {
  id: RivalOptionId;
  stops: PitStop[];
}

function stopKey(stops: readonly PitStop[]): string {
  return [...stops]
    .sort((a, b) => a.lap - b.lap)
    .map((s) => `${s.lap}:${s.to}:${s.added ? 1 : 0}:${s.optional ? 1 : 0}:${s.loss ?? ''}`)
    .join('|');
}

/**
 * Expert's options at the end of lap `lap` (eras spec §7: "Smart's move, stay out, or box
 * now"), as plans after `lap`:
 * - smart: `after`, the plan once this lap's Smart rules (with Expert's timing) have run;
 * - stay-out: `before`, the plan before them, not boxing next lap: a stop it had planned for
 *   lap + 1 moves to lap + 2 (dropped if that is the last lap or already has a stop);
 * - box-now: `after` with its next stop brought forward to lap + 1 on `boxTo` (offered only
 *   with a tyre to fit, and only before the flag; the same plan as smart if that already
 *   boxes on lap + 1 on `boxTo`).
 * Options with the same plan as an earlier one are left out, so an id is legal at a point
 * only if its plan is distinct. Mirrors rival_policy.rival_options.
 */
export function rivalOptions(at: {
  lap: number;
  laps: number;
  before: readonly PitStop[];
  after: readonly PitStop[];
  boxTo: string | null;
}): RivalPlanOption[] {
  const { lap, laps } = at;
  const copy = (s: PitStop): PitStop => ({ ...s });
  const smart = plannedAfter(at.after, lap).map(copy);
  const before = plannedAfter(at.before, lap).map(copy);
  const stay = before.filter((s) => s.lap !== lap + 1);
  const deferred = before.find((s) => s.lap === lap + 1);
  if (deferred && lap + 2 < laps && !stay.some((s) => s.lap === lap + 2))
    stay.push({ lap: lap + 2, to: deferred.to, added: true });
  const options: RivalPlanOption[] = [
    { id: 'smart', stops: smart },
    { id: 'stay-out', stops: stay.sort((a, b) => a.lap - b.lap) },
  ];
  if (at.boxTo && lap + 1 < laps) {
    // Already boxing next lap on that tyre: the same plan as Smart's move.
    const due = smart[0]?.lap === lap + 1 && smart[0]?.to === at.boxTo;
    const box = due ? smart : [{ lap: lap + 1, to: at.boxTo, added: true }, ...smart.slice(1)];
    options.push({ id: 'box-now', stops: box });
  }
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = stopKey(o.stops);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
