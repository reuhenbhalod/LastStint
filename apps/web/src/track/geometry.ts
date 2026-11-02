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
  path: Polyline;
  /** Where the lane leaves and rejoins the lap, as fractions of the outline. */
  entry: number;
  exit: number;
}

export function pitLane(outline: TrackOutline, lap: Polyline): PitLane | null {
  const pts = outline.pit;
  if (!pts || pts.length < 2) return null;
  return {
    path: polyline(pts, false),
    entry: nearestFraction(lap, pts[0] as [number, number]),
    exit: nearestFraction(lap, pts[pts.length - 1] as [number, number]),
  };
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
