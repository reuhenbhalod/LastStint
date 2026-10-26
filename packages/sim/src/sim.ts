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

import headsetConfig from './headset.json';
import { type Rng, deriveSeed, mulberry32 } from './rng.js';
import type {
  CarState,
  Decision,
  FlagState,
  Modes,
  PitStop,
  RaceModel,
  RaceNote,
  RaceResult,
  RaceState,
} from './types.js';

export const DIRTY_AIR_RANGE = 1.0; // within this gap (s) a car is in dirty air
export const PASS_WINDOW = 2.0; // a follower within this gap (s) gets one pass roll
export const FOLLOW_GAP = 0.3; // a follower that fails to pass is held this far (s) behind
export const PASS_MARGIN = 0.05; // a completed pass puts the follower this far (s) ahead
export const BUNCH_GAP = 0.5; // SC train spacing per car (measured on the final SC lap)
export const SC_CLOSE_PER_LAP = 20.0; // s a gap closes per full SC lap
export const SC_FALLBACK = 1.6; // SC lap = this x green if not supplied
export const VSC_FALLBACK = 1.35; // VSC lap = this x green if not supplied
export const CLIFF_FALLBACK = 2.0; // extra wear past the cliff = this x degPerLap if not fitted
export const OVERTAKE_STREAM = 1000;
export const ERROR_STREAM = 2000;
// Rival policy (Implementation Plan 2.5): under green the rival covers a stop only if its own
// next planned stop is within this many laps.
export const COVER_WINDOW = 4;

export type Strategies = Record<string, PitStop[]>;

export interface RunOptions {
  /** Override any car's real strategy (scripted cars; ignored for a player-controlled car). */
  strategies?: Strategies;
  /** The player's calls. When given (even empty), the user's car and the rival go live. */
  decisions?: Decision[];
}

interface ModeEffect {
  lapDelta?: number;
  wearMult?: number;
  errorMult?: number;
  attackLogit?: number;
  defendLogit?: number;
}

interface HeadsetEra {
  baseErrorRate: number;
  errorCost: number;
  modes: { [K in keyof Modes]: Record<string, ModeEffect> };
}

const HEADSET = headsetConfig as unknown as Record<string, HeadsetEra>;

export const DEFAULT_MODES: Modes = { pace: 'standard', fuel: 'normal', battle: 'hold' };

/** Internal run state: the public RaceState plus the per-car random streams. */
export interface Run {
  model: RaceModel;
  state: RaceState;
  /** The player's calls so far (the run log the Worker replays). */
  decisions: Decision[];
  /** True when the user's car is player-controlled and the rival reacts. */
  live: boolean;
  notes: RaceNote[];
  headset: HeadsetEra | undefined;
  noiseRng: Record<string, Rng>;
  passRng: Record<string, Rng>;
  errorRng: Record<string, Rng>;
  /** Neutralization flag per lap, and retirements per lap, precomputed from events. */
  neutral: Map<number, Exclude<FlagState, 'green'>>;
  retireAt: Map<number, string[]>;
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
  const c = model.compounds[car.compound];
  if (!c) throw new Error(`no compound model for ${car.compound}`);
  const wear = car.tyreWear;
  let t = car.basePace + c.offset + c.degPerLap * wear - model.fuelEffectPerLap * lap;
  if (wear > c.cliffLap) {
    const extra = c.cliffDegPerLap ?? CLIFF_FALLBACK * c.degPerLap;
    t += extra * (wear - c.cliffLap);
  }
  return t;
}

function effect(run: Run, car: CarState, key: keyof Modes): ModeEffect {
  return run.headset?.modes[key][car.modes[key]] ?? {};
}

/** Sum of the car's standing-mode lap-time deltas (0 on default modes). */
function modeLapDelta(run: Run, car: CarState): number {
  return (
    (effect(run, car, 'pace').lapDelta ?? 0) +
    (effect(run, car, 'fuel').lapDelta ?? 0) +
    (effect(run, car, 'battle').lapDelta ?? 0)
  );
}

function modeWearMult(run: Run, car: CarState): number {
  return (effect(run, car, 'pace').wearMult ?? 1) * (effect(run, car, 'fuel').wearMult ?? 1);
}

/** Per-lap probability of a costly mistake above the baseline (0 on default modes). */
function extraErrorRate(run: Run, car: CarState): number {
  if (!run.headset) return 0;
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
    if (d.kind === 'pit') {
      if (!model.compounds[d.compound]) throw new Error(`unknown compound ${d.compound}`);
      if (d.lap >= model.race.laps) throw new Error('no stop on the final lap');
    } else if (d.kind === 'mode') {
      if (!headset?.modes[d.key]?.[d.value]) throw new Error(`unknown mode ${d.key}=${d.value}`);
    } else if (d.kind !== 'radio') {
      throw new Error('unknown decision kind');
    }
  }
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
  const neutral = new Map<number, Exclude<FlagState, 'green'>>();
  const retireAt = new Map<number, string[]>();
  for (const e of model.events) {
    if (e.type === 'SC' || e.type === 'VSC' || e.type === 'RED') {
      for (let lap = e.lap; lap < e.lap + (e.laps ?? 1); lap++) neutral.set(lap, FLAG_OF[e.type]);
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

  const noiseRng: Record<string, Rng> = {};
  const passRng: Record<string, Rng> = {};
  const errorRng: Record<string, Rng> = {};
  model.drivers.forEach((d, i) => {
    noiseRng[d.code] = mulberry32(deriveSeed(seed, i));
    passRng[d.code] = mulberry32(deriveSeed(seed, OVERTAKE_STREAM + i));
    errorRng[d.code] = mulberry32(deriveSeed(seed, ERROR_STREAM + i));
  });

  return {
    model,
    decisions: [...(options.decisions ?? [])],
    live,
    notes: [],
    headset: HEADSET[model.era],
    errorRng,
    state: {
      lap: model.race.takeoverLap,
      flag: 'green',
      order: ordered.map((d) => d.code),
      cars,
    },
    noiseRng,
    passRng,
    neutral,
    retireAt,
  };
}

function car(run: Run, code: string): CarState {
  const c = run.state.cars[code];
  if (!c) throw new Error(`unknown car ${code}`);
  return c;
}

function live(run: Run): string[] {
  return run.state.order.filter((c) => !car(run, c).retired);
}

function retiredInOrder(run: Run): string[] {
  return run.state.order.filter((c) => car(run, c).retired);
}

/**
 * Log a player call during the race (the BOX button, a headset change, a radio answer). It
 * must be for a lap not yet run. Throws on an invalid call.
 */
export function decide(run: Run, decision: Decision): void {
  if (!run.live) throw new Error('this run has no player-controlled car');
  if (decision.lap <= run.state.lap) throw new Error(`lap ${decision.lap} has already run`);
  validateDecisions(run.model, [decision]);
  run.decisions.push(decision);
}

/** Apply the player's calls for this lap to the user's car before it is run. */
function applyDecisions(run: Run, lap: number): void {
  if (!run.live) return;
  const user = run.state.cars[run.model.userSide];
  if (!user || user.retired) return;
  for (const d of run.decisions) {
    if (d.lap !== lap) continue;
    if (d.kind === 'mode') {
      (user.modes as unknown as Record<string, string>)[d.key] = d.value;
    } else if (d.kind === 'pit') {
      user.strategy = user.strategy.filter((s) => s.lap !== lap + 1);
      user.strategy.push({ lap: lap + 1, to: d.compound });
    }
  }
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

  const nextStop = rival.strategy.filter((s) => s.lap > lap).sort((a, b) => a.lap - b.lap)[0];
  const nextFlag = run.neutral.get(lap + 1);
  let cover = false;
  if (flag === 'sc' || flag === 'vsc') {
    if (nextFlag === 'sc' || nextFlag === 'vsc') {
      const cost = nextFlag === 'sc' ? model.track.pitLossUnderSC : model.track.pitLossUnderVSC;
      cover = user.totalTime - rival.totalTime > cost;
    }
  } else {
    const startGap = Math.abs((prevTime[user.code] ?? 0) - (prevTime[rival.code] ?? 0));
    cover =
      startGap < model.track.pitLoss && !!nextStop && nextStop.lap - (lap + 1) <= COVER_WINDOW;
  }
  if (!cover) return;
  const to = nextStop?.to ?? user.compound;
  rival.strategy = rival.strategy.filter((s) => s !== nextStop);
  rival.strategy.push({ lap: lap + 1, to });
  run.notes.push({ lap, kind: 'rival-cover', driver: rival.code, detail: to });
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

  const running = live(run);
  const prevTime: Record<string, number> = {};
  for (const c of running) prevTime[c] = car(run, c).totalTime;
  const clean: Record<string, number> = {};
  const pitted = new Set<string>();

  running.forEach((code, i) => {
    const c = car(run, code);
    c.pittedThisLap = false;
    let pitCost = 0;
    const stopIdx = c.strategy.findIndex((st) => st.lap === lap);
    if (stopIdx >= 0) {
      const stop = c.strategy[stopIdx] as PitStop;
      c.strategy.splice(stopIdx, 1);
      pitted.add(code);
      c.pittedThisLap = true;
      c.compound = stop.to;
      c.tyreAge = 0;
      c.tyreWear = 0;
      pitCost =
        flag === 'sc'
          ? track.pitLossUnderSC
          : flag === 'vsc'
            ? track.pitLossUnderVSC
            : track.pitLoss;
    }

    let lt: number;
    if (flag === 'sc' && scTime) lt = scTime;
    else if (flag === 'vsc' && vscTime) lt = vscTime;
    else if (flag === 'red' && green) lt = green;
    else {
      lt = cleanLap(model, c, lap) + (run.noiseRng[code] as Rng).normal(c.noise);
      const ahead = i > 0 ? (running[i - 1] as string) : code;
      const aheadGap = c.totalTime - (prevTime[ahead] ?? c.totalTime);
      if (aheadGap > 0 && aheadGap < DIRTY_AIR_RANGE) lt += track.dirtyAirPenalty;
      lt += modeLapDelta(run, c);
      const errorRate = extraErrorRate(run, c);
      if (errorRate > 0 && run.headset && (run.errorRng[code] as Rng).next() < errorRate) {
        lt += run.headset.errorCost;
        run.notes.push({ lap, kind: 'error', driver: code });
      }
    }
    clean[code] = cleanLap(model, c, lap) + (flag ? 0 : modeLapDelta(run, c));
    c.totalTime += lt + pitCost;
    c.tyreAge += 1;
    c.tyreWear += flag ? 1 : modeWearMult(run, c);
  });

  for (const code of run.retireAt.get(lap) ?? []) {
    const c = state.cars[code];
    if (c && !c.retired) {
      c.retired = true;
      c.retiredLap = lap;
    }
  }

  if (flag) {
    // No overtaking under neutralization: sorting by total time moves only cars that pitted.
    // Under a SC each gap then closes by SC_CLOSE_PER_LAP down to nose-to-tail.
    const order = live(run).sort((a, b) => car(run, a).totalTime - car(run, b).totalTime);
    state.order = [...order, ...retiredInOrder(run)];
    if (flag === 'sc') {
      for (let i = 1; i < order.length; i++) {
        const ahead = car(run, order[i - 1] as string);
        const c = car(run, order[i] as string);
        const gap = c.totalTime - ahead.totalTime;
        c.totalTime = ahead.totalTime + Math.max(BUNCH_GAP, gap - SC_CLOSE_PER_LAP);
      }
    }
  } else {
    resolveOrder(run, clean, prevTime, pitted);
  }
  rivalReacts(run, lap, flag, prevTime);

  state.lap = lap;
  state.flag = flag ?? 'green';
  return state;
}

/**
 * Green-flag order after a lap. Walking the start-of-lap order front to back, each follower
 * that started within PASS_WINDOW of the car ahead gets ONE pass roll; success puts it ahead,
 * failure holds it FOLLOW_GAP behind. Pairs involving a car that pitted this lap, or that
 * started further apart, are left to the natural time order.
 */
function resolveOrder(
  run: Run,
  clean: Record<string, number>,
  prevTime: Record<string, number>,
  pitted: Set<string>,
): void {
  const overtake = run.model.track.overtakeModel;
  const order = live(run);
  for (let i = 1; i < order.length; i++) {
    const a = car(run, order[i - 1] as string);
    const b = car(run, order[i] as string);
    if (pitted.has(a.code) || pitted.has(b.code)) continue;
    const gap = (prevTime[b.code] as number) - (prevTime[a.code] as number);
    if (!(gap >= 0 && gap < PASS_WINDOW)) continue;
    const advantage = (clean[a.code] as number) - (clean[b.code] as number);
    const shift =
      (effect(run, b, 'battle').attackLogit ?? 0) + (effect(run, a, 'battle').defendLogit ?? 0);
    if ((run.passRng[b.code] as Rng).next() < passProbability(overtake, advantage, gap, shift)) {
      if (b.totalTime >= a.totalTime) b.totalTime = a.totalTime - PASS_MARGIN;
    } else if (b.totalTime < a.totalTime + FOLLOW_GAP) {
      b.totalTime = a.totalTime + FOLLOW_GAP;
    }
  }
  order.sort((x, y) => car(run, x).totalTime - car(run, y).totalTime);
  run.state.order = [...order, ...retiredInOrder(run)];
}

/** Classification: finishers by time, then retirees (latest retirement first). */
export function classify(run: Run): RaceResult {
  const finishers = live(run).sort((a, b) => car(run, a).totalTime - car(run, b).totalTime);
  const retirees = retiredInOrder(run).sort(
    (a, b) => (car(run, b).retiredLap ?? 0) - (car(run, a).retiredLap ?? 0),
  );
  const winner = finishers.length ? car(run, finishers[0] as string).totalTime : 0;
  const gaps: Record<string, number> = {};
  const times: Record<string, number> = {};
  for (const c of finishers) {
    gaps[c] = car(run, c).totalTime - winner;
    times[c] = car(run, c).totalTime;
  }
  return { order: [...finishers, ...retirees], finishers, gaps, times };
}

/** Run one seeded simulation from the takeover lap to the flag. */
export function simulate(model: RaceModel, seed: number, options?: RunOptions): RaceResult {
  const run = initRun(model, seed, options);
  while (!isFinished(run)) stepLap(run);
  return classify(run);
}
