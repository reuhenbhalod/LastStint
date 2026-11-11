// The day boundary (spec B1) and generated names (spec B3).
import { describe, expect, it } from 'vitest';
import { providerOf } from '../src/adminPlayers.js';
import { isDate, isPlayable, isSubmittable, playableDates } from '../src/dates.js';
import { displayName } from '../src/names.js';

const at = (iso: string) => new Date(iso).getTime();

describe('day boundary', () => {
  it('a date is playable while it is today somewhere on Earth', () => {
    // 11:00 UTC on Oct 27: UTC-12 is on the 26th (23:00), UTC+14 on the 28th (01:00).
    expect(playableDates(at('2026-10-27T11:00:00Z'))).toEqual({
      first: '2026-10-26',
      last: '2026-10-28',
    });
    // 13:00 UTC: the 26th has ended everywhere.
    expect(isPlayable('2026-10-26', at('2026-10-27T13:00:00Z'))).toBe(false);
    expect(isPlayable('2026-10-29', at('2026-10-27T13:00:00Z'))).toBe(false);
  });

  it('a run finished just after midnight can still be submitted', () => {
    expect(isSubmittable('2026-10-26', at('2026-10-27T13:00:00Z'))).toBe(true);
    expect(isSubmittable('2026-10-26', at('2026-10-27T19:00:00Z'))).toBe(false);
  });

  it('validates calendar dates', () => {
    expect(isDate('2026-10-27')).toBe(true);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-1-5')).toBe(false);
    expect(isDate(20261027)).toBe(false);
  });
});

describe('leaderboard names', () => {
  it('are stable per player and vary between players', () => {
    const a = displayName('11111111-1111-4111-8111-111111111111');
    expect(displayName('11111111-1111-4111-8111-111111111111')).toBe(a);
    const names = new Set(Array.from({ length: 200 }, (_, i) => displayName(`id-${i}`)));
    expect(names.size).toBeGreaterThan(190);
  });
});

describe('admin players: sign-in provider', () => {
  it('reads the provider from the account key', () => {
    expect(providerOf('1234567890')).toBe('google');
    expect(providerOf('auth0|abc')).toBe('email');
    expect(providerOf('apple|xyz')).toBe('apple');
  });
});
