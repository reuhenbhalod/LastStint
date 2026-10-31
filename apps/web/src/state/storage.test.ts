import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersistedRun } from './session.js';
import { clearRun, loadRun, saveRun } from './storage.js';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => data.delete(k),
    setItem: (k, v) => data.set(k, v),
  };
}

const run: PersistedRun = {
  date: '2021-12-12',
  raceId: 'abu-dhabi-2021',
  seed: 81723,
  speed: 1,
  phase: 'racing',
  lap: 40,
  decisions: [],
  resolved: [],
};

describe('run storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips and clears a persisted run', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveRun(run);
    expect(loadRun()).toEqual(run);
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it('is a no-op when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveRun(run)).not.toThrow();
    expect(loadRun()).toBeNull();
  });
});
