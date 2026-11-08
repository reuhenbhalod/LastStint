// Smart's wet-tyre rule (eras spec §7). A pure rule piece: no policy uses it until Smart is
// defined (policy.ts RIVAL_POLICY_GAPS). Mirrored by rival_policy.wet_crossover in the
// pipeline; tests/rival-policy.test.ts and pipeline/tests/test_rival_policy.py check both
// against the same vectors.

import { cleanLap } from '../sim.js';
import type { CarState, Compound, RaceModel } from '../types.js';
import { WET_TYRES, isWetTyre, wetnessOn } from '../weather.js';

/**
 * Smart's wet-tyre rule (eras spec §7, "switches to wet tyres at the sim's crossover lap"):
 * the wet tyre a car on slicks should switch to on `lap`, or null to stay on slicks. The
 * crossover is the first lap on which a fresh set of a wet tyre (inters, or full wets where
 * the race has them) has a faster model lap than the car's slicks as they are, at that lap's
 * wetness `w` (default: the race's real timeline). Model laps only, no pit loss: the lap-time
 * crossover. Ties keep the slicks; between two faster wet tyres the faster wins (inters on an
 * exact tie). Null in a dry race, on wet tyres already, or with no wet tyre in the model.
 * Mirrors rival_policy.wet_crossover.
 */
export function wetCrossover(
  model: RaceModel,
  car: CarState,
  lap: number,
  w: number = wetnessOn(model.weather?.wetness ?? [], lap),
): Compound | null {
  if (!model.weather || isWetTyre(car.compound)) return null;
  let best: Compound | null = null;
  let bestTime = cleanLap(model, car, lap, w);
  for (const wet of WET_TYRES) {
    if (!model.compounds[wet]) continue;
    const fresh = { ...car, compound: wet, tyreWear: 0, tyreAge: 0 };
    const t = cleanLap(model, fresh, lap, w);
    if (t < bestTime) {
      best = wet;
      bestTime = t;
    }
  }
  return best;
}
