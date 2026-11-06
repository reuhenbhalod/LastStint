// The weather as the game shows it (docs/weather-spec.md W3-W4): the track's conditions in a
// word, and the engineer's radar forecast. The radar reads the race's wetness a few laps ahead
// (real teams see rain coming minutes out), less sure the further it looks: blind playouts
// grade the calls against a forecast like it (sim forecastWetness), never the real future.

import { type RaceModel, wetPenalty, wetnessOn } from '@boxthislap/sim';

export type Conditions = 'dry' | 'damp' | 'wet' | 'soaked';

export const CONDITION_WORD: Record<Conditions, string> = {
  dry: 'Dry',
  damp: 'Damp',
  wet: 'Wet',
  soaked: 'Soaked',
};

export function conditionsOf(w: number): Conditions {
  if (w < 0.03) return 'dry';
  if (w < 0.15) return 'damp';
  if (w < 0.45) return 'wet';
  return 'soaked';
}

/** How far ahead the radar looks (laps), and how sure it is at each distance. */
const RADAR_LAPS = 8;
const confidence = (laps: number) => (laps <= 2 ? 90 : laps <= 4 ? 75 : laps <= 6 ? 60 : 45);

export interface Forecast {
  /** "Rain in about 3 laps", "Drying in about 4 laps", "Rain heavier in about 2 laps". */
  text: string;
  /** How sure the radar is (%), or null for no change in sight. */
  sure: number | null;
  /** Rain on its way (or heavier), or the track drying. */
  trend: 'wetter' | 'drier' | 'steady';
}

/** The radar's word on the laps after `lap` (null in a dry race). */
export function forecast(model: RaceModel, lap: number): Forecast | null {
  const weather = model.weather;
  if (!weather) return null;
  const w = weather.wetness;
  const now = conditionsOf(wetnessOn(w, lap + 1));
  const last = model.race.laps;
  for (let k = 2; k <= RADAR_LAPS && lap + k <= last; k++) {
    const then = conditionsOf(wetnessOn(w, lap + k));
    if (then === now) continue;
    const rank = ['dry', 'damp', 'wet', 'soaked'];
    const wetter = rank.indexOf(then) > rank.indexOf(now);
    const text = wetter
      ? now === 'dry'
        ? `Rain in about ${k - 1} laps`
        : `Rain heavier in about ${k - 1} laps`
      : then === 'dry'
        ? `Dry line in about ${k - 1} laps`
        : `Drying in about ${k - 1} laps`;
    return { text, sure: confidence(k - 1), trend: wetter ? 'wetter' : 'drier' };
  }
  return {
    text: now === 'dry' ? 'No rain on the radar' : 'Steady, no change on the radar',
    sure: null,
    trend: 'steady',
  };
}

/** Seconds a lap each tyre class would lose at the coming lap's wetness, on a dry lap of
 * `dryLap` s (for the engineer's numbers: "slicks are 6 s off, inters 4"). */
export function tyreCosts(
  model: RaceModel,
  lap: number,
  dryLap: number,
): { slick: number; inter: number; wet: number } | null {
  const weather = model.weather;
  if (!weather) return null;
  const w = wetnessOn(weather.wetness, lap + 1);
  return {
    slick: dryLap * wetPenalty(weather, 'MEDIUM', w),
    inter: dryLap * wetPenalty(weather, 'INTERMEDIATE', w),
    wet: dryLap * wetPenalty(weather, 'WET', w),
  };
}
