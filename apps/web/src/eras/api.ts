import type { DifficultySettings } from '@laststint/sim';
// The Eras API as the client sees it (docs/laststint-eras-mode-spec.md §13). The Worker
// endpoints are build-plan step 7.2 and don't exist yet, so the app runs on the mock in
// mockErasApi.ts; swap `erasApi` for an HTTP client once the endpoints are up.

import type { RaceModel } from '@laststint/sim';
import { mockErasApi } from './mockErasApi.js';

/** An era on the map: `GET /api/eras`. */
export interface EraSummary {
  eraId: number;
  name: string;
  years: string;
  playOrder: number;
  /** Released in production (`released_at` set); always true on test. */
  released: boolean;
  /** Reached 70% of the stars of the era before it in play order (spec §5). */
  unlocked: boolean;
  /** The player's stars in this era, out of `maxStars` (3 per race). */
  stars: number;
  maxStars: number;
}

/** One race card of an era: `GET /api/eras/:eraId`. */
export interface EraRaceSummary {
  raceId: string;
  /** 1..10 within the era. */
  position: number;
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  hiddenDone: boolean;
  bestAccuracy: number | null;
  reconstructed: boolean;
  /** Unpublished: playable on test only, with a Draft badge. */
  draft: boolean;
}

export interface EraDetail extends EraSummary {
  races: EraRaceSummary[];
}

/**
 * The era's difficulty settings for an attempt (spec §7). One definition, shared with the
 * worker and the sim: `packages/sim/src/eras/config.ts` (step 1.3).
 */
export type { InformationLevel, RivalPolicy } from '@laststint/sim';
export type EraDifficulty = DifficultySettings;

/** `POST /api/eras/attempts`: `{ raceId, legend }`. */
export interface AttemptRequest {
  raceId: string;
  legend: boolean;
}

/** A started attempt: a fresh server seed and the pinned race file (spec §9). */
export interface AttemptResponse {
  attemptId: string;
  seed: number;
  modelUrl: string;
  difficulty: EraDifficulty;
}

export interface ErasApi {
  /** `GET /api/eras`: every era, in play order. */
  eras(): Promise<EraSummary[]>;
  /** `GET /api/eras/:eraId`: the era and its race cards. */
  era(eraId: number): Promise<EraDetail>;
  /** `POST /api/eras/attempts`: start an attempt on a race. */
  startAttempt(req: AttemptRequest): Promise<AttemptResponse>;
  /** Load the race file an attempt pinned (`modelUrl`). */
  loadModel(modelUrl: string): Promise<RaceModel>;
}

/** The client the app uses. MOCK until build-plan step 7.2 ships the endpoints. */
export const erasApi: ErasApi = mockErasApi;
