import { versusTrack } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, lapEdge, parseSetup } from './setup.js';

describe('parseSetup', () => {
  it('reads a stored car and tyre', () => {
    expect(parseSetup('{"car":"bullet","tyre":"SOFT"}')).toEqual({ car: 'bullet', tyre: 'SOFT' });
  });
  it('falls back to the default for nothing stored, bad JSON or unknown picks', () => {
    expect(parseSetup(null)).toEqual(DEFAULT_SETUP);
    expect(parseSetup('{oops')).toEqual(DEFAULT_SETUP);
    expect(parseSetup('{"car":"rocket","tyre":"WET"}')).toEqual(DEFAULT_SETUP);
    expect(parseSetup('{"car":"glider","tyre":"WET"}')).toEqual({ car: 'glider', tyre: 'MEDIUM' });
  });
});

describe('lapEdge', () => {
  it('says a Balanced car matches Balanced, and Bullet gains where top speed pays', () => {
    const monza = versusTrack('monza');
    expect(lapEdge(monza, { topSpeed: 0, cornering: 0 })).toBe('same pace as Balanced');
    expect(lapEdge(monza, { topSpeed: 2, cornering: -1 })).toMatch(/quicker than Balanced$/);
  });
});
