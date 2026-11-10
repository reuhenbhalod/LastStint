// The TV camera (realistic UI spec): cameras on posts at the corners round the lap, as a race
// broadcast has them. The camera nearest your car on the lap has the shot: it pans to keep the
// car in frame, zooms in as the car comes past its post and out as it goes away, and the
// picture cuts to the next post halfway between the two.

import type { Box } from './battle.js';
import { type Polyline, type TrackOutline, nearestFraction, pointAt } from './geometry.js';

/** The fewest laps' share between two posts (a shot lasts at least this share of the lap). */
const MIN_GAP = 0.16;
/** The frame at its tightest and widest, as a share of the circuit's width. */
const TIGHT = 0.24;
const WIDE = 0.42;
/** How far the frame leans from the car toward its post (the camera looks from there). */
const LEAN = 0.3;

/** Where the posts are (fractions of the lap, in order): at the corners, spread out. */
export function tvPosts(outline: Pick<TrackOutline, 'corners'>, line: Polyline): number[] {
  const at = outline.corners.map(([, x, y]) => nearestFraction(line, [x, y])).sort((a, b) => a - b);
  const posts: number[] = [];
  for (const f of at) {
    if (posts.length === 0 || f - (posts[posts.length - 1] as number) >= MIN_GAP) posts.push(f);
  }
  // The last post and the first are neighbours across the line.
  if (posts.length > 1 && 1 - (posts[posts.length - 1] as number) + (posts[0] as number) < MIN_GAP)
    posts.pop();
  // A circuit with few corners on its map still gets a camera every quarter lap.
  if (posts.length < 3) return [0.125, 0.375, 0.625, 0.875];
  return posts;
}

/** The post with the shot when the car is at `f`: the nearest along the lap. */
export function tvPost(posts: number[], f: number): number {
  let best = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  posts.forEach((p, i) => {
    const d = Math.abs(f - p);
    const gap = Math.min(d, 1 - d);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

/** The shot of a car at `car` (fraction `f` of the lap) from post `post`. */
export function tvShot(
  line: Polyline,
  outline: Pick<TrackOutline, 'width' | 'height'>,
  posts: number[],
  car: [number, number],
  f: number,
): { post: number; box: Box } {
  const post = tvPost(posts, f);
  const [px, py] = pointAt(line, posts[post] as number);
  const dist = Math.hypot(car[0] - px, car[1] - py);
  const aspect = outline.width / outline.height;
  const w = Math.min(outline.width * WIDE, outline.width * TIGHT + dist * 0.7);
  const h = w / aspect;
  const cx = car[0] + (px - car[0]) * LEAN;
  const cy = car[1] + (py - car[1]) * LEAN;
  const x = Math.min(Math.max(0, cx - w / 2), outline.width - w);
  const y = Math.min(Math.max(0, cy - h / 2), outline.height - h);
  return { post, box: { x, y, w, h } };
}
