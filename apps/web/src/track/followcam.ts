// The follow camera (realistic UI spec): the map stays as it is (north up, from above) and the
// view closes in on your car and moves with it round the lap, a little ahead of it so you see
// the corner coming.

import type { Box } from './battle.js';
import { type Polyline, type TrackOutline, pointAt } from './geometry.js';

/** How much of the circuit's width the view takes. */
const SHARE = 0.32;
/** How far ahead of the car the view looks (a share of the lap), and how far it leans there. */
const AHEAD = 0.02;
const LEAN = 0.5;

/** The view on a car at `car`, fraction `f` of the lap (null in the pit lane: no look ahead). */
export function followBox(
  line: Polyline,
  outline: Pick<TrackOutline, 'width' | 'height'>,
  car: [number, number],
  f: number | null,
): Box {
  const [ax, ay] = f === null ? car : pointAt(line, (f + AHEAD) % 1);
  const cx = car[0] + (ax - car[0]) * LEAN;
  const cy = car[1] + (ay - car[1]) * LEAN;
  const w = outline.width * SHARE;
  const h = w / (outline.width / outline.height);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
