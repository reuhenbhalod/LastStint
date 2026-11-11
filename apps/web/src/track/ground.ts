// The real ground under the 2D track map (realistic UI spec): each circuit's surroundings seen
// from above, one image per circuit (apps/web/public/basemap, from `pipeline basemap`). The
// index says where each race's outline sits on its circuit's image.

import index from '../../../../data/basemap/index.json';

export interface Ground {
  /** The image's URL. */
  src: string;
  /** Its size in metres (the units it's drawn in before the matrix). */
  w: number;
  h: number;
  /** SVG matrix(a b c d e f): the image's metres into the outline's map units. */
  matrix: [number, number, number, number, number, number];
  /** The open land's colour: the image fades into it, and it fills the map beyond. */
  base: string;
}

interface Index {
  circuits: Record<string, { w: number; h: number; px: number[]; src: string; base: string }>;
  races: Record<string, { circuit: string; matrix: number[]; err: number }>;
}

const INDEX = index as Index;
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

/** The ground for a race, or null when its circuit has no image yet. */
export function groundFor(raceId: string): Ground | null {
  const race = INDEX.races[raceId];
  const circuit = race && INDEX.circuits[race.circuit];
  if (!race || !circuit || race.matrix.length !== 6) return null;
  return {
    src: `${BASE}${circuit.src}`,
    w: circuit.w,
    h: circuit.h,
    matrix: race.matrix as Ground['matrix'],
    base: circuit.base,
  };
}
