import { describe, expect, it } from 'vitest';
import {
  FULL_INFORMATION,
  gapShown,
  gapText,
  informationView,
  neighbours,
  shownGap,
} from './information.js';

const order = ['VER', 'HAM', 'BOT', 'PER', 'NOR'];

describe('information levels (eras spec §7)', () => {
  it('no level is Full: everything shown, exact', () => {
    expect(informationView()).toBe(FULL_INFORMATION);
    expect(informationView('full')).toEqual({
      level: 'full',
      gapTrace: true,
      gapStep: null,
      adjacentGapsOnly: false,
      liveStandings: true,
      rivalFuel: true,
    });
  });

  it('Reduced drops the gap trend graph and nothing else built here', () => {
    expect(informationView('reduced')).toEqual({
      ...FULL_INFORMATION,
      level: 'reduced',
      gapTrace: false,
    });
  });

  it('Limited is Reduced plus gaps to 0.5 s and the rival’s fuel hidden', () => {
    expect(informationView('limited')).toEqual({
      ...informationView('reduced'),
      level: 'limited',
      gapStep: 0.5,
      rivalFuel: false,
    });
  });

  it('Minimal is Limited plus adjacent gaps only, once per lap', () => {
    expect(informationView('minimal')).toEqual({
      ...informationView('limited'),
      level: 'minimal',
      adjacentGapsOnly: true,
      liveStandings: false,
    });
  });

  it('rounds gaps to 0.5 s at Limited and Minimal, exact above', () => {
    expect(shownGap(FULL_INFORMATION, 1.73)).toBe(1.73);
    expect(shownGap(informationView('reduced'), 1.73)).toBe(1.73);
    expect(shownGap(informationView('limited'), 1.73)).toBe(1.5);
    expect(shownGap(informationView('limited'), 1.76)).toBe(2);
    expect(shownGap(informationView('minimal'), -3.3)).toBe(-3.5);
  });

  it('writes gaps as the race screen always has at Full', () => {
    expect(gapText(FULL_INFORMATION, 1.73)).toBe('+1.7s');
    expect(gapText(FULL_INFORMATION, -0.25, false)).toBe('−0.3');
    expect(gapText(FULL_INFORMATION, null)).toBe('-');
    expect(gapText(informationView('limited'), -1.2)).toBe('−1.0s');
  });

  it('finds the cars either side, and shows only their gaps at Minimal', () => {
    expect(neighbours(order, 'BOT')).toEqual({ ahead: 'HAM', behind: 'PER' });
    expect(neighbours(order, 'VER')).toEqual({ ahead: null, behind: 'HAM' });
    expect(neighbours(order, 'XXX')).toEqual({ ahead: null, behind: null });
    const minimal = informationView('minimal');
    expect(gapShown(minimal, order, 'BOT', 'HAM')).toBe(true);
    expect(gapShown(minimal, order, 'BOT', 'PER')).toBe(true);
    expect(gapShown(minimal, order, 'BOT', 'VER')).toBe(false);
    expect(gapShown(informationView('limited'), order, 'BOT', 'VER')).toBe(true);
  });
});
