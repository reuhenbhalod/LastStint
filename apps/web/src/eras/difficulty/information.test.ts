import { ERAS_CONFIG, INFORMATION_LEVELS } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import {
  FULL_INFORMATION,
  gapShown,
  gapText,
  informationView,
  intervalToYou,
  neighbours,
  shownGap,
  tyreAgeText,
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
      tyreAgeRange: null,
    });
  });

  it('Reduced drops the gap trend graph and shows other cars’ tyre ages as 5-lap ranges', () => {
    expect(informationView('reduced')).toEqual({
      ...FULL_INFORMATION,
      level: 'reduced',
      gapTrace: false,
      tyreAgeRange: 5,
    });
  });

  it('takes the range’s width from the eras config', () => {
    expect(informationView('reduced').tyreAgeRange).toBe(ERAS_CONFIG.tyreAgeRangeLaps);
  });

  it('each level hides everything the level above it hides (decided Nov 7)', () => {
    const hidden = (l: (typeof INFORMATION_LEVELS)[number]) => {
      const v = informationView(l);
      return [
        !v.gapTrace && 'trace',
        v.gapStep !== null && 'rounded',
        v.adjacentGapsOnly && 'adjacent',
        !v.liveStandings && 'per-lap',
        !v.rivalFuel && 'fuel',
        v.tyreAgeRange !== null && 'tyre-range',
      ].filter(Boolean);
    };
    for (let i = 1; i < INFORMATION_LEVELS.length; i++) {
      const above = hidden(INFORMATION_LEVELS[i - 1] as (typeof INFORMATION_LEVELS)[number]);
      const level = hidden(INFORMATION_LEVELS[i] as (typeof INFORMATION_LEVELS)[number]);
      for (const h of above) expect(level).toContain(h);
      expect(level.length).toBeGreaterThan(above.length);
    }
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

  it('shows tyre ages exact at Full and for your own car, else as 5-lap ranges', () => {
    expect(tyreAgeText(FULL_INFORMATION, 17, false)).toBe('17');
    for (const level of ['reduced', 'limited', 'minimal'] as const) {
      const v = informationView(level);
      expect(tyreAgeText(v, 17, true)).toBe('17');
      expect(tyreAgeText(v, 17, false)).toBe('15–20');
    }
    const reduced = informationView('reduced');
    expect(tyreAgeText(reduced, 0, false)).toBe('0–5');
    expect(tyreAgeText(reduced, 4, false)).toBe('0–5');
    expect(tyreAgeText(reduced, 5, false)).toBe('5–10');
    expect(tyreAgeText(reduced, 20, false)).toBe('20–25');
    expect(tyreAgeText(reduced, 39, false)).toBe('35–40');
    // Another width in the config, another range.
    expect(tyreAgeText({ ...reduced, tyreAgeRange: 3 }, 7, false)).toBe('6–9');
  });

  it('at Minimal, a standings row’s one interval: yours to the car ahead, behind’s to you', () => {
    const t: Record<string, number | null> = { VER: 0, HAM: 2, BOT: 3.7, PER: 4.6, NOR: null };
    const time = (c: string) => t[c] ?? null;
    expect(intervalToYou(order, 'BOT', 'BOT', time)).toBeCloseTo(1.7);
    expect(intervalToYou(order, 'BOT', 'PER', time)).toBeCloseTo(0.9);
    expect(intervalToYou(order, 'BOT', 'HAM', time)).toBeNull();
    expect(intervalToYou(order, 'BOT', 'VER', time)).toBeNull();
    // The leader has no car ahead; a car out of the race has no time.
    expect(intervalToYou(order, 'VER', 'VER', time)).toBeNull();
    expect(intervalToYou(order, 'VER', 'HAM', time)).toBe(2);
    expect(intervalToYou(order, 'PER', 'NOR', time)).toBeNull();
  });
});
