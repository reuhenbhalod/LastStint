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
import type { RivalPolicy } from './eras/config.js';
import { type FaultTable, cloneFaults, faultCost, faultTable } from './faults.js';
import headsetConfig from './headset.json';
import { legendEvents, legendLoss } from './legend.js';
import { validatePlan } from './plan.js';
import { type RedFlagPlan, lineUp, redFlagPlan, roadOrder } from './redflag.js';
import {
  burnTank,
  checkFill,
  fuelLimit,
  initTanks,
  realFill,
  refuelAtStop,
  refuelling,
  tankPlanDelta,
  tankWeightDelta,
} from './refuel.js';
import { coverWindow, playoutPolicy, resolveRivalPolicy } from './rivals/policy.js';
import {
  type RivalChoice,
  type RivalGrading,
  type RivalRunState,
  assertRivalReady,
  forkRivalState,
  initRivalState,
  rivalAfterLap,
  rivalPlanBefore,
} from './rivals/react.js';
import { type Rng, deriveSeed, mulberry32 } from './rng.js';
import {
  allowedFlag,
  hasMove,
  headsetFor,
  illegalPitCompound,
  minStopsRule,
  pitLaneClosed,
  scQueue,
  serveStopGo,
  stopChangesTyres,
  stopGoCost,
  stopsBeforeTakeover,
  stopsOwed,
  twoCompoundRule,
} from './rules.js';
import type {
  BattleMove,
  CarState,
  CompoundModel,
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
import {
  WET_OFF_COST,
  WET_OFF_STREAM,
  forecastWetness,
  isWetTyre,
  weatherWear,
  wetCrash,
  wetFactor,
  wetOff,
  wetnessOn,
} from './weather.js';

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
// An Eras race (one with an era `rules` block) closes its middle SC laps gap by gap instead:
// each gap over SC_QUEUE_SPACING keeps SC_QUEUE_KEEP of its excess (fitted on the 2018+ timed
// races' real queues, pipeline sc_queue.py). Daily/Gauntlet race files carry no rules block.
export const SC_QUEUE_SPACING = 1.7;
export const SC_QUEUE_KEEP = 0.34;
export const SC_FALLBACK = 1.6; // SC lap = this x green if not supplied
export const VSC_FALLBACK = 1.35; // VSC lap = this x green if not supplied
export const CLIFF_FALLBACK = 2.0; // extra wear past the cliff = this x degPerLap if not fitted
/** A tyre is worn out once it's this much slower than new (s/lap): its usable life. */
export const LIFE_LOSS = 2.0;
/** Laps of life a rival keeps in hand when it skips a stop to go long. */
export const GO_LONG_MARGIN = 3;

/**
 * A compound's usable life (tyre-life fix): the tyre age at which its wear and its cliff make it
 * LIFE_LOSS s a lap slower than new. A fitted cliff is where wear bends upward, often gently
 * (Canada 22 hards: lap 7, +0.03 s a lap), so it isn't the end of a tyre; this is. With no
 * fitted cliff, cliffLap is the edge of the evidence (the longest stint run on it) and the life
 * goes no further. What the game shows as life, and what "worn" means for pushing, punctures,
 * the rival and requests.
 */
export function tyreLife(c: CompoundModel): number {
  const extra = c.cliffDegPerLap ?? CLIFF_FALLBACK * c.degPerLap;
  const loss =
    c.degPerLap * c.cliffLap >= LIFE_LOSS
      ? LIFE_LOSS / c.degPerLap
      : (LIFE_LOSS + extra * c.cliffLap) / (c.degPerLap + extra);
  const life = c.cliffDegPerLap === undefined ? Math.min(loss, c.cliffLap) : loss;
  // A tyre that real teams ran for N laps in this race lasts at least N (tyre-life fix 2).
  return Math.min(99, Math.max(Math.floor(life), c.provenLaps ?? 0));
}

/** Usable life of `compound` in `model` (Infinity if the race has no model for it). */
export function lifeOf(model: RaceModel, compound: string): number {
  const c = model.compounds[compound];
  return c ? tyreLife(c) : Number.POSITIVE_INFINITY;
}
export const OVERTAKE_STREAM = 1000;
export const ERROR_STREAM = 2000;
export const STOP_STREAM = 4000;
export const EVENT_STREAM = 5000;
export const INCIDENT_STREAM = 6000;
export const CONTACT_STREAM = 7000; // the user's car: contact in a battle (race engineer spec)
export const LIMITS_STREAM = 8000; // the user's car: track-limit strikes
export const FUEL_STREAM = 10000; // the user's car: the fuel margin at the takeover
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
  /**
   * Live play: the rival's policy (eras spec §7; rivals/policy.ts). Default `standard`, today's
   * rival. Throws RivalPolicyError on an unknown name.
   */
  rivalPolicy?: RivalPolicy;
  /**
   * Legend difficulty (eras spec 8; legend.ts): the real non-storyline SC/VSC periods after
   * the takeover are replaced by ones drawn from `seed` at the track's historical rate.
   */
  legend?: boolean;
  /** Expert: the rival's claimed choices to replay (rivals/react.ts). */
  rivalChoices?: RivalChoice[];
  /** Expert: how its decisions are graded without a claim (default 'inline'; rivals/react.ts). */
  rivalGrading?: RivalGrading;
  /** Expert: samples per decision (default EXPERT_SAMPLES). */
  rivalSamples?: number;
}

export interface ModeEffect {
  lapDelta?: number;
  wearMult?: number;
  errorMult?: number;
  attackLogit?: number;
  defendLogit?: number;
  /** ERS: battery % gained (+) or spent (-) each green lap. */
  charge?: number;
  /** Fuel load spec: multiplies the fuel burnt a lap. */
  burnMult?: number;
}

/** The fuel load (fuel load spec; live play only). See headset.json's comment. */
export interface FuelConfig {
  burnPerLap: number;
  marginMin: number;
  marginMax: number;
  neutralBurn: number;
  dryLapDelta: number;
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

/**
 * One era's block in headset.json (eras build plan 1.2: one for each schema era). Rule
 * switches by era (roadmap R5): `drs` false drops the `wait-drs` move; an era without `ers`
 * has no battery, so no `ers` modes and no `overtake-button`.
 */
interface HeadsetEra {
  baseErrorRate: number;
  errorCost: number;
  /** The `wait-drs` battle move exists (DRS, 2011-2025). Absent means true. */
  drs?: boolean;
  modes: { [K in Exclude<keyof Modes, 'ers'>]: Record<string, ModeEffect> } & {
    ers?: Record<string, ModeEffect>;
  };
  neutralization?: { scPerLap: number; vscPerLap: number; scLaps: number; vscLaps: number };
  /** The battery (KERS / hybrid ERS); absent in eras without one. */
  ers?: { startBattery: number; scCharge: number };
  fuel?: FuelConfig;
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
  return headsetFor(HEADSET, model)?.engineer ?? null;
}

/** The era's fuel load settings (null: no fuel load in this era). */
export function fuelConfig(model: RaceModel): FuelConfig | null {
  return headsetFor(HEADSET, model)?.fuel ?? null;
}

/**
 * Fuel to spare at the flag (kg; negative: short) for a car with `fuel` kg after `lap`, at
 * the standard burn. Null without a fuel load.
 */
export function fuelMargin(model: RaceModel, car: CarState, lap: number): number | null {
  const f = fuelConfig(model);
  if (!f || car.fuel === undefined) return null;
  return car.fuel - f.burnPerLap * Math.max(0, model.race.laps - lap);
}

/** The fuel load's lap-time effect on this lap (0 without one): its weight, or an empty tank. */
function fuelLapDelta(run: Run, car: CarState, lap: number): number {
  const f = run.headset?.fuel;
  if (!f || car.fuel === undefined || !run.incidents) return 0;
  if (car.fuel <= 0) return f.dryLapDelta;
  // Off the standard load (what the fitted fuel effect assumes), each kg moves the lap time.
  const nominal = f.burnPerLap * (run.model.race.laps - lap + 1);
  return (run.model.fuelEffectPerLap / f.burnPerLap) * (car.fuel - nominal);
}

/** Burn a lap's fuel: the modes' multipliers on green, a fraction under a SC or VSC. */
function burnFuel(run: Run, car: CarState, lap: number, neutral: boolean): void {
  const f = run.headset?.fuel;
  if (!f || car.fuel === undefined || !run.incidents || car.fuel <= 0) return;
  const mult = neutral
    ? f.neutralBurn
    : (effect(run, car, 'pace').burnMult ?? 1) * (effect(run, car, 'fuel').burnMult ?? 1);
  car.fuel = Math.max(0, car.fuel - f.burnPerLap * mult);
  if (car.fuel <= 0) run.notes.push({ lap, kind: 'fuel', driver: car.code, detail: 'empty' });
  // A fuel-limit race (eras build plan 4.2): an empty tank stops the car.
  if (car.fuel <= 0 && fuelLimit(run.model) !== null) outOfFuel(run, car, lap);
}

/** Eras build plan 4.2: the car ran out of fuel and stops (retires on this lap). */
function outOfFuel(run: Run, car: CarState, lap: number): void {
  car.retired = true;
  car.retiredLap = lap;
  run.notes.push({ lap, kind: 'fuel', driver: car.code, detail: 'out' });
}

/** A refuelling race: burn a lap from the tank (refuel.ts); a live tank burns by the modes
 * and the era's neutral share, and stops the car when it runs dry. */
function burnRefuelTank(run: Run, car: CarState, lap: number, neutral: boolean): void {
  const mult = !car.tankLive
    ? 1
    : neutral
      ? (HEADSET[run.model.era]?.fuel?.neutralBurn ?? 1)
      : (effect(run, car, 'pace').burnMult ?? 1) * (effect(run, car, 'fuel').burnMult ?? 1);
  if (burnTank(car, mult)) outOfFuel(run, car, lap);
}

/** The headset modes' effects for a model's era (for explaining the options in the game). */
export function modeEffects(model: RaceModel): HeadsetEra['modes'] | null {
  return headsetFor(HEADSET, model)?.modes ?? null;
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
  /** How the rival reacts in live play (RunOptions.rivalPolicy). Forks keep the parent's. */
  rivalPolicy: RivalPolicy;
  /** Legend difficulty (RunOptions.legend): the evaluator and server read it off the run. */
  legend: boolean;
  /** Expert's decision state (rivals/react.ts); undefined for every other policy. */
  rival?: RivalRunState;
  notes: RaceNote[];
  headset: HeadsetEra | undefined;
  /** Per-car random streams, created on first use (see Streams). */
  rng: Streams;
  /** Per-lap working tables, reused every lap (no allocation in the grader's hot loop). */
  scratch: { prevTime: Record<string, number>; clean: Record<string, number>; pitted: Set<string> };
  /** Neutralizations (start lap, length, flag): the real ones, or a grader fork's view. */
  events: NeutralEvent[];
  /** Red flags: free stops in the stoppage, gaps wiped at the restart (redflag.ts). */
  red: RedFlagPlan;
  /** Neutralization flag per lap, and retirements per lap, precomputed from events. */
  neutral: Map<number, Exclude<FlagState, 'green'>>;
  retireAt: Map<number, string[]>;
  /** Lap of each recent pass, keyed `${passed}>${passer}` (REPASS_COOLDOWN). */
  passedBy: Map<string, number>;
  /** Live play: crashes, failures and punctures happen (RunOptions.incidents). */
  incidents: boolean;
  /** A crash brings out a SC/VSC (off in grader playouts, which sample neutralizations). */
  incidentFlags: boolean;
  /**
   * The track's wetness on each lap (index lap - 1): the real race's, or a grader fork's
   * forecast (weather spec W3). Empty in a dry race.
   */
  wetness: number[];
  /** Car faults by car (faults.ts): frozen on their real laps; forks end their own. */
  faults: FaultTable;
}

export interface NeutralEvent {
  lap: number;
  laps: number;
  flag: Exclude<FlagState, 'green'>;
}

export function neutralMap(events: NeutralEvent[]): Map<number, Exclude<FlagState, 'green'>> {
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

/** A stop's measured loss, if it applies: in Legend only under the flag it was measured under. */
function stopLoss(run: Run, stop: PitStop, lap: number): number | undefined {
  return run.legend ? legendLoss(run.model, run.neutral, stop, lap) : stop.loss;
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

/**
 * Model (noise-free) lap time for a car on this lap: pace + tyres - fuel, times the weather's
 * factor in a wet race at wetness `w` (default: the real race's on that lap).
 */
export function cleanLap(model: RaceModel, car: CarState, lap: number, w?: number): number {
  const dry =
    tyreLapTime(model, car.basePace, car.compound, car.tyreWear, lap) +
    freshTyreDelta(model, car.tyreAge) +
    tankWeightDelta(model, car, lap); // refuelling: the weight resets at each stop (refuel.ts)
  if (!model.weather) return dry;
  const wet = w ?? wetnessOn(model.weather.wetness, lap);
  return dry * wetFactor(model.weather, car.compound, wet, car.wetPace ?? 0, car.dampPace);
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
export function tyreLapTime(
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
  const worn = pace < 0 && car.tyreWear >= lifeOf(run.model, car.compound);
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
  const headset = headsetFor(HEADSET, model);
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
      const illegal = illegalPitCompound(model, d.compound); // era rules (rules.ts)
      if (illegal) throw new Error(illegal);
      checkFill(model, d.fill); // refuel.ts
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
      if (d.kind === 'battle' && !hasMove(headset, d.move)) {
        throw new Error(`no ${d.move} in the ${model.era} era`);
      }
    } else if (d.kind === 'plan') {
      validatePlan(model, d, model.race.takeoverLap);
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

/**
 * The user's real calls as pit decisions (in-lap = real out-lap - 1), for comparison. In a
 * refuelling race each carries the real fill (refuel.ts realFill: the next real stint).
 */
export function realDecisions(model: RaceModel): Decision[] {
  const user = model.drivers.find((d) => d.code === model.userSide);
  const fuel = refuelling(model);
  return (user?.realStrategy ?? []).map((s) => ({
    lap: s.lap - 1,
    kind: 'pit',
    compound: s.to,
    ...(fuel ? { fill: realFill(model, model.userSide, s.lap) } : {}),
  }));
}

const FLAG_OF = { SC: 'sc', VSC: 'vsc', RED: 'red' } as const;

/** Build the run at the takeover lap. `strategies` overrides any car's real strategy. */
export function initRun(model: RaceModel, seed: number, options: RunOptions = {}): Run {
  const strategies = options.strategies ?? {};
  const live = options.decisions !== undefined;
  if (live) validateDecisions(model, options.decisions ?? []);
  const events: NeutralEvent[] = [];
  const retireAt = new Map<number, string[]>();
  // Legend: random SC/VSC periods; red flags stay real (legend.ts isKept).
  const timeline = options.legend ? legendEvents(model, seed) : model.events;
  for (const e of timeline) {
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
      ...(d.wetPace ? { wetPace: d.wetPace } : {}),
      ...(d.dampPace !== undefined ? { dampPace: d.dampPace } : {}),
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
      // Era rules (rules.ts minStops): the stops count only where the race has a minimum.
      ...(minStopsRule(model.rules) > 0 ? { stops: stopsBeforeTakeover(d) } : {}),
    };
  }
  // Refuelling (refuel.ts): every car's takeover tank; the player's burns live with incidents.
  initTanks(
    model,
    cars,
    (code) => realOf(model, code),
    live ? model.userSide : undefined,
    live && options.incidents !== false,
  );
  const ers = headsetFor(HEADSET, model)?.ers;
  const userCar = cars[model.userSide];
  if (live && ers && userCar) userCar.battery = ers.startBattery;
  // The race engineer side comes with live play's chaos (incidents): without it the real
  // calls replay the real race exactly.
  const engineer =
    live && options.incidents !== false ? headsetFor(HEADSET, model)?.engineer : undefined;

  const rivalPolicy = resolveRivalPolicy(options.rivalPolicy);
  const rival = live ? initRivalState(rivalPolicy, options) : undefined;
  const run: Run = {
    model,
    seed,
    ...makeStreams(model, seed),
    decisions: [...(options.decisions ?? [])],
    live,
    rivalPolicy,
    legend: options.legend === true,
    ...(rival ? { rival } : {}),
    notes: [],
    headset: headsetFor(HEADSET, model),
    passedBy: new Map(),
    incidents: live && options.incidents !== false && !!headsetFor(HEADSET, model)?.incidents,
    incidentFlags: true,
    wetness: [...(model.weather?.wetness ?? [])],
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
    red: redFlagPlan(timeline),
    retireAt,
    faults: faultTable(model.events),
  };
  // The fuel load: what the flag needs at the standard burn, plus the race's margin.
  const fuel = run.headset?.fuel;
  const user = run.state.cars[model.userSide];
  if (run.incidents && fuel && user) {
    const margin =
      fuel.marginMin +
      (fuel.marginMax - fuel.marginMin) * run.rng.get(FUEL_STREAM, model.userSide).next();
    user.fuel = fuel.burnPerLap * (model.race.laps - model.race.takeoverLap) + margin;
  }
  markNextFlag(run);
  return run;
}

/** A stop with its out-lap on `lap` is the tyre change in a red flag's stoppage: free. */
export function redFlagFree(run: Run, lap: number): boolean {
  const redLap = run.red.free.get(lap);
  return redLap !== undefined && run.neutral.get(redLap) === 'red';
}

/** Each car's stops with no tyre change, out-lap -> loss (DriverModel.serviceStops). */
const SERVICE = new WeakMap<RaceModel, Map<string, Map<number, number>>>();

/** The loss of the car's stop with no tyre change on `lap` (a repair, a stop-go, a
 * drive-through), if it has one: paid whatever its strategy (sim_reference.py). */
export function serviceStopLoss(model: RaceModel, code: string, lap: number): number | undefined {
  let table = SERVICE.get(model);
  if (!table) {
    table = new Map();
    for (const d of model.drivers) {
      if (d.serviceStops?.length)
        table.set(d.code, new Map(d.serviceStops.map((s) => [s.lap, s.loss])));
    }
    SERVICE.set(model, table);
  }
  return table.get(code)?.get(lap);
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
    const drawn = u < rates.scPerLap ? 'sc' : u < rates.scPerLap + rates.vscPerLap ? 'vsc' : null;
    // Era rules (rules.ts allowedFlag): no made-up SC or VSC before 1993.
    const flag = drawn && allowedFlag(run.model, drawn);
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
  for (const [code, c] of Object.entries(run.state.cars)) {
    cars[code] = cloneCar(c);
    // The grader's playouts leave the fuel load out (fuel load spec: live play only).
    if (options.blindAfter !== undefined) {
      (cars[code] as CarState).fuel = undefined;
      (cars[code] as CarState).tankLive = undefined; // refuel.ts: no dry stop in playouts
    }
  }
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
    // Playouts in an Expert race have Smart rivals (eras spec §7: no grading inside grading).
    rivalPolicy:
      options.blindAfter === undefined ? run.rivalPolicy : playoutPolicy(run.rivalPolicy),
    rival: forkRivalState(run.rival, options.blindAfter !== undefined),
    notes: [],
    ...blindView(run, seed, options.blindAfter),
    faults: cloneFaults(run.faults, options.blindAfter),
    // Blind playouts already draw neutralizations at the base rates, crashes included.
    incidentFlags: options.blindAfter === undefined ? run.incidentFlags : false,
    // Blind: the weather after the decision is the forecast's, not the real race's (W3).
    wetness:
      options.blindAfter === undefined
        ? run.wetness
        : forecastWetness(run.wetness, options.blindAfter, seed),
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

/** A car's real strategy (refuel.ts prices a fill choice at a real stop against it). */
function realOf(model: RaceModel, code: string): readonly PitStop[] {
  return model.drivers.find((d) => d.code === code)?.realStrategy ?? [];
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
      const stop = playerStop(run, lap + 1, d.compound);
      // A refuelling race's call always carries its fill (validateDecisions).
      user.strategy.push(d.fill !== undefined ? { ...stop, fill: d.fill } : stop);
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
  // Expert covers green-flag stops on the player's in-lap instead (rivals/react.ts).
  if (run.rivalPolicy === 'expert' && flag !== 'sc' && flag !== 'vsc') return;
  const to = rivalCover(model, rival, {
    lap,
    flag,
    nextFlag: run.neutral.get(lap + 1),
    startGap: Math.abs((prevTime[user.code] ?? 0) - (prevTime[rival.code] ?? 0)),
    userBehind: user.totalTime - rival.totalTime,
    userCompound: user.compound,
    window: coverWindow(run.rivalPolicy),
  });
  if (!to) return;
  if (pitLaneClosed(model, run.neutral, lap + 1, to)) return; // era rules: no stop-go cover
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
    /** The green-flag cover window (default COVER_WINDOW; rivals/policy.ts coverWindow). */
    window?: number;
  },
): string | null {
  const { lap, flag, nextFlag } = at;
  // Era rules: with no tyre changes there's no fresh set to cover with (4.2: refuel stops).
  if (model.rules?.tyreChanges === false) return null;
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
      at.startGap < model.track.pitLoss &&
      !!nextStop &&
      nextStop.lap - (lap + 1) <= (at.window ?? COVER_WINDOW);
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
  // Era rules: a no-tyre-change race's stops refuel, so none is skipped (eras build plan 4.2).
  if (model.rules?.tyreChanges === false) return;
  // Refuelling: a rival whose fuel doesn't reach the flag can't skip a stop.
  if (rival.tank !== undefined && rival.tank - 1 < model.race.laps - lap) return;
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

  // A team goes long only with a few laps of life to spare at the flag.
  const life = lifeOf(model, rival.compound) - GO_LONG_MARGIN;
  const lapsToCliff = Number.isFinite(life) ? Math.max(1, Math.floor(life - rival.tyreWear)) : 1;
  if (stopLap + lapsToCliff <= model.race.laps) return; // would have to stop later anyway
  const others = rival.strategy.filter((s) => s !== planned);
  // Two-compound rule: going long may not drop the stop that would make the rival comply.
  const needsThisStop =
    !ruleSatisfied(rival, model.rules) && !others.some((s) => !rival.compoundsUsed.includes(s.to));
  if (needsThisStop) return;
  // Era rules (minStops): nor the stop that the rival needs for the minimum.
  if (stopsOwed(model.rules, rival) > others.length) return;
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
      if (stopChangesTyres(model.rules, compound, stop)) {
        compound = stop.to;
        wear = 0;
        age = 0;
      }
      const { track } = model;
      total += redFlagFree(run, lap)
        ? 0
        : flag === 'sc'
          ? track.pitLossUnderSC
          : flag === 'vsc'
            ? track.pitLossUnderVSC
            : track.pitLoss;
      if (pitLaneClosed(model, known, lap, stop.to)) total += stopGoCost(model); // era rules
    }
    const wet = wetnessOn(run.wetness, lap);
    if (!flag) {
      const dry =
        tyreLapTime(model, car.basePace, compound, wear, lap) + freshTyreDelta(model, age);
      total += dry * wetFactor(model.weather, compound, wet, car.wetPace ?? 0, car.dampPace);
    }
    wear += (flag ? 1 : wearMult) * weatherWear(model.weather, compound, wet);
    age += 1;
  }
  // Refuelling (refuel.ts): the fill time and the tank's weight; Infinity if it runs dry.
  if (car.tank !== undefined) total += tankPlanDelta(model, car, fromLap, stop, known);
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
  // Era rules: with no tyre changes a dry stop only costs time, unless it refuels (refuel.ts).
  if (model.rules?.tyreChanges === false && !model.weather && !refuelling(model)) return null;
  // Two-compound rule: a car that hasn't yet run two dry compounds must stop for a new one.
  const mustChange = !ruleSatisfied(user, model.rules);
  // Minimum stops (rules.minStops): a car still owing one must stop.
  const mustStop = mustChange || owedAfterPlan(model, user, state.lap) > 0;
  // Refuelling: the planner prices the tank (exact path); one stop at most, as ever.
  let best: PitStop | null = null;
  // Plan only on what is known now: neutralizations that have started by the next lap.
  const known = knownNow(run);
  let knownAhead = false;
  for (const lap of known.keys()) if (lap > state.lap) knownAhead = true;
  // The fast path assumes a dry race (a lap's time splits into a lap term and a tyre term).
  if (!knownAhead && !options.exact && !model.weather && user.tank === undefined)
    return planGreenToFlag(run, user, mustChange, mustStop);
  let bestTime = mustStop
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
function planGreenToFlag(
  run: Run,
  user: CarState,
  mustChange: boolean,
  mustStop: boolean,
): PitStop | null {
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
  let bestTime = mustStop ? Number.POSITIVE_INFINITY : (pre[n] as number);
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

/** Neutralizations the run knows of now: those that have started by the next lap. */
function knownNow(run: Run): Map<number, Exclude<FlagState, 'green'>> {
  return neutralMap(run.events.filter((e) => e.lap <= run.state.lap + 1));
}

/** Stops the car still owes the race's minimum beyond those it has planned after `lap`. */
function owedAfterPlan(model: RaceModel, car: CarState, lap: number): number {
  const owed = stopsOwed(model.rules, car);
  return owed && Math.max(0, owed - car.strategy.filter((s) => s.lap > lap).length);
}

/**
 * The grader's sensible-strategist continuation as a list of stops: planRemainingStop's one
 * stop (or none), unless the car owes more than one stop for the race's minimum
 * (rules.minStops), when it is the fastest plan of exactly that many stops
 * (planOwedStops). Without the rule, exactly planRemainingStop.
 */
export function planRemainingStops(run: Run): PitStop[] {
  const user = run.state.cars[run.model.userSide];
  if (!user || user.retired) return [];
  const owed = owedAfterPlan(run.model, user, run.state.lap);
  if (owed > 1) return planOwedStops(run, user, owed);
  const stop = planRemainingStop(run);
  return stop ? [stop] : [];
}

/**
 * The fastest plan of exactly `k` more stops for `car` by the lap-time model (as
 * predictedRemaining: no noise, traffic or rivals; known neutralizations skipped; the pit loss
 * for each stop's flag), with the two-compound rule kept: a dynamic programme over (stops
 * left, out-lap, rule met), O(k x laps^2 x compounds). The tank is left out: no race with a
 * minimum refuels. Each stop fits new tyres. The earliest stops win a tie. Empty if no plan
 * of `k` stops fits.
 */
function planOwedStops(run: Run, car: CarState, k: number): PitStop[] {
  const { model, state } = run;
  const known = knownNow(run);
  const first = state.lap + 1;
  const last = model.race.laps;
  const n = last - first + 1;
  if (n < k) return [];
  const compounds = Object.keys(model.compounds).filter((c) => !illegalPitCompound(model, c));
  const wearMult = modeWearMult(run, car);
  const lapCost = (compound: string, wear: number, age: number, lap: number) => {
    if (known.get(lap)) return 0;
    const dry = tyreLapTime(model, car.basePace, compound, wear, lap) + freshTyreDelta(model, age);
    const wet = wetnessOn(run.wetness, lap);
    return dry * wetFactor(model.weather, compound, wet, car.wetPace ?? 0, car.dampPace);
  };
  const wearStep = (compound: string, lap: number) =>
    (known.get(lap) ? 1 : wearMult) *
    weatherWear(model.weather, compound, wetnessOn(run.wetness, lap));
  // cur[i]: laps first..first+i-1 on the current set.
  const cur = new Float64Array(n + 1);
  {
    let wear = car.tyreWear;
    for (let i = 0; i < n; i++) {
      const lap = first + i;
      cur[i + 1] = (cur[i] as number) + lapCost(car.compound, wear, car.tyreAge + i, lap);
      wear += wearStep(car.compound, lap);
    }
  }
  // fresh[c][a][j]: laps a..a+j-1 on a new set of c fitted at out-lap a (index a - first).
  const fresh = compounds.map((c) =>
    Array.from({ length: n }, (_, ai) => {
      const a = first + ai;
      const t = new Float64Array(last - a + 2);
      let wear = 0;
      for (let j = 0; a + j <= last; j++) {
        t[j + 1] = (t[j] as number) + lapCost(c, wear, j, a + j);
        wear += wearStep(c, a + j);
      }
      return t;
    }),
  );
  const loss = (outLap: number, to: string) => {
    if (redFlagFree(run, outLap)) return 0;
    const flag = known.get(outLap);
    const { track } = model;
    const base =
      flag === 'sc' ? track.pitLossUnderSC : flag === 'vsc' ? track.pitLossUnderVSC : track.pitLoss;
    return base + (pitLaneClosed(model, known, outLap, to) ? stopGoCost(model) : 0);
  };
  const meets = (met: boolean, c: string) =>
    met ||
    isWetTyre(c) ||
    ((DRY_COMPOUNDS as readonly string[]).includes(c) && !car.compoundsUsed.includes(c));
  // best[at(left, met, ai)]: the time from a stop at out-lap first+ai (its pit loss included)
  // to the flag, with `left` more stops after it and the two-compound rule met (1) or not (0)
  // before it; fit / next: that stop's compound index and the next stop's out-lap index.
  const INF = Number.POSITIVE_INFINITY;
  const at = (left: number, met: number, ai: number) => (left * 2 + met) * n + ai;
  const best = new Float64Array(2 * k * n).fill(INF);
  const fit = new Int32Array(2 * k * n).fill(-1);
  const next = new Int32Array(2 * k * n).fill(-1);
  for (let left = 0; left < k; left++) {
    for (let ai = n - 1; ai >= 0; ai--) {
      const a = first + ai;
      for (let met = 0; met <= 1; met++) {
        const i = at(left, met, ai);
        compounds.forEach((c, ci) => {
          const t = fresh[ci]?.[ai] as Float64Array;
          const met2 = meets(met === 1, c) ? 1 : 0;
          const pit = loss(a, c);
          // The last stop runs to the flag; it must leave the two-compound rule met.
          const ends = left === 0 ? [n] : Array.from({ length: n - ai - 1 }, (_, j) => ai + 1 + j);
          for (const bi of ends) {
            const rest = left === 0 ? (met2 ? 0 : INF) : (best[at(left - 1, met2, bi)] as number);
            const total = pit + (t[bi - ai] as number) + rest;
            if (total < (best[i] as number)) {
              best[i] = total;
              fit[i] = ci;
              next[i] = bi;
            }
          }
        });
      }
    }
  }
  // The first stop, after a stint on the current set.
  let met = ruleSatisfied(car, model.rules) ? 1 : 0;
  let ai = -1;
  let bestT = INF;
  for (let s = 0; s < n; s++) {
    const total = (cur[s] as number) + (best[at(k - 1, met, s)] as number);
    if (total < bestT) {
      bestT = total;
      ai = s;
    }
  }
  const stops: PitStop[] = [];
  for (let left = k - 1; left >= 0 && ai >= 0 && bestT < INF; left--) {
    const i = at(left, met, ai);
    const c = compounds[fit[i] as number] as string;
    stops.push({ lap: first + ai, to: c });
    met = meets(met === 1, c) ? 1 : 0;
    ai = next[i] as number;
  }
  return stops;
}

/** True once the chequered flag has fallen. */
export function isFinished(run: Run): boolean {
  return run.state.lap >= run.model.race.laps;
}

/** Advance the race one lap: pit stops, lap times, retirements, then order. */
export function stepLap(run: Run): RaceState {
  const { model, state } = run;
  if (isFinished(run)) return state;
  assertRivalReady(run);
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
      // Era rules (minStops): never skipped when the rival needs it for the minimum.
      const needed = stopsOwed(model.rules, c) > c.strategy.length - 1;
      if (
        !needed &&
        gapBehind <= (stopLoss(run, stop, lap) ?? stopCost(run, code, flag, false, lap))
      ) {
        c.strategy.splice(stopIdx, 1);
        stopIdx = -1;
      }
    }
    // Era rules (rules.ts): a stop-go owed for a closed pit lane is served on a green lap.
    if (c.stopGo) {
      const served = serveStopGo(c, flag, lap, model.race.laps);
      if (served) {
        pitCost += served;
        pitted.add(code);
        run.notes.push({ lap, kind: 'stop-go', driver: code, detail: 'served', value: served });
      }
    }
    if (stopIdx >= 0) {
      const stop = c.strategy[stopIdx] as PitStop;
      c.strategy.splice(stopIdx, 1);
      pitted.add(code);
      c.pittedThisLap = true;
      if (c.stops !== undefined) c.stops++; // era rules: minStops
      // Era rules (rules.ts): with no tyre changes (2005) a stop keeps the set.
      if (stopChangesTyres(model.rules, c.compound, stop)) {
        c.compound = stop.to;
        if (!c.compoundsUsed.includes(stop.to)) c.compoundsUsed.push(stop.to);
        c.tyreAge = 0;
        c.tyreWear = 0;
      }
      // A red flag's stoppage: the tyre change there is free (redflag.ts), the fill too.
      const free = redFlagFree(run, lap);
      if (!free) {
        pitCost += stopLoss(run, stop, lap) ?? stopCost(run, code, flag, stop.added === true, lap);
      }
      // Refuelling (refuel.ts): fill for the next stint; the fill time over the base cost.
      if (c.tank !== undefined) {
        const fillTime = refuelAtStop(model, c, stop, lap, realOf(model, code));
        if (!free) pitCost += fillTime;
      }
      // Era rules: an added stop into a closed pit lane (2007-08) owes a stop-go.
      if (stop.added && pitLaneClosed(model, run.neutral, lap, stop.to)) {
        const cost = stopGoCost(model);
        c.stopGo = (c.stopGo ?? 0) + cost;
        run.notes.push({ lap, kind: 'stop-go', driver: code, detail: 'owed', value: cost });
        if (lap >= model.race.laps) pitCost += serveStopGo(c, flag, lap, model.race.laps);
      }
      const eng = code === model.userSide ? state.engineer : undefined;
      if (eng && eng.damage > 0) {
        // A new nose on the stop: slower than a tyre change alone.
        pitCost += run.headset?.engineer?.noseCost ?? 0;
        eng.damage = 0;
        run.notes.push({ lap, kind: 'nose', driver: code });
      }
    }

    // A stop with no tyre change (a repair, a stop-go, a drive-through; Eras builds): whatever
    // the car's strategy, it pays its measured loss on its real lap and keeps its set.
    const service = serviceStopLoss(model, code, lap);
    if (service !== undefined) {
      pitted.add(code);
      c.pittedThisLap = true;
      if (!redFlagFree(run, lap)) pitCost += service;
    }
    // A car fault (faults.ts): its pace loss on green laps, its slow lap on its own lap.
    const fault = faultCost(run.faults, code, lap, c.pittedThisLap, !flag);
    if (fault.struck) run.notes.push({ lap, kind: 'fault', driver: code, detail: fault.struck });
    const wet = wetnessOn(run.wetness, lap);
    const base = cleanLap(model, c, lap, wet);
    const eng = code === model.userSide && !flag ? state.engineer : undefined;
    const lapEng = eng ? engineerLap(run, lap, c, running, i, prevTime, eng) : null;
    if (lapEng) battle = lapEng;
    const modeDelta = flag
      ? 0
      : modeLapDelta(run, c) + (lapEng?.pace ?? 0) + fuelLapDelta(run, c, lap);
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
      // Slicks in the wet (weather spec): the player's car slides off now and then.
      if (code === model.userSide && run.incidents && model.weather) {
        const off = wetOff(model.weather, c.compound, wet);
        if (off > 0 && run.rng.get(WET_OFF_STREAM, code).next() < off) {
          lt += WET_OFF_COST;
          run.notes.push({ lap, kind: 'error', driver: code, detail: 'aquaplane' });
        }
      }
      const errorRate = extraErrorRate(run, c) + (lapEng?.errorRate ?? 0);
      if (errorRate > 0 && run.headset && run.rng.get(ERROR_STREAM, code).next() < errorRate) {
        lt += run.headset.errorCost;
        run.notes.push({ lap, kind: 'error', driver: code });
      }
    }
    lt += fault.pace + fault.extra;
    clean[code] = base + modeDelta + fault.pace;
    c.totalTime += lt + pitCost;
    c.tyreAge += 1;
    c.tyreWear +=
      (flag ? 1 : modeWearMult(run, c) * (lapEng?.wearMult ?? 1)) *
      weatherWear(model.weather, c.compound, wet);
    if (c.battery !== undefined) {
      const gain = flag ? (run.headset?.ers?.scCharge ?? 0) : (effect(run, c, 'ers').charge ?? 0);
      c.battery = Math.min(100, Math.max(0, c.battery + gain));
    }
    burnFuel(run, c, lap, !!flag);
    if (c.tank !== undefined) burnRefuelTank(run, c, lap, !!flag);
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
      bunch(order, cars, green, keep, scQueue(model), model.rules !== undefined);
      state.order = [...sortByTime(order, cars), ...retiredInOrder(run)];
    }
  } else {
    resolveOrder(run, lap, clean, prevTime, pitted);
    applySwap(run, lap, prevTime);
  }
  const wipe = run.red.wipes.get(lap);
  if (wipe && run.neutral.get(wipe.redLap) === 'red') {
    // No unlapping (scUnlap 'none'): the lapped cars line up where they are on the road.
    lineUp(live(run), cars, wipe.gap, scQueue(model) === 'none' ? green : undefined);
  }
  if (state.engineer) engineerAfterLap(run, lap, battle, prevTime, pitted);
  const rivalBefore = rivalPlanBefore(run);
  rivalReacts(run, lap, flag, prevTime);
  rivalGoesLong(run, lap);

  state.lap = lap;
  state.flag = flag ?? 'green';
  markNextFlag(run);
  rivalAfterLap(run, lap, rivalBefore);
  return state;
}

/**
 * Crashes, mechanical failures and punctures (feedback round 2; live play only, green laps).
 * Each running car takes one draw a lap from its own incident stream, so one car's fate never
 * shifts another's. The chance of each grows with what provokes it: pushing (failures,
 * punctures), tyres past their cliff (punctures), attacking or defending in a fight
 * (crashes). A crash or a failure retires the car; a crash also brings out a SC or VSC from
 * the next lap (not in grader playouts, which sample those; none before 1993: allowedFlag). A puncture costs a slow lap and
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
    const worn = Math.max(0, c.tyreWear - lifeOf(model, c.compound));
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
      (fightBehind && c.modes.battle === 'defend' ? rates.defendCrash : 1) *
      wetCrash(model.weather, c.compound, wetnessOn(run.wetness, lap));
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
      const to = next?.to ?? forcedCompound(model, c, wetnessOn(run.wetness, lap));
      c.strategy = c.strategy.filter((st) => st !== next && st.lap !== lap + 1);
      c.strategy.push({ lap: lap + 1, to, added: true, damaged: true });
      continue;
    }
    c.retired = true;
    c.retiredLap = lap;
    if (kind === 'crash' && run.incidentFlags && lap < model.race.laps) {
      const cfg = run.headset?.neutralization;
      const sc = rng.next() < rates.scShare;
      const from = lap + 1;
      // Era rules (rules.ts allowedFlag): before 1993 a crash brings out no SC or VSC (the draw
      // above is still taken, so the streams don't move).
      const flag = allowedFlag(model, sc ? 'sc' : 'vsc');
      if (cfg && flag && !run.neutral.has(from)) {
        const laps = Math.min(flag === 'sc' ? cfg.scLaps : cfg.vscLaps, model.race.laps - from + 1);
        // New arrays: forks share the parent's events until they change them.
        run.events = [...run.events, { lap: from, laps, flag }];
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
function forcedCompound(model: RaceModel, c: CarState, w = 0): string {
  // In the wet, the tyre for the track.
  if (model.weather && w >= 0.15) return w >= 0.6 && model.compounds.WET ? 'WET' : 'INTERMEDIATE';
  const prefs = ['MEDIUM', 'HARD', 'SOFT'].filter((x) => model.compounds[x]);
  if (!ruleSatisfied(c, model.rules)) {
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
 *
 * An Eras race (`eras`: it has a rules block) closes a middle lap gap by gap (closeGaps, the
 * fit of pipeline sc_queue.py). With scUnlap 'none' (no unlapping: before 2007 and 2010-11)
 * the lapped cars stay in the queue where they are on the road, a lap down (bunchRoad).
 */
function bunch(
  live: string[],
  cars: Record<string, CarState>,
  lapTime: number | undefined,
  keep: number,
  duel: [string, string] | 'none' | null,
  eras = false,
): void {
  if (!live.length) return;
  if (duel === 'none' && lapTime) {
    bunchRoad(live, cars, lapTime, keep, eras);
    return;
  }
  if (!duel && eras && keep > 0) {
    closeGaps(live, cars);
    return;
  }
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
  // scUnlap 'none' (rules.ts scQueue): the lead lap closes up and nobody is waved through.
  const [a, b] = duel === 'none' ? ['', ''] : duel;
  if (duel !== 'none' && keep === 0 && leadLap.includes(a) && leadLap.includes(b)) {
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

/** An Eras middle SC lap: each gap over SC_QUEUE_SPACING keeps SC_QUEUE_KEEP of its excess,
 * measured on the queue as it stood (sim_reference.py _close_gaps). */
function closeGaps(live: string[], cars: Record<string, CarState>): void {
  const old = live.map((c) => (cars[c] as CarState).totalTime);
  for (let i = 1; i < live.length; i++) {
    let gap = (old[i] as number) - (old[i - 1] as number);
    if (gap > SC_QUEUE_SPACING) gap = SC_QUEUE_SPACING + SC_QUEUE_KEEP * (gap - SC_QUEUE_SPACING);
    (cars[live[i] as string] as CarState).totalTime =
      (cars[live[i - 1] as string] as CarState).totalTime + gap;
  }
}

/** No unlapping (scUnlap 'none'): the whole queue closes up in road order, lapped cars where
 * they are on the road, each keeping its laps down; the last lap (keep 0) is nose-to-tail
 * (sim_reference.py _bunch_road). */
function bunchRoad(
  live: string[],
  cars: Record<string, CarState>,
  lapTime: number,
  keep: number,
  eras: boolean,
): void {
  const lead = (cars[live[0] as string] as CarState).totalTime;
  const { road, down, onRoad } = roadOrder(live, cars, lapTime);
  const placed = new Map<string, number>([
    [road[0] as string, onRoad.get(road[0] as string) as number],
  ]);
  for (let i = 1; i < road.length; i++) {
    const ahead = road[i - 1] as string;
    const car = road[i] as string;
    let gap = (onRoad.get(car) as number) - (onRoad.get(ahead) as number);
    if (keep === 0) gap = BUNCH_GAP;
    else if (eras) {
      if (gap > SC_QUEUE_SPACING) gap = SC_QUEUE_SPACING + SC_QUEUE_KEEP * (gap - SC_QUEUE_SPACING);
    } else {
      gap =
        BUNCH_GAP +
        keep * Math.max(0, (onRoad.get(car) as number) - (placed.get(ahead) as number) - BUNCH_GAP);
    }
    placed.set(car, (placed.get(ahead) as number) + gap);
  }
  for (const c of live) {
    (cars[c] as CarState).totalTime =
      lead + (placed.get(c) as number) + (down.get(c) as number) * lapTime;
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
      ? (cfg.moves[eng.move as keyof typeof cfg.moves].attackLogit ?? 0) -
        readMove(cfg, eng, eng.move, ahead, lap)
      : 0;
    return m + (eng.drsLap === lap ? cfg.drsLogit : 0);
  }
  if (ahead === user && isDefend(eng.move)) {
    return (
      (cfg.moves[eng.move as keyof typeof cfg.moves].defendLogit ?? 0) +
      readMove(cfg, eng, eng.move, behind, lap)
    );
  }
  return 0;
}

/**
 * The other driver reads a repeated move (battle variety): the same attack or defence against
 * the same car within two laps loses `adapt` of its logit (he covers the inside he was dived
 * on, or goes round the outside of a car that covered the inside). Waiting and yielding are
 * never read.
 */
export function readMove(
  cfg: EngineerConfig,
  eng: Pick<EngineerState, 'lastMove'>,
  move: BattleMove | null,
  other: string,
  lap: number,
): number {
  const last = eng.lastMove;
  if (!move || !last || move === 'wait-drs' || move === 'let-go') return 0;
  return last.move === move && last.other === other && lap - last.lap <= 2 ? (cfg.adapt ?? 0) : 0;
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
    if (move) eng.lastMove = { move, other: t, lap };
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
      // In a wet race he's also right if he's now on the wrong tyres for the track: slicks
      // in the wet, or wets and inters on a dry line.
      const w = wetnessOn(run.wetness, lap);
      const wrongTyres =
        !!model.weather &&
        ((!isWetTyre(user.compound) && w >= 0.15) || (isWetTyre(user.compound) && w < 0.05));
      wrong =
        wrongTyres ||
        user.tyreWear > lifeOf(model, user.compound) ||
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
export function ruleSatisfied(car: CarState, rules?: RaceModel['rules']): boolean {
  if (!twoCompoundRule(rules)) return true; // era rules: no such rule before 2007
  // Running wet tyres waives the rule (weather spec W6).
  if (isWetTyre(car.compound) || car.compoundsUsed.some(isWetTyre)) return true;
  const dry = new Set(
    car.compoundsUsed.filter((c) => (DRY_COMPOUNDS as readonly string[]).includes(c)),
  );
  return dry.size >= 2;
}

/**
 * Classification: finishers by time, then retirees (latest retirement first). In a live run
 * a car that reaches the flag without satisfying the two-compound rule, or short of the
 * race's minimum stops (rules.minStops), is disqualified and listed last, as in the real rules. Scripted real strategies always comply, so replays
 * (and Python parity) are unaffected.
 */
export function classify(run: Run): RaceResult {
  // Track-limit penalties are added at the flag (race engineer spec).
  const penalty = run.state.engineer?.penalty ?? 0;
  const time = (c: string) =>
    car(run, c).totalTime + (penalty && c === run.model.userSide ? penalty : 0);
  const running = live(run).sort((a, b) => time(a) - time(b));
  const finished = isFinished(run);
  const legalFinish = (c: string) =>
    ruleSatisfied(car(run, c), run.model.rules) && stopsOwed(run.model.rules, car(run, c)) === 0;
  const disqualified = run.live && finished ? running.filter((c) => !legalFinish(c)) : [];
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
