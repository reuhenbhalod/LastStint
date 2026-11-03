import pools from '@data/pools.json';
import { describe, expect, it } from 'vitest';
import { outlineFor } from './outlines.js';

describe('track maps', () => {
  it('every daily and survivor race has its circuit and pit lane', () => {
    const ids = [...pools.daily, ...Object.keys(pools.survivor)];
    const missing = ids.filter((id) => !outlineFor(id));
    expect(missing).toEqual([]);
    const noPit = ids.filter((id) => (outlineFor(id)?.pit?.length ?? 0) < 2);
    expect(noPit).toEqual([]);
  });
});
