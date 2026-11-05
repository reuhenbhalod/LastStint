import type { RaceModel } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { goalOf } from './goal.js';

const model = (user: string, rival: string, result: string[]) =>
  ({ userSide: user, rival, realResult: result }) as unknown as RaceModel;

describe('goalOf', () => {
  it('beat: the rival really finished ahead', () => {
    expect(goalOf(model('HAM', 'VER', ['VER', 'HAM']))).toMatchObject({
      kind: 'beat',
      short: 'Beat Verstappen',
    });
  });

  it('defend: the rival is the car that finished behind', () => {
    expect(goalOf(model('BOT', 'LEC', ['HAM', 'BOT', 'LEC']))).toMatchObject({
      kind: 'defend',
      place: 2,
      short: 'Hold P2 from Leclerc',
    });
  });
});
