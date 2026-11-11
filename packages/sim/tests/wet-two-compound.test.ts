// The two-compound rule and wet tyres: a car that has run intermediates or wets at any point
// (before the takeover, on them at the takeover, or after) is free of the rule, so the real
// calls of a car that takes over on intermediates and switches to one dry compound are legal.
// stateAtTakeover.compoundsUsed lists wet tyres (pipeline scenario.state_at_takeover); a file
// built before that lists dry ones only (canada-2024, a Daily race left as it is), so the sim
// adds the takeover tyre (takeoverCompoundsUsed).

import { describe, expect, it } from 'vitest';
import canadaJson from '../../../data/races/canada-2024.json';
import franceJson from '../../../data/races/france-2019.json';
import gbJson from '../../../data/races/great-britain-2016.json';
import hungaryJson from '../../../data/races/hungary-2021.json';
import monacoJson from '../../../data/races/monaco-2008.json';
import usJson from '../../../data/races/united-states-2015.json';
import { takeoverCompoundsUsed } from '../src/rules.js';
import { initRun, realDecisions, ruleSatisfied, simulate } from '../src/sim.js';
import type { CarState, RaceModel } from '../src/types.js';

const WET_TAKEOVERS = {
  'great-britain-2016': gbJson,
  'monaco-2008': monacoJson,
  'united-states-2015': usJson,
  'canada-2024': canadaJson,
  // On slicks at the takeover after a start on intermediates: the race file lists them.
  'hungary-2021': hungaryJson,
} as unknown as Record<string, RaceModel>;
const france = franceJson as unknown as RaceModel;
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe('takeoverCompoundsUsed', () => {
  it('adds the tyre the car is on at the takeover', () => {
    expect(
      takeoverCompoundsUsed({
        position: 1,
        gapAhead: 0,
        compound: 'INTERMEDIATE',
        tyreAge: 3,
        compoundsUsed: [],
      }),
    ).toEqual(['INTERMEDIATE']);
    expect(
      takeoverCompoundsUsed({
        position: 1,
        gapAhead: 0,
        compound: 'INTERMEDIATE',
        tyreAge: 3,
        compoundsUsed: ['SOFT'],
      }),
    ).toEqual(['SOFT', 'INTERMEDIATE']);
  });

  it('leaves a dry car as the file has it', () => {
    for (const d of france.drivers) {
      expect(takeoverCompoundsUsed(d.stateAtTakeover)).toEqual(d.stateAtTakeover.compoundsUsed);
    }
  });

  it('starts every car on wet tyres at the takeover with them in compoundsUsed', () => {
    for (const model of Object.values(WET_TAKEOVERS)) {
      const run = initRun(model, 1, { decisions: realDecisions(model), incidents: false });
      for (const d of model.drivers) {
        if (!['INTERMEDIATE', 'WET'].includes(d.stateAtTakeover.compound)) continue;
        expect(run.state.cars[d.code]?.compoundsUsed).toContain(d.stateAtTakeover.compound);
      }
    }
  });
});

describe('ruleSatisfied with wet tyres', () => {
  const car = (compound: string, compoundsUsed: string[]) =>
    ({ compound, compoundsUsed }) as unknown as CarState;

  it('a wet tyre at any point waives the rule, after the switch to slicks too', () => {
    expect(ruleSatisfied(car('MEDIUM', ['INTERMEDIATE', 'MEDIUM']))).toBe(true);
    expect(ruleSatisfied(car('INTERMEDIATE', ['INTERMEDIATE']))).toBe(true);
    expect(ruleSatisfied(car('SOFT', ['WET', 'SOFT']))).toBe(true);
  });

  it('a dry car still needs two dry compounds', () => {
    expect(ruleSatisfied(car('MEDIUM', ['MEDIUM']))).toBe(false);
    expect(ruleSatisfied(car('HARD', ['MEDIUM', 'HARD']))).toBe(true);
  });
});

describe('live play: the real calls of a wet race are never disqualified', () => {
  for (const [id, model] of Object.entries(WET_TAKEOVERS)) {
    for (const incidents of [false, true]) {
      it(`${id}, incidents ${incidents ? 'on' : 'off'}`, () => {
        for (const seed of SEEDS) {
          const result = simulate(model, seed, { decisions: realDecisions(model), incidents });
          expect(result.disqualified, `seed ${seed}`).not.toContain(model.userSide);
          // No car that took over on wet tyres is disqualified by the rule either.
          const wet = model.drivers
            .filter((d) => ['INTERMEDIATE', 'WET'].includes(d.stateAtTakeover.compound))
            .map((d) => d.code);
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
      const result = simulate(france, 1, { decisions: [], incidents });
      const last = result.order.slice(result.order.length - result.disqualified.length);
      expect(result.disqualified).toContain(france.userSide);
      expect(last).toContain(france.userSide);
    }
  });

  it('a stop for the second dry compound is legal', () => {
    const result = simulate(france, 1, {
      decisions: [{ lap: 30, kind: 'pit', compound: 'HARD' }],
      incidents: false,
    });
    expect(result.disqualified).not.toContain(france.userSide);
  });
});
