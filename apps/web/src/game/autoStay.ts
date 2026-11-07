// A stop moment when a stop is already booked, or just made (feedback round 2, pit fix 2): if
// the car has a BOX called and not yet made, or stopped in the last AUTO_STAY_LAPS laps, the
// wall isn't asked again. It stays out for you (a booked stop still happens as called).
// Derived from the call log alone (the calls made before the moment's pause), so the game and
// the results screen always agree.

import type { Decision, DecisionMoment } from '@laststint/sim';

export const AUTO_STAY_LAPS = 5;

/** The BOX calls made before `moment` paused the race (its own answer and later calls aren't). */
function stopsBefore(moment: DecisionMoment, decisions: Decision[]) {
  return decisions.filter(
    (d) => d.kind === 'pit' && (d.at ?? Number.NEGATIVE_INFINITY) < moment.lap - 1,
  );
}

/** The option the wall takes without asking ("stay out"), or null if the moment is asked. */
export function autoStay(moment: DecisionMoment, decisions: Decision[]): string | null {
  const stops = moment.options.some((o) => o.decisions.some((d) => d.kind === 'pit'));
  const stay = moment.options.find((o) => o.decisions.length === 0);
  if (!stops || !stay) return null;
  const recent = stopsBefore(moment, decisions).some((d) => d.lap >= moment.lap - AUTO_STAY_LAPS);
  return recent ? stay.id : null;
}

/** A stop is booked and not yet made when the moment pauses the race (its in-lap is the lap
 * just run, or one to come): "we're boxing". */
export function boxingAt(moment: DecisionMoment, decisions: Decision[]): boolean {
  return stopsBefore(moment, decisions).some((d) => d.lap >= moment.lap - 1);
}
