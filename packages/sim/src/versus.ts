// Versus mode (docs/versus-spec.md): a custom 20-lap race on a real track's measured numbers
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
}

export const VERSUS_TRACKS: VersusTrack[] = [
  {
    id: 'monza',
    name: 'Monza',
    raceFile: 'italy-2024',
    straightShare: 0.78,
    character: 'Long straights: top speed pays',
  },
  {
    id: 'spa',
    name: 'Spa',
    raceFile: 'belgium-2024',
    straightShare: 0.72,
    character: 'Power and fast corners',
  },
  {
    id: 'bahrain',
    name: 'Bahrain',
    raceFile: 'bahrain-2022',
    straightShare: 0.65,
    character: 'Rough surface: hard on tyres',
  },
  {
    id: 'suzuka',
    name: 'Suzuka',
    raceFile: 'japan-2024',
    straightShare: 0.66,
    character: 'Flowing corners',
  },
  {
    id: 'hungaroring',
    name: 'Hungaroring',
    raceFile: 'hungary-2025',
    straightShare: 0.56,
    character: 'Twisty and hard to pass: cornering pays',
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
/** Chance a versus race has a SC or VSC (about one in three, spec V1). */
export const NEUTRAL_CHANCE = 1 / 3;

export const VERSUS_LAPS = 20;
/** The grid: the second car starts this far behind the first. */
export const GRID_GAP = 0.3;
/** A SC or VSC can start on these laps. */
export const NEUTRAL_FROM = 4;
export const NEUTRAL_TO = 17;

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
}

export type VersusFlag = 'green' | 'sc' | 'vsc';

export interface VersusNote {
  lap: number;
  player: PlayerIndex;
  kind: 'pit' | 'pass' | 'held' | 'contact' | 'wing' | 'error' | 'fuel';
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
}

// Random streams: one per purpose and car, so one player's call never shifts the other's draws.
const S_NOISE = 0;
const S_ERROR = 10;
const S_STOP = 20;
const S_PASS = 30;
const S_CONTACT = 40;
const S_EVENTS = 50;

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
  };
  // Who starts in front comes from the seed.
  const front = stream(run, S_EVENTS + 1).next() < 0.5 ? 0 : 1;
  cars[front === 0 ? 1 : 0].totalTime = GRID_GAP;
  rollNeutral(run);
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
  run.calls.push(call);
}

export function versusFinished(run: VersusRun): boolean {
  return run.state.lap >= VERSUS_LAPS;
}

function modeEffect(run: VersusRun, car: VersusCarState, key: keyof Modes): ModeEffect {
  if (car.modes[key] === DEFAULT_MODES[key]) return {};
  const e = run.headset.modes[key]?.[car.modes[key]] ?? {};
  if (key === 'ers' && (e.charge ?? 0) < 0 && car.battery <= 0) return {};
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
  const moves: [BattleMove | null, BattleMove | null] = [null, null];
  for (const c of callsFor(run, lap)) {
    const car = cars[c.player];
    if (c.kind === 'mode') (car.modes as unknown as Record<string, string>)[c.key] = c.value;
    if (c.kind === 'move') moves[c.player] = c.move;
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
      pitCost = loss - STAT_SCALE.pitCrew * stats.pitCrew;
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
      if (p !== leader && gap < DIRTY_AIR_RANGE) lt += model.track.dirtyAirPenalty;
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
      (1 - STAT_SCALE.tyreWear * stats.tyreWear);
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
  } else if (!flag && !cars[0].pittedThisLap && !cars[1].pittedThisLap) {
    fight(run, lap, prev, clean, moves, inBattle);
  }

  state.lap = lap;
  state.flag = flag ?? 'green';
  state.nextFlag = run.neutral.get(lap + 1) ?? 'green';
  return state;
}

/** The follower's one pass roll a lap within PASS_WINDOW, as in the solo sim, with both
 * players' headset settings and battle moves, and the top-speed stat. */
function fight(
  run: VersusRun,
  lap: number,
  prev: [number, number],
  clean: [number, number],
  moves: [BattleMove | null, BattleMove | null],
  inBattle: boolean,
): void {
  const { headset, track } = run;
  const ahead: PlayerIndex = prev[0] <= prev[1] ? 0 : 1;
  const behind: PlayerIndex = ahead === 0 ? 1 : 0;
  const a = run.state.cars[ahead];
  const b = run.state.cars[behind];
  const gap = prev[behind] - prev[ahead];
  if (!(gap >= 0 && gap < PASS_WINDOW)) return;
  const mvA: MoveEffect = inBattle && moves[ahead] ? headset.engineer.moves[moves[ahead]] : {};
  const mvB: MoveEffect = inBattle && moves[behind] ? headset.engineer.moves[moves[behind]] : {};
  const speed =
    STAT_SCALE.passLogit *
    track.straightShare *
    (versusCar(b.car).stats.topSpeed - versusCar(a.car).stats.topSpeed);
  const shift =
    (modeEffect(run, b, 'battle').attackLogit ?? 0) +
    (modeEffect(run, a, 'battle').defendLogit ?? 0) +
    (modeEffect(run, b, 'ers').attackLogit ?? 0) +
    (modeEffect(run, a, 'ers').defendLogit ?? 0) +
    (mvB.attackLogit ?? 0) +
    (mvA.defendLogit ?? 0) +
    speed;
  // A fight with a move called can end in contact: the riskier move takes the hit.
  if (inBattle && (moves[0] || moves[1])) {
    const risk = Math.max(mvA.contact ?? 1, mvB.contact ?? 1);
    if (stream(run, S_CONTACT).next() < headset.engineer.contactBase * risk) {
      const hit = (mvB.contact ?? 1) >= (mvA.contact ?? 1) ? b : a;
      const r = stream(run, S_CONTACT + 1);
      if (r.next() < headset.engineer.contactWing) {
        const [lo, hi] = headset.engineer.wingDamage;
        hit.wing = lo + (hi - lo) * r.next();
        run.state.notes.push({ lap, player: hit.player, kind: 'wing' });
      } else {
        hit.totalTime += headset.engineer.spinCost;
        run.state.notes.push({ lap, player: hit.player, kind: 'contact', detail: 'spin' });
      }
      return;
    }
  }
  const cooling = lap - run.passedAt[behind] <= REPASS_COOLDOWN;
  const advantage = clean[ahead] - clean[behind];
  const roll = stream(run, S_PASS + behind).next();
  if (!cooling && roll < passProbability(run.model.track.overtakeModel, advantage, gap, shift)) {
    run.passedAt[ahead] = lap;
    if (b.totalTime >= a.totalTime) b.totalTime = a.totalTime - PASS_MARGIN;
    run.state.notes.push({ lap, player: behind, kind: 'pass' });
  } else if (b.totalTime < a.totalTime + FOLLOW_GAP) {
    b.totalTime = a.totalTime + FOLLOW_GAP;
    if (inBattle) run.state.notes.push({ lap, player: ahead, kind: 'held' });
  }
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

export type VersusMomentKind = 'pitWindow' | 'neutral' | 'theyPitted' | 'finalLaps';

/** A big call for one player at the pause before lap `lap`. Both browsers raise the same ones. */
export interface VersusMoment {
  player: PlayerIndex;
  kind: VersusMomentKind;
  /** The lap the answer acts on (a stop called now boxes at the end of it). */
  lap: number;
  /** Options: stop (pick a tyre) or stay out; the final laps pick a battle stance. */
  options: ('box' | 'stay' | 'attack' | 'defend' | 'hold')[];
}

/** A car's tyres are within this many laps of their drop-off: the pit window opens. */
export const PIT_WINDOW_NEAR = 5;
/** From this lap a car that hasn't stopped is asked (one stop is required). */
export const PIT_WINDOW_LAP = 8;
/** A car still without a stop is asked again this many laps later. */
export const PIT_WINDOW_EVERY = 4;
/** The final-laps call: this many laps to go, with the gap under FINAL_GAP. */
export const FINAL_LAPS = 5;
export const FINAL_GAP = 3;

/** The big calls due now, before the next lap runs, in a fixed order (by player). Each is
 * raised once: calling this marks them asked. */
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
  const gap = Math.abs(state.cars[0].totalTime - state.cars[1].totalTime);
  for (const car of state.cars) {
    const p = car.player;
    const other = state.cars[p === 0 ? 1 : 0];
    if (booked(p)) continue;
    // A SC or VSC is coming out: a cheap stop.
    if (state.nextFlag !== 'green' && state.flag === 'green') {
      raise(p, 'neutral', `neutral-${lap}`, ['box', 'stay']);
      continue;
    }
    if (state.flag !== 'green') continue;
    // The other car stopped on the lap just run.
    if (other.pittedThisLap && !car.pittedThisLap && lap < VERSUS_LAPS - 1) {
      raise(p, 'theyPitted', `they-${state.lap}`, ['box', 'stay']);
      continue;
    }
    const left = VERSUS_LAPS - state.lap;
    const life = lifeOf(run.model, car.compound) - car.tyreWear;
    if (
      car.stops === 0 &&
      lap >= PIT_WINDOW_LAP &&
      (lap - PIT_WINDOW_LAP) % PIT_WINDOW_EVERY === 0
    ) {
      raise(p, 'pitWindow', `window-${lap}`, ['box', 'stay']);
      continue;
    }
    if (life <= PIT_WINDOW_NEAR && life < left && left > 2) {
      raise(p, 'pitWindow', `wear-${car.stops}`, ['box', 'stay']);
      continue;
    }
    if (left === FINAL_LAPS && gap < FINAL_GAP)
      raise(p, 'finalLaps', 'final', ['attack', 'defend', 'hold']);
  }
  return out;
}
