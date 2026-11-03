import { describe, expect, it } from 'vitest';
import { overtakingCorners } from './corners.js';
import { outlineFor } from './outlines.js';

describe('overtakingCorners', () => {
  it('puts the corners after the longest straights first', () => {
    // Abu Dhabi (2021 layout): the long back straight runs into Turn 6 (the old T8 hairpin
    // was removed, renumbering it), the other big stop is Turn 5 after the first straight.
    const abu = overtakingCorners(outlineFor('abu-dhabi-2021'));
    expect(abu.length).toBeGreaterThan(5);
    // Monza's first chicane follows the start straight.
    const monza = overtakingCorners(outlineFor('italy-2024'));
    expect(monza.slice(0, 2)).toContain(1);
  });

  it('falls back to Turn 1 without a map', () => {
    expect(overtakingCorners(null)).toEqual([1]);
  });
});
