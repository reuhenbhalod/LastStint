// A circuit's 3D scenery (data/scenery, written by `pipeline scenery`; docs/3d-spec.md), and
// where a car on the game's lap is in it.

import { SCENE_3D } from './switch.js';

export interface SceneryRace {
  /** The game's outline (2D map units) into the scenery: world = M · p + t. */
  m: [number, number, number, number];
  t: [number, number];
  err: number;
  /** Fractions of the game's lap (evenly spaced) to fractions of the real lap (unwrapped). */
  frac: number[];
  corners: Array<[number, number, number]>;
  pit: Array<[number, number]>;
}

export interface Scenery {
  circuit: string;
  name: string;
  light: 'afternoon' | 'overcast' | 'dusk' | 'summer';
  ground: 'park' | 'forest' | 'desert' | 'dry';
  /** Metres: x east, z south, from the scenery's corner. */
  size: [number, number];
  grid: { nx: number; nz: number; step: number; min: number; h: string };
  lap: { pts: Array<[number, number]>; y: number[]; bridge: number[]; length: number };
  pit: Array<[number, number]> | null;
  areas: Record<string, Array<Array<[number, number]>>>;
  buildings: Array<{
    p: Array<[number, number]>;
    h: number;
    min?: number;
    stand?: 1;
    roof?: string;
  }>;
  roads: Array<{ w: number; p: Array<[number, number]> }>;
  streams: Array<{ w: number; p: Array<[number, number]> }>;
  rails: Array<Array<[number, number]>>;
  barriers: Array<{ kind: string; p: Array<[number, number]> }>;
  trees: Array<[number, number]>;
  landmarks: Array<{ kind: 'wheel'; at: [number, number]; size: number }>;
  races: Record<string, SceneryRace>;
  credit: string;
}

// Behind the switch, so with SCENE_3D off the scenery files aren't built at all.
const FILES: Record<string, () => Promise<{ default: Scenery }>> = SCENE_3D
  ? import.meta.glob<{ default: Scenery }>('../../../../data/scenery/*.json')
  : {};

/** Which races have scenery: the circuit file's name by race id prefix. */
const CIRCUIT_OF: Record<string, string> = {
  italy: 'monza',
  belgium: 'spa',
  bahrain: 'bahrain',
  japan: 'suzuka',
  hungary: 'hungaroring',
};
const RACES: Record<string, string[]> = {
  monza: ['italy-2019', 'italy-2022', 'italy-2024'],
  spa: ['belgium-2024'],
  bahrain: ['bahrain-2021', 'bahrain-2022'],
  suzuka: ['japan-2024'],
  hungaroring: ['hungary-2019', 'hungary-2025'],
};

/** The circuit with scenery for this race, or null. */
export function circuitFor(raceId: string): string | null {
  const c = CIRCUIT_OF[raceId.replace(/-\d{4}$/, '')];
  if (!c || !RACES[c]?.includes(raceId)) return null;
  return FILES[`../../../../data/scenery/${c}.json`] ? c : null;
}

export async function loadScenery(circuit: string): Promise<Scenery> {
  const load = FILES[`../../../../data/scenery/${circuit}.json`];
  if (!load) throw new Error(`no scenery for ${circuit}`);
  return (await load()).default;
}

/** Ground heights, decoded (metres above the scenery's lowest point). */
export function heights(s: Scenery): Float32Array {
  const bin = atob(s.grid.h);
  const out = new Float32Array(s.grid.nx * s.grid.nz);
  for (let k = 0; k < out.length; k++) {
    out[k] = (bin.charCodeAt(2 * k) | (bin.charCodeAt(2 * k + 1) << 8)) / 10;
  }
  return out;
}

/** Where on the real lap (a fractional point index) a car at `at` of the game's lap is. */
export function lapIndex(race: SceneryRace, n: number, at: number): number {
  const f = race.frac;
  const k = f.length;
  const x = (((at % 1) + 1) % 1) * k;
  const i = Math.floor(x) % k;
  const a = f[i] as number;
  const b = i + 1 < k ? (f[i + 1] as number) : (f[0] as number) + 1;
  const real = a + (b - a) * (x - Math.floor(x));
  return (((real % 1) + 1) % 1) * n;
}

/** A point of the game's 2D map in the scenery. */
export function toWorld(race: SceneryRace, x: number, y: number): [number, number] {
  const [a, b, c, d] = race.m;
  return [a * x + b * y + race.t[0], c * x + d * y + race.t[1]];
}

export type { MapFeed } from '../track/feed.js';
