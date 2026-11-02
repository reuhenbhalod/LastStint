// Placing cars on a circuit outline (data/tracks/<race>.json, from `pipeline outline`). The
// outline starts at the start/finish line, so a car's progress round the lap is a fraction of
// the outline's length. The sim gives each car's total race time, so a car `gap` seconds
// behind the leader sits `gap / lapTime` of a lap behind it on track; a lapped car wraps round
// and shows up among the leaders, as it does on a real circuit.

import type { RaceModel, RaceState } from '@boxthislap/sim';

export interface TrackOutline {
  raceId: string;
  width: number;
  height: number;
  /** Polyline round the lap, starting at the start/finish line (SVG coordinates). */
  points: Array<[number, number]>;
  /** [corner number, x, y]. */
  corners: Array<[number, number, number]>;
  /** The pit lane, entry to exit (from a real stop's in-lap and out-lap), if known. */
  pit?: Array<[number, number]>;
}

export interface Polyline {
  points: Array<[number, number]>;
  /** Distance from the first point to point i (closed: the last entry is the full lap). */
  cumulative: number[];
  length: number;
}

export function polyline(points: Array<[number, number]>, closed = true): Polyline {
  const cumulative = [0];
  const n = closed ? points.length : points.length - 1;
  for (let i = 1; i <= n; i++) {
    const [ax, ay] = points[i - 1] as [number, number];
    const [bx, by] = points[i % points.length] as [number, number];
    cumulative.push((cumulative[i - 1] as number) + Math.hypot(bx - ax, by - ay));
  }
  return { points, cumulative, length: cumulative[n] as number };
}

/** The point a fraction `t` (clamped to [0, 1]) of the way along an open polyline. */
export function pointAlong(line: Polyline, t: number): [number, number] {
  const n = line.cumulative.length - 1;
  if (n < 1) return line.points[0] ?? [0, 0];
  const target = Math.min(1, Math.max(0, t)) * line.length;
  let i = 0;
  while (i < n - 1 && (line.cumulative[i + 1] as number) < target) i++;
  const seg = (line.cumulative[i + 1] as number) - (line.cumulative[i] as number);
  const u = seg > 0 ? (target - (line.cumulative[i] as number)) / seg : 0;
  const [ax, ay] = line.points[i] as [number, number];
  const [bx, by] = line.points[i + 1] as [number, number];
  return [ax + (bx - ax) * u, ay + (by - ay) * u];
}

/** How far round the closed outline (a fraction of the lap) the point nearest `p` lies. */
export function nearestFraction(line: Polyline, p: [number, number]): number {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  const n = line.points.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = line.points[i] as [number, number];
    const [bx, by] = line.points[(i + 1) % n] as [number, number];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const u = len2 > 0 ? Math.min(1, Math.max(0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2)) : 0;
    const d = Math.hypot(ax + dx * u - p[0], ay + dy * u - p[1]);
    if (d < bestD) {
      bestD = d;
      best = (line.cumulative[i] as number) + u * Math.sqrt(len2);
    }
  }
  return best / line.length;
}

export interface PitLane {
  /** The lane as drawn (pushed clear of the track, see `spreadLane`). */
  path: Polyline;
  /** Where the lane leaves and rejoins the lap, as fractions of the outline. */
  entry: number;
  exit: number;
}

/** The nearest point on the closed outline to `p`, and the outline's direction there. */
function nearestOn(line: Polyline, p: [number, number]) {
  let best = { d: Number.POSITIVE_INFINITY, q: [0, 0] as [number, number], dir: [1, 0] };
  const n = line.points.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = line.points[i] as [number, number];
    const [bx, by] = line.points[(i + 1) % n] as [number, number];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (!len2) continue;
    const u = Math.min(1, Math.max(0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    const q: [number, number] = [ax + dx * u, ay + dy * u];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < best.d) best = { d, q, dir: [dx / Math.sqrt(len2), dy / Math.sqrt(len2)] };
  }
  return best;
}

/**
 * The real pit lane runs a few metres off the track, which at map scale is under the drawn
 * asphalt. Push each point out to `gap` from the track's centre line on its own side, easing
 * in over the first and last `taper` points so the lane still leaves and rejoins the track
 * where it really does. Where the lane crosses the track (a tunnel) it switches side, and the
 * drawn lane passes under the asphalt there.
 */
export function spreadLane(
  lap: Polyline,
  pit: Array<[number, number]>,
  gap: number,
  taper = 5,
): Array<[number, number]> {
  const n = pit.length;
  return pit.map((p, i) => {
    const { d, q, dir } = nearestOn(lap, p);
    const ends = Math.min(i, n - 1 - i);
    const w = ease(ends / taper);
    const target = d + (Math.max(gap, d) - d) * w;
    // Which side of the track the point is on: the sign of the cross product.
    const side =
      Math.sign((dir[0] as number) * (p[1] - q[1]) - (dir[1] as number) * (p[0] - q[0])) || 1;
    const nx = -(dir[1] as number) * side;
    const ny = (dir[0] as number) * side;
    return [q[0] + nx * target, q[1] + ny * target];
  });
}

/** The lane's drawn path: spread clear of a track `trackWidth` wide. */
export function pitLane(outline: TrackOutline, lap: Polyline, trackWidth = 30): PitLane | null {
  const pts = outline.pit;
  if (!pts || pts.length < 2) return null;
  const drawn = spreadLane(lap, pts, trackWidth * 1.15);
  return {
    path: polyline(drawn, false),
    entry: nearestFraction(lap, pts[0] as [number, number]),
    exit: nearestFraction(lap, pts[pts.length - 1] as [number, number]),
  };
}

/** Direction (radians) of an open polyline at fraction `t`. */
export function angleAlong(line: Polyline, t: number): number {
  const [ax, ay] = pointAlong(line, Math.max(0, t - 0.01));
  const [bx, by] = pointAlong(line, Math.min(1, t + 0.01));
  return Math.atan2(by - ay, bx - ax);
}

/** Ease in and out over [0, 1]. */
export function ease(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

/** The point a fraction `f` of the way round the closed outline (f wraps into [0, 1)). */
export function pointAt(line: Polyline, f: number): [number, number] {
  const frac = ((f % 1) + 1) % 1;
  const target = frac * line.length;
  let lo = 0;
  let hi = line.points.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((line.cumulative[mid] as number) <= target) lo = mid;
    else hi = mid;
  }
  const seg = (line.cumulative[lo + 1] as number) - (line.cumulative[lo] as number);
  const t = seg > 0 ? (target - (line.cumulative[lo] as number)) / seg : 0;
  const [ax, ay] = line.points[lo] as [number, number];
  const [bx, by] = line.points[(lo + 1) % line.points.length] as [number, number];
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

/** How long a lap takes under the current flag (time gaps stretch under a SC or VSC). */
export function lapTime(model: RaceModel, flag: RaceState['flag']): number {
  const t = model.track;
  const green =
    t.greenLapTime ??
    model.drivers.reduce((sum, d) => sum + d.basePace, 0) / Math.max(1, model.drivers.length);
  if (flag === 'sc') return t.scLapTime ?? green * 1.6;
  if (flag === 'vsc') return t.vscLapTime ?? green * 1.35;
  return green;
}

export interface CarOnTrack {
  code: string;
  /** Fraction of a lap behind the leader's position (0 for the leader). */
  behind: number;
  /** At least a lap behind the leader. */
  lapped: boolean;
}

/** Every running car's distance behind the leader, as a fraction of a lap, in race order. */
export function carsOnTrack(race: RaceState, model: RaceModel): CarOnTrack[] {
  const live = race.order.filter((c) => race.cars[c] && !race.cars[c]?.retired);
  const leader = race.cars[live[0] as string];
  if (!leader) return [];
  const lap = lapTime(model, race.flag);
  return live.map((code) => {
    const gap = (race.cars[code]?.totalTime ?? 0) - leader.totalTime;
    return { code, behind: gap / lap, lapped: gap >= lap };
  });
}
