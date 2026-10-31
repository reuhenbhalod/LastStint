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
}

export interface Polyline {
  points: Array<[number, number]>;
  /** Distance from the first point to point i (closed: the last entry is the full lap). */
  cumulative: number[];
  length: number;
}

export function polyline(points: Array<[number, number]>): Polyline {
  const cumulative = [0];
  for (let i = 1; i <= points.length; i++) {
    const [ax, ay] = points[i - 1] as [number, number];
    const [bx, by] = points[i % points.length] as [number, number];
    cumulative.push((cumulative[i - 1] as number) + Math.hypot(bx - ax, by - ay));
  }
  return { points, cumulative, length: cumulative[points.length] as number };
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
