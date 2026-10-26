// Lap-loop simulator (Implementation Plan 2.3-2.4): a TypeScript port of the Python
// reference sim (pipeline/src/pipeline/sim_reference.py). The two must agree on every golden
// file in data/golden/ (tests/parity.test.ts); change both together.
//
// A run is fully defined by (race model, seed, strategies). Each car draws from its own
// random streams, indexed by its position in model.drivers: lap noise on deriveSeed(seed, i),
// its pass attempts on deriveSeed(seed, OVERTAKE_STREAM + i). One car's strategy never
// shifts another car's draws.

import { type Rng, deriveSeed, mulberry32 } from './rng.js';
import type { CarState, FlagState, PitStop, RaceModel, RaceResult, RaceState } from './types.js';

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

export type Strategies = Record<string, PitStop[]>;

/** Internal run state: the public RaceState plus the per-car random streams. */
export interface Run {
  model: RaceModel;
  state: RaceState;
  noiseRng: Record<string, Rng>;
  passRng: Record<string, Rng>;
  /** Neutralization flag per lap, and retirements per lap, precomputed from events. */
  neutral: Map<number, Exclude<FlagState, 'green'>>;
  retireAt: Map<number, string[]>;
}

/** Fitted logistic P(follower passes this lap) from pace advantage (s/lap) and gap (s). */
export function passProbability(
  overtake: RaceModel['track']['overtakeModel'],
  advantage: number,
  gap: number,
): number {
  const z = overtake.intercept + overtake.paceCoef * advantage + overtake.gapCoef * gap;
  return 1 / (1 + Math.exp(-z));
}

/** Model (noise-free) lap time for a car on this lap: pace + tyres - fuel. */
export function cleanLap(model: RaceModel, car: CarState, lap: number): number {
  const c = model.compounds[car.compound];
  if (!c) throw new Error(`no compound model for ${car.compound}`);
  let t = car.basePace + c.offset + c.degPerLap * car.tyreAge - model.fuelEffectPerLap * lap;
  if (car.tyreAge > c.cliffLap) {
    const extra = c.cliffDegPerLap ?? CLIFF_FALLBACK * c.degPerLap;
    t += extra * (car.tyreAge - c.cliffLap);
  }
  return t;
}

const FLAG_OF = { SC: 'sc', VSC: 'vsc', RED: 'red' } as const;

/** Build the run at the takeover lap. `strategies` overrides any car's real strategy. */
export function initRun(model: RaceModel, seed: number, strategies: Strategies = {}): Run {
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
      totalTime: cum,
      strategy: [...(strategies[d.code] ?? d.realStrategy)],
      pittedThisLap: false,
      retired: false,
      retiredLap: null,
      modes: { pace: 'standard', battle: 'hold' },
    };
  }

  const noiseRng: Record<string, Rng> = {};
  const passRng: Record<string, Rng> = {};
  model.drivers.forEach((d, i) => {
    noiseRng[d.code] = mulberry32(deriveSeed(seed, i));
    passRng[d.code] = mulberry32(deriveSeed(seed, OVERTAKE_STREAM + i));
  });

  return {
    model,
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
    }
    clean[code] = cleanLap(model, c, lap);
    c.totalTime += lt + pitCost;
    c.tyreAge += 1;
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
    if ((run.passRng[b.code] as Rng).next() < passProbability(overtake, advantage, gap)) {
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
export function simulate(model: RaceModel, seed: number, strategies?: Strategies): RaceResult {
  const run = initRun(model, seed, strategies);
  while (!isFinished(run)) stepLap(run);
  return classify(run);
}
