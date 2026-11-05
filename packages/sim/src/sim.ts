// Lap-loop simulator (Implementation Plan 2.3-2.4): a TypeScript port of the Python
// reference sim (pipeline/src/pipeline/sim_reference.py). The two must agree on every golden
// file in data/golden/ (tests/parity.test.ts); change both together.
//
// A run is fully defined by (race model, seed, decisions). Without decisions every car
// follows its real strategy (validation, golden files). With decisions the user's car is
// player-controlled (pit calls + headset modes) and the rival reacts (rival policy); the
// rest of the field stays scripted. Each car draws from its own random streams, indexed by
// its position in model.drivers: lap noise on deriveSeed(seed, i), its pass attempts on
// deriveSeed(seed, OVERTAKE_STREAM + i), driver errors on deriveSeed(seed, ERROR_STREAM + i).
// One car's calls never shift another car's draws. The no-decision path is the Python
// reference sim's; rival policy and headset effects are TS-only.

import {
  type EngineerConfig,
  applyEngineerCall,
  cloneEngineer,
  isAttack,
  isDefend,
  moodEffect,
  moodOf,
  newEngineer,
  validEngineerCall,
} from './engineer.js';
import headsetConfig from './headset.json';
import { type Rng, deriveSeed, mulberry32 } from './rng.js';
import type {
  CarState,
  Decision,
  EngineerState,
  FlagState,
  Modes,
  PitStop,
  RaceModel,
  RaceNote,
  RaceResult,
  RaceState,
  TrustReason,
} from './types.js';

export const DIRTY_AIR_RANGE = 1.0; // within this gap (s) a car is in dirty air
export const PASS_WINDOW = 2.0; // a follower within this gap (s) gets one pass roll
export const FOLLOW_GAP = 0.3; // a follower that fails to pass is held this far (s) behind
export const PASS_MARGIN = 0.05; // a completed pass puts the follower this far (s) ahead
// A car that has just been passed gets no pass roll against the car that passed it for this
// many laps (real races undo ~4% of passes within 3 laps; without it the sim undid 25-60%).
export const REPASS_COOLDOWN = 3;
export const BUNCH_GAP = 0.5; // SC train spacing per car (measured on the final SC lap)
// SC bunching (measured on the tuning races' SCs, 259 gaps): gaps are kept on the deployment
// lap, each middle SC lap keeps SC_GAP_KEEP of a gap's excess over BUNCH_GAP, and the last lap
// before the restart is nose-to-tail. Mirrors sim_reference.py.
export const SC_GAP_KEEP = 0.34;
export const SC_FALLBACK = 1.6; // SC lap = this x green if not supplied
export const VSC_FALLBACK = 1.35; // VSC lap = this x green if not supplied
export const CLIFF_FALLBACK = 2.0; // extra wear past the cliff = this x degPerLap if not fitted
export const OVERTAKE_STREAM = 1000;
export const ERROR_STREAM = 2000;
export const STOP_STREAM = 4000;
export const EVENT_STREAM = 5000;
export const INCIDENT_STREAM = 6000;
export const CONTACT_STREAM = 7000; // the user's car: contact in a battle (race engineer spec)
export const LIMITS_STREAM = 8000; // the user's car: track-limit strikes
// Rival policy (Implementation Plan 2.5): under green the rival covers a stop only if its own
// next planned stop is within this many laps.
export const COVER_WINDOW = 4;

export type Strategies = Record<string, PitStop[]>;

export interface RunOptions {
  /** Override any car's real strategy (scripted cars; ignored for a player-controlled car). */
  strategies?: Strategies;
  /** The player's calls. When given (even empty), the user's car and the rival go live. */
  decisions?: Decision[];
  /**
   * Live play only: crashes, failures and punctures across the field (headset `incidents`).
   * On by default; off reproduces the real race exactly from the real calls.
   */
  incidents?: boolean;
}

export interface ModeEffect {
  lapDelta?: number;
  wearMult?: number;
  errorMult?: number;
  attackLogit?: number;
  defendLogit?: number;
  /** ERS: battery % gained (+) or spent (-) each green lap. */
  charge?: number;
}

interface IncidentRates {
  crash: number;
  mechanical: number;
  puncture: number;
  puncturePerWornLap: number;
  punctureMax: number;
  pushMechanical: number;
  pushPuncture: number;
  attackCrash: number;
  defendCrash: number;
  punctureCost: number;
  scShare: number;
}

interface HeadsetEra {
  baseErrorRate: number;
  errorCost: number;
  modes: { [K in keyof Modes]: Record<string, ModeEffect> };
  neutralization?: { scPerLap: number; vscPerLap: number; scLaps: number; vscLaps: number };
  ers?: { startBattery: number; scCharge: number };
  incidents?: IncidentRates;
  engineer?: EngineerConfig;
  teamOrders?: {
    holdUpLogit: number;
    holdUpCost: number;
    swapWindow: number;
    swapCost: number;
    swapLaps: number;
  };
}

const HEADSET = headsetConfig as unknown as Record<string, HeadsetEra>;

/** The race engineer config for a model's era (battles, trust...), or null. */
export function engineerConfig(model: RaceModel): EngineerConfig | null {
  return HEADSET[model.era]?.engineer ?? null;
}

/** The headset modes' effects for a model's era (for explaining the options in the game). */
export function modeEffects(model: RaceModel): HeadsetEra['modes'] | null {
  return HEADSET[model.era]?.modes ?? null;
}

export const DEFAULT_MODES: Modes = {
  pace: 'standard',
  fuel: 'normal',
  battle: 'hold',
  ers: 'balanced',
};

/** Internal run state: the public RaceState plus the per-car random streams. */
export interface Run {
  model: RaceModel;
  /** The seed the run's random streams were derived from. */
  seed: number;
  state: RaceState;
  /** The player's calls so far (the run log the Worker replays). */
  decisions: Decision[];
  /** True when the user's car is player-controlled and the rival reacts. */
  live: boolean;
  notes: RaceNote[];
  headset: HeadsetEra | undefined;
  /** Per-car random streams, created on first use (see Streams). */
  rng: Streams;
  /** Per-lap working tables, reused every lap (no allocation in the grader's hot loop). */
  scratch: { prevTime: Record<string, number>; clean: Record<string, number>; pitted: Set<string> };
  /** Neutralizations (start lap, length, flag): the real ones, or a grader fork's view. */
  events: NeutralEvent[];
  /** Neutralization flag per lap, and retirements per lap, precomputed from events. */
  neutral: Map<number, Exclude<FlagState, 'green'>>;
  retireAt: Map<number, string[]>;
  /** Lap of each recent pass, keyed `${passed}>${passer}` (REPASS_COOLDOWN). */
  passedBy: Map<string, number>;
  /** Live play: crashes, failures and punctures happen (RunOptions.incidents). */
  incidents: boolean;
  /** A crash brings out a SC/VSC (off in grader playouts, which sample neutralizations). */
  incidentFlags: boolean;
}

export interface NeutralEvent {
  lap: number;
  laps: number;
  flag: Exclude<FlagState, 'green'>;
}

function neutralMap(events: NeutralEvent[]): Map<number, Exclude<FlagState, 'green'>> {
  const map = new Map<number, Exclude<FlagState, 'green'>>();
  for (const e of events) for (let lap = e.lap; lap < e.lap + e.laps; lap++) map.set(lap, e.flag);
  return map;
}

/**
 * Time lost to a stop with no measured loss: the track's figure for the flag. A stop added
 * during the run (the player's call, a rival reaction) also draws a deviation from the race's
 * measured green stops, so it can be quick or slow like a real one (spec B1). Real stops
 * never sample, so replays match the Python sim.
 */
function stopCost(
  run: Run,
  code: string,
  flag: FlagState | undefined,
  added: boolean,
  lap: number,
): number {
  const { track } = run.model;
  // A new call (the player's or the rival's) whose out-lap is the first lap of an SC/VSC
  // was boxed at the end of the green lap before it, ahead of the deployment: a green-flag
  // stop (model v3 stage 9). Real stops carry their own priced loss from the pipeline.
  const greenEntry = added && flag !== undefined && !run.neutral.get(lap - 1);
  const base = greenEntry
    ? track.pitLoss
    : flag === 'sc'
      ? track.pitLossUnderSC
      : flag === 'vsc'
        ? track.pitLossUnderVSC
        : track.pitLoss;
  const devs = track.pitLossDeviations ?? [];
  if (!added || devs.length === 0) return base;
  const pick = Math.floor(run.rng.get(STOP_STREAM, code).next() * devs.length);
  return base + (devs[pick] as number);
}

/**
 * Fitted logistic P(follower passes this lap) from pace advantage (s/lap) and gap (s), plus
 * any battle-stance shift to the logit (attacker's attackLogit + defender's defendLogit).
 */
export function passProbability(
  overtake: RaceModel['track']['overtakeModel'],
  advantage: number,
  gap: number,
  logitShift = 0,
): number {
  const z =
    overtake.intercept + overtake.paceCoef * advantage + overtake.gapCoef * gap + logitShift;
  return 1 / (1 + Math.exp(-z));
}

/** Model (noise-free) lap time for a car on this lap: pace + tyres - fuel. */
export function cleanLap(model: RaceModel, car: CarState, lap: number): number {
  return (
    tyreLapTime(model, car.basePace, car.compound, car.tyreWear, lap) +
    freshTyreDelta(model, car.tyreAge)
  );
}

/**
 * Fresh-tyre bonus by tyre age (0 = the out-lap): full on the first lap after the out-lap,
 * fading linearly over freshTyre.laps laps. Mirrors fresh_weight_sim in the Python sim.
 */
export function freshTyreDelta(model: RaceModel, tyreAge: number): number {
  const f = model.freshTyre;
  if (!f || tyreAge < 1) return 0;
  return f.bonus * Math.min(1, Math.max(0, (f.laps + 1 - tyreAge) / f.laps));
}

/** The lap-time model for a given pace, compound and tyre wear (laps) on this lap. */
function tyreLapTime(
  model: RaceModel,
  basePace: number,
  compound: string,
  wear: number,
  lap: number,
): number {
  const c = model.compounds[compound];
  if (!c) throw new Error(`no compound model for ${compound}`);
  let t = basePace + c.offset + c.degPerLap * wear - model.fuelEffectPerLap * lap;
  if (wear > c.cliffLap) {
    const extra = c.cliffDegPerLap ?? CLIFF_FALLBACK * c.degPerLap;
    t += extra * (wear - c.cliffLap);
  }
  return t;
}

const NO_EFFECT: ModeEffect = {};

function effect(run: Run, car: CarState, key: keyof Modes): ModeEffect {
  if (car.modes[key] === DEFAULT_MODES[key]) return NO_EFFECT; // defaults have no effect
  const e = run.headset?.modes[key]?.[car.modes[key]] ?? NO_EFFECT;
  // A spending ERS mode does nothing with the battery empty.
  if (key === 'ers' && (e.charge ?? 0) < 0 && (car.battery ?? 0) <= 0) return NO_EFFECT;
  return e;
}

function defaultModes(car: CarState): boolean {
  const m = car.modes;
  return (
    m.pace === 'standard' &&
    m.fuel === 'normal' &&
    m.battle === 'hold' &&
    (m.ers ?? 'balanced') === 'balanced'
  );
}

/**
 * Sum of the car's standing-mode lap-time deltas (0 on default modes). Pushing gains nothing
 * on tyres past their cliff, which have no grip left to push with (it still wears them
 * faster): otherwise a player could push worn tyres to open a gap the real driver, already
 * flat out, couldn't (Abu Dhabi 21: a free stop under the lap-53 SC).
 */
function modeLapDelta(run: Run, car: CarState): number {
  if (defaultModes(car)) return 0;
  const pace = effect(run, car, 'pace').lapDelta ?? 0;
  const cliff = run.model.compounds[car.compound]?.cliffLap;
  const worn = pace < 0 && cliff !== undefined && car.tyreWear >= cliff;
  return (
    (worn ? 0 : pace) +
    (effect(run, car, 'fuel').lapDelta ?? 0) +
    (effect(run, car, 'battle').lapDelta ?? 0) +
    (effect(run, car, 'ers').lapDelta ?? 0)
  );
}

function modeWearMult(run: Run, car: CarState): number {
  if (defaultModes(car)) return 1;
  return (effect(run, car, 'pace').wearMult ?? 1) * (effect(run, car, 'fuel').wearMult ?? 1);
}

/** Per-lap probability of a costly mistake above the baseline (0 on default modes). */
function extraErrorRate(run: Run, car: CarState): number {
  if (!run.headset || defaultModes(car)) return 0;
  const mult =
    (effect(run, car, 'pace').errorMult ?? 1) *
    (effect(run, car, 'fuel').errorMult ?? 1) *
    (effect(run, car, 'battle').errorMult ?? 1);
  return Math.max(0, run.headset.baseErrorRate * (mult - 1));
}

/**
 * Reject calls the Worker must never replay: unknown kinds or modes, laps outside the
 * player's window, compounds the race doesn't have, or a stop with no lap left to run.
 */
export function validateDecisions(model: RaceModel, decisions: Decision[]): void {
  const headset = HEADSET[model.era];
  for (const d of decisions) {
    if (!Number.isInteger(d.lap) || d.lap <= model.race.takeoverLap || d.lap > model.race.laps) {
      throw new Error(
        `decision lap ${d.lap} outside ${model.race.takeoverLap + 1}-${model.race.laps}`,
      );
    }
    if (
      d.at !== undefined &&
      (!Number.isInteger(d.at) || d.at < model.race.takeoverLap || d.at >= d.lap)
    ) {
      throw new Error(`decision for lap ${d.lap} made at lap ${d.at}`);
    }
    if (d.kind === 'pit') {
      if (!model.compounds[d.compound]) throw new Error(`unknown compound ${d.compound}`);
      if (d.lap >= model.race.laps) throw new Error('no stop on the final lap');
    } else if (d.kind === 'mode') {
      if (!headset?.modes[d.key]?.[d.value]) throw new Error(`unknown mode ${d.key}=${d.value}`);
    } else if (d.kind === 'teamOrder') {
      const orders = ['letTeammatePast', 'teammateLetsYouPast', 'holdUp', 'release'];
      if (!orders.includes(d.order)) throw new Error('unknown team order');
      if (!teammateOf(model)) throw new Error(`${model.userSide} has no teammate in this race`);
    } else if (
      d.kind === 'battle' ||
      d.kind === 'limits' ||
      d.kind === 'blue' ||
      d.kind === 'reply'
    ) {
      if (!headset?.engineer || !validEngineerCall(d)) throw new Error(`bad ${d.kind} call`);
    } else if (d.kind !== 'radio') {
      throw new Error('unknown decision kind');
    }
  }
}

/** The user's teammate (same team), if one is in the race. */
export function teammateOf(model: RaceModel): string | undefined {
  const team = model.drivers.find((d) => d.code === model.userSide)?.team;
  return model.drivers.find((d) => d.team === team && d.code !== model.userSide)?.code;
}

/** The user's real calls as pit decisions (in-lap = real out-lap - 1), for comparison. */
export function realDecisions(model: RaceModel): Decision[] {
  const user = model.drivers.find((d) => d.code === model.userSide);
  return (user?.realStrategy ?? []).map((s) => ({ lap: s.lap - 1, kind: 'pit', compound: s.to }));
}

const FLAG_OF = { SC: 'sc', VSC: 'vsc', RED: 'red' } as const;

/** Build the run at the takeover lap. `strategies` overrides any car's real strategy. */
export function initRun(model: RaceModel, seed: number, options: RunOptions = {}): Run {
  const strategies = options.strategies ?? {};
  const live = options.decisions !== undefined;
  if (live) validateDecisions(model, options.decisions ?? []);
  const events: NeutralEvent[] = [];
  const retireAt = new Map<number, string[]>();
  for (const e of model.events) {
    if (e.type === 'SC' || e.type === 'VSC' || e.type === 'RED') {
      events.push({ lap: e.lap, laps: e.laps ?? 1, flag: FLAG_OF[e.type] });
    } else if (e.type === 'RETIREMENT' && e.driver) {
      retireAt.set(e.lap, [...(retireAt.get(e.lap) ?? []), e.driver]);
    }
  }

  const ordered = [...model.drivers].sort(
    (a, b) => a.stateAtTakeover.position - b.stateAtTakeover.position,
  );
  const cars: Record<string, CarState> = {};
  let cum = 0;
  for (const d of ordered) {
    const s = d.stateAtTakeover;
    cum += s.gapAhead;
    cars[d.code] = {
      code: d.code,
      team: d.team,
      basePace: d.basePace,
      noise: d.noise,
      compound: s.compound,
      tyreAge: s.tyreAge,
      tyreWear: s.tyreAge,
      compoundsUsed: [...(s.compoundsUsed ?? [])],
      totalTime: cum,
      // A player-controlled car pits only when the player calls it.
      strategy:
        live && d.code === model.userSide ? [] : [...(strategies[d.code] ?? d.realStrategy)],
      pittedThisLap: false,
      retired: false,
      retiredLap: null,
      modes: { ...DEFAULT_MODES },
    };
  }
  const ers = HEADSET[model.era]?.ers;
  const userCar = cars[model.userSide];
  if (live && ers && userCar) userCar.battery = ers.startBattery;
  // The race engineer side comes with live play's chaos (incidents): without it the real
  // calls replay the real race exactly.
  const engineer = live && options.incidents !== false ? HEADSET[model.era]?.engineer : undefined;

  const run: Run = {
    model,
    seed,
    ...makeStreams(model, seed),
    decisions: [...(options.decisions ?? [])],
    live,
    notes: [],
    headset: HEADSET[model.era],
    passedBy: new Map(),
    incidents: live && options.incidents !== false && !!HEADSET[model.era]?.incidents,
    incidentFlags: true,
    state: {
      lap: model.race.takeoverLap,
      flag: 'green',
      order: ordered.map((d) => d.code),
      cars,
      teamOrders: { holdUp: false, swap: null },
      ...(live && engineer ? { engineer: newEngineer(engineer, model.userSide) } : {}),
    },
    events,
    neutral: neutralMap(events),
    retireAt,
  };
  markNextFlag(run);
  return run;
}

/** Set the flag the next lap will run under, from the neutralizations known so far. */
function markNextFlag(run: Run): void {
  run.state.nextFlag = run.neutral.get(run.state.lap + 1) ?? 'green';
}

export const NOISE_STREAM = 0;

/**
 * Per-car random streams for a seed: stream base + the car's index in model.drivers (see the
 * header comment). Each is created on first use, since most cars never touch their pass,
 * error or stop streams; seeds are unchanged, so results are identical to eager creation.
 */
export class Streams {
  // Slot per (stream base, car): bases are multiples of 1000, cars fewer than 64.
  private readonly cache: Array<Rng | undefined> = [];

  constructor(
    private readonly seed: number,
    private readonly index: Readonly<Record<string, number>>,
  ) {}

  get(base: number, code: string): Rng {
    const car = this.index[code] as number;
    const slot = (base / 1000) * 64 + car;
    let rng = this.cache[slot];
    if (!rng) {
      rng = mulberry32(deriveSeed(this.seed, base + car));
      this.cache[slot] = rng;
    }
    return rng;
  }
}

function driverIndex(model: RaceModel): Record<string, number> {
  const index: Record<string, number> = {};
  model.drivers.forEach((d, i) => {
    index[d.code] = i;
  });
  return index;
}

function makeStreams(model: RaceModel, seed: number): Pick<Run, 'rng' | 'scratch'> {
  return {
    rng: new Streams(seed, driverIndex(model)),
    scratch: { prevTime: {}, clean: {}, pitted: new Set() },
  };
}

function cloneCar(c: CarState): CarState {
  return {
    ...c,
    strategy: c.strategy.map((s) => ({ ...s })),
    compoundsUsed: [...c.compoundsUsed],
    modes: { ...c.modes },
  };
}

/**
 * Branch a live run at its current lap: the same race state and past calls, with fresh
 * random streams from `seed` for everything still to come, plus `decisions` (calls for laps
 * not yet run). The grader forks once per (option, sample); forks that share a seed share
 * every future draw (common random numbers).
 */
export interface ForkOptions {
  /**
   * Grader playouts: the fork doesn't know the race's future. Events that start on or before
   * this lap are kept as they really were; later real neutralizations and retirements are
   * dropped, and SC/VSC periods are drawn instead from the era's base rates on the fork's
   * own event stream (shared by forks with the same seed, so options see the same future).
   */
  blindAfter?: number;
}

/** Random SC/VSC periods for laps after `from`, around the events already known. */
function sampledEvents(
  run: Run,
  seed: number,
  known: NeutralEvent[],
  from: number,
): NeutralEvent[] {
  const rates = run.headset?.neutralization;
  if (!rates) return [];
  const rng = mulberry32(deriveSeed(seed, EVENT_STREAM));
  const events: NeutralEvent[] = [];
  const busy = neutralMap(known);
  for (let lap = from + 1; lap <= run.model.race.laps; lap++) {
    const u = rng.next(); // one draw per lap, so the stream doesn't depend on the outcome
    if (busy.has(lap)) continue;
    const flag = u < rates.scPerLap ? 'sc' : u < rates.scPerLap + rates.vscPerLap ? 'vsc' : null;
    if (!flag) continue;
    const laps = Math.min(
      flag === 'sc' ? rates.scLaps : rates.vscLaps,
      run.model.race.laps - lap + 1,
    );
    events.push({ lap, laps, flag });
    for (let l = lap; l < lap + laps; l++) busy.set(l, flag);
  }
  return events;
}

export function forkRun(
  run: Run,
  seed: number,
  decisions: Decision[] = [],
  options: ForkOptions = {},
): Run {
  if (!run.live) throw new Error('only a live run can be forked');
  for (const d of decisions) {
    if (d.lap <= run.state.lap) throw new Error(`lap ${d.lap} has already run`);
  }
  validateDecisions(run.model, decisions);
  const cars: Record<string, CarState> = {};
  for (const [code, c] of Object.entries(run.state.cars)) cars[code] = cloneCar(c);
  return {
    ...run,
    seed,
    ...makeStreams(run.model, seed),
    passedBy: new Map(run.passedBy),
    state: {
      ...run.state,
      order: [...run.state.order],
      cars,
      teamOrders: {
        holdUp: run.state.teamOrders.holdUp,
        swap: run.state.teamOrders.swap ? { ...run.state.teamOrders.swap } : null,
      },
      ...(run.state.engineer ? { engineer: cloneEngineer(run.state.engineer) } : {}),
    },
    decisions: [...run.decisions.filter((d) => d.lap > run.state.lap), ...decisions],
    notes: [],
    ...blindView(run, seed, options.blindAfter),
    // Blind playouts already draw neutralizations at the base rates, crashes included.
    incidentFlags: options.blindAfter === undefined ? run.incidentFlags : false,
  };
}

function blindView(
  run: Run,
  seed: number,
  blindAfter: number | undefined,
): Pick<Run, 'events' | 'neutral' | 'retireAt'> {
  if (blindAfter === undefined) {
    return { events: run.events, neutral: run.neutral, retireAt: run.retireAt };
  }
  const known = run.events.filter((e) => e.lap <= blindAfter);
  const events = [...known, ...sampledEvents(run, seed, known, blindAfter)];
  const retireAt = new Map([...run.retireAt].filter(([lap]) => lap <= blindAfter));
  return { events, neutral: neutralMap(events), retireAt };
}

function car(run: Run, code: string): CarState {
  const c = run.state.cars[code];
  if (!c) throw new Error(`unknown car ${code}`);
  return c;
}

/** Stable sort by total time; the order is almost always nearly sorted already. */
function sortByTime(codes: string[], cars: Record<string, CarState>): string[] {
  for (let i = 1; i < codes.length; i++) {
    const code = codes[i] as string;
    const t = (cars[code] as CarState).totalTime;
    let j = i - 1;
    while (j >= 0 && (cars[codes[j] as string] as CarState).totalTime > t) {
      codes[j + 1] = codes[j] as string;
      j--;
    }
    codes[j + 1] = code;
  }
  return codes;
}

function live(run: Run): string[] {
  const { order, cars } = run.state;
  const out: string[] = [];
  for (const code of order) if (!(cars[code] as CarState).retired) out.push(code);
  return out;
}

function retiredInOrder(run: Run): string[] {
  const { order, cars } = run.state;
  const out: string[] = [];
  for (const code of order) if ((cars[code] as CarState).retired) out.push(code);
  return out;
}

/** order (running cars, by time) followed by the retired cars, in one array. */
function withRetired(run: Run, order: string[]): string[] {
  for (const code of retiredInOrder(run)) order.push(code);
  return order;
}

/**
 * Log a player call during the race (the BOX button, a headset change, a radio answer). It
 * must be for a lap not yet run. Throws on an invalid call. The logged call is stamped with
 * `at`, the last completed lap.
 */
export function decide(run: Run, decision: Decision): void {
  if (!run.live) throw new Error('this run has no player-controlled car');
  if (decision.lap <= run.state.lap) throw new Error(`lap ${decision.lap} has already run`);
  const stamped = { ...decision, at: run.state.lap };
  validateDecisions(run.model, [stamped]);
  run.decisions.push(stamped);
}

/**
 * The stop a pit call schedules. Boxing on the real lap for the real compound is the real stop
 * (its measured time, or the track's figure where none was measured), so the real team's
 * calls replay the real race in live play too; any other stop is an added stop with a
 * sampled time (stopCost).
 */
function playerStop(run: Run, outLap: number, compound: string): PitStop {
  const real = run.model.drivers
    .find((d) => d.code === run.model.userSide)
    ?.realStrategy.find((s) => s.lap === outLap && s.to === compound);
  if (!real) return { lap: outLap, to: compound, added: true };
  // A real stop without a measured loss (e.g. under a SC) costs the track's figure, as in replay.
  return real.loss !== undefined
    ? { lap: outLap, to: compound, loss: real.loss }
    : { lap: outLap, to: compound };
}

/** True if the user's real strategy has this stop (out-lap and compound). */
function isRealStop(run: Run, outLap: number, compound: string): boolean {
  return !!run.model.drivers
    .find((d) => d.code === run.model.userSide)
    ?.realStrategy.some((s) => s.lap === outLap && s.to === compound);
}

/** Apply the player's calls for this lap to the user's car before it is run. */
function applyDecisions(run: Run, lap: number): void {
  if (!run.live) return;
  const user = run.state.cars[run.model.userSide];
  if (!user || user.retired) return;
  const eng = run.state.engineer;
  if (eng) {
    eng.move = null;
    eng.moveByDriver = false;
    eng.blue = null;
  }
  for (const d of run.decisions) {
    if (d.lap !== lap) continue;
    if (eng) applyEngineerCall(eng, d, lap);
    if (d.kind === 'reply' && eng) {
      if (d.yes) trust(run, lap, 'request-yes');
      else {
        const rival = run.state.cars[run.model.rival];
        const gap = rival && !rival.retired ? rival.totalTime - user.totalTime : 0;
        eng.refused.push({ request: d.request, lap, gap });
      }
    }
    if (d.kind === 'mode') {
      (user.modes as unknown as Record<string, string>)[d.key] = d.value;
    } else if (d.kind === 'pit') {
      user.strategy = user.strategy.filter((s) => s.lap !== lap + 1);
      user.strategy.push(playerStop(run, lap + 1, d.compound));
    } else if (d.kind === 'teamOrder') {
      const orders = run.state.teamOrders;
      if (d.order === 'holdUp') orders.holdUp = true;
      if (d.order === 'release') orders.holdUp = false;
      if (d.order === 'letTeammatePast' || d.order === 'teammateLetsYouPast') {
        const mate = teammateOf(run.model) as string;
        orders.swap = {
          yielder: d.order === 'letTeammatePast' ? run.model.userSide : mate,
          untilLap: lap + (run.headset?.teamOrders?.swapLaps ?? 3) - 1,
        };
      }
    }
  }
  if (eng) engineerBeforeLap(run, lap, user, eng);
}

/**
 * Race engineer spec, before the user's lap is run: count recent headset orders (too many in
 * a few laps and the driver feels micromanaged), and let a furious driver pick his own battle
 * move when the wall called none.
 */
function engineerBeforeLap(run: Run, lap: number, user: CarState, eng: EngineerState): void {
  const cfg = run.headset?.engineer as EngineerConfig;
  eng.orders = eng.orders.filter((l) => l > lap - 3);
  if (eng.orders.length > cfg.trust.ordersLimit && eng.orders.at(-1) === lap) {
    trust(run, lap, 'micromanaging');
  }
  if (eng.move || run.neutral.get(lap) || !moodEffect(cfg, eng.trust)?.rogue) return;
  const order = live(run);
  const i = order.indexOf(user.code);
  const t = (c: string | undefined) => (c ? car(run, c).totalTime : Number.NaN);
  const ahead = order[i - 1];
  const behind = order[i + 1];
  if (ahead && user.totalTime - t(ahead) < cfg.battleWindow) eng.move = 'dive-inside';
  else if (behind && t(behind) - user.totalTime < cfg.battleWindow) eng.move = 'defend-hard';
  if (!eng.move) return;
  eng.moveByDriver = true;
  run.notes.push({ lap, kind: 'rogue', driver: user.code, detail: eng.move });
}

/** Move the driver's trust for a reason (its delta in the config); notes it for the game. */
function trust(run: Run, lap: number, reason: TrustReason, scale = 1): void {
  const eng = run.state.engineer;
  const cfg = run.headset?.engineer;
  if (!eng || !cfg) return;
  const delta = cfg.trust.deltas[reason] * scale;
  const next = Math.min(100, Math.max(0, eng.trust + delta));
  if (next === eng.trust) return;
  eng.trust = next;
  eng.lastEvent = lap;
  run.notes.push({ lap, kind: 'trust', driver: run.model.userSide, detail: reason, value: delta });
}

/** True while the user's teammate is holding up the rival from directly ahead of it. */
function holdingUp(run: Run, aheadCode: string, behindCode: string): boolean {
  if (!run.live || !run.state.teamOrders.holdUp || behindCode !== run.model.rival) return false;
  return aheadCode === teammateOf(run.model);
}

/**
 * A pending yield call: when the yielding car started a green lap directly ahead of the other
 * and within the swap window, it lifts and lets the other through, losing swapCost. Live
 * runs only.
 */
function applySwap(run: Run, lap: number, prevTime: Record<string, number>): void {
  const orders = run.state.teamOrders;
  const cfg = run.headset?.teamOrders;
  if (!run.live || !cfg || !orders.swap) return;
  if (lap > orders.swap.untilLap) {
    orders.swap = null;
    return;
  }
  const mate = teammateOf(run.model) as string;
  const yielder = orders.swap.yielder;
  const other = yielder === run.model.userSide ? mate : run.model.userSide;
  const order = live(run);
  const startGap = (prevTime[other] ?? Number.POSITIVE_INFINITY) - (prevTime[yielder] ?? 0);
  if (!(startGap >= 0 && startGap <= cfg.swapWindow)) return;
  const between = Object.entries(prevTime).some(
    ([code, t]) =>
      code !== yielder &&
      code !== other &&
      t > (prevTime[yielder] ?? 0) &&
      t < (prevTime[other] ?? 0),
  );
  if (between) return; // only directly-adjacent teammates can swap
  const a = car(run, yielder);
  const b = car(run, other);
  b.totalTime = a.totalTime - PASS_MARGIN;
  a.totalTime = b.totalTime + PASS_MARGIN + cfg.swapCost;
  orders.swap = null;
  run.notes.push({ lap, kind: 'team-swap', driver: other, detail: yielder });
  run.state.order = [
    ...order.sort((x, y) => car(run, x).totalTime - car(run, y).totalTime),
    ...retiredInOrder(run),
  ];
}

/**
 * Rival policy (Implementation Plan 2.5), run after a lap on which the user's stop was
 * charged. Under SC/VSC: if the next lap is still neutralized and pitting then keeps the
 * rival ahead of the user after both stops, it pits next lap. Under green, inside the
 * undercut window (cars within a pit loss of each other at the start of the lap): it covers
 * next lap if its own next planned stop is within COVER_WINDOW laps. Otherwise it keeps its
 * real strategy. A cover replaces the rival's next planned stop (taking its compound).
 */
function rivalReacts(
  run: Run,
  lap: number,
  flag: FlagState | undefined,
  prevTime: Record<string, number>,
): void {
  const { model, state } = run;
  const user = state.cars[model.userSide];
  const rival = state.cars[model.rival];
  if (!run.live || !user || !rival || !user.pittedThisLap) return;
  if (rival.retired || rival.pittedThisLap || lap >= model.race.laps) return;
  const to = rivalCover(model, rival, {
    lap,
    flag,
    nextFlag: run.neutral.get(lap + 1),
    startGap: Math.abs((prevTime[user.code] ?? 0) - (prevTime[rival.code] ?? 0)),
    userBehind: user.totalTime - rival.totalTime,
    userCompound: user.compound,
  });
  if (!to) return;
  const nextStop = rival.strategy.filter((s) => s.lap > lap).sort((a, b) => a.lap - b.lap)[0];
  rival.strategy = rival.strategy.filter((s) => s !== nextStop);
  rival.strategy.push({ lap: lap + 1, to, added: true });
  run.notes.push({ lap, kind: 'rival-cover', driver: rival.code, detail: to });
}

/**
 * The rival's answer to the user's stop charged on `lap` (rivalReacts): the tyre it covers
 * on next lap, or null if it keeps its plan. Pure, so the game's map can tell a lap ahead
 * (the cover's in-lap is the lap the user's stop is charged on). `flag`/`nextFlag`: the flags
 * of `lap` and the lap after; `startGap`: the two cars' gap (s) at the start of `lap`;
 * `userBehind`: how far (s) the user is behind the rival after `lap`.
 */
export function rivalCover(
  model: RaceModel,
  rival: CarState,
  at: {
    lap: number;
    flag: FlagState | undefined;
    nextFlag: FlagState | undefined;
    startGap: number;
    userBehind: number;
    userCompound: string;
  },
): string | null {
  const { lap, flag, nextFlag } = at;
  // The real stop: the rival's real answer to it is already its real strategy.
  const real = model.drivers
    .find((d) => d.code === model.userSide)
    ?.realStrategy.some((s) => s.lap === lap && s.to === at.userCompound);
  if (real) return null;
  const nextStop = rival.strategy.filter((s) => s.lap > lap).sort((a, b) => a.lap - b.lap)[0];
  let cover = false;
  if (flag === 'sc' || flag === 'vsc') {
    if (nextFlag === 'sc' || nextFlag === 'vsc') {
      const cost = nextFlag === 'sc' ? model.track.pitLossUnderSC : model.track.pitLossUnderVSC;
      cover = at.userBehind > cost;
    }
  } else {
    cover =
      at.startGap < model.track.pitLoss && !!nextStop && nextStop.lap - (lap + 1) <= COVER_WINDOW;
  }
  return cover ? (nextStop?.to ?? at.userCompound) : null;
}

/**
 * Rival goes long (product doc design decision 3: "cover the stop, go long, or switch
 * tires"). Run at the end of the user's in-lap, when the user's stop is due next lap: a rival
 * still behind the user (so it reaches pit entry after seeing the call) that would be ahead
 * once the user's stop is charged under a SC/VSC skips its own stop planned within
 * COVER_WINDOW laps to keep track position, but only when its tyres reach the flag without
 * it. A rival that would have to stop later anyway keeps its cheap neutralized stop: going
 * long would trade it for a full green stop (Abu Dhabi 21: HAM boxing under the lap-36 VSC
 * had VER skip his VSC stop and pay ~22s on lap 46). Under green the plan's cover rule
 * applies instead (rivalReacts).
 */
function rivalGoesLong(run: Run, lap: number): void {
  const { model, state } = run;
  const user = state.cars[model.userSide];
  const rival = state.cars[model.rival];
  if (!run.live || !user || !rival || user.retired || rival.retired) return;
  const stopLap = lap + 1;
  const userStop = user.strategy.find((s) => s.lap === stopLap);
  if (!userStop || isRealStop(run, stopLap, userStop.to)) return;
  const stopFlag = run.neutral.get(stopLap);
  if (stopFlag !== 'sc' && stopFlag !== 'vsc') return;
  if (rival.totalTime <= user.totalTime) return; // ahead: already past pit entry

  const planned = rival.strategy
    .filter((s) => s.lap >= stopLap && s.lap - stopLap <= COVER_WINDOW)
    .sort((a, b) => a.lap - b.lap)[0];
  if (!planned) return;
  const userCost = stopFlag === 'sc' ? model.track.pitLossUnderSC : model.track.pitLossUnderVSC;
  if (user.totalTime + userCost <= rival.totalTime) return; // staying out wouldn't lead

  const compound = model.compounds[rival.compound];
  const lapsToCliff = compound ? Math.max(1, Math.floor(compound.cliffLap - rival.tyreWear)) : 1;
  if (stopLap + lapsToCliff <= model.race.laps) return; // would have to stop later anyway
  const others = rival.strategy.filter((s) => s !== planned);
  // Two-compound rule: going long may not drop the stop that would make the rival comply.
  const needsThisStop =
    !ruleSatisfied(rival) && !others.some((s) => !rival.compoundsUsed.includes(s.to));
  if (needsThisStop) return;
  rival.strategy = others;
  run.notes.push({ lap, kind: 'rival-stays-out', driver: rival.code, detail: 'no stop' });
}

/**
 * Predicted time for `car` to run laps (fromLap, laps] with at most one more stop, from the
 * lap-time model alone (no noise, traffic or rivals): `stop` is the out-lap and compound, or
 * null for no stop. Neutralized laps cost the same whatever the tyres, so they are skipped;
 * a stop pays the pit loss for its lap's flag. Wear advances as in stepLap.
 */
function predictedRemaining(
  run: Run,
  car: CarState,
  fromLap: number,
  stop: PitStop | null,
  known: Map<number, Exclude<FlagState, 'green'>>,
): number {
  const { model } = run;
  const wearMult = modeWearMult(run, car);
  let compound = car.compound;
  let wear = car.tyreWear;
  let age = car.tyreAge;
  let total = 0;
  for (let lap = fromLap + 1; lap <= model.race.laps; lap++) {
    const flag = known.get(lap);
    if (stop && lap === stop.lap) {
      compound = stop.to;
      wear = 0;
      age = 0;
      const { track } = model;
      total +=
        flag === 'sc'
          ? track.pitLossUnderSC
          : flag === 'vsc'
            ? track.pitLossUnderVSC
            : track.pitLoss;
    }
    if (!flag) {
      total += tyreLapTime(model, car.basePace, compound, wear, lap) + freshTyreDelta(model, age);
    }
    wear += flag ? 1 : wearMult;
    age += 1;
  }
  return total;
}

/**
 * The "sensible strategist" continuation the grader uses for the player's car after a graded
 * option (decision recorded in the implementation plan, 2.7): from the current state, the
 * best of no more stops or one stop at any remaining lap on any compound, by predicted time.
 * Deterministic and the same for every option, so options are compared on the call alone.
 * Returns the stop (out-lap, compound) or null; it never plans more than one stop.
 */
export function planRemainingStop(run: Run, options: { exact?: boolean } = {}): PitStop | null {
  const { model, state } = run;
  const user = state.cars[model.userSide];
  if (!user || user.retired) return null;
  // Two-compound rule: a car that hasn't yet run two dry compounds must stop for a new one.
  const mustChange = !ruleSatisfied(user);
  let best: PitStop | null = null;
  // Plan only on what is known now: neutralizations that have started by the next lap.
  const known = neutralMap(run.events.filter((e) => e.lap <= state.lap + 1));
  let knownAhead = false;
  for (const lap of known.keys()) if (lap > state.lap) knownAhead = true;
  if (!knownAhead && !options.exact) return planGreenToFlag(run, user, mustChange);
  let bestTime = mustChange
    ? Number.POSITIVE_INFINITY
    : predictedRemaining(run, user, state.lap, null, known);
  for (let lap = state.lap + 1; lap <= model.race.laps; lap++) {
    for (const to of Object.keys(model.compounds)) {
      if (mustChange && user.compoundsUsed.includes(to)) continue;
      const t = predictedRemaining(run, user, state.lap, { lap, to }, known);
      if (t < bestTime) {
        bestTime = t;
        best = { lap, to };
      }
    }
  }
  return best;
}

/**
 * planRemainingStop for the usual case of no known neutralization ahead, in O(laps x
 * compounds) instead of O(laps^2 x compounds). A lap's model time splits into a lap term
 * (pace and fuel, the same whatever the tyres) and a tyre-age term, so a one-stop plan's time
 * is a prefix sum on the current set + the pit loss + a suffix sum of lap terms + a per-
 * compound cumulative sum over tyre age. Same choices as the full loop (sums differ only in
 * floating-point order).
 */
function planGreenToFlag(run: Run, user: CarState, mustChange: boolean): PitStop | null {
  const { model, state } = run;
  const first = state.lap + 1;
  const last = model.race.laps;
  const n = last - first + 1;
  const m = modeWearMult(run, user);
  const lapTerm = (lap: number) => user.basePace - model.fuelEffectPerLap * lap;
  const ageTerm = (compound: string, age: number) =>
    tyreLapTime(model, 0, compound, age * m, 0) + freshTyreDelta(model, age);

  // pre[i]: time for laps first..first+i-1 on the current set; suffix[i]: lap terms from
  // lap first+i to the flag.
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const lap = first + i;
    const wear = user.tyreWear + i * m;
    pre[i + 1] =
      (pre[i] as number) +
      tyreLapTime(model, user.basePace, user.compound, wear, lap) +
      freshTyreDelta(model, user.tyreAge + i);
  }
  const suffix = new Float64Array(n + 1);
  for (let i = n - 1; i >= 0; i--) suffix[i] = (suffix[i + 1] as number) + lapTerm(first + i);

  let best: PitStop | null = null;
  let bestTime = mustChange ? Number.POSITIVE_INFINITY : (pre[n] as number);
  for (const to of Object.keys(model.compounds)) {
    if (mustChange && user.compoundsUsed.includes(to)) continue;
    // ageSum[a]: tyre-age terms for ages 0..a-1 on a fresh set of `to`.
    const ageSum = new Float64Array(n + 1);
    for (let a = 0; a < n; a++) ageSum[a + 1] = (ageSum[a] as number) + ageTerm(to, a);
    for (let i = 0; i < n; i++) {
      const t =
        (pre[i] as number) +
        model.track.pitLoss +
        (suffix[i] as number) +
        (ageSum[n - i] as number);
      if (t < bestTime) {
        bestTime = t;
        best = { lap: first + i, to };
      }
    }
  }
  return best;
}

/** True once the chequered flag has fallen. */
export function isFinished(run: Run): boolean {
  return run.state.lap >= run.model.race.laps;
}

/** Advance the race one lap: pit stops, lap times, retirements, then order. */
export function stepLap(run: Run): RaceState {
  const { model, state } = run;
  if (isFinished(run)) return state;
  const lap = state.lap + 1;
  const flag = run.neutral.get(lap);
  applyDecisions(run, lap);
  const { track } = model;
  const green = track.greenLapTime;
  const scTime = track.scLapTime || (green ? green * SC_FALLBACK : undefined);
  const vscTime = track.vscLapTime || (green ? green * VSC_FALLBACK : undefined);

  const cars = state.cars;
  const running = live(run);
  const { prevTime, clean, pitted } = run.scratch;
  pitted.clear();
  let battle: EngineerLap | null = null;
  for (const code of running) prevTime[code] = (cars[code] as CarState).totalTime;

  for (let i = 0; i < running.length; i++) {
    const code = running[i] as string;
    const c = cars[code] as CarState;
    c.pittedThisLap = false;
    let pitCost = 0;
    let stopIdx = c.strategy.findIndex((st) => st.lap === lap);
    if (
      stopIdx >= 0 &&
      run.live &&
      code === model.rival &&
      (c.strategy[stopIdx] as PitStop).optional
    ) {
      // The rival's fastest-lap stop, in live play: taken only if the gap behind covers its
      // cost (it really stopped only because it could do so for free). Replays, and every
      // other car, keep the real stop, so validation and parity are unchanged.
      const stop = c.strategy[stopIdx] as PitStop;
      const behind = running[i + 1];
      const gapBehind =
        behind !== undefined
          ? (prevTime[behind] as number) - (prevTime[code] as number)
          : Number.POSITIVE_INFINITY;
      if (gapBehind <= (stop.loss ?? stopCost(run, code, flag, false, lap))) {
        c.strategy.splice(stopIdx, 1);
        stopIdx = -1;
      }
    }
    if (stopIdx >= 0) {
      const stop = c.strategy[stopIdx] as PitStop;
      c.strategy.splice(stopIdx, 1);
      pitted.add(code);
      c.pittedThisLap = true;
      c.compound = stop.to;
      if (!c.compoundsUsed.includes(stop.to)) c.compoundsUsed.push(stop.to);
      c.tyreAge = 0;
      c.tyreWear = 0;
      pitCost = stop.loss ?? stopCost(run, code, flag, stop.added === true, lap);
      const eng = code === model.userSide ? state.engineer : undefined;
      if (eng && eng.damage > 0) {
        // A new nose on the stop: slower than a tyre change alone.
        pitCost += run.headset?.engineer?.noseCost ?? 0;
        eng.damage = 0;
        run.notes.push({ lap, kind: 'nose', driver: code });
      }
    }

    const base = cleanLap(model, c, lap);
    const eng = code === model.userSide && !flag ? state.engineer : undefined;
    const lapEng = eng ? engineerLap(run, lap, c, running, i, prevTime, eng) : null;
    if (lapEng) battle = lapEng;
    const modeDelta = flag ? 0 : modeLapDelta(run, c) + (lapEng?.pace ?? 0);
    let lt: number;
    if (flag === 'sc' && scTime) lt = scTime;
    else if (flag === 'vsc' && vscTime) lt = vscTime;
    else if (flag === 'red' && green) lt = green;
    else {
      lt = base + run.rng.get(NOISE_STREAM, code).normal(c.noise);
      const ahead = i > 0 ? (running[i - 1] as string) : code;
      const aheadGap = c.totalTime - (prevTime[ahead] ?? c.totalTime);
      if (aheadGap > 0 && aheadGap < DIRTY_AIR_RANGE) lt += track.dirtyAirPenalty;
      lt += modeDelta + (lapEng?.extra ?? 0);
      const behind = running[i + 1];
      if (behind && holdingUp(run, code, behind)) {
        const gapBehind = (prevTime[behind] ?? 0) - (prevTime[code] ?? 0);
        if (gapBehind >= 0 && gapBehind < PASS_WINDOW)
          lt += run.headset?.teamOrders?.holdUpCost ?? 0;
      }
      const errorRate = extraErrorRate(run, c) + (lapEng?.errorRate ?? 0);
      if (errorRate > 0 && run.headset && run.rng.get(ERROR_STREAM, code).next() < errorRate) {
        lt += run.headset.errorCost;
        run.notes.push({ lap, kind: 'error', driver: code });
      }
    }
    clean[code] = base + modeDelta;
    c.totalTime += lt + pitCost;
    c.tyreAge += 1;
    c.tyreWear += flag ? 1 : modeWearMult(run, c) * (lapEng?.wearMult ?? 1);
    if (c.battery !== undefined) {
      const gain = flag ? (run.headset?.ers?.scCharge ?? 0) : (effect(run, c, 'ers').charge ?? 0);
      c.battery = Math.min(100, Math.max(0, c.battery + gain));
    }
  }

  if (run.incidents && !flag) incidents(run, lap, prevTime);

  for (const code of run.retireAt.get(lap) ?? []) {
    const c = state.cars[code];
    if (c && !c.retired) {
      c.retired = true;
      c.retiredLap = lap;
    }
  }

  if (flag) {
    // No overtaking under neutralization: sorting by total time moves only cars that pitted.
    // Under a SC the gaps then close toward nose-to-tail (see SC_GAP_KEEP).
    const order = sortByTime(live(run), cars);
    state.order = [...order, ...retiredInOrder(run)];
    if (flag === 'sc' && run.neutral.get(lap - 1) === 'sc') {
      // Deployment lap: gaps kept. Middle laps: SC_GAP_KEEP of the excess. Last lap: bunched.
      const keep = run.neutral.get(lap + 1) === 'sc' ? SC_GAP_KEEP : 0;
      bunch(
        order,
        cars,
        green,
        keep,
        model.race.scUnlap === 'duel' ? [model.userSide, model.rival] : null,
      );
      state.order = [...sortByTime(order, cars), ...retiredInOrder(run)];
    }
  } else {
    resolveOrder(run, lap, clean, prevTime, pitted);
    applySwap(run, lap, prevTime);
  }
  if (state.engineer) engineerAfterLap(run, lap, battle, prevTime, pitted);
  rivalReacts(run, lap, flag, prevTime);
  rivalGoesLong(run, lap);

  state.lap = lap;
  state.flag = flag ?? 'green';
  markNextFlag(run);
  return state;
}

/**
 * Crashes, mechanical failures and punctures (feedback round 2; live play only, green laps).
 * Each running car takes one draw a lap from its own incident stream, so one car's fate never
 * shifts another's. The chance of each grows with what provokes it: pushing (failures,
 * punctures), tyres past their cliff (punctures), attacking or defending in a fight
 * (crashes). A crash or a failure retires the car; a crash also brings out a SC or VSC from
 * the next lap (not in grader playouts, which sample those). A puncture costs a slow lap and
 * forces a stop next lap onto the next planned compound (or mediums, or hards).
 */
function incidents(run: Run, lap: number, prevTime: Record<string, number>): void {
  const rates = run.headset?.incidents;
  if (!rates) return;
  const { model, state } = run;
  const order = live(run);
  for (let i = 0; i < order.length; i++) {
    const code = order[i] as string;
    const c = state.cars[code] as CarState;
    const rng = run.rng.get(INCIDENT_STREAM, code);
    const u = rng.next();
    const push = c.modes.pace === 'push';
    const cliff = model.compounds[c.compound]?.cliffLap ?? Number.POSITIVE_INFINITY;
    const worn = Math.max(0, c.tyreWear - cliff);
    const ahead = i > 0 ? (order[i - 1] as string) : null;
    const behind = order[i + 1];
    const fightAhead =
      ahead !== null &&
      (prevTime[code] ?? 0) - (prevTime[ahead] ?? 0) < PASS_WINDOW &&
      (prevTime[code] ?? 0) >= (prevTime[ahead] ?? 0);
    const fightBehind =
      behind !== undefined && (prevTime[behind] ?? 0) - (prevTime[code] ?? 0) < PASS_WINDOW;
    const crash =
      rates.crash *
      (fightAhead && c.modes.battle === 'attack' ? rates.attackCrash : 1) *
      (fightBehind && c.modes.battle === 'defend' ? rates.defendCrash : 1);
    const mechanical = rates.mechanical * (push ? rates.pushMechanical : 1);
    const puncture =
      Math.min(rates.punctureMax, rates.puncture + rates.puncturePerWornLap * worn) *
      (push ? rates.pushPuncture : 1);
    let kind: 'crash' | 'mechanical' | 'puncture' | null = null;
    if (u < crash) kind = 'crash';
    else if (u < crash + mechanical) kind = 'mechanical';
    else if (u < crash + mechanical + puncture) kind = 'puncture';
    if (!kind) continue;
    run.notes.push({ lap, kind: 'incident', driver: code, detail: kind });
    if (kind === 'puncture') {
      c.totalTime += rates.punctureCost;
      if (lap >= model.race.laps) continue; // limps to the flag
      const next = c.strategy.filter((st) => st.lap > lap).sort((a, b) => a.lap - b.lap)[0];
      const to = next?.to ?? forcedCompound(model, c);
      c.strategy = c.strategy.filter((st) => st !== next && st.lap !== lap + 1);
      c.strategy.push({ lap: lap + 1, to, added: true });
      continue;
    }
    c.retired = true;
    c.retiredLap = lap;
    if (kind === 'crash' && run.incidentFlags && lap < model.race.laps) {
      const cfg = run.headset?.neutralization;
      const sc = rng.next() < rates.scShare;
      const from = lap + 1;
      if (cfg && !run.neutral.has(from)) {
        const laps = Math.min(sc ? cfg.scLaps : cfg.vscLaps, model.race.laps - from + 1);
        // New arrays: forks share the parent's events until they change them.
        run.events = [...run.events, { lap: from, laps, flag: sc ? 'sc' : 'vsc' }];
        run.neutral = neutralMap(run.events);
      }
    }
  }
  // The order is settled after the lap (resolveOrder), which drops retired cars to the back.
}

/**
 * The tyres a forced stop (a puncture) fits when no stop was planned: mediums, else hards, but
 * a dry compound the car hasn't run yet if it still needs one for the two-compound rule (a
 * puncture must never leave the car disqualified).
 */
function forcedCompound(model: RaceModel, c: CarState): string {
  const prefs = ['MEDIUM', 'HARD', 'SOFT'].filter((x) => model.compounds[x]);
  if (!ruleSatisfied(c)) {
    const fresh = prefs.find((x) => !c.compoundsUsed.includes(x));
    if (fresh) return fresh;
  }
  return prefs[0] ?? c.compound;
}

/**
 * Close the SC queue: each gap keeps `keep` of its excess over BUNCH_GAP (nose-to-tail on the
 * last lap). By the rules every lapped car unlaps and joins the back of the queue, so the
 * whole field closes up in race order (duel null). A race with scUnlap "duel" follows Abu
 * Dhabi 2021's call instead: only the lead lap closes up, the lapped cars stay where they are
 * a lap down, and on the last lap (keep 0) the lapped cars sitting between the user's car and
 * the rival are waved through to the back of the lead-lap queue. Mirrors _bunch in
 * sim_reference.py.
 */
function bunch(
  live: string[],
  cars: Record<string, CarState>,
  lapTime: number | undefined,
  keep: number,
  duel: [string, string] | null,
): void {
  if (!live.length) return;
  if (!duel) {
    for (let i = 1; i < live.length; i++) {
      const ahead = cars[live[i - 1] as string] as CarState;
      const c = cars[live[i] as string] as CarState;
      const excess = Math.max(0, c.totalTime - ahead.totalTime - BUNCH_GAP);
      c.totalTime = ahead.totalTime + BUNCH_GAP + keep * excess;
    }
    return;
  }
  const len = lapTime ?? 0;
  const time = (c: string) => (cars[c] as CarState).totalTime;
  const lead = time(live[0] as string);
  const down = new Map(live.map((c) => [c, len ? Math.floor((time(c) - lead) / len) : 0]));
  const onTrack = new Map(live.map((c) => [c, time(c) - lead - (down.get(c) as number) * len]));
  const leadLap = live.filter((c) => down.get(c) === 0);
  let waved: string[] = [];
  const [a, b] = duel;
  if (keep === 0 && leadLap.includes(a) && leadLap.includes(b)) {
    const lo = Math.min(onTrack.get(a) as number, onTrack.get(b) as number);
    const hi = Math.max(onTrack.get(a) as number, onTrack.get(b) as number);
    waved = live
      .filter(
        (c) =>
          (down.get(c) as number) >= 1 &&
          (onTrack.get(c) as number) > lo &&
          (onTrack.get(c) as number) < hi,
      )
      .sort((x, y) => (onTrack.get(x) as number) - (onTrack.get(y) as number));
  }
  for (let i = 1; i < leadLap.length; i++) {
    const ahead = cars[leadLap[i - 1] as string] as CarState;
    const c = cars[leadLap[i] as string] as CarState;
    const excess = Math.max(0, c.totalTime - ahead.totalTime - BUNCH_GAP);
    c.totalTime = ahead.totalTime + BUNCH_GAP + keep * excess;
  }
  let last = time(leadLap[leadLap.length - 1] as string);
  for (const c of waved) {
    last += BUNCH_GAP;
    (cars[c] as CarState).totalTime = last;
  }
}

/** The user's lap on the engineer side: what it adds, and the battle it fought (if any). */
interface EngineerLap {
  /** Pace change (damage, mood): counts in the pass model's pace advantage. */
  pace: number;
  /** Time the lap's calls cost (the battle move, track-limit care, a lapped car, contact). */
  extra: number;
  wearMult: number;
  errorRate: number;
  /** The car the move was against, when it was a fight (within PASS_WINDOW). */
  target: string | null;
  move: EngineerState['move'];
  byDriver: boolean;
}

/**
 * Race engineer spec: the user's green lap. The battle move against the car directly ahead
 * (attacks) or behind (defences), contact in the fight (a front wing, a puncture or a spin),
 * a lapped car in the way, a track-limit strike, and the driver's mood. Contact and strikes
 * each take one draw a green lap from the user's own streams, so the streams don't depend on
 * the calls.
 */
function engineerLap(
  run: Run,
  lap: number,
  c: CarState,
  running: string[],
  i: number,
  prevTime: Record<string, number>,
  eng: EngineerState,
): EngineerLap {
  const cfg = run.headset?.engineer as EngineerConfig;
  const mood = moodEffect(cfg, eng.trust);
  const out: EngineerLap = {
    pace: eng.damage + (mood?.lapDelta ?? 0),
    extra: eng.careful ? cfg.carefulCost : 0,
    wearMult: mood?.wearMult ?? 1,
    errorRate: mood?.errorRate ?? 0,
    target: null,
    move: eng.move,
    byDriver: eng.moveByDriver,
  };
  const me = prevTime[c.code] as number;
  let move = eng.move ? cfg.moves[eng.move] : null;
  if (eng.move === 'overtake-button' && (c.battery ?? 0) < -(move?.battery ?? 0)) {
    move = null; // no battery left: an ordinary lap
    out.move = null;
    eng.move = null;
  }
  const target = isAttack(eng.move)
    ? running[i - 1]
    : isDefend(eng.move)
      ? running[i + 1]
      : undefined;
  const fighting =
    target !== undefined && Math.abs((prevTime[target] as number) - me) < PASS_WINDOW;
  let contact = 0;
  if (move && fighting) {
    out.target = target as string;
    out.extra += move.lapDelta ?? 0;
    out.wearMult *= move.wearMult ?? 1;
    contact = cfg.contactBase * (move.contact ?? 1);
    if (move.battery && c.battery !== undefined) {
      c.battery = Math.max(0, c.battery + move.battery);
    }
  }

  // A lapped car just ahead on track.
  const len = run.model.track.greenLapTime ?? cleanLap(run.model, c, lap);
  let blue: { code: string; gap: number } | null = null;
  for (let j = i + 1; j < running.length; j++) {
    const code = running[j] as string;
    const d = (prevTime[code] as number) - me;
    if (d < len * 0.5) continue;
    const x = Math.ceil(d / len) * len - d;
    if (x > 0 && x < cfg.blue.window && (!blue || x < blue.gap)) blue = { code, gap: x };
  }
  if (blue && eng.blue === 'go-round') {
    // Waiting for the blue flags is what the measured lap times already include; going round
    // at once gains a little and risks contact.
    out.extra -= cfg.blue.goRoundGain;
    contact += cfg.blue.goRoundContact;
    run.notes.push({
      lap,
      kind: 'blue',
      driver: c.code,
      other: blue.code,
      value: -cfg.blue.goRoundGain,
    });
  }

  // Contact in the fight.
  const crng = run.rng.get(CONTACT_STREAM, c.code);
  if (crng.next() < contact) {
    const u = crng.next();
    const other = out.target ?? blue?.code;
    if (u < cfg.contactWing) {
      const [lo, hi] = cfg.wingDamage;
      const dmg = lo + (hi - lo) * crng.next();
      eng.damage = Math.min(hi * 1.5, eng.damage + dmg);
      run.notes.push({ lap, kind: 'contact', driver: c.code, detail: 'wing', other, value: dmg });
    } else if (u < cfg.contactWing + cfg.contactPuncture) {
      const rates = run.headset?.incidents;
      out.extra += rates?.punctureCost ?? 20;
      run.notes.push({ lap, kind: 'contact', driver: c.code, detail: 'puncture', other });
      if (lap < run.model.race.laps) {
        const next = c.strategy.filter((st) => st.lap > lap).sort((a, b) => a.lap - b.lap)[0];
        const to = next?.to ?? forcedCompound(run.model, c);
        c.strategy = c.strategy.filter((st) => st !== next && st.lap !== lap + 1);
        c.strategy.push({ lap: lap + 1, to, added: true });
      }
    } else {
      out.extra += cfg.spinCost;
      run.notes.push({ lap, kind: 'contact', driver: c.code, detail: 'spin', other });
    }
    if (out.move && !out.byDriver) trust(run, lap, 'contact');
  }

  // Track limits.
  const strike =
    cfg.strikeBase *
    (c.modes.pace === 'push' ? cfg.strikePush : 1) *
    (move && fighting ? (move.strike ?? 1) : 1) *
    (eng.careful ? cfg.strikeCareful : 1);
  if (run.rng.get(LIMITS_STREAM, c.code).next() < strike) {
    eng.strikes += 1;
    run.notes.push({ lap, kind: 'strike', driver: c.code, value: eng.strikes });
    const over = eng.strikes - cfg.penaltyAt;
    if (over >= 0 && over % cfg.penaltyEvery === 0) {
      eng.penalty += cfg.penalty;
      run.notes.push({ lap, kind: 'penalty', driver: c.code, value: cfg.penalty });
      trust(run, lap, 'penalty');
    } else {
      trust(run, lap, 'strike');
    }
  }
  return out;
}

/** The user's battle move (and DRS after waiting) on the pass roll between a and b behind it. */
function engineerShift(run: Run, lap: number, ahead: string, behind: string): number {
  const eng = run.state.engineer;
  const cfg = run.headset?.engineer;
  if (!eng || !cfg) return 0;
  const user = run.model.userSide;
  if (behind === user) {
    const m = isAttack(eng.move)
      ? (cfg.moves[eng.move as keyof typeof cfg.moves].attackLogit ?? 0)
      : 0;
    return m + (eng.drsLap === lap ? cfg.drsLogit : 0);
  }
  if (ahead === user && isDefend(eng.move)) {
    return cfg.moves[eng.move as keyof typeof cfg.moves].defendLogit ?? 0;
  }
  return 0;
}

/**
 * Race engineer spec, after the lap: how the battle went (and the driver's trust in the call),
 * a stop that swapped places with the rival, requests the wall turned down (who was right),
 * and a calmer driver after some quiet laps.
 */
function engineerAfterLap(
  run: Run,
  lap: number,
  battle: EngineerLap | null,
  prevTime: Record<string, number>,
  pitted: Set<string>,
): void {
  const { model, state } = run;
  const eng = state.engineer as EngineerState;
  const cfg = run.headset?.engineer as EngineerConfig;
  const user = state.cars[model.userSide];
  if (!user || user.retired) return;
  const pos = (c: string) => state.order.indexOf(c);
  const t = battle?.target;
  if (battle && t && !pitted.has(t) && !pitted.has(user.code) && !car(run, t).retired) {
    const move = battle.move;
    const called = !battle.byDriver;
    if (isAttack(move)) {
      const passed = pos(user.code) < pos(t);
      run.notes.push({
        lap,
        kind: 'battle',
        driver: user.code,
        detail: passed ? 'passed' : 'stuck',
        other: t,
      });
      if (passed && called) trust(run, lap, 'pass-called');
      else if (!passed && called && move !== 'wait-drs') trust(run, lap, 'pass-failed');
      if (!passed && move === 'wait-drs') eng.drsLap = lap + 1;
    } else {
      const lost = pos(t) < pos(user.code);
      run.notes.push({
        lap,
        kind: 'battle',
        driver: user.code,
        detail: lost ? 'lost' : 'held',
        other: t,
      });
      if (called && move === 'let-go') {
        if (lost) trust(run, lap, t === model.rival ? 'let-rival-go' : 'let-car-go');
      } else if (called) trust(run, lap, lost ? 'passed-anyway' : 'held-called');
    }
  }

  // A stop that swapped places with the rival, judged once the rival has answered it (its own
  // stop) or a few laps on: a stop that only drops him behind until the rival pits is fine.
  const rival = state.cars[model.rival];
  if (rival && !rival.retired) {
    if (user.pittedThisLap) {
      eng.stopWatch = {
        lap,
        ahead: (prevTime[user.code] as number) < (prevTime[rival.code] as number),
      };
    } else if (
      eng.stopWatch &&
      (rival.pittedThisLap || lap >= eng.stopWatch.lap + cfg.trust.stopWatch)
    ) {
      const after = user.totalTime < rival.totalTime;
      if (eng.stopWatch.ahead && !after) trust(run, lap, 'stop-lost');
      if (!eng.stopWatch.ahead && after) trust(run, lap, 'undercut');
      eng.stopWatch = null;
    }
  }

  // Requests the wall turned down, once the watch is over (or he boxed anyway).
  const keep: EngineerState['refused'] = [];
  for (const r of eng.refused) {
    if (r.request === 'box' && user.pittedThisLap) continue; // boxed after all
    if (lap < r.lap + cfg.trust.watch - 1) {
      keep.push(r);
      continue;
    }
    let wrong: boolean;
    if (r.request === 'box') {
      const cliff = model.compounds[user.compound]?.cliffLap ?? Number.POSITIVE_INFINITY;
      wrong =
        user.tyreWear > cliff ||
        run.notes.some(
          (n) =>
            n.lap >= r.lap &&
            n.driver === user.code &&
            (n.detail === 'puncture' || (n.kind === 'incident' && n.detail === 'puncture')),
        );
    } else {
      const gap = rival && !rival.retired ? rival.totalTime - user.totalTime : r.gap;
      wrong = gap - r.gap < -1.0;
    }
    trust(run, lap, wrong ? 'request-wrong' : 'request-right');
  }
  eng.refused = keep;

  // Quiet laps settle him, back toward where he started: calmer after a row, a little less
  // sure of the wall after a run of good calls.
  if (eng.trust !== eng.baseTrust && lap - eng.lastEvent >= cfg.trust.settleAfter) {
    const before = moodOf(cfg, eng.trust);
    const was = eng.trust;
    eng.trust =
      eng.trust < eng.baseTrust
        ? Math.min(eng.baseTrust, eng.trust + cfg.trust.settle)
        : Math.max(eng.baseTrust, eng.trust - cfg.trust.settle);
    if (moodOf(cfg, eng.trust) !== before) {
      run.notes.push({
        lap,
        kind: 'trust',
        driver: user.code,
        detail: 'settled',
        value: eng.trust - was,
      });
    }
  }
}

/**
 * Green-flag order after a lap. Walking the start-of-lap order front to back, each follower
 * that started within PASS_WINDOW of the car ahead gets ONE pass roll; success puts it ahead,
 * failure holds it FOLLOW_GAP behind. A car passed within REPASS_COOLDOWN laps gets no roll
 * against the car that passed it. Pairs involving a car that pitted this lap, or that
 * started further apart, are left to the natural time order.
 */
function resolveOrder(
  run: Run,
  lap: number,
  clean: Record<string, number>,
  prevTime: Record<string, number>,
  pitted: Set<string>,
): void {
  const overtake = run.model.track.overtakeModel;
  const cars = run.state.cars;
  const order = live(run);
  for (let i = 1; i < order.length; i++) {
    const a = cars[order[i - 1] as string] as CarState;
    const b = cars[order[i] as string] as CarState;
    if (pitted.has(a.code) || pitted.has(b.code)) continue;
    const gap = (prevTime[b.code] as number) - (prevTime[a.code] as number);
    if (!(gap >= 0 && gap < PASS_WINDOW)) continue;
    const advantage = (clean[a.code] as number) - (clean[b.code] as number);
    const shift =
      (effect(run, b, 'battle').attackLogit ?? 0) +
      (effect(run, a, 'battle').defendLogit ?? 0) +
      (effect(run, b, 'ers').attackLogit ?? 0) +
      (effect(run, a, 'ers').defendLogit ?? 0) +
      (holdingUp(run, a.code, b.code) ? (run.headset?.teamOrders?.holdUpLogit ?? 0) : 0) +
      engineerShift(run, lap, a.code, b.code);
    // No roll (and no draw) while b is in its cooldown after being passed by a.
    const cooling = lap - (run.passedBy.get(`${b.code}>${a.code}`) ?? -1e9) <= REPASS_COOLDOWN;
    if (
      !cooling &&
      run.rng.get(OVERTAKE_STREAM, b.code).next() < passProbability(overtake, advantage, gap, shift)
    ) {
      run.passedBy.set(`${a.code}>${b.code}`, lap);
      if (b.totalTime >= a.totalTime) b.totalTime = a.totalTime - PASS_MARGIN;
    } else if (b.totalTime < a.totalTime + FOLLOW_GAP) {
      b.totalTime = a.totalTime + FOLLOW_GAP;
    }
  }
  sortByTime(order, cars);
  run.state.order = withRetired(run, order);
}

/** Classification: finishers by time, then retirees (latest retirement first). */
/** Dry compounds counted by the two-compound rule. */
export const DRY_COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD'] as const;

/**
 * Two-compound rule: in a dry race every car must run at least two different dry compounds.
 * (No modelled race is wet; wet tyres would waive it.)
 */
export function ruleSatisfied(car: CarState): boolean {
  const dry = new Set(
    car.compoundsUsed.filter((c) => (DRY_COMPOUNDS as readonly string[]).includes(c)),
  );
  return dry.size >= 2;
}

/**
 * Classification: finishers by time, then retirees (latest retirement first). In a live run
 * a car that reaches the flag without satisfying the two-compound rule is disqualified and
 * listed last, as in the real rules. Scripted real strategies always comply, so replays
 * (and Python parity) are unaffected.
 */
export function classify(run: Run): RaceResult {
  // Track-limit penalties are added at the flag (race engineer spec).
  const penalty = run.state.engineer?.penalty ?? 0;
  const time = (c: string) =>
    car(run, c).totalTime + (penalty && c === run.model.userSide ? penalty : 0);
  const running = live(run).sort((a, b) => time(a) - time(b));
  const finished = isFinished(run);
  const disqualified =
    run.live && finished ? running.filter((c) => !ruleSatisfied(car(run, c))) : [];
  const finishers = running.filter((c) => !disqualified.includes(c));
  const retirees = retiredInOrder(run).sort(
    (a, b) => (car(run, b).retiredLap ?? 0) - (car(run, a).retiredLap ?? 0),
  );
  const winner = finishers.length ? time(finishers[0] as string) : 0;
  const gaps: Record<string, number> = {};
  const times: Record<string, number> = {};
  for (const c of finishers) {
    gaps[c] = time(c) - winner;
    times[c] = time(c);
  }
  return {
    order: [...finishers, ...retirees, ...disqualified],
    finishers,
    disqualified,
    gaps,
    times,
  };
}

/** Run one seeded simulation from the takeover lap to the flag. */
export function simulate(model: RaceModel, seed: number, options?: RunOptions): RaceResult {
  const run = initRun(model, seed, options);
  while (!isFinished(run)) stepLap(run);
  return classify(run);
}
