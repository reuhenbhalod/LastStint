// A stop moment the wall answers for you (feedback round 2 pit fix 2; round 3, docs/feedback-
// round-3-spec.md R1). The moments are authored on the real race, so a player who stopped earlier
// than the real team can meet a question whose premise is gone ("our tyres are dropping off" on
// a 7-lap-old set). The wall stays out without asking when:
//   - a stop is booked and not yet made, or one was made in the last few laps: 5 laps (8 for a
//     safety car or VSC: a cheap stop can still pay on 10-lap-old tyres, not on fresher ones);
//   - a tyre moment (trigger 'cliff') comes after a stop of yours, and the tyres you fitted are
//     neither near their drop-off nor short of the flag.
// Derived from the model and the call log alone (the calls made before the moment's pause), so
// the game, the results screen and the server's score always agree. An answer the wall gave
// isn't scored (verifyRun).

import type { DecisionMoment } from './moments.js';
import { lifeOf } from './sim.js';
import type { Decision, RaceModel } from './types.js';

export const AUTO_STAY_LAPS = 5;
/** A safety car or VSC moment: a fresh-ish set can still be worth a cheap stop past this. */
export const AUTO_STAY_LAPS_NEUTRAL = 8;
/** A tyre moment is asked when the fitted set is within this many laps of its drop-off. */
export const NEAR_DROP_OFF = 5;

type PitCall = Extract<Decision, { kind: 'pit' }>;

/** The BOX calls made before `moment` paused the race (its own answer and later calls aren't). */
function stopsBefore(moment: DecisionMoment, decisions: Decision[]): PitCall[] {
  return decisions.filter(
    (d): d is PitCall => d.kind === 'pit' && (d.at ?? Number.NEGATIVE_INFINITY) < moment.lap - 1,
  );
}

/** The option the wall takes without asking ("stay out"), or null if the moment is asked. */
export function autoStay(
  model: RaceModel,
  moment: DecisionMoment,
  decisions: Decision[],
): string | null {
  const stops = moment.options.some((o) => o.decisions.some((d) => d.kind === 'pit'));
  const stay = moment.options.find((o) => o.decisions.length === 0);
  if (!stops || !stay) return null;
  const made = stopsBefore(moment, decisions);
  const neutral = moment.trigger === 'SC' || moment.trigger === 'VSC';
  const window = neutral ? AUTO_STAY_LAPS_NEUTRAL : AUTO_STAY_LAPS;
  if (made.some((d) => d.lap >= moment.lap - window)) return stay.id;
  // A tyre moment after your own stop: asked only if that set is wearing out.
  const last = made.reduce<PitCall | null>((a, d) => (!a || d.lap > a.lap ? d : a), null);
  if (moment.trigger === 'cliff' && last) {
    const age = moment.lap - 1 - last.lap; // laps on the set when the race pauses
    const left = model.race.laps - (moment.lap - 1);
    const life = lifeOf(model, last.compound);
    const wearing = age >= life - NEAR_DROP_OFF || age + left > life;
    if (!wearing) return stay.id;
  }
  return null;
}

/** A stop is booked and not yet made when the moment pauses the race (its in-lap is the lap
 * just run, or one to come): "we're boxing". */
export function boxingAt(moment: DecisionMoment, decisions: Decision[]): boolean {
  return stopsBefore(moment, decisions).some((d) => d.lap >= moment.lap - 1);
}
