// The race engineer's side of the user's car (race engineer spec, Nov 3 2026; live play only).
//
// Between the big calls the wall runs the car lap by lap, as a real race engineer does:
// - battle moves for one lap against the car directly ahead or behind (cover the inside, go
//   round the outside, wait for DRS...), changing that lap's pass odds, contact risk and time;
// - contact: a broken front wing (seconds a lap until a stop fixes it), a puncture or a spin;
// - track-limit strikes, and a time penalty at the flag past the limit;
// - lapped cars slow to move over;
// - the driver's requests, and whether the wall was right to say no;
// - the driver's trust in the wall, which moves with how the calls turn out. A frustrated
//   driver overdrives (faster, harder on the tyres, more mistakes); a furious one picks his
//   own battle moves.
// Everything is driven by the call log and the run's own random streams (contact and strikes on
// the user's car), so the Worker's replay of a run is exactly the race the player saw. Replays
// without decisions (validation, golden files) never touch any of it.

import drivers from '../../../data/drivers.json';
import type {
  BattleMove,
  CarState,
  Decision,
  EngineerState,
  Mood,
  RaceModel,
  RaceState,
  TrustReason,
} from './types.js';
import { ATTACK_MOVES, DEFEND_MOVES } from './types.js';

export interface MoveEffect {
  attackLogit?: number;
  defendLogit?: number;
  lapDelta?: number;
  wearMult?: number;
  /** Multiplies the battle's contact chance. */
  contact?: number;
  /** Multiplies the lap's track-limit strike chance. */
  strike?: number;
  /** Battery % the move spends (the overtake button). */
  battery?: number;
}

export interface MoodEffect {
  lapDelta: number;
  wearMult: number;
  /** A costly mistake's chance per green lap, on top of any mode's. */
  errorRate: number;
  /** Picks his own battle move when the wall calls none. */
  rogue?: boolean;
}

export interface EngineerConfig {
  /** A car within this gap (s) ahead or behind at the start of a lap is a battle. */
  battleWindow: number;
  moves: Record<BattleMove, MoveEffect>;
  /** The next lap's attack after `wait-drs`. */
  drsLogit: number;
  contactBase: number;
  /** Shares of a contact's outcome (the rest of 1 is a spin). */
  contactWing: number;
  contactPuncture: number;
  wingDamage: [number, number];
  spinCost: number;
  noseCost: number;
  strikeBase: number;
  strikePush: number;
  strikeCareful: number;
  carefulCost: number;
  penaltyAt: number;
  penaltyEvery: number;
  penalty: number;
  blue: { window: number; goRoundGain: number; goRoundContact: number };
  /** Trust: start = clamp(startTrust - perIgnore x the driver's ignores %, min, max). */
  trust: {
    start: number;
    perIgnore: number;
    min: number;
    max: number;
    deltas: Record<TrustReason, number>;
    /** Quiet laps before trust settles back toward its start, and how much a lap. */
    settleAfter: number;
    settle: number;
    /** Headset orders within 3 laps before it counts as micromanaging. */
    ordersLimit: number;
    /** Laps a refused request is watched. */
    watch: number;
    /** Laps after his stop it's judged, if the rival hasn't stopped by then. */
    stopWatch: number;
  };
  /** Lower edges of the moods (trust at or above). */
  moods: { calm: number; tense: number; frustrated: number };
  moodEffects: Record<'frustrated' | 'furious', MoodEffect>;
}

const ATTITUDES = (drivers as { drivers: Record<string, { ignores?: number }> }).drivers;

/** The driver's trust in the wall at the start (from how often he ignores it). */
export function startTrust(cfg: EngineerConfig, code: string): number {
  const ignores = ATTITUDES[code]?.ignores ?? 0;
  return Math.min(
    cfg.trust.max,
    Math.max(cfg.trust.min, cfg.trust.start - cfg.trust.perIgnore * ignores),
  );
}

export function newEngineer(cfg: EngineerConfig, code: string): EngineerState {
  const trust = startTrust(cfg, code);
  return {
    trust,
    baseTrust: trust,
    damage: 0,
    strikes: 0,
    penalty: 0,
    careful: false,
    move: null,
    moveByDriver: false,
    drsLap: -1,
    blue: null,
    orders: [],
    refused: [],
    stopWatch: null,
    lastEvent: -1,
  };
}

export function cloneEngineer(e: EngineerState): EngineerState {
  return {
    ...e,
    orders: [...e.orders],
    refused: e.refused.map((r) => ({ ...r })),
    stopWatch: e.stopWatch && { ...e.stopWatch },
  };
}

export function moodOf(cfg: EngineerConfig | undefined, trust: number): Mood {
  if (!cfg) return 'calm';
  if (trust >= cfg.moods.calm) return 'calm';
  if (trust >= cfg.moods.tense) return 'tense';
  if (trust >= cfg.moods.frustrated) return 'frustrated';
  return 'furious';
}

export function moodEffect(cfg: EngineerConfig, trust: number): MoodEffect | null {
  const mood = moodOf(cfg, trust);
  return mood === 'frustrated' || mood === 'furious' ? cfg.moodEffects[mood] : null;
}

export const isAttack = (m: BattleMove | null): boolean => !!m && ATTACK_MOVES.includes(m);
export const isDefend = (m: BattleMove | null): boolean => !!m && DEFEND_MOVES.includes(m);

/** Running cars in race order (by total time). */
function runningOrder(race: RaceState): string[] {
  return race.order
    .filter((c) => !(race.cars[c] as CarState).retired)
    .sort((a, b) => (race.cars[a] as CarState).totalTime - (race.cars[b] as CarState).totalTime);
}

/**
 * The battles the user's car is in at the start of the next lap: the car directly ahead and the
 * car directly behind, each if within the battle window. The game asks about these, and the
 * race model plays the move against them.
 */
export function battlesFor(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
): { ahead: { code: string; gap: number } | null; behind: { code: string; gap: number } | null } {
  const order = runningOrder(race);
  const i = order.indexOf(model.userSide);
  if (i < 0) return { ahead: null, behind: null };
  const t = (c: string) => (race.cars[c] as CarState).totalTime;
  const me = t(model.userSide);
  const a = order[i - 1];
  const b = order[i + 1];
  const ahead =
    a !== undefined && me - t(a) < cfg.battleWindow ? { code: a, gap: me - t(a) } : null;
  const behind =
    b !== undefined && t(b) - me < cfg.battleWindow ? { code: b, gap: t(b) - me } : null;
  return { ahead, behind };
}

/**
 * A lapped car just ahead of the user's car on track (it is one or more laps down, so it sits
 * behind in the order): the nearest within the blue-flag window, or null.
 */
export function lappedAhead(
  race: RaceState,
  model: RaceModel,
  cfg: EngineerConfig,
  lapLength: number,
): { code: string; gap: number } | null {
  const me = race.cars[model.userSide];
  if (!me || me.retired || !(lapLength > 0)) return null;
  let best: { code: string; gap: number } | null = null;
  for (const code of race.order) {
    const c = race.cars[code] as CarState;
    if (code === model.userSide || c.retired) continue;
    const d = c.totalTime - me.totalTime;
    if (d < lapLength * 0.5) continue;
    const x = Math.ceil(d / lapLength) * lapLength - d; // how far ahead on track
    if (x > 0 && x < cfg.blue.window && (!best || x < best.gap)) best = { code, gap: x };
  }
  return best;
}

/** A call the race engineer side applies when its lap is run (the rest are sim.ts's). */
export function applyEngineerCall(e: EngineerState, d: Decision, lap: number): void {
  if (d.kind === 'battle') {
    e.move = d.move;
    e.moveByDriver = d.driver === true;
  } else if (d.kind === 'limits') {
    e.careful = d.careful;
  } else if (d.kind === 'blue') {
    e.blue = d.action;
  } else if (d.kind === 'mode') {
    e.orders.push(lap);
  }
}

/** Every call kind this module adds (validateDecisions checks their fields). */
export function validEngineerCall(d: Decision): boolean {
  if (d.kind === 'battle') {
    return (
      (ATTACK_MOVES.includes(d.move) || DEFEND_MOVES.includes(d.move)) &&
      (d.driver === undefined || typeof d.driver === 'boolean')
    );
  }
  if (d.kind === 'limits') return typeof d.careful === 'boolean';
  if (d.kind === 'blue') return d.action === 'complain' || d.action === 'go-round';
  if (d.kind === 'reply') {
    return (d.request === 'box' || d.request === 'push') && typeof d.yes === 'boolean';
  }
  return false;
}
