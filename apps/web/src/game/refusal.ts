// Drivers don't always do what the pit wall says (feedback spec D1). Each driver refuses a
// share of the wall's live calls (BOX, headset): their `ignores` rate in data/drivers.json,
// researched from their real team-radio history (high, medium or low attitude). A refused
// call is never applied or logged, so the server's replay of the call log is exactly the race
// the player saw. The roll is a hash of (seed, lap, call): the same call on the same lap
// always gets the same answer, so neither a refresh nor pressing again re-rolls it. The
// graded decision moments, and answers to the radio's quick calls, are always followed.

import type { CarState, Decision, Mood } from '@boxthislap/sim';

export type LiveCall = Extract<Decision, { kind: 'pit' } | { kind: 'mode' } | { kind: 'battle' }>;

/**
 * How the driver's mood scales his refusals (race engineer spec D4): a calm driver takes more
 * of the wall's calls, a furious one far fewer.
 */
export const MOOD_REFUSALS: Record<Mood, number> = {
  calm: 0.6,
  tense: 1,
  frustrated: 2,
  furious: 3.5,
};

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
  if (call.kind === 'pit') return `pit:${call.compound}`;
  if (call.kind === 'battle') return `battle:${call.move}`;
  return `mode:${call.key}:${call.value}`;
}

/** The driver's reason, when the call gives them one (the radio says it when they refuse). */
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
 * The driver's refusal of a live call, or null if they'll do it. `ignores` is the share (0-1)
 * of calls this driver refuses; `seed` is the day's seed and `lap` the last completed lap (the
 * call is made during the next one).
 */
export function refusal(
  seed: number,
  lap: number,
  call: LiveCall,
  car: CarState,
  ignores: number,
): string | null {
  if (roll(`${seed}|${lap}|${callKey(call)}`) >= ignores) return null;
  return (
    reason(call, car) ??
    (call.kind === 'pit'
      ? (REPLY.pit as string)
      : call.kind === 'battle'
        ? 'No. I’ll do it my way.'
        : (REPLY[`${call.key}:${call.value}`] ?? 'Negative.'))
  );
}

/** The radio's "copy" for a call the driver will make. */
export function acknowledge(call: LiveCall): string {
  if (call.kind === 'pit') return `Copy, box this lap for ${call.compound.toLowerCase()}s.`;
  if (call.kind === 'battle') return BATTLE_COPY[call.move];
  const mode = call.value === 'liftAndCoast' ? 'lift and coast' : call.value;
  return `Copy, ${mode} mode.`;
}

const BATTLE_COPY: Record<Extract<LiveCall, { kind: 'battle' }>['move'], string> = {
  'cover-inside': 'Copy, covering the inside.',
  'hold-outside': 'Copy, I’ll hold the outside.',
  'defend-hard': 'Copy. He’s not getting by.',
  'let-go': 'Copy… letting him through.',
  'dive-inside': 'Copy, going up the inside!',
  'round-outside': 'Copy, round the outside.',
  'wait-drs': 'Copy, I’ll sit in DRS.',
  'overtake-button': 'Copy, overtake button.',
};
