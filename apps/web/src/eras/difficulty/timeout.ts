// The decision timer running out (eras spec §7): the wall takes the moment's default option
// (stay out, or keep the current mode; game/autoStay.ts `defaultOption`) and says so on the
// radio, so the call log shows why.

import type { DecisionMoment, Modes } from '@laststint/sim';
import { defaultOption } from '../../game/autoStay.js';
import type { Game } from '../../game/useGame.js';

/** Answer an unanswered moment with its default option. Returns the option taken, or null
 * for a moment with no options (nothing to take). */
export function takeDefault(
  game: Pick<Game, 'radio' | 'choose'>,
  moment: DecisionMoment,
  modes?: Modes,
): string | null {
  const o = defaultOption(moment, modes);
  if (!o) return null;
  game.radio(
    o.decisions.length === 0
      ? 'Out of time, no call from the wall. Staying out.'
      : 'Out of time, no call from the wall. No change.',
  );
  game.choose(o.id);
  return o.id;
}
