// The two-compound rule and wet tyres: a car on intermediates or wets at the takeover has run
// a wet tyre, which waives the rule after it switches to one dry compound. canada-2024 (a Daily
// race) lists dry tyres only in stateAtTakeover.compoundsUsed, so the sim adds the takeover tyre
// (takeoverCompoundsUsed); the race file is left as it is.

import { describe, expect, it } from 'vitest';
import canadaJson from '../../../data/races/canada-2024.json';
import franceJson from '../../../data/races/france-2019.json';
import { playDailyRace } from '../examples/daily-race.js';
import {
  initRun,
  realDecisions,
  ruleSatisfied,
  simulate,
  takeoverCompoundsUsed,
} from '../src/sim.js';
import type { CarState, Decision, RaceModel } from '../src/types.js';
import { verifyRun } from '../src/verify.js';

const canada = canadaJson as unknown as RaceModel;
const france = franceJson as unknown as RaceModel;
const SEEDS = [canada.race.seed, ...Array.from({ length: 12 }, (_, i) => i + 1)];
const isWet = (c: string) => c === 'INTERMEDIATE' || c === 'WET';

/** The decisions of the given option at each moment (the real one where none is given). */
function calls(model: RaceModel, pick: Record<string, string> = {}): Decision[] {
  return model.decisionMoments.flatMap((m) => {
    const id = pick[m.id] ?? m.realOptionId;
    return m.options.find((o) => o.id === id)?.decisions ?? [];
  });
}

describe('takeoverCompoundsUsed', () => {
  const state = { position: 1, gapAhead: 0, tyreAge: 3 };

  it('adds the tyre the car is on at the takeover', () => {
    expect(
      takeoverCompoundsUsed({ ...state, compound: 'INTERMEDIATE', compoundsUsed: [] }),
    ).toEqual(['INTERMEDIATE']);
    expect(
      takeoverCompoundsUsed({ ...state, compound: 'INTERMEDIATE', compoundsUsed: ['SOFT'] }),
    ).toEqual(['SOFT', 'INTERMEDIATE']);
  });

  it('leaves a dry car as the file has it', () => {
    for (const d of france.drivers) {
      expect(takeoverCompoundsUsed(d.stateAtTakeover)).toEqual(d.stateAtTakeover.compoundsUsed);
    }
  });

  it('starts every canada-2024 car on wet tyres with them in compoundsUsed', () => {
    const run = initRun(canada, canada.race.seed, { decisions: realDecisions(canada) });
    const wet = canada.drivers.filter((d) => isWet(d.stateAtTakeover.compound));
    expect(wet.length).toBeGreaterThan(0);
    for (const d of wet) {
      expect(run.state.cars[d.code]?.compoundsUsed).toContain(d.stateAtTakeover.compound);
    }
  });
});

describe('ruleSatisfied with wet tyres', () => {
  const car = (compound: string, compoundsUsed: string[]) =>
    ({ compound, compoundsUsed }) as unknown as CarState;

  it('a wet tyre run earlier waives the rule after the switch to slicks', () => {
    expect(ruleSatisfied(car('MEDIUM', ['INTERMEDIATE', 'MEDIUM']))).toBe(true);
    expect(ruleSatisfied(car('SOFT', ['WET', 'SOFT']))).toBe(true);
  });

  it('a dry car still needs two dry compounds', () => {
    expect(ruleSatisfied(car('MEDIUM', ['MEDIUM']))).toBe(false);
    expect(ruleSatisfied(car('HARD', ['MEDIUM', 'HARD']))).toBe(true);
  });
});

describe('live play: canada-2024 is never disqualified on its real calls', () => {
  const plays: Record<string, Decision[]> = {
    'the real strategy': realDecisions(canada),
    'the real calls at the moments': calls(canada),
    // Stays out on the takeover intermediates, then the real switch to mediums: one dry
    // compound after a wet tyre (disqualified before the fix).
    'stay out at lap 26, then mediums': calls(canada, { 'stop-26': 'stay' }),
    'stay out at lap 26, then hards': calls(canada, { 'stop-26': 'stay', 'stop-47': 'box-hard' }),
  };
  for (const [name, decisions] of Object.entries(plays)) {
    for (const incidents of [false, true]) {
      it(`${name}, incidents ${incidents ? 'on' : 'off'}`, () => {
        const wet = canada.drivers
          .filter((d) => isWet(d.stateAtTakeover.compound))
          .map((d) => d.code);
        for (const seed of SEEDS) {
          const result = simulate(canada, seed, { decisions, incidents });
          expect(result.disqualified, `seed ${seed}`).not.toContain(canada.userSide);
          // No rival that took over on intermediates is disqualified by the rule either.
          expect(
            result.disqualified.filter((c) => wet.includes(c)),
            `seed ${seed}`,
          ).toEqual([]);
        }
      });
    }
  }
});

describe('live play: a dry race still enforces the rule', () => {
  it('disqualifies a player who never runs a second dry compound', () => {
    const user = france.drivers.find((d) => d.code === france.userSide);
    expect(user?.stateAtTakeover.compoundsUsed).toEqual(['MEDIUM']);
    for (const incidents of [false, true]) {
      for (const seed of [france.race.seed, 1, 2]) {
        const result = simulate(france, seed, { decisions: [], incidents });
        expect(result.disqualified, `seed ${seed}`).toContain(france.userSide);
        const last = result.order.slice(result.order.length - result.disqualified.length);
        expect(last).toContain(france.userSide);
      }
    }
  });

  it('a stop for the second dry compound is legal', () => {
    const result = simulate(france, france.race.seed, {
      decisions: [{ lap: 30, kind: 'pit', compound: 'HARD' }],
      incidents: false,
    });
    expect(result.disqualified).not.toContain(france.userSide);
  });
});

describe('server verification: a canada-2024 Daily run on the real calls finishes', () => {
  // POST /api/runs and the nightly re-verify rebuild the run with verifyRun on the daily seed.
  // The pace moments have no real call: standard pace.
  const SAMPLES = 40;
  for (const [name, pick] of Object.entries({
    'the real calls': {},
    'stay out at lap 26, then mediums': { 'stop-26': 'stay' },
  } as Record<string, Record<string, string>>)) {
    it(name, () => {
      const seed = canada.race.seed;
      const played = playDailyRace(
        canada,
        seed,
        (m) => pick[m.id] ?? m.realOptionId ?? 'standard',
        {
          samples: SAMPLES,
        },
      );
      expect(played.result.disqualified).not.toContain(canada.userSide);
      const verified = verifyRun(canada, seed, played.decisions, SAMPLES);
      expect(verified.disqualified).toBe(false);
      expect(verified.finishPosition).toBe(played.result.order.indexOf(canada.userSide) + 1);
      expect(verified.score).toEqual(played.score);
    });
  }
});
