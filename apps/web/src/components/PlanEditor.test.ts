// The plan editor's two-compound check: wet tyres waive the rule, as in the sim's ruleSatisfied
// (a car that takes over on intermediates and switches to one dry compound is legal).

import type { RacePlan } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { twoCompounds } from './PlanEditor.js';

const plan = (...compounds: string[]): RacePlan => ({
  id: 'own',
  stops: compounds.map((compound, i) => ({ lap: 30 + 10 * i, compound })),
  pace: [],
});

describe('twoCompounds', () => {
  it('a wet tyre at the takeover waives the rule (a race file listing dry tyres only too)', () => {
    // canada-2024: on intermediates at the takeover, compoundsUsed empty, then one dry compound.
    expect(twoCompounds({ compound: 'INTERMEDIATE', compoundsUsed: [] }, plan('MEDIUM'))).toBe(
      true,
    );
    expect(
      twoCompounds({ compound: 'INTERMEDIATE', compoundsUsed: ['INTERMEDIATE'] }, plan('HARD')),
    ).toBe(true);
  });

  it('a wet tyre already run, or planned, waives it', () => {
    expect(
      twoCompounds({ compound: 'MEDIUM', compoundsUsed: ['INTERMEDIATE', 'MEDIUM'] }, plan()),
    ).toBe(true);
    expect(twoCompounds({ compound: 'MEDIUM', compoundsUsed: ['MEDIUM'] }, plan('WET'))).toBe(true);
    expect(
      twoCompounds(
        { compound: 'MEDIUM', compoundsUsed: ['MEDIUM'] },
        plan('INTERMEDIATE', 'MEDIUM'),
      ),
    ).toBe(true);
  });

  it('a dry car still needs a second dry compound', () => {
    const onMedium = { compound: 'MEDIUM', compoundsUsed: ['MEDIUM'] };
    expect(twoCompounds(onMedium, plan())).toBe(false);
    expect(twoCompounds(onMedium, plan('MEDIUM'))).toBe(false);
    expect(twoCompounds(onMedium, plan('HARD'))).toBe(true);
    expect(twoCompounds({ compound: 'HARD', compoundsUsed: ['SOFT', 'HARD'] }, plan())).toBe(true);
  });
});
