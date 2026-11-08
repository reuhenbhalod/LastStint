// Pit-board prompts (eras spec §7, build plan 8.5): in Eras 1-2 team radio was limited, so a
// decision reads as a message on the pit board rather than a radio call. Presentation only:
// the same text, facts and options; the tag says where it comes from. The race's era id
// (`eras.eraId`) picks it, through raceRules.ts.

import { named, surname } from '../data/names.js';
import type { QuickCall } from '../game/quickCalls.js';

/** The class a call card adds in pit-board style. */
export const PIT_BOARD_CLASS = 'pit-board';
/** The board's lettering colour (the card's accent in pit-board style). */
export const BOARD_ACCENT = '#f2c94c';

/** A quick call's tag on the pit board: the board, and the battle or who's signalling. */
export function boardTag(call: QuickCall): string {
  if (call.kind === 'battle')
    return `Pit board · battle${call.other ? ` with ${surname(call.other)}` : ''}`;
  if (call.kind === 'trouble') return 'Pit board · trouble';
  if (call.from !== 'Engineer') return `Pit board · ${named(call.from)} signals`;
  return 'Pit board';
}
