// Red flags (eras build plan 4.3, simulator roadmap R1). The TypeScript twin of
// pipeline/src/pipeline/redflag.py's `plan` and `line_up`: the two sims must agree
// (tests/parity.test.ts, tests/redflag.test.ts).
//
// A RED event { lap: L, laps: k, restart } covers race laps L..S (S = L + k - 1): S holds the
// stoppage. The cars line up in the pit lane in race order; a stop with its out-lap on a red
// lap after L is the tyre change made there during the stoppage, so it's free. At the end of S
// the gaps are wiped (the queue behind the safety car, RESTART_QUEUE_GAP apart); the laps the
// safety car stays out after the resumption are an SC event straight after. A standing restart
// then spreads the field STANDING_RESTART_GAP apart at the end of the last of them (the first
// racing lap is a start); a rolling one goes green from the queue. No `restart`: the race
// wasn't resumed. Restart rules by year and their sources: redflag.py.

import type { CarState, RaceEvent } from './types.js';

/** The queue behind the safety car, per car (sim.ts BUNCH_GAP, measured on final SC laps). */
export const RESTART_QUEUE_GAP = 0.5;
/**
 * A standing restart's spacing per car: the median gap between adjacent cars in the top ten at
 * the end of lap 1, over the 47 races in data/raw/ with a green lap 1 (redflag.py).
 */
export const STANDING_RESTART_GAP = 0.74;

export interface RedFlagPlan {
  /** Out-lap -> red lap: a stop with its out-lap there costs nothing (the tyre change in the
   * stoppage), if the red flag that started on that red lap is in the run's events. */
  free: Map<number, number>;
  /** At the end of this lap the running cars line up `gap` apart, if the red flag that started
   * on `redLap` is in the run's events (a grader's blind fork may not know it). */
  wipes: Map<number, { gap: number; redLap: number }>;
}

/**
 * The out-laps of a stop made in the stoppage of the red flag on laps first..stop: the red laps
 * after the first. When the cars stopped on the grid on the flag lap itself (stop === first:
 * every 2007-11 red flag, Monaco 2022), a tyre change made there has its out-lap on the lap
 * after it (redflag.py free_out_laps).
 */
export function freeOutLaps(first: number, stop: number): number[] {
  if (stop === first) return [first + 1];
  const out: number[] = [];
  for (let lap = first + 1; lap <= stop; lap++) out.push(lap);
  return out;
}

/**
 * What a race's red flags do in the sim (redflag.py `plan`). `eras` (an Eras race: it has a
 * rules block): a standing restart's STANDING_RESTART_GAP is the field's spacing at the end of
 * a lap 1, so the field is spaced that far apart at the end of the restart's first racing lap,
 * in that lap's order, not at the end of the lap before it.
 */
export function redFlagPlan(events: RaceEvent[], eras = false): RedFlagPlan {
  const free = new Map<number, number>();
  const wipes = new Map<number, { gap: number; redLap: number }>();
  const scs = new Map<number, number>();
  for (const e of events) if (e.type === 'SC') scs.set(e.lap, e.laps ?? 1);
  for (const e of events) {
    if (e.type !== 'RED' || (e.restart !== 'standing' && e.restart !== 'rolling')) continue;
    const stop = e.lap + (e.laps ?? 1) - 1;
    for (const lap of freeOutLaps(e.lap, stop)) free.set(lap, e.lap);
    wipes.set(stop, { gap: RESTART_QUEUE_GAP, redLap: e.lap });
    if (e.restart === 'standing') {
      const start = stop + (scs.get(stop + 1) ?? 0);
      wipes.set(eras ? start + 1 : start, { gap: STANDING_RESTART_GAP, redLap: e.lap });
    }
  }
  return { free, wipes };
}

/**
 * Lap -> car -> laps down: each SC or RED event's real laps down (`lapsDown`, written by an Eras
 * build of a no-unlapping race: pipeline restart.with_laps_down) on every lap of the event, for
 * the scripted cars (not `overridden`: a car whose strategy the run changes, or the player's car
 * in live play, decides from its own gaps). redflag.py real_laps_down.
 */
export function realLapsDown(
  events: RaceEvent[],
  overridden: (code: string) => boolean,
): Map<number, Map<string, number>> {
  const out = new Map<number, Map<string, number>>();
  for (const e of events) {
    if ((e.type !== 'SC' && e.type !== 'RED') || !e.lapsDown) continue;
    const down = new Map(Object.entries(e.lapsDown).filter(([c]) => !overridden(c)));
    for (let lap = e.lap; lap < e.lap + (e.laps ?? 1); lap++) out.set(lap, down);
  }
  return out;
}

/**
 * The running cars in the order they are on the road behind the leader, with each car's laps
 * down and its time behind the leader on the road (redflag.py road_order). `known`
 * (realLapsDown): a car's real laps down, which wins over its gap. A car really on a lap the sim
 * has it behind sits at the back of the road queue (it unlapped); a car really a lap down that
 * the sim has closer keeps its place on the road and loses the lap.
 */
export function roadOrder(
  order: string[],
  cars: Record<string, CarState>,
  lapTime: number,
  known?: Map<string, number>,
): { road: string[]; down: Map<string, number>; onRoad: Map<string, number> } {
  const time = (c: string) => (cars[c] as CarState).totalTime;
  const lead = time(order[0] as string);
  const down = new Map<string, number>();
  const onRoad = new Map<string, number>();
  for (const c of order) {
    const gap = time(c) - lead;
    const own = Math.floor(gap / lapTime);
    const n = known?.get(c) ?? own;
    down.set(c, n);
    onRoad.set(c, gap - Math.min(n, own) * lapTime);
  }
  const road = [...order].sort((a, b) => (onRoad.get(a) as number) - (onRoad.get(b) as number));
  return { road, down, onRoad };
}

/**
 * Wipe the gaps: the running cars, in order, `gap` apart behind the leader. With `lapTime` (no
 * unlapping, scUnlap 'none': before 2007 and 2010-11) the lapped cars line up where they are on
 * the road, each keeping its laps down (roadOrder, with the real laps down `known`; Monaco
 * 2011's restart).
 */
export function lineUp(
  order: string[],
  cars: Record<string, CarState>,
  gap: number,
  lapTime?: number,
  known?: Map<string, number>,
): void {
  const lead = order[0] === undefined ? undefined : cars[order[0]];
  if (!lead) return;
  if (lapTime) {
    const base = lead.totalTime;
    const { road, down } = roadOrder(order, cars, lapTime, known);
    road.forEach((c, i) => {
      (cars[c] as CarState).totalTime = base + i * gap + (down.get(c) as number) * lapTime;
    });
    return;
  }
  for (let i = 1; i < order.length; i++) {
    (cars[order[i] as string] as CarState).totalTime = lead.totalTime + i * gap;
  }
}
