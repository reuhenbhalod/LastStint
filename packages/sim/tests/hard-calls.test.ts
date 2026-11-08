// Hard-call counter (eras build plan 1.5; eras spec §4).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { parseErasConfig } from '../src/eras/config.js';
import erasConfigJson from '../src/eras/eras-config.json';
import {
  type SideMoment,
  chooseUserSide,
  countHardCalls,
  fromSide,
  tallySide,
} from '../src/eras/hard-calls.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;

function moment(
  chances: Record<string, number>,
  realChance: number,
  verdict: SideMoment['verdict'] = 'keep',
): SideMoment {
  return { lap: 40, chances, realChance, verdict };
}

describe('tallySide', () => {
  const moments = [
    // Best two 4 points apart: a hard call; the real call gave up 30 points.
    moment({ a: 0.6, b: 0.56, c: 0.3 }, 0.3),
    // Exactly on the 5-point edge: still a hard call; the real call was the best.
    moment({ a: 0.5, b: 0.45, c: 0.1 }, 0.5),
    // 10 points apart: not a hard call; real call gave up 10.
    moment({ a: 0.7, b: 0.6, c: 0.2 }, 0.6),
    // Every option within 5 points: the moment finder drops it, so not a hard call, but its
    // real call still counts towards the chance given up (2 points).
    moment({ a: 0.9, b: 0.89, c: 0.88 }, 0.88, 'no-choice'),
  ];

  it('counts kept moments whose best two options are within the edge', () => {
    expect(tallySide(moments).hardCalls).toBe(2);
  });

  it('sums the chance every real call gave up against the best option, in points', () => {
    expect(tallySide(moments).gaveUp).toBeCloseTo(30 + 0 + 10 + 2, 9);
  });

  it('never counts a real call that beat every option as negative', () => {
    expect(tallySide([moment({ a: 0.5, b: 0.2 }, 0.6)]).gaveUp).toBe(0);
  });

  it('reads the edge from the config', () => {
    const wide = parseErasConfig({ ...erasConfigJson, hardCallEdge: 'orange' });
    expect(tallySide(moments, wide).hardCalls).toBe(3);
  });
});

describe('chooseUserSide', () => {
  it('picks the side with more hard calls, whatever the chance given up', () => {
    const r = chooseUserSide(
      { HAM: { hardCalls: 1, gaveUp: 90 }, VER: { hardCalls: 2, gaveUp: 0 } },
      'HAM',
    );
    expect(r).toEqual({ userSide: 'VER', decidedBy: 'hard-calls' });
  });

  it('breaks a tie towards the side whose real calls gave up the most chance', () => {
    const r = chooseUserSide(
      { HAM: { hardCalls: 2, gaveUp: 12 }, VER: { hardCalls: 2, gaveUp: 25.5 } },
      'HAM',
    );
    expect(r).toEqual({ userSide: 'VER', decidedBy: 'gave-up' });
  });

  it('keeps the race file side when both counts and chance given up tie', () => {
    const tallies = { HAM: { hardCalls: 0, gaveUp: 0 }, VER: { hardCalls: 0, gaveUp: 0 } };
    expect(chooseUserSide(tallies, 'VER')).toEqual({ userSide: 'VER', decidedBy: 'race-file' });
    expect(chooseUserSide(tallies, 'HAM')).toEqual({ userSide: 'HAM', decidedBy: 'race-file' });
  });

  it('rejects anything but two sides, and a fallback outside them', () => {
    expect(() => chooseUserSide({ HAM: { hardCalls: 1, gaveUp: 0 } }, 'HAM')).toThrow();
    const two = { HAM: { hardCalls: 1, gaveUp: 0 }, VER: { hardCalls: 1, gaveUp: 0 } };
    expect(() => chooseUserSide(two, 'BOT')).toThrow();
  });
});

describe('countHardCalls', () => {
  it('swaps userSide and rival to see the race from the rival side', () => {
    const ver = fromSide(abu, 'VER');
    expect([ver.userSide, ver.rival]).toEqual(['VER', 'HAM']);
    expect(fromSide(abu, 'HAM')).toBe(abu);
    expect(() => fromSide(abu, 'BOT')).toThrow();
  });

  it('counts Abu Dhabi 2021 from both sides, deterministically', () => {
    const r = countHardCalls(abu);
    expect(r.hardCalls).toEqual({ HAM: 1, VER: 2 });
    expect(r.userSide).toBe('VER');
    expect(r.decidedBy).toBe('hard-calls');
    expect(countHardCalls(abu)).toEqual(r);
  });
});
