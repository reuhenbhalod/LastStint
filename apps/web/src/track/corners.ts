// The corners a battle is fought into (race engineer spec): the ends of the longest straights.
// On the outline each corner sits a fraction of the way round the lap; the longer the run up
// to it, the bigger the braking zone, which is where cars pass.

import { type TrackOutline, nearestFraction, polyline } from './geometry.js';

/** Corner numbers by how long the straight before them is, longest first. */
export function overtakingCorners(outline: TrackOutline | null): number[] {
  if (!outline || outline.corners.length < 2) return [1];
  const line = polyline(outline.points);
  const at = outline.corners
    .map(([n, x, y]) => ({ n, f: nearestFraction(line, [x, y]) }))
    .sort((a, b) => a.f - b.f);
  const runUp = at.map((c, i) => {
    const prev = at[(i - 1 + at.length) % at.length] as { f: number };
    return { n: c.n, len: (c.f - prev.f + 1) % 1 };
  });
  return runUp.sort((a, b) => b.len - a.len).map((c) => c.n);
}

/** Where corner `n` is on the map, if the outline has it. */
export function cornerPoint(outline: TrackOutline | null, n: number): [number, number] | null {
  const c = outline?.corners.find((x) => x[0] === n);
  return c ? [c[1], c[2]] : null;
}
