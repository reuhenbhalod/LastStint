// Scripted race mechanics for Eras builds (Eras model fixes M4). The TypeScript twin of
// pipeline/src/pipeline/restart.py, sim_reference.py's team orders and storyline.py: the two
// sims must agree (tests/scripted.test.ts, pipeline/tests/fixtures/scripted_parity.json).
//
// 1. The SC restart (`track.restart`, restart.py): on a green lap straight after an SC lap
//    the car k places behind the leader loses jump + spread x min(k, places).
// 2. Team orders and let-bys (TEAM_ORDER events, sourced in data/incidents.json): from the
//    event's lap, for up to TEAM_ORDER_LAPS green laps, a yielder still ahead of its passer and
//    no more than TEAM_ORDER_WINDOW s clear of it drops TEAM_ORDER_GAP s behind it, and doesn't
//    pass it back. In live play an order telling the player's own car to let a car by is the
//    player's call (a `teamOrder: comply` decision; moments.ts offers it).
// 3. Avoidable storyline retirements (`eras.storylineRetirements`, storyline.py): in live play
//    the player's car retires on its real lap only if it repeats the real call (the item's
//    condition); every scripted car keeps its real retirement.

import type { RedFlagPlan } from './redflag.js';
import { STANDING_RESTART_GAP } from './redflag.js';
import type {
  FlagState,
  Modes,
  RaceEvent,
  RestartModel,
  StorylineCondition,
  StorylineRetirement,
} from './types.js';

export const TEAM_ORDER_LAPS = 3;
export const TEAM_ORDER_WINDOW = 10.0;
export const TEAM_ORDER_GAP = 0.5;

/** Seconds the car `k` places behind the leader loses on the restart lap (restart.py extra). */
export function restartExtra(block: RestartModel, k: number): number {
  if (k <= 0) return 0;
  return block.jump + block.spread * Math.min(k, block.places);
}

/**
 * A green lap straight after an SC lap: a safety car's restart (also a red flag's rolling
 * restart behind it), not a standing restart's first lap (sim_reference.is_restart_lap).
 */
export function isRestartLap(
  neutral: Map<number, Exclude<FlagState, 'green'>>,
  red: RedFlagPlan,
  lap: number,
): boolean {
  if (neutral.get(lap) || neutral.get(lap - 1) !== 'sc') return false;
  const wipe = red.wipes.get(lap - 1);
  const standing =
    wipe !== undefined && wipe.gap === STANDING_RESTART_GAP && neutral.get(wipe.redLap) === 'red';
  return !standing;
}

/** One scripted team order: `yielder` lets `passer` by, open from `lap` to `until`. */
export interface TeamOrderState {
  lap: number;
  yielder: string;
  passer: string;
  until: number;
  /** Live play: it tells the player's car to yield, so it waits for the player's call. */
  call?: boolean;
  /** The player complied (a `teamOrder: comply` call on one of its laps). */
  armed?: boolean;
}

/** The race's TEAM_ORDER events, in lap order (sim_reference.team_orders). `user`: the
 * player's car in live play, whose orders wait for the player's call. */
export function teamOrdersOf(events: readonly RaceEvent[], user?: string): TeamOrderState[] {
  return [...events]
    .filter((e) => e.type === 'TEAM_ORDER' && e.driver && e.other)
    .sort((a, b) => a.lap - b.lap)
    .map((e) => ({
      lap: e.lap,
      yielder: e.driver as string,
      passer: e.other as string,
      until: e.lap + TEAM_ORDER_LAPS - 1,
      ...(user !== undefined && e.driver === user ? { call: true } : {}),
    }));
}

/** The player's car's open team orders on `lap` (the ones a `comply` call answers). */
export function userOrdersOn(events: readonly RaceEvent[], user: string, lap: number): RaceEvent[] {
  return events.filter(
    (e) =>
      e.type === 'TEAM_ORDER' && e.driver === user && lap >= e.lap && lap < e.lap + TEAM_ORDER_LAPS,
  );
}

interface OrderCar {
  code: string;
  totalTime: number;
  retired: boolean;
}

/**
 * A green lap's scripted team orders, after the lap's passes (sim_reference.apply_team_orders).
 * Returns the swaps made (yielder, passer), for the run's notes and the order. `passedBy`: the
 * sims' repass cooldown, set so the yielder doesn't pass back before the flag.
 */
export function applyTeamOrders(
  orders: TeamOrderState[],
  cars: Record<string, OrderCar>,
  lap: number,
  total: number,
  passedBy: Map<string, number>,
): Array<[string, string]> {
  const swaps: Array<[string, string]> = [];
  for (const o of [...orders]) {
    if (lap < o.lap) continue;
    const y = cars[o.yielder];
    const p = cars[o.passer];
    const drop = () => orders.splice(orders.indexOf(o), 1);
    if (lap > o.until || !y || !p || y.retired || p.retired) {
      drop();
      continue;
    }
    if (p.totalTime < y.totalTime) {
      drop();
      continue;
    }
    if (o.call && !o.armed) continue; // the player's call (live play)
    if (p.totalTime - y.totalTime > TEAM_ORDER_WINDOW) continue;
    y.totalTime = p.totalTime + TEAM_ORDER_GAP;
    passedBy.set(`${y.code}>${p.code}`, total);
    drop();
    swaps.push([o.yielder, o.passer]);
  }
  return swaps;
}

// --- Avoidable storyline retirements ------------------------------------------------------------

/** The player's car at the start of one lap, for a storyline condition (storyline.py). */
export interface StorylineLap {
  lap: number;
  /** Its standing modes for the lap. */
  modes: Modes;
  /** Laps on its tyres at the start of the lap. */
  tyreAge: number;
  /** Each running car's start-of-lap time minus the player's (positive: behind it). */
  gaps: Record<string, number>;
}

/**
 * Whether the player repeated the real call, judged at the start of the retirement lap
 * `retireLap` from the laps run so far (storyline.py condition_met). `fuel`: never by itself
 * (the fuel model decides, so the frozen retirement is dropped).
 */
export function conditionMet(
  c: StorylineCondition,
  laps: readonly StorylineLap[],
  retireLap: number,
): boolean {
  const at = laps.find((l) => l.lap === retireLap);
  switch (c.type) {
    case 'mode': {
      // Every lap from fromLap (or the first lap run, if later) to the retirement lap.
      const start = Math.max(c.fromLap, laps[0]?.lap ?? c.fromLap);
      const span = laps.filter((l) => l.lap >= start && l.lap <= retireLap);
      return span.length === retireLap - start + 1 && span.every((l) => l.modes[c.key] === c.value);
    }
    case 'tyre_age':
      return at !== undefined && at.tyreAge >= c.minLaps;
    case 'pressure': {
      const gap = at?.gaps[c.driver];
      return gap !== undefined && gap >= 0 && gap <= c.seconds;
    }
    case 'fuel':
      return false;
  }
}

/** The player's storyline retirements (eras.storylineRetirements for `user`). */
export function storylineFor(
  retirements: readonly StorylineRetirement[] | undefined,
  user: string,
): StorylineRetirement[] {
  return (retirements ?? []).filter((r) => r.driver === user);
}
