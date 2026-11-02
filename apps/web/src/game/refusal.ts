// Drivers don't always do what the pit wall says (feedback spec D1). A BOX or headset call made
// during the race can be refused on the radio; a refused call is never applied or logged, so
// the server's replay of the call log is exactly the race the player saw. The roll is a hash
// of (seed, lap, call): the same call on the same lap always gets the same answer, so neither
// a refresh nor pressing again re-rolls it. The graded decision moments are always followed.

import type { CarState, Decision } from '@boxthislap/sim';

export type LiveCall = Extract<Decision, { kind: 'pit' } | { kind: 'mode' }>;

/** Base chance a call is refused, and the higher chance when the driver has a reason. */
export const REFUSE_BASE = 0.125;
export const REFUSE_REASON = 0.35;

/** FNV-1a over the text, mapped to [0, 1). */
export function roll(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

function callKey(call: LiveCall): string {
  return call.kind === 'pit' ? `pit:${call.compound}` : `mode:${call.key}:${call.value}`;
}

/** Why the driver would push back on this call (raises the chance), or null. */
function reason(call: LiveCall, car: CarState): string | null {
  if (call.kind === 'pit' && car.tyreAge < 6)
    return 'Box? These tyres are brand new. I’m staying out.';
  if (call.kind === 'mode' && call.key === 'pace' && call.value === 'push' && car.tyreAge > 25)
    return 'I can’t push any harder. These tyres won’t take it.';
  return null;
}

const REPLY: Record<string, string> = {
  pit: 'Negative, the tyres feel good. Staying out.',
  'pace:push': 'Not yet. I’m saving the tyres for the end.',
  'pace:standard': 'No, I’ll run my own pace.',
  'pace:manage': 'No way. I’m not giving up the gap.',
  'battle:attack': 'Not here. I’ll pick my moment.',
  'battle:hold': 'Negative, I’m racing.',
  'battle:defend': 'I’m not defending, I’m going for it.',
};

/**
 * The driver's refusal for a live call, or null if they'll do it. `seed` is the day's seed and
 * `lap` the last completed lap (the call is made during the next one).
 */
export function refusal(seed: number, lap: number, call: LiveCall, car: CarState): string | null {
  const why = reason(call, car);
  const chance = why ? REFUSE_REASON : REFUSE_BASE;
  if (roll(`${seed}|${lap}|${callKey(call)}`) >= chance) return null;
  if (why) return why;
  return call.kind === 'pit'
    ? (REPLY.pit as string)
    : (REPLY[`${call.key}:${call.value}`] ?? 'Negative.');
}

/** The radio's "copy" for a call the driver will make. */
export function acknowledge(call: LiveCall): string {
  if (call.kind === 'pit') return `Copy, box this lap for ${call.compound.toLowerCase()}s.`;
  return `Copy, ${call.value} mode.`;
}
