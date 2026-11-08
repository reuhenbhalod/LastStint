// The ten eras of Eras mode (docs/laststint-eras-mode-spec.md §4): id, name, years and play
// order. Players start at Era 10 (play order 1) and move back through the timeline to Era 1.
// The server's `eras` table (spec §12) is the source of truth once the Eras API is up; this is
// the client's copy for routing and the placeholder screens.

export interface EraInfo {
  /** 1..10, oldest first (Era 1 is 1983–1988). */
  id: number;
  name: string;
  /** For display, e.g. "2022–2025". */
  years: string;
  /** 1..10, newest first: Era 10 is play order 1. */
  playOrder: number;
}

/** In play order (newest first). */
export const ERAS: readonly EraInfo[] = [
  { id: 10, name: 'Ground-effect era', years: '2022–2025', playOrder: 1 },
  { id: 9, name: 'The 2021 title fight', years: '2021', playOrder: 2 },
  { id: 8, name: 'Mercedes vs Ferrari', years: '2017–2020', playOrder: 3 },
  { id: 7, name: 'Hybrid turbo', years: '2014–2016', playOrder: 4 },
  { id: 6, name: 'Fast-wearing tyres', years: '2010–2013', playOrder: 5 },
  { id: 5, name: 'Alonso, Räikkönen, Hamilton', years: '2005–2009', playOrder: 6 },
  { id: 4, name: 'Ferrari dynasty', years: '2000–2004', playOrder: 7 },
  { id: 3, name: 'Refuelling returns', years: '1994–1999', playOrder: 8 },
  { id: 2, name: 'Senna vs Prost', years: '1989–1993', playOrder: 9 },
  { id: 1, name: 'Turbo era', years: '1983–1988', playOrder: 10 },
];

export function eraById(id: number): EraInfo | undefined {
  return ERAS.find((e) => e.id === id);
}

/**
 * The Eras route a path is on: the era map (`/eras`), an era's detail (`/eras/<eraId>`), or
 * `null` when the path isn't an Eras path. An era segment that isn't a known era id gives
 * `{ kind: 'unknown' }` so the screen can say so.
 */
export type ErasRoute =
  | { kind: 'map' }
  | { kind: 'era'; era: EraInfo }
  | { kind: 'unknown'; segment: string };

export function erasRoute(pathname: string): ErasRoute | null {
  const m = /^\/eras(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!m) return null;
  const segment = m[1] ?? '';
  if (segment === '') return { kind: 'map' };
  const era = /^\d+$/.test(segment) ? eraById(Number(segment)) : undefined;
  return era ? { kind: 'era', era } : { kind: 'unknown', segment };
}
