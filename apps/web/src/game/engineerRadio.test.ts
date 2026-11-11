// The radio for a car fault, a storyline retirement and a team order: a line in team-radio
// eras, a pit-board sign (or the wall) in Eras 1-2.

import type { RaceNote, RaceState } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { engineerRadio } from './engineerRadio.js';

const race = {} as RaceState;
const radio = (notes: RaceNote[], board = false) =>
  engineerRadio(notes, 10, 'SEN', race, null, 1, board);

describe('fault, storyline and team-order radio', () => {
  it('tells each car fault', () => {
    const lines = (detail: string, board?: boolean) =>
      radio([{ lap: 10, kind: 'fault', driver: 'SEN', detail }], board);
    expect(lines('gear-stuck')).toEqual([
      { from: 'SEN', text: 'The gearbox is stuck in one gear! I’m losing loads.' },
    ]);
    expect(lines('power-loss')).toEqual([
      { from: 'SEN', text: 'I’ve lost power! Something’s up with the engine.' },
    ]);
    expect(lines('puncture')).toEqual([{ from: 'SEN', text: 'Puncture! The tyre’s going down.' }]);
    expect(lines('tyre-failure')).toEqual([
      { from: 'SEN', text: 'The tyre’s failed! I’m getting it back slowly.' },
    ]);
    expect(lines('gear-stuck', true)).toEqual([{ from: 'Pit board', text: 'SLOW · GEARBOX?' }]);
    expect(lines('power-loss', true)).toEqual([{ from: 'Pit board', text: 'SLOW · ENGINE?' }]);
    expect(lines('puncture', true)).toEqual([{ from: 'Pit board', text: 'SLOW · TYRE?' }]);
    expect(lines('tyre-failure', true)).toEqual([{ from: 'Pit board', text: 'SLOW · TYRE?' }]);
  });

  it('tells a storyline retirement, not an avoided one', () => {
    const note = (detail: string): RaceNote[] => [
      { lap: 10, kind: 'storyline', driver: 'SEN', detail },
    ];
    expect(radio(note('retired'))).toEqual([
      { from: 'SEN', text: 'That’s it, I’m out. The car’s finished.' },
    ]);
    expect(radio(note('retired'), true)).toEqual([
      { from: 'Pit wall', text: 'SEN has stopped. That’s our race.' },
    ]);
    expect(radio(note('avoided'))).toEqual([]);
    expect(radio(note('avoided'), true)).toEqual([]);
  });

  it('tells an empty fuel load as lifting, and a car stopped by an empty tank as stopped', () => {
    const empty: RaceNote = { lap: 10, kind: 'fuel', driver: 'SEN', detail: 'empty' };
    const out: RaceNote = { lap: 10, kind: 'fuel', driver: 'SEN', detail: 'out' };
    const lift = { from: 'SEN', text: 'I’m out of fuel! I have to lift everywhere now.' };
    const stopped = { from: 'SEN', text: 'I’m out of fuel! The car’s stopped.' };
    // A fuel load (the hybrid era): an empty tank costs lap time, the car goes on.
    expect(radio([empty])).toEqual([lift]);
    // A refuelling race's tank runs dry: the car stops ('out' alone).
    expect(radio([out])).toEqual([stopped]);
    // A 1984-88 fuel limit: 'empty' and 'out' on the same lap; only the stop is told.
    expect(radio([empty, out])).toEqual([stopped]);
    // Another car stopping does not silence the player's lift line.
    expect(radio([empty, { ...out, driver: 'BER' }])).toEqual([lift]);
    expect(radio([empty, out], true)).toEqual([
      { from: 'Pit wall', text: 'SEN has run out of fuel. That’s our race.' },
    ]);
  });

  it('tells a team order to the car let by and to the car yielding', () => {
    const letBy: RaceNote[] = [{ lap: 10, kind: 'team-order', driver: 'SEN', detail: 'BER' }];
    expect(radio(letBy)).toEqual([
      { from: 'Engineer', text: 'BER is letting you through. Take the place.' },
    ]);
    expect(radio(letBy, true)).toEqual([{ from: 'Pit board', text: 'BER LETS YOU BY' }]);
    const yields: RaceNote[] = [{ lap: 10, kind: 'team-order', driver: 'BER', detail: 'SEN' }];
    expect(radio(yields)).toEqual([
      { from: 'Engineer', text: 'Team orders: let BER by, then hold station.' },
    ]);
    expect(radio(yields, true)).toEqual([{ from: 'Pit board', text: 'LET BER BY' }]);
  });

  it('says nothing for other cars or other laps', () => {
    expect(
      radio([
        { lap: 10, kind: 'fault', driver: 'PRO', detail: 'gear-stuck' },
        { lap: 9, kind: 'fault', driver: 'SEN', detail: 'gear-stuck' },
        { lap: 10, kind: 'team-order', driver: 'BER', detail: 'MAN' },
        { lap: 9, kind: 'team-order', driver: 'BER', detail: 'SEN' },
      ]),
    ).toEqual([]);
  });
});
