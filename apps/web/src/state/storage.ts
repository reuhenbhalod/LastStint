// Thin localStorage wrapper for the in-progress run. All access is guarded: a refresh
// restores the run, but storage being unavailable (private mode, SSR, quota) never throws.

import type { PersistedRun } from './session.js';

/** The daily's slot; survivor keeps its race in its own (useGame's `storageKey`). */
export const RUN_KEY = 'pitwall:run';

export function saveRun(run: PersistedRun, key = RUN_KEY): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(run));
  } catch {
    // ignore: storage full or blocked
  }
}

export function loadRun(key = RUN_KEY): PersistedRun | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PersistedRun) : null;
  } catch {
    return null;
  }
}

export function clearRun(key = RUN_KEY): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
