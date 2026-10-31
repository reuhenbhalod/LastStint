// Thin localStorage wrapper for the in-progress run. All access is guarded: a refresh
// restores the run, but storage being unavailable (private mode, SSR, quota) never throws.

import type { PersistedRun } from './session.js';

const KEY = 'pitwall:run';

export function saveRun(run: PersistedRun): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // ignore: storage full or blocked
  }
}

export function loadRun(): PersistedRun | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedRun) : null;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
