// Your Versus setup: the car and start tyre you pick in the garage (Lobby.tsx). It's remembered in
// the browser, and the match's pick screen (Versus.tsx Pick) starts from it, so on the grid you
// only lock it in. The pick itself stays blind and server-side as before.

import { STAT_SCALE, VERSUS_CARS, VERSUS_TRACKS, type versusTrack } from '@laststint/sim';

const SETUP_KEY = 'laststint:versus-setup';
export const TYRES = ['SOFT', 'MEDIUM', 'HARD'] as const;
export type StartTyre = (typeof TYRES)[number];

export interface Setup {
  car: string;
  tyre: StartTyre;
}

export const DEFAULT_SETUP: Setup = { car: 'balanced', tyre: 'MEDIUM' };

export const STAT_NAME: Record<string, string> = {
  topSpeed: 'Top speed',
  cornering: 'Cornering',
  tyreWear: 'Tyre life',
  fuelUse: 'Fuel saving',
  pitCrew: 'Pit crew',
};

/** A stored setup, or the default when there's none or it names a car or tyre that's gone. */
export function parseSetup(raw: string | null): Setup {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Setup>) : null;
    const car = VERSUS_CARS.some((c) => c.id === v?.car) ? (v?.car as string) : DEFAULT_SETUP.car;
    const tyre = TYRES.includes(v?.tyre as StartTyre) ? (v?.tyre as StartTyre) : DEFAULT_SETUP.tyre;
    return { car, tyre };
  } catch {
    return DEFAULT_SETUP;
  }
}

export function loadSetup(): Setup {
  try {
    return parseSetup(localStorage.getItem(SETUP_KEY));
  } catch {
    return DEFAULT_SETUP;
  }
}

export function saveSetup(setup: Setup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    // private mode
  }
}

// A match entered from the garage (Lobby.tsx create or join) already has its setup: the match
// locks it in on its own (Versus.tsx Match) instead of showing the car pick again. Per tab, by
// match code; a shared link opened directly still gets the car pick.
const GARAGE_KEY = 'laststint:versus-from-garage';

export function markFromGarage(code: string): void {
  try {
    sessionStorage.setItem(GARAGE_KEY, code.toUpperCase());
  } catch {
    // private mode
  }
}

export function cameFromGarage(code: string): boolean {
  try {
    return sessionStorage.getItem(GARAGE_KEY) === code.toUpperCase();
  } catch {
    return false;
  }
}

/** What a car's pace stats come to on this track (s a lap vs a Balanced car). */
export function lapEdge(
  track: ReturnType<typeof versusTrack> | null,
  stats: Record<string, number>,
): string {
  if (!track) return '';
  const mean = VERSUS_TRACKS.reduce((a, t) => a + t.straightShare, 0) / VERSUS_TRACKS.length;
  const s = track.straightShare;
  const d =
    -STAT_SCALE.pace *
    ((stats.topSpeed ?? 0) * (s / mean) + (stats.cornering ?? 0) * ((1 - s) / (1 - mean)));
  if (Math.abs(d) < 0.005) return 'same pace as Balanced';
  return `${Math.abs(d).toFixed(2)} s a lap ${d < 0 ? 'quicker' : 'slower'} than Balanced`;
}
