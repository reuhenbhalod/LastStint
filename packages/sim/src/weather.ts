// Weather (docs/weather-spec.md): what a wet track costs each tyre, how it changes their wear,
// and the forecast a blind playout races under. The curves and the race's wetness timeline
// come from the race model (pipeline/wet.py fits them); the arithmetic here mirrors the
// Python reference sim (sim_reference.wet_penalty / weather_wear) for parity.

import { deriveSeed, mulberry32 } from './rng.js';
import type { Compound, Weather } from './types.js';

export const WET_TYRES: readonly Compound[] = ['INTERMEDIATE', 'WET'];
/** A grader fork's weather stream (separate from every other draw). */
export const WEATHER_STREAM = 9000;

export const isWetTyre = (compound: Compound) => WET_TYRES.includes(compound);

/** The share of a dry lap a tyre loses at wetness w. */
export function wetPenalty(weather: Weather, compound: Compound, w: number): number {
  if (compound === 'INTERMEDIATE' || compound === 'WET') {
    const c = compound === 'INTERMEDIATE' ? weather.curves.inter : weather.curves.wet;
    return c.min + c.dry * Math.max(0, c.best - w) + c.wet * Math.max(0, w - c.best);
  }
  if (w <= 0) return 0;
  const c = weather.curves.slick;
  return c.a * w + c.b * w * w;
}

/** Wetness below this is damp: a car's dampPace applies there (pipeline wet.DAMP_EDGE). */
export const DAMP_EDGE = 0.15;

/**
 * A dry lap's time is multiplied by this: the tyre's penalty and the driver's wet pace
 * (`dampPace`, an Eras build's, under DAMP_EDGE; sim_reference.driver_wet).
 */
export function wetFactor(
  weather: Weather | undefined,
  compound: Compound,
  w: number,
  wetPace = 0,
  dampPace?: number,
): number {
  if (!weather) return 1;
  const pace = dampPace !== undefined && w < DAMP_EDGE ? dampPace : wetPace;
  return 1 + wetPenalty(weather, compound, w) + pace * Math.min(1, w / 0.1);
}

/**
 * Tyre wear on a lap at wetness w, against a dry lap: slicks barely wear on a wet track;
 * inters and wets overheat and wear fast on a drying one (estimates; wet.wear_mult).
 */
export function weatherWear(weather: Weather | undefined, compound: Compound, w: number): number {
  if (!weather) return 1;
  if (compound === 'INTERMEDIATE' || compound === 'WET') {
    const edge = compound === 'INTERMEDIATE' ? 0.15 : 0.3;
    return 1 + 2 * Math.max(0, (edge - w) / edge);
  }
  return 1 - 0.8 * Math.min(1, w / 0.05);
}

/** The wetness on `lap` of a timeline (0 in a dry race; the last lap's past its end). */
export function wetnessOn(wetness: readonly number[], lap: number): number {
  if (!wetness.length) return 0;
  return wetness[Math.min(wetness.length, Math.max(1, lap)) - 1] as number;
}

/**
 * The weather a blind playout races under after lap `from` (weather spec W3, the radar
 * forecast): the real timeline, shifted by a lap or two and 20% stronger or weaker, drawn
 * per playout. Fair at short range, rougher further out; the laps up to `from` + 1 are known.
 */
export function forecastWetness(wetness: readonly number[], from: number, seed: number): number[] {
  if (!wetness.length) return [];
  const rng = mulberry32(deriveSeed(seed, WEATHER_STREAM));
  const shift = Math.round(rng.normal(1.5));
  const scale = Math.max(0.5, 1 + rng.normal(0.2));
  return wetness.map((w, i) => {
    const lap = i + 1;
    if (lap <= from + 1) return w;
    const src = wetnessOn(wetness, lap + shift);
    return Math.min(1, Math.max(0, Math.round(src * scale * 100) / 100));
  });
}

/**
 * Crash risk on a wet track, against a dry lap: a little more for everyone, and a lot more
 * on slicks as they lose grip (estimates, no evidence to fit; live play only).
 */
export function wetCrash(weather: Weather | undefined, compound: Compound, w: number): number {
  if (!weather || w <= 0) return 1;
  const slick = isWetTyre(compound) ? 0 : wetPenalty(weather, compound, w);
  return 1 + 3 * w + 40 * slick;
}

/** The player's car on slicks in the wet: a slide off and back on costs this (s). */
export const WET_OFF_COST = 10;
/** Its random stream (per car; only drawn in a wet race). */
export const WET_OFF_STREAM = 9500;

/**
 * The chance a lap that the player's car slides off on slicks in the wet (live play only:
 * the field's real laps already have their own slides in them). Rises with the grip the slicks
 * have lost: one lap in three at 20% off the pace. Estimates.
 */
export function wetOff(weather: Weather | undefined, compound: Compound, w: number): number {
  if (!weather || isWetTyre(compound) || w <= 0) return 0;
  return Math.min(0.5, 1.5 * wetPenalty(weather, compound, w));
}
