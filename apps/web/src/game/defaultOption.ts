// The option a moment takes when nobody answers it (the Eras decision timer running out). The
// wall's own "stay out" answers (autoStay, boxingAt) are in the sim (packages/sim/src/autoStay.ts).

import type { DecisionMoment, Modes, MomentOption } from '@laststint/sim';

/**
 * The option a moment takes when nobody answers it (eras spec §7, the decision timer): stay
 * out, or keep the current mode. That's the option that changes the least: one with no calls
 * at all (stay out, as the sim's `autoStay` and a retired car's moments take), else the one whose mode
 * calls are already in effect on the car (`modes`), fewest calls first. A stop always counts
 * as a change. Ties go to the earlier option; null only for a moment with no options.
 */
export function defaultOption(moment: DecisionMoment, modes?: Modes): MomentOption | null {
  const changes = (o: MomentOption) =>
    o.decisions.filter((d) => d.kind !== 'mode' || !modes || modes[d.key] !== d.value).length;
  let best: MomentOption | null = null;
  for (const o of moment.options) {
    if (
      !best ||
      changes(o) < changes(best) ||
      (changes(o) === changes(best) && o.decisions.length < best.decisions.length)
    )
      best = o;
  }
  return best;
}
