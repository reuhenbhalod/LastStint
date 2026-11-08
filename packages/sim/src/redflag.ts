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
  /** Out-laps on which a stop costs nothing (the tyre change in the stoppage). */
  free: Set<number>;
  /** At the end of this lap the running cars line up `gap` apart, if the red flag that started
   * on `redLap` is in the run's events (a grader's blind fork may not know it). */
  wipes: Map<number, { gap: number; redLap: number }>;
}

/** What a race's red flags do in the sim (redflag.py `plan`). */
export function redFlagPlan(events: RaceEvent[]): RedFlagPlan {
  const free = new Set<number>();
  const wipes = new Map<number, { gap: number; redLap: number }>();
  const scs = new Map<number, number>();
  for (const e of events) if (e.type === 'SC') scs.set(e.lap, e.laps ?? 1);
  for (const e of events) {
    if (e.type !== 'RED' || (e.restart !== 'standing' && e.restart !== 'rolling')) continue;
    const stop = e.lap + (e.laps ?? 1) - 1;
    for (let lap = e.lap + 1; lap <= stop; lap++) free.add(lap);
    wipes.set(stop, { gap: RESTART_QUEUE_GAP, redLap: e.lap });
    if (e.restart === 'standing') {
      wipes.set(stop + (scs.get(stop + 1) ?? 0), { gap: STANDING_RESTART_GAP, redLap: e.lap });
    }
  }
  return { free, wipes };
}

/** Wipe the gaps: the running cars, in order, `gap` apart behind the leader. */
export function lineUp(order: string[], cars: Record<string, CarState>, gap: number): void {
  const lead = order[0] === undefined ? undefined : cars[order[0]];
  if (!lead) return;
  for (let i = 1; i < order.length; i++) {
    (cars[order[i] as string] as CarState).totalTime = lead.totalTime + i * gap;
  }
}
