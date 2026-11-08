// The era map's state (docs/laststint-eras-mode-spec.md §5, §14; build-plan 8.2): each era's
// lock, release and open state, worked out from `GET /api/eras`. Locks use the sim's unlock
// helpers (packages/sim/src/eras/config.ts), the same ones the server uses, so the threshold
// (21 of 30 at 70%) lives in the Eras config only.

import { STARS_PER_RACE, unlockThreshold, unlocksNextEra } from '@laststint/sim';
import type { EraSummary, ErasApi, ErasResponse } from './api.js';

/** What the stars of the era before a locked era need to reach. */
export interface UnlockNeed {
  /** The era before it in play order. */
  from: EraSummary;
  /** Stars needed there: `unlockThreshold` of its races. */
  threshold: number;
  /** Stars still to earn there. */
  remaining: number;
}

export interface EraNode {
  era: EraSummary;
  /** Short of the unlock threshold in the era before it. Never true for the first era. */
  locked: boolean;
  /** Set when locked: what unlocks it. */
  unlock: UnlockNeed | null;
  /** Not released yet, in production. Never true on test. */
  comingSoon: boolean;
  /** Can be entered (links to `/eras/<eraId>`): on test always, in production when released
   * and unlocked. */
  open: boolean;
}

function invalid(why: string): never {
  throw new Error(`eras response: ${why}`);
}

/** The races of an era, from its star total (3 per race). */
function racesOf(era: EraSummary): number {
  const races = era.maxStars / STARS_PER_RACE;
  if (!Number.isInteger(races) || races < 1)
    invalid(`era ${era.eraId} has maxStars ${era.maxStars}, not a multiple of ${STARS_PER_RACE}`);
  return races;
}

/**
 * The map's nodes, in play order (Era 10 first). Throws on a response that doesn't make sense
 * (play orders not 1..n, stars out of range), so a bad payload shows as an error rather than a
 * wrong lock.
 */
export function eraNodes({ testMode, eras }: ErasResponse): EraNode[] {
  if (eras.length === 0) invalid('no eras');
  const ordered = [...eras].sort((a, b) => a.playOrder - b.playOrder);
  ordered.forEach((era, i) => {
    if (era.playOrder !== i + 1) invalid(`play orders are not 1..${eras.length}`);
    racesOf(era);
    if (!Number.isInteger(era.stars) || era.stars < 0 || era.stars > era.maxStars)
      invalid(`era ${era.eraId} has ${era.stars} of ${era.maxStars} stars`);
  });

  return ordered.map((era, i): EraNode => {
    const prev = i > 0 ? ordered[i - 1] : undefined;
    const locked = prev !== undefined && !unlocksNextEra(prev.stars, racesOf(prev));
    let unlock: UnlockNeed | null = null;
    if (locked && prev) {
      const threshold = unlockThreshold(racesOf(prev));
      unlock = { from: prev, threshold, remaining: threshold - prev.stars };
    }
    const comingSoon = !testMode && !era.released;
    return { era, locked, unlock, comingSoon, open: testMode || (!locked && !comingSoon) };
  });
}

export type EraMapState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; testMode: boolean; nodes: EraNode[] };

/** Loads the map through the Eras API. Never rejects: a failure is an `error` state. */
export async function loadEraMap(api: ErasApi): Promise<EraMapState> {
  try {
    const res = await api.eras();
    return { kind: 'ready', testMode: res.testMode, nodes: eraNodes(res) };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { kind: 'error', message: `Couldn’t load the eras (${detail}).` };
  }
}
