// A battle drawn on the track (battles and trust spec D1): the lines into its corner, which
// side is the inside, the braking zone, and the camera box that frames the two cars.

import type { BattleLine } from '../game/quickCalls.js';
import { type Polyline, type TrackOutline, pointAt } from './geometry.js';

/** Each option's colour, on the map and on its button. */
export const LINE_COLOR: Record<BattleLine, string> = {
  inside: '#22c55e',
  outside: '#3b82f6',
  boost: '#a855f7',
  hard: '#ef4444',
  let: '#9aa39f',
  wait: '#f59e0b',
};

/** How far before the corner the braking zone starts (a share of the lap). */
export const BRAKE_BEFORE = 0.035;
/** Where the lines into the corner start and end, around it (shares of the lap). */
const LINE_FROM = 0.05;
const LINE_TO = 0.012;

/** The track's direction at fraction `f`, as a unit vector. */
export function tangentAt(line: Polyline, f: number): [number, number] {
  const [ax, ay] = pointAt(line, f - 0.002);
  const [bx, by] = pointAt(line, f + 0.002);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  return [(bx - ax) / len, (by - ay) / len];
}

/** The normal at `f`, to the left of the direction of travel (as drawn). */
export function normalAt(line: Polyline, f: number): [number, number] {
  const [tx, ty] = tangentAt(line, f);
  return [-ty, tx];
}

/** Which side of the track is the inside of the corner at `f`: +1 along normalAt, else -1. */
export function insideSide(line: Polyline, f: number): 1 | -1 {
  const [ax, ay] = tangentAt(line, f - 0.02);
  const [bx, by] = tangentAt(line, f + 0.02);
  return ax * by - ay * bx > 0 ? 1 : -1;
}

/** The side of the track each option's line runs on (+1 the inside), or 0: no line of its
 * own (waiting, letting him by: a tag before the braking zone). */
export function lineSide(kind: BattleLine, inside: 1 | -1): number {
  switch (kind) {
    case 'inside':
    case 'boost':
    case 'hard':
      return inside;
    case 'outside':
      return -inside;
    default:
      return 0;
  }
}

/** Points along the track from `from` to `to` (fractions), `offset` map units off the centre
 * line (positive along normalAt). */
export function offsetPath(
  line: Polyline,
  from: number,
  to: number,
  offset: number,
  n = 18,
): Array<[number, number]> {
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = from + ((to - from) * i) / n;
    const [x, y] = pointAt(line, f);
    const [nx, ny] = normalAt(line, f);
    return [x + nx * offset, y + ny * offset] as [number, number];
  });
}

/** The stretch the lines cover, into and just past the corner at `at`. */
export function lineStretch(at: number): [number, number] {
  return [at - LINE_FROM, at + LINE_TO];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The camera on a battle: a box round `points` with `pad` to spare, at least `minShare` of the
 * map wide, in the map's shape, kept inside the map.
 */
export function cameraBox(
  points: Array<[number, number]>,
  outline: Pick<TrackOutline, 'width' | 'height'>,
  minShare = 0.45,
  pad = 70,
): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const aspect = outline.width / outline.height;
  let w = Math.max(Math.max(...xs) - Math.min(...xs) + 2 * pad, outline.width * minShare);
  let h = Math.max(Math.max(...ys) - Math.min(...ys) + 2 * pad, w / aspect);
  w = Math.max(w, h * aspect);
  h = w / aspect;
  w = Math.min(w, outline.width);
  h = Math.min(h, outline.height);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const x = Math.min(Math.max(0, cx - w / 2), outline.width - w);
  const y = Math.min(Math.max(0, cy - h / 2), outline.height - h);
  return { x, y, w, h };
}
