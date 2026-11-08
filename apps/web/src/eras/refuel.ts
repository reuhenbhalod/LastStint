// Refuelling on the race screen (eras build plan 8.5, roadmap R4): the fill choice on the pit
// stop (short / standard / long) and the gauge of fuel to the next stop, in races whose rules
// refuel (`rules.refuelling`). The refuelling model itself is build plan 4.2, built in
// parallel: this file is the small interface the screen needs from it. Until a source is
// connected (`REFUEL_SOURCE` is null on this branch) the reading is null and the refuelling UI
// is hidden, so a refuelling race shows exactly today's pit section.
//
// TODO(4.2): set REFUEL_SOURCE to the sim's refuelling reading, and carry the chosen fill on
// the pit call once the sim's Decision has it.

import type { RaceModel, RaceState } from '@laststint/sim';
import { raceScreenEra } from './raceRules.js';

/** The fill a stop takes (roadmap R4): less fuel is a shorter stop and a lighter car. */
export type FuelFill = 'short' | 'standard' | 'long';
export const FUEL_FILLS: readonly FuelFill[] = ['short', 'standard', 'long'];

export interface FillOption {
  fill: FuelFill;
  /** Laps the fill lasts at the standard burn (where the next stop falls). */
  laps: number;
  /** Seconds stationary to put it in (the fill rate fitted per race). */
  seconds: number;
}

export interface RefuelReading {
  /** Laps the fuel on board lasts at the standard burn. */
  lapsOfFuel: number;
  /** The lap of the next stop the car is fuelled to (null: fuelled to the flag). */
  nextStopLap: number | null;
  /** The share of a full tank on board, 0-1 (the gauge). */
  level: number;
  /** The fills a stop called now can take, short first. */
  fills: FillOption[];
}

/** What the refuelling model gives the screen for the user's car (4.2 implements it). */
export type RefuelSource = (race: RaceState, model: RaceModel) => RefuelReading | null;

/** The connected refuelling model: none yet on this branch (see the TODO above). */
export const REFUEL_SOURCE: RefuelSource | null = null;

/**
 * The refuelling reading to show, or null to show none: the race doesn't refuel, there's no
 * refuelling model, or it has nothing for the car (retired, say).
 */
export function refuelReading(
  race: RaceState,
  model: RaceModel,
  source: RefuelSource | null = REFUEL_SOURCE,
): RefuelReading | null {
  if (!raceScreenEra(model).rules.refuelling || !source) return null;
  return source(race, model);
}
