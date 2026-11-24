// Modes that aren't in the release yet. Versus is held back from the first release (owner,
// 2026-11-24): it stays on localhost (a dev build) and in tests, and a deployed build leaves it
// out (no tab, and /versus goes to the home page) unless built with `VITE_VERSUS=1`.

/** Versus is on in a dev build, or in a production build with `VITE_VERSUS=1`. */
export function versusOn(env: { PROD?: boolean; VITE_VERSUS?: string } = import.meta.env): boolean {
  return !env.PROD || env.VITE_VERSUS === '1';
}

export const VERSUS_ON = versusOn();
