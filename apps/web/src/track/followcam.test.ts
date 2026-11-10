import { describe, expect, it } from 'vitest';
import { followBox } from './followcam.js';
import { polyline } from './geometry.js';

const square = polyline([
  [0, 0],
  [400, 0],
  [400, 400],
  [0, 400],
]);
const outline = { width: 400, height: 400 };

describe('follow camera', () => {
  it('keeps the car in view, a little behind the middle, at one size', () => {
    const a = followBox(square, outline, [100, 0], 1 / 16);
    const b = followBox(square, outline, [400, 300], 0.4375);
    expect(a.w).toBe(b.w);
    // heading right along the top: the view sits ahead of the car
    expect(a.x + a.w / 2).toBeGreaterThan(100);
    expect(100).toBeGreaterThan(a.x);
    expect(a.y + a.h / 2).toBeCloseTo(0);
  });
});
