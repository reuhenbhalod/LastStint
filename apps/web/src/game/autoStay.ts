// A stop moment right after a stop (feedback round 2): if the car stopped, or has a stop
// booked, in the last AUTO_STAY_LAPS laps, the wall isn't asked again. It stays out for you.
// Derived from the call log alone, so the game and the results screen always agree.

import type { Decision, DecisionMoment } from '@boxthislap/sim';

export const AUTO_STAY_LAPS = 3;

/** The option the wall takes without asking ("stay out"), or null if the moment is asked. */
export function autoStay(moment: DecisionMoment, decisions: Decision[]): string | null {
  const stops = moment.options.some((o) => o.decisions.some((d) => d.kind === 'pit'));
  const stay = moment.options.find((o) => o.decisions.length === 0);
  if (!stops || !stay) return null;
  const recent = decisions.some(
    (d) => d.kind === 'pit' && d.lap < moment.lap && d.lap >= moment.lap - AUTO_STAY_LAPS,
  );
  return recent ? stay.id : null;
}
