import pools from '@data/pools.json';
import { describe, expect, it } from 'vitest';
import { type TrackOutline, pitLane, polyline } from './geometry.js';
import { outlineFor } from './outlines.js';

const ids = [...pools.daily, ...Object.keys(pools.survivor)];

describe('track maps', () => {
  it('every daily and survivor race has its circuit and pit lane', () => {
    const missing = ids.filter((id) => !outlineFor(id));
    expect(missing).toEqual([]);
    const noPit = ids.filter((id) => (outlineFor(id)?.pit?.length ?? 0) < 2);
    expect(noPit).toEqual([]);
  });

  it('every pit lane is a short stretch beside the start line, not a lap of the circuit', () => {
    const long = ids.filter((id) => {
      const outline = outlineFor(id) as TrackOutline;
      const line = polyline(outline.points);
      const lane = pitLane(outline, line);
      // The lane runs from just before the line to just after it (a pit straight).
      const span = ((((lane?.exit ?? 0) - (lane?.entry ?? 0)) % 1) + 1) % 1;
      return !lane || lane.path.length > 0.35 * line.length || span > 0.3;
    });
    expect(long).toEqual([]);
  });
});
