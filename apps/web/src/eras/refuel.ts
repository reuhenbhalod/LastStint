// Refuelling on the race screen (eras build plan 8.5, roadmap R4): the fill choice on the pit
// stop (short / standard / long) and the gauge of fuel to the next stop, in races whose rules
// refuel (`rules.refuelling`). The reading comes from the sim's refuelling model (build plan
// 4.2, packages/sim refuel.ts: `tankReading`, `fillOptions`), and the chosen fill rides on the
// pit call (`Decision.fill`; TeamRadio, QuickCallCard, PlanEditor). The fill is required: no
// box call goes without one, and none is preselected (owner decision, Nov 7 2026). A race
// that doesn't refuel shows none of it.

import type { RaceModel, RaceState } from '@laststint/sim';
import { RESERVE_LAPS, fillOptions, refuelModel, tankReading } from '@laststint/sim';
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

/**
 * The sim's refuelling model for the user's car (packages/sim refuel.ts). A pit call now (for
 * the coming lap, `race.lap + 1`) boxes at the end of that lap, so its fill fuels from the
 * out-lap `race.lap + 2`: each choice's laps are `fillOptions` there, and its seconds are the
 * race's fill rate times what goes in (the stint plus the reserve, less the fuel left after the
 * in-lap). The gauge is the fuel on board over a full tank (the longest stint plus reserve).
 */
export const simRefuelSource: RefuelSource = (race, model) => {
  const car = race.cars[model.userSide];
  if (!car || car.retired) return null;
  const tank = tankReading(model, car, race.lap);
  if (!tank) return null;
  const rm = refuelModel(model);
  const left = Math.max(0, tank.laps - 1);
  const options = fillOptions(model, race.lap + 2);
  return {
    lapsOfFuel: tank.laps,
    nextStopLap: tank.toFlag ? null : tank.boxBy,
    level: Math.min(1, Math.max(0, tank.laps / (rm.tankLaps + RESERVE_LAPS))),
    fills: FUEL_FILLS.map((fill) => ({
      fill,
      laps: options[fill],
      seconds: rm.secondsPerLap * Math.max(0, options[fill] + RESERVE_LAPS - left),
    })),
  };
};

/** The connected refuelling model: the sim's (4.2). */
export const REFUEL_SOURCE: RefuelSource | null = simRefuelSource;

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
