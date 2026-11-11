// The era's decision timer on the calls between the big moments (decided Nov 7; eras spec §7):
// in an Eras race, quick calls and battles wait on the era's timer (45/30/20 s), not their own
// short ones, and the race holds while a quick call waits (a battle already waits frozen at
// the braking zone). Out of time, the same outcome as no answer: the driver's own move, or no
// change. Outside Eras the cards keep their own timers and nothing here applies.

import type { ReactNode } from 'react';
import { DecisionTimer } from './DecisionTimer.js';
import type { ErasRace } from './erasRace.js';

/**
 * What a quick-call or battle card is given in Eras: the era's timer for the call (keyed by
 * the attempt and `key`, so its time left survives leaving the screen), or a null timer with
 * the player's timer setting off (the call waits). Undefined outside Eras: the card's own.
 */
export function erasCallTimer(
  eras: ErasRace | undefined,
  timed: boolean,
  key: string,
  onExpire: () => void,
): { timer: ReactNode } | undefined {
  if (!eras) return undefined;
  return {
    timer: timed ? (
      <DecisionTimer
        momentKey={`${eras.attemptId}:${key}`}
        seconds={eras.difficulty.decisionTimerSeconds}
        onExpire={onExpire}
      />
    ) : null,
  };
}

/** Whether the race holds for a quick call: in Eras, while one is up and the race is running. */
export function holdsForQuickCall(
  eras: ErasRace | undefined,
  quickUp: boolean,
  racing: boolean,
): boolean {
  return !!eras && quickUp && racing;
}
