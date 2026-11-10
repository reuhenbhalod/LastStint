import { describe, expect, it } from 'vitest';
import { polyline } from './geometry.js';
import { tvPost, tvPosts, tvShot } from './tvcam.js';

// A square lap 0..400, corners at each turn.
const square = polyline([
  [0, 0],
  [400, 0],
  [400, 400],
  [0, 400],
]);
const outline = {
  width: 400,
  height: 400,
  corners: [
    [1, 400, 0],
    [2, 400, 400],
    [3, 0, 400],
    [4, 0, 0],
  ] as Array<[number, number, number]>,
};

describe('TV camera', () => {
  it('puts posts at the corners, spread out', () => {
    expect(tvPosts(outline, square).map((f) => Math.round(f * 100) / 100)).toEqual([
      0, 0.25, 0.5, 0.75,
    ]);
    // corners too close together share a post; too few corners get one every quarter lap
    const close = {
      ...outline,
      corners: [
        [1, 400, 0],
        [2, 400, 20],
      ] as Array<[number, number, number]>,
    };
    expect(tvPosts(close, square)).toEqual([0.125, 0.375, 0.625, 0.875]);
  });

  it('cuts to the next post halfway between the two, across the line too', () => {
    const posts = [0.1, 0.4, 0.7];
    expect(tvPost(posts, 0.24)).toBe(0);
    expect(tvPost(posts, 0.26)).toBe(1);
    expect(tvPost(posts, 0.95)).toBe(0);
  });

  it('zooms in as the car passes the post and out as it goes away', () => {
    const posts = [0.25, 0.75];
    const near = tvShot(square, outline, posts, [400, 0], 0.25).box;
    const far = tvShot(square, outline, posts, [400, 150], 0.34).box;
    expect(near.w).toBeLessThan(far.w);
    expect(far.w).toBeLessThanOrEqual(400 * 0.42);
    // the car stays in frame
    expect(150).toBeGreaterThan(far.y);
    expect(150).toBeLessThan(far.y + far.h);
  });
});
