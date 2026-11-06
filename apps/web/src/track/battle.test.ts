import { describe, expect, it } from 'vitest';
import { cameraBox, cornerKind, insideSide, lineSide, normalAt, offsetPath } from './battle.js';
import { cornerPoint } from './corners.js';
import { nearestFraction, polyline } from './geometry.js';
import { outlineFor } from './outlines.js';

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

describe('corner kinds', () => {
  // A long hairpin: out along y=0, round a tight half circle, back along y=40.
  const hairpin = polyline([
    ...Array.from({ length: 50 }, (_, i) => [i * 20, 0] as [number, number]),
    ...Array.from({ length: 9 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 8;
      return [1000 + 20 * Math.cos(a), 20 + 20 * Math.sin(a)] as [number, number];
    }),
    ...Array.from({ length: 50 }, (_, i) => [1000 - i * 20, 40] as [number, number]),
  ]);
  it('knows a hairpin from a straight', () => {
    const at = nearestFraction(hairpin, [1020, 20]);
    expect(cornerKind(hairpin, at)).toBe('hairpin');
    // Halfway down a straight: no hairpin, no chicane.
    expect(cornerKind(hairpin, nearestFraction(hairpin, [500, 0]))).toBe('corner');
  });
});

describe('corner kinds on real circuits', () => {
  const kind = (id: string, n: number) => {
    const o = outlineFor(id) as NonNullable<ReturnType<typeof outlineFor>>;
    const line = polyline(o.points);
    return cornerKind(line, nearestFraction(line, cornerPoint(o, n) as [number, number]));
  };
  it.each([
    ['italy-2019', 1, 'chicane'],
    ['italy-2019', 4, 'chicane'],
    ['canada-2022', 13, 'chicane'],
    ['abu-dhabi-2021', 6, 'chicane'],
    ['belgium-2024', 5, 'chicane'],
    ['canada-2022', 10, 'hairpin'],
    ['hungary-2019', 1, 'hairpin'],
    ['belgium-2024', 1, 'hairpin'],
    ['austria-2019', 4, 'hairpin'],
    ['usa-2022', 12, 'hairpin'],
    ['russia-2020', 2, 'corner'],
  ] as const)('%s T%s is a %s', (id, n, want) => {
    expect(kind(id, n)).toBe(want);
  });
});
