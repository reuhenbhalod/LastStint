// Versus mode (docs/versus-spec.md, docs/versus-action-spec.md): a custom 15-lap race on a real track's measured numbers
// with only two cars, both player-controlled, starting side by side. Deterministic like the
// solo sim: the same setup, seed and calls give the same race on both players' browsers (only
// the calls travel). It reuses the solo sim's tyre, fuel, overtake and pit-loss pieces and the
// headset's mode and battle-move numbers, but runs its own small lap loop: the solo sim is
// built around one player car and a scripted field, and versus has neither.

import type { MoveEffect } from './engineer.js';
import headsetConfig from './headset.json';
import { type Rng, deriveSeed, mulberry32 } from './rng.js';
import {
  BUNCH_GAP,
  DEFAULT_MODES,
  DIRTY_AIR_RANGE,
  DRY_COMPOUNDS,
  FOLLOW_GAP,
  type FuelConfig,
  type ModeEffect,
  PASS_MARGIN,
  PASS_WINDOW,
  REPASS_COOLDOWN,
  SC_FALLBACK,
  VSC_FALLBACK,
  freshTyreDelta,
  lifeOf,
  passProbability,
  tyreLapTime,
} from './sim.js';
import type { BattleMove, Compound, Modes, RaceModel } from './types.js';

// --- Tracks and cars -------------------------------------------------------------------------

/** A versus track: the race file whose measured numbers it runs on, and its character. */
export interface VersusTrack {
  id: string;
  name: string;
  /** The race file (data/races/<raceFile>.json) its numbers come from. */
  raceFile: string;
  /** Share of the lap at full throttle: an estimate from published figures, not measured. */
  straightShare: number;
  character: string;
  /** Where battles are fought (action spec A1): the best overtaking corners on the map (the
   * longest run-ups), their number and place round the lap (a fraction, from the outline). */
  battleCorners: Array<{ corner: number; at: number }>;
}

export const VERSUS_TRACKS: VersusTrack[] = [
  {
    id: 'monza',
    name: 'Monza',
    raceFile: 'italy-2024',
    straightShare: 0.78,
    character: 'Long straights: top speed pays',
    battleCorners: [
      { corner: 1, at: 0.153 },
      { corner: 11, at: 0.899 },
      { corner: 8, at: 0.677 },
    ],
  },
  {
    id: 'spa',
    name: 'Spa',
    raceFile: 'belgium-2024',
    straightShare: 0.72,
    character: 'Power and fast corners',
    battleCorners: [
      { corner: 5, at: 0.344 },
      { corner: 16, at: 0.844 },
      { corner: 1, at: 0.05 },
    ],
  },
  {
    id: 'bahrain',
    name: 'Bahrain',
    raceFile: 'bahrain-2022',
    straightShare: 0.65,
    character: 'Rough surface: hard on tyres',
    battleCorners: [
      { corner: 1, at: 0.132 },
      { corner: 14, at: 0.906 },
      { corner: 11, at: 0.641 },
    ],
  },
  {
    id: 'suzuka',
    name: 'Suzuka',
    raceFile: 'japan-2024',
    straightShare: 0.66,
    character: 'Flowing corners',
    battleCorners: [
      { corner: 15, at: 0.86 },
      { corner: 1, at: 0.116 },
      { corner: 13, at: 0.655 },
    ],
  },
  {
    id: 'hungaroring',
    name: 'Hungaroring',
    raceFile: 'hungary-2025',
    straightShare: 0.56,
    character: 'Twisty and hard to pass: cornering pays',
    battleCorners: [
      { corner: 1, at: 0.143 },
      { corner: 4, at: 0.41 },
      { corner: 12, at: 0.804 },
    ],
  },
];

export type CarStat = 'topSpeed' | 'cornering' | 'tyreWear' | 'fuelUse' | 'pitCrew';
/** Stat points, -2 to +2 each (+ is better); a car's points add up to 0. */
export type CarStats = Record<CarStat, number>;

export interface VersusCar {
  id: string;
  name: string;
  blurb: string;
  stats: CarStats;
}

export const VERSUS_CARS: VersusCar[] = [
  {
    id: 'bullet',
    name: 'Bullet',
    blurb: 'Flies on the straights, hard on its tyres',
    stats: { topSpeed: 2, cornering: -1, tyreWear: -1, fuelUse: 0, pitCrew: 0 },
  },
  {
    id: 'glider',
    name: 'Glider',
    blurb: 'Quick in the corners and kind to its tyres, but thirsty',
    stats: { topSpeed: -1, cornering: 2, tyreWear: 1, fuelUse: -1, pitCrew: -1 },
  },
  {
    id: 'endurance',
    name: 'Endurance',
    blurb: 'A touch slower, but goes long and saves fuel',
    stats: { topSpeed: -1, cornering: -1, tyreWear: 1, fuelUse: 1, pitCrew: 0 },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    blurb: 'No weakness, no strength',
    stats: { topSpeed: 0, cornering: 0, tyreWear: 0, fuelUse: 0, pitCrew: 0 },
  },
];

/** What one stat point is worth. Small on purpose: the calls, not the car, decide the race.
 * Tuned so no car wins more than about 60% of same-strategy races on any launch track and each
 * averages about 50% over them (tests/versus.test.ts). */
export const STAT_SCALE: Record<'pace' | 'tyreWear' | 'fuelUse' | 'pitCrew' | 'passLogit', number> =
  {
    /** Lap time, s per point: top speed on the straight share, cornering on the rest (each
     * weighed against the average track). */
    pace: 0.035,
    /** Tyre wear rate, share per point (+1 point: 13% less wear). */
    tyreWear: 0.13,
    /** Fuel burn, share per point (+1 point: 5% less fuel, so a lighter car). */
    fuelUse: 0.05,
    /** Stationary time, s per point (+1 point: 0.15 s quicker stops). */
    pitCrew: 0.15,
    /** Overtaking: logit per point of top-speed advantage, times the straight share. */
    passLogit: 0.12,
  };

/** The launch tracks' mean straight share: top speed and cornering weigh the same on it. */
const MEAN_SHARE = VERSUS_TRACKS.reduce((a, t) => a + t.straightShare, 0) / VERSUS_TRACKS.length;
/** Chance a versus race has a SC or VSC (about two in three, action spec A4). */
export const NEUTRAL_CHANCE = 2 / 3;

export const VERSUS_LAPS = 15;
/** The grid: the second car starts this far behind the first. */
export const GRID_GAP = 0.3;
/** A SC or VSC can start on these laps. */
export const NEUTRAL_FROM = 3;
export const NEUTRAL_TO = 12;

// --- Action (docs/versus-action-spec.md) -----------------------------------------------------

/** A battle is fought when the cars start a green lap this close (s). */
export const BATTLE_GAP = 1.5;
/** Boosts each car has for battles (they spend battery). */
export const BOOSTS = 3;
/** A boost's effect on the pass odds (logit), the attacker's for it, the defender's against. */
const BOOST_LOGIT = 0.9;
/** An attacker who waited last lap has a better run this time (logit). */
const WAIT_LOGIT = 0.6;
/** Each second a lap the attacker is quicker (tyres, car) shifts the odds by this (logit). */
const PACE_LOGIT = 1.2;
/** Cold tyres on the out-lap (s): keeps the undercut close. */
export const OUT_LAP_COST = 0.8;
/** Dirty air is this share of the race file's (the car behind can stay close). */
const DIRTY_AIR_SHARE = 0.5;
/** A failed attack ends this far behind (s); a wait keeps the attacker closer. */
const HELD_GAP = 0.6;
const WAIT_GAP = 0.35;
/** Chance of a gremlin in a race, and its laps. */
export const GREMLIN_CHANCE = 0.25;
const GREMLIN_FROM = 3;
const GREMLIN_TO = 11;
/** A slow stop costs this much more (s); a flat-spot wears the tyres this much faster. */
const SLOW_STOP = 2.5;
const FLAT_SPOT_WEAR = 1.6;
/** An ERS fault: no boosts and no deploy for this many laps. */
const ERS_FAULT_LAPS = 2;
/** A restart jump: the chance it's judged too early, the penalty, and what a good one gains. */
const JUMP_RISK = 0.3;
const JUMP_PENALTY = 3;
const JUMP_GAIN = 0.5;

export type AttackPick = 'inside' | 'outside' | 'switchback' | 'wait';
export type DefendPick = 'cover-inside' | 'cover-outside' | 'defend-hard';
export type BattlePick = AttackPick | DefendPick;
export const ATTACK_PICKS: AttackPick[] = ['inside', 'outside', 'switchback', 'wait'];
export const DEFEND_PICKS: DefendPick[] = ['cover-inside', 'cover-outside', 'defend-hard'];

/** The mind game (action spec A1): the pass chance before the cars' odds, and the chance of
 * contact, for each attack against each defence. Covering the side the attacker goes shuts
 * the door; guessing wrong leaves it open. Defending hard beats the switchback but risks
 * contact with a straight dive. */
export const DUEL: Record<AttackPick, Record<DefendPick, { pass: number; contact: number }>> = {
  inside: {
    'cover-inside': { pass: 0.15, contact: 0.03 },
    'cover-outside': { pass: 0.75, contact: 0.02 },
    'defend-hard': { pass: 0.35, contact: 0.15 },
  },
  outside: {
    'cover-inside': { pass: 0.65, contact: 0.02 },
    'cover-outside': { pass: 0.12, contact: 0.03 },
    'defend-hard': { pass: 0.3, contact: 0.12 },
  },
  switchback: {
    'cover-inside': { pass: 0.7, contact: 0.02 },
    'cover-outside': { pass: 0.4, contact: 0.03 },
    'defend-hard': { pass: 0.15, contact: 0.08 },
  },
  wait: {
    'cover-inside': { pass: 0.04, contact: 0 },
    'cover-outside': { pass: 0.04, contact: 0 },
    'defend-hard': { pass: 0.04, contact: 0 },
  },
};

export type GremlinKind = 'ers' | 'flatspot' | 'slowstop';

// --- Setup, calls, state ---------------------------------------------------------------------

export type PlayerIndex = 0 | 1;

export interface VersusPlayer {
  name: string;
  car: string;
  startTyre: Compound;
  /** Fuel margin, kg over the standard load (the headset's range). */
  fuelMargin?: number;
}

export interface VersusSetup {
  track: string;
  seed: number;
  players: [VersusPlayer, VersusPlayer];
}

/** A player's call. `pit`: box at the end of `lap` (the stop is charged on lap + 1). `mode`: a
 * headset setting from `lap` on. `move`: a battle move for `lap` only. */
export type VersusCall = { player: PlayerIndex; lap: number } & (
  | { kind: 'pit'; compound: Compound }
  | { kind: 'mode'; key: keyof Modes; value: string }
  | { kind: 'move'; move: BattleMove }
  /** A battle pick for `lap`'s battle (attack or defence), with or without a boost. */
  | { kind: 'battle'; pick: BattlePick; boost: boolean }
  /** The restart after a SC, on `lap` (the first green lap): jump early, or go normally. */
  | { kind: 'restart'; jump: 'early' | 'normal' }
);

export interface VersusCarState {
  player: PlayerIndex;
  car: string;
  compound: Compound;
  tyreAge: number;
  tyreWear: number;
  compoundsUsed: Compound[];
  totalTime: number;
  fuel: number;
  battery: number;
  modes: Modes;
  /** Front wing damage: seconds a lap until the next stop (it changes the nose). */
  wing: number;
  pittedThisLap: boolean;
  stops: number;
  /** Boosts left for battles. */
  boosts: number;
  /** Gremlins (action spec A4): no boost or deploy before this lap; a flat-spotted set (until
   * the next stop); the next stop runs slow. */
  ersFaultUntil: number;
  flatSpot: boolean;
  slowStop: boolean;
}

export type VersusFlag = 'green' | 'sc' | 'vsc';

export interface VersusNote {
  lap: number;
  player: PlayerIndex;
  kind:
    | 'pit'
    | 'pass'
    | 'held'
    | 'contact'
    | 'wing'
    | 'error'
    | 'fuel'
    | 'battle'
    | 'gremlin'
    | 'penalty'
    | 'jump';
  /** A battle: `attack|defence|result|boosts` (result pass, held, wait or contact; boosts the
   * attacker's then the defender's, 1 or 0); a gremlin: its kind; a pit stop: the tyre. */
  detail?: string;
}

export interface VersusState {
  lap: number;
  flag: VersusFlag;
  nextFlag: VersusFlag;
  cars: [VersusCarState, VersusCarState];
  notes: VersusNote[];
}

export interface VersusResult {
  /** Road order, first to last (a car that broke the two-compound rule is classified last). */
  order: PlayerIndex[];
  /** Seconds the second car finished behind. */
  gap: number;
  disqualified: PlayerIndex[];
}

interface HeadsetPieces {
  baseErrorRate: number;
  errorCost: number;
  modes: { [K in keyof Modes]: Record<string, ModeEffect> };
  neutralization: { scPerLap: number; vscPerLap: number; scLaps: number; vscLaps: number };
  ers: { startBattery: number; scCharge: number };
  fuel: FuelConfig;
  engineer: {
    battleWindow: number;
    moves: Record<BattleMove, MoveEffect>;
    contactBase: number;
    contactWing: number;
    spinCost: number;
    wingDamage: [number, number];
    noseCost: number;
  };
}

export interface VersusRun {
  setup: VersusSetup;
  model: RaceModel;
  track: VersusTrack;
  headset: HeadsetPieces;
  calls: VersusCall[];
  state: VersusState;
  /** Neutralization per lap, rolled from the seed at the start. */
  neutral: Map<number, Exclude<VersusFlag, 'green'>>;
  rng: Map<number, Rng>;
  /** Lap of the last pass of `player`'s car, for the repass cooldown. */
  passedAt: [number, number];
  /** The big calls raised so far (versusCallsDue), so none is asked twice. */
  asked: Set<string>;
  /** The lap of the last battle fought (a lap's break after one), and the last lap an
   * attacker waited (a better run next time). */
  lastBattle: number;
  waitedAt: number;
  /** The race's gremlin, rolled from the seed (action spec A4), if it has one. */
  gremlin: { player: PlayerIndex; lap: number; kind: GremlinKind } | null;
}

// Random streams: one per purpose and car, so one player's call never shifts the other's draws.
const S_NOISE = 0;
const S_ERROR = 10;
const S_STOP = 20;
const S_PASS = 30;
const S_CONTACT = 40;
const S_EVENTS = 50;
const S_BATTLE = 60;
const S_AUTO = 70;
const S_JUMP = 80;

function stream(run: VersusRun, id: number): Rng {
  let r = run.rng.get(id);
  if (!r) {
    r = mulberry32(deriveSeed(run.setup.seed, id));
    run.rng.set(id, r);
  }
  return r;
}

export function versusTrack(id: string): VersusTrack {
  const t = VERSUS_TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`no versus track ${id}`);
  return t;
}

export function versusCar(id: string): VersusCar {
  const c = VERSUS_CARS.find((x) => x.id === id);
  if (!c) throw new Error(`no versus car ${id}`);
  return c;
}

const HEADSET = (headsetConfig as unknown as Record<string, HeadsetPieces>)['2014-2025'] as
  | HeadsetPieces
  | undefined;

/** The race file's lap a versus lap runs as: the last 20 laps, so the fuel effect fits. */
function modelLap(run: VersusRun, lap: number): number {
  return run.model.race.laps - VERSUS_LAPS + lap;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Roll the race's one SC or VSC (if any) from the seed: NEUTRAL_CHANCE of one, on a lap
 * between NEUTRAL_FROM and NEUTRAL_TO, a SC or a VSC in the era's ratio of the two. */
function rollNeutral(run: VersusRun): void {
  const n = run.headset.neutralization;
  const r = stream(run, S_EVENTS);
  if (r.next() >= NEUTRAL_CHANCE) return;
  const lap = NEUTRAL_FROM + Math.floor(r.next() * (NEUTRAL_TO - NEUTRAL_FROM + 1));
  const flag = r.next() < n.scPerLap / (n.scPerLap + n.vscPerLap) ? 'sc' : 'vsc';
  // A SC runs 3-4 laps, a VSC 2 (shorter than a full race's: there's no field to clear).
  const laps = flag === 'sc' ? 3 + Math.floor(r.next() * 2) : n.vscLaps;
  for (let k = 0; k < laps && lap + k <= VERSUS_LAPS; k++) run.neutral.set(lap + k, flag);
}

/** Roll the race's gremlin (if any) from the seed: GREMLIN_CHANCE of one, on one car. */
function rollGremlin(run: VersusRun): void {
  const r = stream(run, S_EVENTS + 2);
  if (r.next() >= GREMLIN_CHANCE) return;
  const player: PlayerIndex = r.next() < 0.5 ? 0 : 1;
  const lap = GREMLIN_FROM + Math.floor(r.next() * (GREMLIN_TO - GREMLIN_FROM + 1));
  const kinds: GremlinKind[] = ['ers', 'flatspot', 'slowstop'];
  run.gremlin = { player, lap, kind: kinds[Math.floor(r.next() * kinds.length)] as GremlinKind };
}

export function initVersus(
  model: RaceModel,
  setup: VersusSetup,
  calls: VersusCall[] = [],
): VersusRun {
  const headset = HEADSET;
  if (!headset) throw new Error('versus needs the 2014-2025 headset');
  const track = versusTrack(setup.track);
  const cars = setup.players.map((p, i) => {
    for (const c of [p.startTyre]) {
      if (!model.compounds[c]) throw new Error(`no compound ${c} at ${track.name}`);
    }
    const stats = versusCar(p.car).stats;
    const burn = headset.fuel.burnPerLap * (1 - STAT_SCALE.fuelUse * stats.fuelUse);
    const margin = Math.min(
      headset.fuel.marginMax,
      Math.max(headset.fuel.marginMin, p.fuelMargin ?? 0),
    );
    return {
      player: i as PlayerIndex,
      car: p.car,
      compound: p.startTyre,
      tyreAge: 0,
      tyreWear: 0,
      compoundsUsed: [p.startTyre],
      totalTime: 0,
      fuel: burn * VERSUS_LAPS + margin,
      battery: headset.ers.startBattery,
      modes: { ...DEFAULT_MODES },
      wing: 0,
      pittedThisLap: false,
      stops: 0,
      boosts: BOOSTS,
      ersFaultUntil: 0,
      flatSpot: false,
      slowStop: false,
    } satisfies VersusCarState;
  }) as [VersusCarState, VersusCarState];
  const run: VersusRun = {
    setup,
    model,
    track,
    headset,
    calls: [],
    state: { lap: 0, flag: 'green', nextFlag: 'green', cars, notes: [] },
    neutral: new Map(),
    rng: new Map(),
    passedAt: [-99, -99],
    asked: new Set(),
    lastBattle: -99,
    waitedAt: -99,
    gremlin: null,
  };
  // Who starts in front comes from the seed.
  const front = stream(run, S_EVENTS + 1).next() < 0.5 ? 0 : 1;
  cars[front === 0 ? 1 : 0].totalTime = GRID_GAP;
  rollNeutral(run);
  rollGremlin(run);
  run.state.nextFlag = run.neutral.get(1) ?? 'green';
  for (const c of calls) callVersus(run, c);
  return run;
}

/** Add a player's call (it must be for a lap still to run). */
export function callVersus(run: VersusRun, call: VersusCall): void {
  if (call.lap <= run.state.lap) throw new Error(`lap ${call.lap} has already run`);
  if (call.lap > VERSUS_LAPS) throw new Error(`lap ${call.lap} is past the flag`);
  if (call.kind === 'pit' && !run.model.compounds[call.compound])
    throw new Error(`no compound ${call.compound}`);
  if (call.kind === 'mode' && !run.headset.modes[call.key]?.[call.value])
    throw new Error(`no mode ${call.key}=${call.value}`);
  if (call.kind === 'move' && !run.headset.engineer.moves[call.move])
    throw new Error(`no move ${call.move}`);
  if (
    call.kind === 'battle' &&
    !(ATTACK_PICKS as string[]).concat(DEFEND_PICKS).includes(call.pick)
  )
    throw new Error(`no battle pick ${call.pick}`);
  run.calls.push(call);
}

export function versusFinished(run: VersusRun): boolean {
  return run.state.lap >= VERSUS_LAPS;
}

function modeEffect(run: VersusRun, car: VersusCarState, key: keyof Modes): ModeEffect {
  if (car.modes[key] === DEFAULT_MODES[key]) return {};
  const e = run.headset.modes[key]?.[car.modes[key]] ?? {};
  if (key === 'ers' && (e.charge ?? 0) < 0 && car.battery <= 0) return {};
  // An ERS fault: no deploying until it's fixed.
  if (key === 'ers' && (e.charge ?? 0) < 0 && run.state.lap + 1 < car.ersFaultUntil) return {};
  return e;
}

/** The car's pace on this track from its stats (negative = faster), s a lap. */
export function statPace(track: VersusTrack, stats: CarStats): number {
  const s = track.straightShare;
  // Weighed against the average track, so neither stat is worth more everywhere.
  const top = s / MEAN_SHARE;
  const corner = (1 - s) / (1 - MEAN_SHARE);
  return -STAT_SCALE.pace * (stats.topSpeed * top + stats.cornering * corner);
}

/** The calls for `lap`, in a fixed order (player, then the order they were made). */
function callsFor(run: VersusRun, lap: number): VersusCall[] {
  return run.calls
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c.lap === lap)
    .sort((a, b) => a.c.player - b.c.player || a.i - b.i)
    .map((x) => x.c);
}

/** Run one lap. */
export function stepVersus(run: VersusRun): VersusState {
  const { model, state, headset, track } = run;
  if (versusFinished(run)) return state;
  const lap = state.lap + 1;
  const flag = run.neutral.get(lap);
  const cars = state.cars;
  // Whether this lap is a battle, from the state before it (as versusCallsDue raised it).
  const due = battleDue(run);
  const moves: [BattleMove | null, BattleMove | null] = [null, null];
  const picks: [
    { pick: BattlePick; boost: boolean } | null,
    { pick: BattlePick; boost: boolean } | null,
  ] = [null, null];
  const jumps: ['early' | 'normal' | null, 'early' | 'normal' | null] = [null, null];
  for (const c of callsFor(run, lap)) {
    const car = cars[c.player];
    if (c.kind === 'mode') (car.modes as unknown as Record<string, string>)[c.key] = c.value;
    if (c.kind === 'move') moves[c.player] = c.move;
    if (c.kind === 'battle') picks[c.player] = { pick: c.pick, boost: c.boost };
    if (c.kind === 'restart') jumps[c.player] = c.jump;
  }
  // The race's gremlin strikes at the start of its lap.
  const g = run.gremlin;
  if (g && g.lap === lap) {
    const car = cars[g.player];
    if (g.kind === 'ers') {
      car.ersFaultUntil = lap + ERS_FAULT_LAPS;
      car.battery = 0;
    } else if (g.kind === 'flatspot') car.flatSpot = true;
    else car.slowStop = true;
    state.notes.push({ lap, player: g.player, kind: 'gremlin', detail: g.kind });
  }
  // A pit call made for the previous lap boxes now: its stop is charged on this lap.
  const boxing = callsFor(run, lap - 1).filter((c) => c.kind === 'pit');

  const green = model.track.greenLapTime ?? 90;
  const scTime = model.track.scLapTime || green * SC_FALLBACK;
  const vscTime = model.track.vscLapTime || green * VSC_FALLBACK;
  const base = median(model.drivers.map((d) => d.basePace));
  const noise = median(model.drivers.map((d) => d.noise));
  const prev: [number, number] = [cars[0].totalTime, cars[1].totalTime];
  const leader: PlayerIndex = prev[0] <= prev[1] ? 0 : 1;
  const gap = Math.abs(prev[0] - prev[1]);
  const inBattle = !flag && gap < headset.engineer.battleWindow;
  const clean: [number, number] = [0, 0];

  for (const car of cars) {
    const p = car.player;
    const stats = versusCar(car.car).stats;
    car.pittedThisLap = false;
    let pitCost = 0;
    const stop = boxing.find((c) => c.player === p);
    if (stop && stop.kind === 'pit') {
      const devs = model.track.pitLossDeviations ?? [];
      const dev = devs.length
        ? (devs[Math.floor(stream(run, S_STOP + p).next() * devs.length)] as number)
        : 0;
      const loss =
        flag === 'sc'
          ? model.track.pitLossUnderSC
          : flag === 'vsc'
            ? model.track.pitLossUnderVSC
            : model.track.pitLoss + dev;
      pitCost = loss - STAT_SCALE.pitCrew * stats.pitCrew + (flag ? 0 : OUT_LAP_COST);
      if (car.slowStop) {
        pitCost += SLOW_STOP;
        car.slowStop = false;
      }
      car.flatSpot = false;
      if (car.wing > 0) {
        pitCost += headset.engineer.noseCost;
        car.wing = 0;
      }
      car.compound = stop.compound;
      if (!car.compoundsUsed.includes(stop.compound)) car.compoundsUsed.push(stop.compound);
      car.tyreAge = 0;
      car.tyreWear = 0;
      car.pittedThisLap = true;
      car.stops++;
      state.notes.push({ lap, player: p, kind: 'pit', detail: stop.compound });
    }

    const move = inBattle ? moves[p] : null;
    const mv: MoveEffect = move ? headset.engineer.moves[move] : {};
    const pace = modeEffect(run, car, 'pace');
    const worn = (pace.lapDelta ?? 0) < 0 && car.tyreWear >= lifeOf(model, car.compound);
    const modeDelta = flag
      ? 0
      : (worn ? 0 : (pace.lapDelta ?? 0)) +
        (modeEffect(run, car, 'fuel').lapDelta ?? 0) +
        (modeEffect(run, car, 'battle').lapDelta ?? 0) +
        (modeEffect(run, car, 'ers').lapDelta ?? 0) +
        (mv.lapDelta ?? 0);
    // Fuel off the standard load (what the fitted fuel effect assumes) moves the lap time.
    const f = headset.fuel;
    const fuelDelta =
      car.fuel <= 0
        ? f.dryLapDelta
        : (model.fuelEffectPerLap / f.burnPerLap) *
          (car.fuel - f.burnPerLap * (VERSUS_LAPS - lap + 1));
    const dry =
      tyreLapTime(model, base, car.compound, car.tyreWear, modelLap(run, lap)) +
      freshTyreDelta(model, car.tyreAge) +
      statPace(track, stats);
    clean[p] = dry + modeDelta + (flag ? 0 : fuelDelta) + car.wing;

    let lt: number;
    if (flag === 'sc') lt = scTime;
    else if (flag === 'vsc') lt = vscTime;
    else {
      lt = clean[p] + stream(run, S_NOISE + p).normal(noise);
      if (p !== leader && gap < DIRTY_AIR_RANGE)
        lt += model.track.dirtyAirPenalty * DIRTY_AIR_SHARE;
      const errorMult =
        (pace.errorMult ?? 1) *
        (modeEffect(run, car, 'fuel').errorMult ?? 1) *
        (modeEffect(run, car, 'battle').errorMult ?? 1);
      const rate = headset.baseErrorRate * Math.max(0, errorMult - 1);
      if (rate > 0 && stream(run, S_ERROR + p).next() < rate) {
        lt += headset.errorCost;
        state.notes.push({ lap, player: p, kind: 'error' });
      }
    }
    car.totalTime += lt + pitCost;
    car.tyreAge += 1;
    car.tyreWear +=
      (flag
        ? 1
        : (pace.wearMult ?? 1) *
          (modeEffect(run, car, 'fuel').wearMult ?? 1) *
          (mv.wearMult ?? 1)) *
      (1 - STAT_SCALE.tyreWear * stats.tyreWear) *
      (car.flatSpot ? FLAT_SPOT_WEAR : 1);
    const charge = flag ? headset.ers.scCharge : (modeEffect(run, car, 'ers').charge ?? 0);
    car.battery = Math.min(100, Math.max(0, car.battery + charge + (mv.battery ?? 0)));
    if (car.fuel > 0) {
      const burn =
        f.burnPerLap *
        (1 - STAT_SCALE.fuelUse * stats.fuelUse) *
        (flag
          ? f.neutralBurn
          : (pace.burnMult ?? 1) * (modeEffect(run, car, 'fuel').burnMult ?? 1));
      car.fuel = Math.max(0, car.fuel - burn);
      if (car.fuel <= 0) state.notes.push({ lap, player: p, kind: 'fuel', detail: 'empty' });
    }
  }

  if (flag === 'sc' && run.neutral.get(lap + 1) !== 'sc') {
    // The last SC lap: the two cars bunch up behind it.
    const [a, b] = cars[0].totalTime <= cars[1].totalTime ? [cars[0], cars[1]] : [cars[1], cars[0]];
    if (b.totalTime - a.totalTime > BUNCH_GAP) b.totalTime = a.totalTime + BUNCH_GAP;
  } else if (!flag) {
    // The restart: a jump is a gamble on the stewards.
    for (const car of cars) {
      if (jumps[car.player] !== 'early') continue;
      if (stream(run, S_JUMP + car.player).next() < JUMP_RISK) {
        car.totalTime += JUMP_PENALTY;
        state.notes.push({ lap, player: car.player, kind: 'penalty', detail: 'jump' });
      } else {
        car.totalTime -= JUMP_GAIN;
        state.notes.push({ lap, player: car.player, kind: 'jump' });
      }
    }
    if (!cars[0].pittedThisLap && !cars[1].pittedThisLap) {
      // Every pass is a battle both players play (action spec A1); between battles the car
      // behind can close up but not get by.
      if (due) duel(run, lap, clean, due, picks);
      else holdBehind(run, prev);
    }
  }

  state.lap = lap;
  state.flag = flag ?? 'green';
  state.nextFlag = run.neutral.get(lap + 1) ?? 'green';
  return state;
}

/** Between battles: the car behind closes up but can't get by. */
function holdBehind(run: VersusRun, prev: [number, number]): void {
  const ahead: PlayerIndex = prev[0] <= prev[1] ? 0 : 1;
  const a = run.state.cars[ahead];
  const b = run.state.cars[ahead === 0 ? 1 : 0];
  if (prev[b.player] - prev[ahead] < PASS_WINDOW && b.totalTime < a.totalTime + FOLLOW_GAP)
    b.totalTime = a.totalTime + FOLLOW_GAP;
}

/** A battle due on the next lap (action spec A1): the cars start a green lap within
 * BATTLE_GAP, neither is on its out-lap, and it isn't the lap straight after a battle (unless
 * the attacker waited for a better run). Where: one of the track's battle corners, by lap. */
export function battleDue(
  run: VersusRun,
): { lap: number; attacker: PlayerIndex; corner: number; at: number } | null {
  const { state } = run;
  const lap = state.lap + 1;
  if (lap > VERSUS_LAPS || state.nextFlag !== 'green') return null;
  const [a, b] = state.cars;
  if (Math.abs(a.totalTime - b.totalTime) >= BATTLE_GAP) return null;
  if (run.calls.some((c) => c.kind === 'pit' && c.lap === lap - 1)) return null;
  if (lap - run.lastBattle <= 1 && run.waitedAt !== run.lastBattle) return null;
  const attacker: PlayerIndex = a.totalTime <= b.totalTime ? 1 : 0;
  const cs = run.track.battleCorners;
  const c = cs[(lap + run.setup.seed) % cs.length] as { corner: number; at: number };
  return { lap, attacker, corner: c.corner, at: c.at };
}

/** Can this car boost in a battle on `lap`? */
export function canBoost(car: VersusCarState, lap: number): boolean {
  return car.boosts > 0 && lap >= car.ersFaultUntil;
}

/** The driver's own pick (no answer, or a replay that doesn't know the player's): a mix, as
 * a racer would. */
export function autoPick(run: VersusRun, player: PlayerIndex, attack: boolean): BattlePick {
  const r = stream(run, S_AUTO + player).next();
  if (attack) return r < 0.35 ? 'inside' : r < 0.6 ? 'outside' : r < 0.8 ? 'switchback' : 'wait';
  return r < 0.45 ? 'cover-inside' : r < 0.8 ? 'cover-outside' : 'defend-hard';
}

/** The battle (action spec A1): the attacker's pick against the defender's, the cars' odds
 * (boosts, a better run after waiting, top speed, tyres), then contact, a pass or a hold. */
function duel(
  run: VersusRun,
  lap: number,
  clean: [number, number],
  due: NonNullable<ReturnType<typeof battleDue>>,
  picks: [{ pick: BattlePick; boost: boolean } | null, { pick: BattlePick; boost: boolean } | null],
): void {
  const { headset, track } = run;
  const atk = due.attacker;
  const def: PlayerIndex = atk === 0 ? 1 : 0;
  const a = run.state.cars[def];
  const b = run.state.cars[atk];
  const pa = picks[atk];
  const pd = picks[def];
  const ap = (
    pa && (ATTACK_PICKS as string[]).includes(pa.pick) ? pa.pick : autoPick(run, atk, true)
  ) as AttackPick;
  const dp = (
    pd && (DEFEND_PICKS as string[]).includes(pd.pick) ? pd.pick : autoPick(run, def, false)
  ) as DefendPick;
  const boostA = !!pa?.boost && canBoost(b, lap);
  const boostD = !!pd?.boost && canBoost(a, lap);
  if (boostA) b.boosts--;
  if (boostD) a.boosts--;
  const cell = DUEL[ap][dp];
  const shift =
    BOOST_LOGIT * ((boostA ? 1 : 0) - (boostD ? 1 : 0)) +
    (run.waitedAt === lap - 1 ? WAIT_LOGIT : 0) +
    STAT_SCALE.passLogit *
      track.straightShare *
      (versusCar(b.car).stats.topSpeed - versusCar(a.car).stats.topSpeed) +
    PACE_LOGIT * (clean[def] - clean[atk]);
  const z = Math.log(cell.pass / (1 - cell.pass)) + (ap === 'wait' ? 0 : shift);
  const passChance = 1 / (1 + Math.exp(-z));
  const r = stream(run, S_BATTLE);
  let result: 'pass' | 'held' | 'wait' | 'contact';
  if (r.next() < cell.contact) {
    result = 'contact';
    const hit = r.next() < 0.5 ? a : b;
    if (r.next() < headset.engineer.contactWing) {
      const [lo, hi] = headset.engineer.wingDamage;
      hit.wing = lo + (hi - lo) * r.next();
      run.state.notes.push({ lap, player: hit.player, kind: 'wing' });
    } else {
      hit.totalTime += headset.engineer.spinCost;
      run.state.notes.push({ lap, player: hit.player, kind: 'contact', detail: 'spin' });
    }
  } else if (r.next() < passChance) {
    result = 'pass';
    if (b.totalTime >= a.totalTime - PASS_MARGIN) b.totalTime = a.totalTime - HELD_GAP / 2;
    run.passedAt[def] = lap;
    run.state.notes.push({ lap, player: atk, kind: 'pass' });
  } else {
    result = ap === 'wait' ? 'wait' : 'held';
    const behind = ap === 'wait' ? WAIT_GAP : HELD_GAP;
    if (b.totalTime < a.totalTime + behind) b.totalTime = a.totalTime + behind;
    run.state.notes.push({ lap, player: def, kind: 'held' });
  }
  run.lastBattle = lap;
  if (ap === 'wait') run.waitedAt = lap;
  run.state.notes.push({
    lap,
    player: atk,
    kind: 'battle',
    detail: `${ap}|${dp}|${result}|${boostA ? 1 : 0}${boostD ? 1 : 0}`,
  });
}

/** Two dry compounds run (or a wet tyre), as the real rules ask. */
export function versusRuleMet(car: VersusCarState): boolean {
  const dry = new Set(
    car.compoundsUsed.filter((c) => (DRY_COMPOUNDS as readonly string[]).includes(c)),
  );
  return dry.size >= 2 || car.compoundsUsed.some((c) => c === 'INTERMEDIATE' || c === 'WET');
}

export function classifyVersus(run: VersusRun): VersusResult {
  const [a, b] = run.state.cars;
  const dq = run.state.cars.filter((c) => !versusRuleMet(c)).map((c) => c.player);
  const byTime: PlayerIndex[] = a.totalTime <= b.totalTime ? [0, 1] : [1, 0];
  const order = [...byTime.filter((p) => !dq.includes(p)), ...byTime.filter((p) => dq.includes(p))];
  return { order, gap: Math.abs(a.totalTime - b.totalTime), disqualified: dq };
}

/** Run a whole versus race with these calls. */
export function simulateVersus(
  model: RaceModel,
  setup: VersusSetup,
  calls: VersusCall[],
): { run: VersusRun; result: VersusResult } {
  const run = initVersus(model, setup, calls);
  while (!versusFinished(run)) stepVersus(run);
  return { run, result: classifyVersus(run) };
}

// --- The big calls (spec V3) ------------------------------------------------------------------

export type VersusMomentKind =
  | 'pitWindow'
  | 'neutral'
  | 'theyPitted'
  | 'undercut'
  | 'cover'
  | 'restart'
  | 'battle';

/** The strategy calls, graded at the flag (battles and the restart are not). */
export const GRADED_KINDS: VersusMomentKind[] = [
  'pitWindow',
  'neutral',
  'theyPitted',
  'undercut',
  'cover',
];

/** A big call for one player at the pause before lap `lap`. Both browsers raise the same ones. */
export interface VersusMoment {
  player: PlayerIndex;
  kind: VersusMomentKind;
  /** The lap the answer acts on (a stop called now boxes at the end of it). */
  lap: number;
  /** Options: stop (pick a tyre) or stay out; the restart's jump; a battle's picks. */
  options: ('box' | 'stay' | 'early' | 'normal' | BattlePick)[];
  /** A battle: who attacks, at which corner (its place round the lap), and whether this
   * player can boost. */
  battle?: { attacker: PlayerIndex; corner: number; at: number; canBoost: boolean };
}

/** Tyres within this many laps of their drop-off, with more laps than that to go: the
 * tyre call (they won't make the flag). */
export const PIT_WINDOW_NEAR = 3;
/** The undercut and cover calls: the cars this close (s), the tyres at least this old, and
 * asked at most once in this many laps. */
export const UNDERCUT_GAP = 3;
export const UNDERCUT_AGE = 5;
export const UNDERCUT_EVERY = 3;

/** The big calls due now, before the next lap runs, in a fixed order (by player). Each is
 * raised once: calling this marks them asked. Strategy calls come first; once they're
 * answered, calling again raises the lap's battle (if it has one). */
export function versusCallsDue(run: VersusRun): VersusMoment[] {
  const { state } = run;
  const lap = state.lap + 1;
  if (lap > VERSUS_LAPS) return [];
  const out: VersusMoment[] = [];
  const raise = (
    player: PlayerIndex,
    kind: VersusMomentKind,
    key: string,
    options: VersusMoment['options'],
  ) => {
    const id = `${player}:${key}`;
    if (run.asked.has(id)) return;
    run.asked.add(id);
    out.push({ player, kind, lap, options });
  };
  const booked = (p: PlayerIndex) =>
    run.calls.some((c) => c.player === p && c.kind === 'pit' && c.lap >= state.lap);
  const owes = (c: VersusCarState) => !versusRuleMet(c);
  const left = VERSUS_LAPS - state.lap;
  for (const car of state.cars) {
    const p = car.player;
    const other = state.cars[p === 0 ? 1 : 0];
    // The SC goes in: the restart.
    if (state.flag === 'sc' && state.nextFlag === 'green') {
      raise(p, 'restart', `restart-${lap}`, ['early', 'normal']);
      continue;
    }
    if (booked(p)) continue;
    // A SC or VSC is coming out: a cheap stop.
    if (state.nextFlag !== 'green' && state.flag === 'green') {
      if (lap < VERSUS_LAPS) raise(p, 'neutral', `neutral-${lap}`, ['box', 'stay']);
      continue;
    }
    if (state.flag !== 'green' || lap >= VERSUS_LAPS) continue;
    // The last lap a stop can still be made, with it still owed: the last chance.
    if (owes(car) && lap === VERSUS_LAPS - 1) {
      raise(p, 'pitWindow', 'last', ['box', 'stay']);
      continue;
    }
    // The other car stopped on the lap just run.
    if (other.pittedThisLap && !car.pittedThisLap && lap < VERSUS_LAPS - 1) {
      raise(p, 'theyPitted', `they-${state.lap}`, ['box', 'stay']);
      continue;
    }
    const gap = car.totalTime - other.totalTime; // > 0: behind
    const life = lifeOf(run.model, car.compound) - car.tyreWear;
    const lifeOther = lifeOf(run.model, other.compound) - other.tyreWear;
    // A stop would change something: it's owed, or the tyres won't reach the flag.
    const wants = (c: VersusCarState, l: number) => owes(c) || l < left;
    const window = lap >= 3 && lap <= VERSUS_LAPS - 2;
    const slot = Math.floor(lap / UNDERCUT_EVERY);
    // Close behind, on old tyres, the other car not stopped since you: the undercut.
    if (
      window &&
      gap > 0 &&
      gap < UNDERCUT_GAP &&
      car.tyreAge >= UNDERCUT_AGE &&
      other.stops <= car.stops &&
      wants(car, life)
    ) {
      raise(p, 'undercut', `undercut-${car.stops}-${slot}`, ['box', 'stay']);
      continue;
    }
    // Close ahead, and the car behind could undercut you: cover it, or go long.
    if (
      window &&
      gap < 0 &&
      -gap < UNDERCUT_GAP &&
      other.tyreAge >= UNDERCUT_AGE &&
      car.tyreAge >= UNDERCUT_AGE - 1 &&
      other.stops <= car.stops &&
      wants(other, lifeOther) &&
      wants(car, life)
    ) {
      raise(p, 'cover', `cover-${car.stops}-${slot}`, ['box', 'stay']);
      continue;
    }
    // The tyres won't reach the flag and are nearly done.
    if (life <= PIT_WINDOW_NEAR && life < left - 1) {
      raise(p, 'pitWindow', `wear-${car.stops}`, ['box', 'stay']);
    }
  }
  if (out.length) return out;
  // No strategy call this lap (or they're answered): the battle, both players at once.
  const due = battleDue(run);
  if (due && !run.asked.has(`battle-${lap}`)) {
    run.asked.add(`battle-${lap}`);
    for (const p of [0, 1] as PlayerIndex[]) {
      const attack = p === due.attacker;
      out.push({
        player: p,
        kind: 'battle',
        lap,
        options: attack ? [...ATTACK_PICKS] : [...DEFEND_PICKS],
        battle: {
          attacker: due.attacker,
          corner: due.corner,
          at: due.at,
          canBoost: canBoost(state.cars[p], lap),
        },
      });
    }
  }
  return out;
}
