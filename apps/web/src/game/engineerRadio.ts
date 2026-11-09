// What the radio says when the race engineer side of the race moves (race engineer spec): the
// battle's outcome, contact, track limits, a new nose, a lapped car, and the driver's trust in
// the wall going up or down. The driver's tone follows his mood: a calm driver says "good call",
// a furious one asks whether anyone on the wall is watching.

import type { EngineerConfig, Mood, RaceNote, RaceState, TrustReason } from '@laststint/sim';
import { moodOf } from '@laststint/sim';
import { driverInfo } from '../data/drivers.js';

export interface RadioLine {
  from: string;
  text: string;
}

const angry = (m: Mood) => m === 'frustrated' || m === 'furious';

/** The driver's reaction when his trust moves, by why and how he feels now. */
const TRUST_LINES: Record<TrustReason, [calm: string, angry: string] | null> = {
  'pass-called': ['Yes! Got him. Good call.', 'Done. About time something worked.'],
  'pass-failed': ['Couldn’t make it stick.', 'There was nothing there! Why send me?'],
  'held-called': ['Held him. Keep the info coming.', 'Held him, no thanks to that call.'],
  'passed-anyway': [
    'He’s through. That line didn’t work.',
    'He just drove past! What was that call?!',
  ],
  'let-rival-go': [
    'You told me to let him go? That’s the race!',
    'You told me to LET HIM GO?! Unbelievable!',
  ],
  'let-car-go': [
    'Letting him by? OK… if you say so.',
    'Another one waved past! Whose side are you on?',
  ],
  contact: [
    'Contact! We touched. That was a risky call.',
    'You sent me into him! Are you even watching?!',
  ],
  undercut: ['Yes! We’re ahead of him. Great strategy.', 'OK. That one worked.'],
  'stop-lost': ['We came out behind him. What happened?', 'Behind him again! Who made that call?!'],
  micromanaging: ['Too much talking. Let me drive.', 'Stop talking to me! Let me drive!'],
  'request-yes': ['Copy, thanks.', 'Finally.'],
  'request-wrong': ['I told you the tyres were gone.', 'I TOLD you! The tyres were gone!'],
  'request-right': ['OK, you were right. Tyres are holding.', 'Fine. You were right.'],
  penalty: ['A penalty? Ugh, sorry guys.', 'A penalty?! This race is a joke.'],
  strike: null,
  settled: null,
};

/** The driver's call when a car fault strikes (faults.ts kinds), and the pit board's sign. */
const FAULT_LINES: Record<string, [radio: string, board: string]> = {
  'gear-stuck': ['The gearbox is stuck in one gear! I’m losing loads.', 'SLOW · GEARBOX?'],
  'power-loss': ['I’ve lost power! Something’s up with the engine.', 'SLOW · ENGINE?'],
  puncture: ['Puncture! The tyre’s going down.', 'SLOW · TYRE?'],
  'tyre-failure': ['The tyre’s failed! I’m getting it back slowly.', 'SLOW · TYRE?'],
};

/** Race control's name for a car ("Car 44 (HAM)"). */
function car(code: string): string {
  const n = driverInfo(code)?.number;
  return n ? `Car ${n} (${code})` : code;
}

/**
 * The radio for the engineer notes of one lap. `cfg` gives the moods; `race` the state after
 * the lap (the driver's mood now). `board`: Eras 1-2, where team radio was limited, so the
 * wall's word on a fault or a team order is a pit-board sign (eras/PitBoard.ts).
 */
export function engineerRadio(
  notes: RaceNote[],
  lap: number,
  side: string,
  race: RaceState,
  cfg: EngineerConfig | null,
  corner: number,
  board = false,
): RadioLine[] {
  const out: RadioLine[] = [];
  const mood: Mood = race.engineer && cfg ? moodOf(cfg, race.engineer.trust) : 'calm';
  const trustOf = new Set(
    notes.filter((n) => n.lap === lap && n.kind === 'trust').map((n) => n.detail),
  );
  for (const n of notes) {
    if (n.lap !== lap) continue;
    // A team order names the car let by; the player's car may be the one told to yield.
    if (n.kind === 'team-order' && n.detail === side) {
      out.push(
        board
          ? { from: 'Pit board', text: `LET ${n.driver} BY` }
          : { from: 'Engineer', text: `Team orders: let ${n.driver} by, then hold station.` },
      );
      continue;
    }
    if (n.driver !== side) continue;
    switch (n.kind) {
      case 'battle':
        // A called move's outcome is told by the trust line; the driver's own moves here.
        if (
          trustOf.has('pass-called') ||
          trustOf.has('pass-failed') ||
          trustOf.has('held-called') ||
          trustOf.has('passed-anyway') ||
          trustOf.has('let-rival-go') ||
          trustOf.has('let-car-go')
        )
          break;
        if (n.detail === 'passed') out.push({ from: side, text: `Past ${n.other}!` });
        if (n.detail === 'lost') out.push({ from: side, text: `${n.other} got me.` });
        if (n.detail === 'held')
          out.push({ from: 'Engineer', text: `Good defending. ${n.other} is still behind.` });
        break;
      case 'contact':
        if (n.detail === 'wing')
          out.push({ from: side, text: `Contact with ${n.other ?? 'him'}! Front wing’s damaged.` });
        else if (n.detail === 'puncture')
          out.push({ from: side, text: 'He’s hit me! Puncture! Coming in.' });
        else out.push({ from: side, text: 'I’ve spun! I’ve spun! Going again.' });
        break;
      case 'strike':
        out.push({
          from: 'Race control',
          text:
            n.value === 3
              ? `${car(side)}: black and white flag, track limits at Turn ${corner}.`
              : `${car(side)}: track limits, lap time deleted (strike ${n.value}).`,
        });
        break;
      case 'penalty':
        out.push({
          from: 'Race control',
          text: `${car(side)}: ${n.value}-second time penalty for track limits.`,
        });
        break;
      case 'nose':
        out.push({ from: 'Engineer', text: 'New nose on. The pace should be back.' });
        break;
      case 'fuel':
        out.push({ from: side, text: 'I’m out of fuel! I have to lift everywhere now.' });
        break;
      case 'blue':
        out.push({ from: side, text: `Past ${n.other}. Finally.` });
        break;
      case 'rogue':
        out.push({
          from: side,
          text:
            n.detail === 'dive-inside'
              ? 'I’m going for it. I’m doing this my way.'
              : 'I’m defending my way. Stop telling me what to do.',
        });
        break;
      case 'fault': {
        const lines = FAULT_LINES[n.detail ?? ''] ?? [
          'Something’s wrong with the car!',
          'SLOW · PROBLEM?',
        ];
        out.push(board ? { from: 'Pit board', text: lines[1] } : { from: side, text: lines[0] });
        break;
      }
      case 'storyline':
        // Only a retirement is told; an avoided one is a race that simply goes on.
        if (n.detail !== 'retired') break;
        out.push(
          board
            ? { from: 'Pit wall', text: `${side} has stopped. That’s our race.` }
            : { from: side, text: 'That’s it, I’m out. The car’s finished.' },
        );
        break;
      case 'team-order':
        out.push(
          board
            ? { from: 'Pit board', text: `${n.detail} LETS YOU BY` }
            : { from: 'Engineer', text: `${n.detail} is letting you through. Take the place.` },
        );
        break;
      case 'trust': {
        if (n.detail === 'settled') {
          out.push({ from: 'Engineer', text: `${side} has calmed down a bit.` });
          break;
        }
        const lines = TRUST_LINES[n.detail as TrustReason];
        if (lines) out.push({ from: side, text: angry(mood) ? lines[1] : lines[0] });
        break;
      }
    }
  }
  return out;
}

/** The driver's radio after the flag, by mood and whether he beat the rival. */
export function postRaceRadio(mood: Mood | null, won: boolean, side: string): string {
  if (!mood) return won ? 'Yes! Great job, guys!' : 'We gave it everything.';
  if (won) {
    return mood === 'calm'
      ? 'YES! What a race! Great calls all afternoon, thank you!'
      : mood === 'tense'
        ? 'We did it. Some calls I didn’t like, but we did it.'
        : mood === 'frustrated'
          ? 'We won. No thanks to some of those calls. We need to talk.'
          : `We won in spite of the wall. ${side} out.`;
  }
  return mood === 'calm'
    ? 'Not our day. But the calls were good, we’ll get them next time.'
    : mood === 'tense'
      ? 'Disappointing. We need to look at a few of those calls.'
      : mood === 'frustrated'
        ? 'That was a mess. Too many wrong calls today.'
        : 'Don’t talk to me. That was a disaster.';
}
