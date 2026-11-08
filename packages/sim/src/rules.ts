// Era rules (eras build plan 4.1, roadmap R5): the race's `rules` block and `race.scUnlap`,
// applied to the sim. Mirrors pipeline/src/pipeline/race_rules.py (parity for the rules both
// sims run: tyre changes, the pit-lane closure, scUnlap). Every rule is off unless the race
// says so: a race without a `rules` block runs exactly as before.
//
// Sources (checked Nov 7, 2026):
// - VSC: introduced for 2015 (Wikipedia, "Safety car": "officially introduced for the 2015
//   season following ratification by the WMSC").
// - DRS 2011-2025 (Wikipedia, "Drag reduction system"); KERS raced in 2009, not in 2010 (all
//   teams agreed not to), and again from 2011 (Wikipedia, "Kinetic energy recovery system").
// - Two-compound rule: 2007 Sporting Regulations art. 77c, a driver who hasn't used wet tyres
//   must run each dry specification in the race (Autosport, 2007 tyre strategy previews).
// - 2005: one set of dry tyres for qualifying and the race; a tyre may be changed only if it's
//   damaged, or when conditions switch between wet and dry (BBC, Bridgestone 2005 technical
//   regulations page, Motorsport.com 2005 rules summary).
// - Pit lane closed under the SC, 2007-2008: closed as soon as the SC is deployed, until every
//   car is queued behind it and "pit lane open" is shown; a car entering before then gets a
//   ten-second stop-go; a car already in the pit entry or pit lane is exempt, as is a stop
//   only for wet tyres (RaceFans, "F1 2007 Preview: New rules at a glance", Feb 28 2007;
//   Wikipedia, "2007 Canadian Grand Prix": Alonso and Rosberg's ten-second stop-and-go).
//   Dropped for 2009 (Autosport, "FIA confirms new safety car rules", Jan 27 2009: "we've gone
//   back to the 2006 regulations"), so R5's "2007-09" is 2007-08.
// - Lapped cars unlap before the restart: new in 2007 ("a substantial departure from prior
//   practice", RaceFans, as above); banned from 2010; allowed again from 2012 (Wikipedia,
//   "Safety car"). So scUnlap is `none` before 2007 and in 2010-11.

import type { BattleMove, Compound, FlagState, PitStop, RaceModel, RaceRules } from './types.js';
import { isWetTyre } from './weather.js';

/**
 * SC laps (from the deployment) whose end the pit entry is closed on: the field is taken to
 * be queued behind the SC within one lap, when race control opened the pit lane. A model
 * estimate, not a measured figure.
 */
export const PIT_CLOSED_SC_LAPS = 1;
/** The penalty's stationary time (s): the ten-second stop-go. */
export const STOP_GO_SECONDS = 10;

/**
 * The race's era rules, with defaults filled in (`drs` and `ers` stay as given: absent means
 * the era's headset.json block).
 */
export interface ResolvedRules {
  twoCompound: boolean;
  tyreChanges: boolean;
  refuelling: boolean;
  fuelLimit?: number;
  pitLaneClosedUnderSC: boolean;
  vsc: boolean;
  drs?: boolean;
  ers?: RaceRules['ers'];
}

export function resolveRules(model: RaceModel): ResolvedRules {
  const r = model.rules ?? {};
  return {
    twoCompound: r.twoCompound !== false,
    tyreChanges: r.tyreChanges !== false,
    refuelling: r.refuelling === true,
    ...(r.fuelLimit !== undefined ? { fuelLimit: r.fuelLimit } : {}),
    pitLaneClosedUnderSC: r.pitLaneClosedUnderSC === true,
    vsc: r.vsc !== false,
    ...(r.drs !== undefined ? { drs: r.drs } : {}),
    ...(r.ers !== undefined ? { ers: r.ers } : {}),
  };
}

// --- The headset block: race-level DRS / ERS override the era's, no VSC ---------------------

/** The parts of a headset.json era block the rules switch (sim.ts's HeadsetEra). */
export interface RuleSwitchable {
  drs?: boolean;
  modes: { ers?: unknown };
  ers?: unknown;
  neutralization?: { scPerLap: number; vscPerLap: number };
  incidents?: { scShare: number };
  fuel?: { burnPerLap: number };
}

/** Where a battery comes from when the race has one and its era block doesn't. */
const ERS_SOURCE = { kers: '2010-2013', hybrid: '2014-2025' } as const;

const cache = new WeakMap<RaceModel, unknown>();

/**
 * The race's headset block: the era's, with the race's `rules` applied. `drs` overrides the
 * era's DRS (the `wait-drs` move); `ers: 'none'` removes the battery (no ERS modes, no
 * `overtake-button`), and `kers` / `hybrid` in an era block without one borrows the battery
 * of the era that raced it (rates copied, not tuned). `vsc: false` sets the VSC base rate to
 * 0 (grader playouts never draw one) and makes every crash a SC (`scShare` 1: the draw is
 * still taken, so the streams don't move). `refuelling` drops the fuel load and `fuelLimit`
 * sets its burn (eras build plan 4.2). Without rules it is the era block itself.
 */
export function headsetFor<T extends RuleSwitchable>(
  blocks: Record<string, T>,
  model: RaceModel,
): T | undefined {
  const base = blocks[model.era];
  const r = model.rules;
  if (
    !base ||
    !r ||
    (r.drs === undefined &&
      r.ers === undefined &&
      r.vsc !== false &&
      r.refuelling !== true &&
      r.fuelLimit === undefined)
  )
    return base;
  if (cache.has(model)) return cache.get(model) as T;
  const out: T = { ...base, modes: { ...base.modes } };
  if (r.drs !== undefined) out.drs = r.drs;
  if (r.ers === 'none') {
    out.ers = undefined;
    out.modes.ers = undefined;
  } else if (r.ers && !base.ers) {
    const from = blocks[ERS_SOURCE[r.ers]];
    out.ers = from?.ers;
    out.modes.ers = from?.modes.ers;
  }
  // Eras build plan 4.2 (refuel.ts): a refuelling race has no fuel load (the tank replaces
  // it); a fuel-limit race's standard burn is its allowance over the distance.
  if (r.refuelling === true) out.fuel = undefined;
  else if (r.fuelLimit !== undefined && out.fuel) {
    out.fuel = { ...out.fuel, burnPerLap: r.fuelLimit / model.race.laps };
  }
  if (r.vsc === false) {
    if (out.neutralization) out.neutralization = { ...out.neutralization, vscPerLap: 0 };
    if (out.incidents) out.incidents = { ...out.incidents, scShare: 1 };
  }
  cache.set(model, out);
  return out;
}

/** Roadmap R5: no `wait-drs` without DRS, no `overtake-button` without a battery. */
export function hasMove(headset: RuleSwitchable, move: BattleMove): boolean {
  if (move === 'wait-drs') return headset.drs !== false;
  if (move === 'overtake-button') return !!headset.ers;
  return true;
}

/**
 * The flag a neutralization the sim makes up (a crash, a grader or Legend draw) may take: a
 * VSC becomes a SC in a race without one. Real events are the race's data and are kept.
 */
export function allowedFlag<F extends Exclude<FlagState, 'green'>>(
  model: RaceModel,
  flag: F,
): F | 'sc' {
  return flag === 'vsc' && model.rules?.vsc === false ? 'sc' : flag;
}

// --- Tyres ----------------------------------------------------------------------------------

/** The two-compound rule applies (default: yes). */
export function twoCompoundRule(rules: RaceRules | undefined): boolean {
  return rules?.twoCompound !== false;
}

/**
 * True if a stop from `from` onto `stop.to` fits new tyres. With `tyreChanges: false` (2005) a
 * stop keeps the set unless the set is damaged (a puncture's stop) or the change is for the
 * weather (to or from a wet tyre). Such a stop only refuels (refuel.ts refuelAtStop, with
 * the race's `refuelling`).
 */
export function stopChangesTyres(
  rules: RaceRules | undefined,
  from: Compound,
  stop: Pick<PitStop, 'to' | 'damaged'>,
): boolean {
  if (rules?.tyreChanges !== false) return true;
  return stop.damaged === true || isWetTyre(from) || isWetTyre(stop.to);
}

/**
 * validateDecisions: with no tyre changes, a pit call may name only the dry compound the user
 * is on at the takeover (a refuelling stop), or a wet tyre. Null when the call is legal.
 */
export function illegalPitCompound(model: RaceModel, compound: Compound): string | null {
  if (model.rules?.tyreChanges !== false || isWetTyre(compound)) return null;
  const on = model.drivers.find((d) => d.code === model.userSide)?.stateAtTakeover.compound;
  if (!on || isWetTyre(on) || on === compound) return null;
  return `no tyre changes in this race: ${compound} for ${on}`;
}

// --- The pit lane closed under the SC (2007-08) -----------------------------------------------

/**
 * True if a stop whose out-lap is `outLap` entered a closed pit lane: its in-lap (outLap - 1)
 * ends within PIT_CLOSED_SC_LAPS of a SC's deployment. A stop entering at the end of the
 * green lap before the SC was already in the pit entry (exempt), and so is a stop only for
 * wet tyres.
 */
export function pitLaneClosed(
  model: RaceModel,
  neutral: ReadonlyMap<number, FlagState>,
  outLap: number,
  to: Compound,
): boolean {
  if (model.rules?.pitLaneClosedUnderSC !== true || isWetTyre(to)) return false;
  let scLaps = 0;
  for (let lap = outLap - 1; neutral.get(lap) === 'sc'; lap--) scLaps++;
  return scLaps >= 1 && scLaps <= PIT_CLOSED_SC_LAPS;
}

/**
 * Time a stop-go costs (s): the track's green pit loss for the drive through the lane plus
 * the ten seconds stationary. The pit loss also holds a routine stop's service time, so this
 * overstates it by a few seconds: a tunable estimate.
 */
export function stopGoCost(model: RaceModel): number {
  return model.track.pitLoss + STOP_GO_SECONDS;
}

/**
 * The stop-go a car owes, served on its first green lap after the offence (no penalty is
 * served behind the SC), or added at the flag if none is left. Returns the time charged this
 * lap (0 if none) and clears the debt. Call before the lap's stop is checked, so a penalty is
 * never served on its own offence's lap.
 */
export function serveStopGo(
  car: { stopGo?: number },
  flag: FlagState | undefined,
  lap: number,
  laps: number,
): number {
  const owed = car.stopGo ?? 0;
  if (owed <= 0 || (flag && flag !== 'green' && lap < laps)) return 0;
  car.stopGo = 0;
  return owed;
}

// --- SC restarts ----------------------------------------------------------------------------

/**
 * How the SC queue closes up (bunch in sim.ts): null, every lapped car unlaps (the rule
 * since 2012, and 2007-09); 'none', lapped cars stay a lap down (before 2007 and 2010-11);
 * or the two cars between which Abu Dhabi 2021's lapped cars were waved through.
 */
export function scQueue(model: RaceModel): [string, string] | 'none' | null {
  const u = model.race.scUnlap;
  if (u === 'duel') return [model.userSide, model.rival];
  return u === 'none' ? 'none' : null;
}
