import { describe, expect, it } from 'vitest';
import { cameraBox, insideSide, lineSide, normalAt, offsetPath } from './battle.js';
import { polyline } from './geometry.js';

// A square lap, clockwise on screen (y down): right along the top, down the right side...
const square = polyline([
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
]);

describe('a battle on the track', () => {
  it('knows the inside of a corner', () => {
    // The top-right corner (a quarter of the way round) turns right on screen: down.
    const inside = insideSide(square, 0.25);
    const [nx, ny] = normalAt(square, 0.2);
    // The inside is toward the middle of the square (below the top straight).
    expect(ny * inside).toBeGreaterThan(0);
    expect(Math.abs(nx)).toBeLessThan(1e-9);
    expect(lineSide('inside', inside)).toBe(inside);
    expect(lineSide('outside', inside)).toBe(-inside);
    expect(lineSide('wait', inside)).toBe(0);
  });

  it('draws a line beside the track, on the side asked', () => {
    const inside = insideSide(square, 0.25);
    const pts = offsetPath(square, 0.1, 0.2, 8 * inside);
    for (const [, y] of pts) expect(y).toBeCloseTo(8, 9);
  });

  it('frames the cars and the corner, in the map’s shape and inside it', () => {
    const map = { width: 1000, height: 600 };
    const box = cameraBox(
      [
        [900, 550],
        [950, 580],
      ],
      map,
    );
    expect(box.w / box.h).toBeCloseTo(1000 / 600, 6);
    expect(box.x + box.w).toBeLessThanOrEqual(1000 + 1e-9);
    expect(box.y + box.h).toBeLessThanOrEqual(600 + 1e-9);
    expect(box.w).toBeGreaterThanOrEqual(450);
    expect(box.x).toBeLessThanOrEqual(900);
  });
});
