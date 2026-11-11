// The fuel load for the screens and the engineer (fuel load spec): what's in the tank, what the
// flag needs at the standard burn, and how much to save a lap. Live play only (the sim's
// fuelMargin); null when the race has no fuel load.

import {
  type RaceModel,
  type RaceState,
  fuelConfig,
  fuelMargin,
  modeEffects,
} from '@laststint/sim';

/** Below this margin (kg) the car is short: the engineer asks to save. */
export const FUEL_SHORT = -0.5;
/** Above this margin (kg) while saving, the target's met: back to normal. */
export const FUEL_BACK = 0.4;

export interface FuelReading {
  /** Kg in the tank. */
  kg: number;
  /** Kg to spare at the flag at the standard burn (negative: short). */
  margin: number;
  /** Kg to save a lap to reach the flag (0 when there's enough). */
  savePerLap: number;
  /** Laps of lift and coast that make up the shortfall (0 when there's enough). */
  liftLaps: number;
  /** The share of the takeover's load left, 0-1 (the gauge). */
  level: number;
  /** The tank is dry. */
  empty: boolean;
}

export function fuelReading(race: RaceState, model: RaceModel): FuelReading | null {
  const car = race.cars[model.userSide];
  const f = fuelConfig(model);
  if (!car || !f || car.fuel === undefined) return null;
  const margin = fuelMargin(model, car, race.lap) ?? 0;
  const left = Math.max(1, model.race.laps - race.lap);
  const full = f.burnPerLap * (model.race.laps - model.race.takeoverLap) + f.marginMax;
  const lift = modeEffects(model)?.fuel.liftAndCoast?.burnMult ?? 0.85;
  const perLap = f.burnPerLap * (1 - lift);
  return {
    kg: car.fuel,
    margin,
    savePerLap: margin < 0 ? -margin / left : 0,
    liftLaps: margin < 0 && perLap > 0 ? Math.ceil(-margin / perLap) : 0,
    level: Math.max(0, Math.min(1, car.fuel / full)),
    empty: car.fuel <= 0,
  };
}

/** "about 3 laps of lift and coast". */
export function liftText(laps: number): string {
  return `about ${laps} ${laps === 1 ? 'lap' : 'laps'} of lift and coast`;
}

/** "0.8 kg short" / "0.5 kg spare" / "on target". */
export function marginText(margin: number): string {
  if (Math.abs(margin) < 0.05) return 'on target';
  return margin < 0 ? `${(-margin).toFixed(1)} kg short` : `${margin.toFixed(1)} kg spare`;
}
