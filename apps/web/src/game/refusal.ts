// Drivers don't always do what the pit wall says (feedback spec D1), and each has a fixed
// attitude (round 2, D3; data/drivers.ts). A BOX or headset call made during the race can be
// done, questioned ("are you sure?", and the wall confirms or drops it) or refused on the
// radio. A refused or dropped call is never applied or logged, so the server's replay of the
// call log is exactly the race the player saw. The roll is a hash of (seed, lap, call): the
// same call on the same lap always gets the same answer, so neither a refresh nor pressing
// again re-rolls it. The graded decision moments are always followed.

import type { CarState, Decision } from '@boxthislap/sim';
import type { Attitude } from '../data/drivers.js';

export type LiveCall = Extract<Decision, { kind: 'pit' } | { kind: 'mode' }>;

/** Chances by attitude: [without a reason, with one]. */
export const REFUSE: Record<Attitude, [number, number]> = {
  always: [0, 0],
  questions: [0.04, 0.08],
  sometimes: [0.25, 0.5],
};
/** A `questions` driver asks before doing these calls (refusals are rolled first). */
export const QUESTION: [number, number] = [0.25, 0.65];

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

/** Why the driver would push back on this call, as a refusal and as a question, or null. */
function reason(call: LiveCall, car: CarState): { no: string; ask: string } | null {
  if (call.kind === 'pit' && car.tyreAge < 6)
    return {
      no: 'Box? These tyres are brand new. I’m staying out.',
      ask: 'Box? These tyres are brand new. Are you sure?',
    };
  if (call.kind === 'mode' && call.key === 'pace' && call.value === 'push' && car.tyreAge > 25)
    return {
      no: 'I can’t push any harder. These tyres won’t take it.',
      ask: 'Push on these tyres? They won’t last. Confirm?',
    };
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

/** The calls a `questions` driver asks about, and how. */
const ASK: Record<string, string> = {
  pit: 'Box now? The tyres still feel okay. Are you sure?',
  'pace:push': 'Push now? That’ll eat the tyres. Confirm?',
  'pace:manage': 'Manage? He’ll close the gap. You sure?',
  'battle:attack': 'Attack here? It’s risky. Confirm?',
  'battle:defend': 'Defend? It costs us lap time. Sure?',
};

export type Response =
  | { kind: 'ok' }
  | { kind: 'refuse'; text: string }
  | { kind: 'question'; text: string };

/**
 * How the driver answers a live call. `seed` is the day's seed and `lap` the last completed
 * lap (the call is made during the next one). One roll decides: a refusal below the refusal
 * chance, a question (questions drivers only) below that plus the question chance.
 */
export function respond(
  seed: number,
  lap: number,
  call: LiveCall,
  car: CarState,
  attitude: Attitude,
): Response {
  const why = reason(call, car);
  const i = why ? 1 : 0;
  const r = roll(`${seed}|${lap}|${callKey(call)}`);
  const refuse = REFUSE[attitude][i];
  if (r < refuse) {
    const text =
      why?.no ??
      (call.kind === 'pit'
        ? (REPLY.pit as string)
        : (REPLY[`${call.key}:${call.value}`] ?? 'Negative.'));
    return { kind: 'refuse', text };
  }
  const key = call.kind === 'pit' ? 'pit' : `${call.key}:${call.value}`;
  const ask = why?.ask ?? ASK[key];
  if (attitude === 'questions' && ask && r < refuse + QUESTION[i]) {
    return { kind: 'question', text: ask };
  }
  return { kind: 'ok' };
}

/** The radio's "copy" for a call the driver will make. */
export function acknowledge(call: LiveCall): string {
  if (call.kind === 'pit') return `Copy, box this lap for ${call.compound.toLowerCase()}s.`;
  return `Copy, ${call.value} mode.`;
}
