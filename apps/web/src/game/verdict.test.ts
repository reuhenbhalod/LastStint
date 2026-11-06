import { describe, expect, it } from 'vitest';
import { verdict } from './verdict.js';

describe('verdict', () => {
  it('beats the real team by finishing ahead of the real result', () => {
    const v = verdict(1, 2, 'Mercedes', 'HAM', 'VER', true);
    expect(v.outcome).toBe('beat');
    expect(v.headline).toBe('You beat Mercedes!');
    expect(v.detail).toBe(
      'Hamilton P1, ahead of Verstappen. The real Mercedes pit wall finished P2.',
    );
  });

  it('a defend race held is "you held P2"', () => {
    expect(verdict(2, 2, 'Mercedes', 'BOT', 'LEC', true, true).headline).toBe('You held P2!');
  });

  it('matches it on the same place', () => {
    expect(verdict(2, 2, 'Mercedes', 'HAM', 'VER', false).headline).toBe('You matched Mercedes');
    expect(verdict(1, 1, 'Red Bull Racing', 'VER', 'HAM', true).headline).toBe(
      'You matched Red Bull Racing: a win',
    );
  });

  it('says the real team did better when you finish behind it', () => {
    const v = verdict(3, 2, 'Mercedes', 'HAM', 'VER', false);
    expect(v.outcome).toBe('worse');
    expect(v.headline).toBe('Mercedes did better');
  });
});
