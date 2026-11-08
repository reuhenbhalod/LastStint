// Legend difficulty's safety cars (eras build plan 9.2, eras spec 8 "Legend difficulty"). A
// port of pipeline/src/pipeline/legend.py: the two must draw identical events for every
// (race, seed) (tests/legend.test.ts checks the Python vectors).
//
// In Legend the race's real SC/VSC periods after the takeover are replaced by ones drawn from
// the attempt's seed at the track's historical rate (data/sc_rates.json, measured by
// pipeline/sc_rates.py), so memorizing the race doesn't help. Kept exactly as real: periods
// flagged `storylineEvent`, periods that started on or before the takeover lap, red flags and
// retirements.
//
// The draw: one stream, deriveSeed(seed, LEGEND_STREAM); one draw per lap from takeover + 1
// to the flag, whatever happens. Per lap u < scPerRace / laps is a SC, else
// u < (scPerRace + vscPerRace) / laps a VSC (no VSC when rules.vsc is false; absent =
// allowed). A drawn period starts only after a green lap, runs the all-track mean length,
// stops at the flag and ends a lap before the next kept period; one that can't get a lap is
// dropped. A race before the safety car (rules.ts safetyCarRule: before 1993) draws none.
//
// Scripted stops pay the lap's Legend conditions (legendLoss): a real stop's measured loss was
// taken under the real flag, so on a lap whose flag Legend changed (a real SC now green, a
// green lap now under a drawn SC/VSC) it pays the track's figure for the flag it now runs
// under. Calls follow the safety cars too: moments.ts legendMoments.

import scRatesJson from '../../../data/sc_rates.json';
import { deriveSeed, mulberry32 } from './rng.js';
import { resolveRules } from './rules.js';
import type { FlagState, PitStop, RaceEvent, RaceModel } from './types.js';

export const LEGEND_STREAM = 15000;

interface CircuitRates {
  scPerRace: number;
  vscPerRace: number;
  scFallback: boolean;
  vscFallback: boolean;
}

export interface ScRates {
  lengths: { scLaps: number; vscLaps: number };
  allTracks: { scPerRace: number; vscPerRace: number };
  circuits: Record<string, CircuitRates>;
  /** Race-id slug -> [[fromYear, circuit], ...] (Jolpica rounds). */
  events: Record<string, Array<[number, string]>>;
}

/** The rates one race's Legend draws use. */
export interface LegendRates {
  /** Jolpica circuit reference, or null when the race id's circuit isn't known. */
  circuit: string | null;
  scPerRace: number;
  vscPerRace: number;
  /** True: too little data at this circuit, so the all-track rate is used. */
  scFallback: boolean;
  vscFallback: boolean;
  scLaps: number;
  vscLaps: number;
}

const SC_RATES = scRatesJson as unknown as ScRates;
const RACE_ID = /^(.+?)-(\d{4})(?:-.*)?$/;

/** 'abu-dhabi-2021' -> ['abu-dhabi', 2021]; a variant suffix is ignored ('spain-1994-pits'). */
export function parseRaceId(raceId: string): [string, number] {
  const m = RACE_ID.exec(raceId);
  if (!m) throw new Error(`race id '${raceId}' is not <event-slug>-<year>`);
  return [m[1] as string, Number(m[2])];
}

/** The circuit a race ran at, from the rates file's events table (null: unknown). */
export function circuitFor(raceId: string, rates: ScRates = SC_RATES): string | null {
  const [slug, year] = parseRaceId(raceId);
  let found: string | null = null;
  for (const [fromYear, circuit] of rates.events[slug] ?? []) if (fromYear <= year) found = circuit;
  return found;
}

/** A race's Legend rates: its circuit's, or the all-track rate (flagged). */
export function legendRates(model: RaceModel, rates: ScRates = SC_RATES): LegendRates {
  const circuit = circuitFor(model.race.id, rates);
  const row = circuit ? rates.circuits[circuit] : undefined;
  return {
    circuit,
    scPerRace: row ? row.scPerRace : rates.allTracks.scPerRace,
    vscPerRace: row ? row.vscPerRace : rates.allTracks.vscPerRace,
    scFallback: row ? row.scFallback : true,
    vscFallback: row ? row.vscFallback : true,
    scLaps: rates.lengths.scLaps,
    vscLaps: rates.lengths.vscLaps,
  };
}

/** A real event Legend leaves alone: anything but a non-storyline SC/VSC after the takeover. */
export function isKept(event: RaceEvent, takeoverLap: number): boolean {
  if (event.type !== 'SC' && event.type !== 'VSC') return true;
  return !!event.storylineEvent || event.lap <= takeoverLap;
}

/** The race's events as a Legend attempt with `seed` runs them (sorted by lap). */
export function legendEvents(
  model: RaceModel,
  seed: number,
  rates: ScRates = SC_RATES,
): RaceEvent[] {
  const { laps, takeoverLap } = model.race;
  const r = legendRates(model, rates);
  const rules = resolveRules(model);
  const scOk = rules.safetyCar; // no SC (so no VSC) before 1993
  const vscOk = scOk && rules.vsc;
  const kept = model.events.filter((e) => isKept(e, takeoverLap));
  const busy = new Set<number>();
  for (const e of kept) {
    if (e.type === 'SC' || e.type === 'VSC' || e.type === 'RED') {
      for (let lap = e.lap; lap < e.lap + (e.laps ?? 1); lap++) busy.add(lap);
    }
  }
  const pSc = scOk ? r.scPerRace / laps : 0;
  const pAny = pSc + (vscOk ? r.vscPerRace / laps : 0);
  const rng = mulberry32(deriveSeed(seed, LEGEND_STREAM));
  const drawn: RaceEvent[] = [];
  for (let lap = takeoverLap + 1; lap <= laps; lap++) {
    const u = rng.next(); // one draw per lap
    const type = u < pSc ? 'SC' : u < pAny ? 'VSC' : null;
    if (!type || busy.has(lap) || busy.has(lap - 1)) continue;
    const want = type === 'SC' ? r.scLaps : r.vscLaps;
    let n = 0;
    while (n < want && lap + n <= laps && !busy.has(lap + n) && !busy.has(lap + n + 1)) n++;
    if (n === 0) continue;
    drawn.push({ lap, type, laps: n });
    for (let l = lap; l < lap + n; l++) busy.add(l);
  }
  return [...kept, ...drawn].sort((a, b) => a.lap - b.lap);
}

/** The real SC/VSC periods every Legend run of the race drops (isKept false). */
export function removedEvents(model: RaceModel): RaceEvent[] {
  return model.events.filter((e) => !isKept(e, model.race.takeoverLap));
}

/** The SC/VSC periods a Legend run drew (those not in the race's events), by lap. */
export function drawnEvents(model: RaceModel, events: readonly RaceEvent[]): RaceEvent[] {
  const real = new Set(model.events);
  return events.filter((e) => !real.has(e));
}

const FLAG_OF = { SC: 'sc', VSC: 'vsc', RED: 'red' } as const;
const realFlagCache = new WeakMap<RaceModel, Map<number, Exclude<FlagState, 'green'>>>();

/** The real race's flag per lap (SC, VSC and red-flag laps; absent: green). */
export function realFlags(model: RaceModel): ReadonlyMap<number, Exclude<FlagState, 'green'>> {
  let map = realFlagCache.get(model);
  if (!map) {
    map = new Map();
    for (const e of model.events) {
      if (e.type !== 'SC' && e.type !== 'VSC' && e.type !== 'RED') continue;
      for (let lap = e.lap; lap < e.lap + (e.laps ?? 1); lap++) map.set(lap, FLAG_OF[e.type]);
    }
    realFlagCache.set(model, map);
  }
  return map;
}

/**
 * A stop's loss in a Legend run whose flags are `neutral`: its measured loss while the lap runs
 * under the flag it was measured under, else undefined (the track's figure for the lap's flag:
 * green, SC or VSC). A stop with no measured loss is unchanged.
 */
export function legendLoss(
  model: RaceModel,
  neutral: ReadonlyMap<number, FlagState>,
  stop: Pick<PitStop, 'loss'>,
  lap: number,
): number | undefined {
  if (stop.loss === undefined) return undefined;
  return realFlags(model).get(lap) === neutral.get(lap) ? stop.loss : undefined;
}
