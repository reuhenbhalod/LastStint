import type { Decision, DifficultySettings, RivalChoice } from '@laststint/sim';
// The Eras API as the client sees it (docs/laststint-eras-mode-spec.md §13). The app talks to
// the Worker (httpErasApi.ts); `VITE_ERAS_MOCK=1` runs it on the in-browser mock instead
// (mockErasApi.ts), for working on the screens without a Worker.

import type { RaceModel } from '@laststint/sim';
import type { CallResult, PlanResult, RunSubmission } from '../data/api.js';
import { httpErasApi } from './httpErasApi.js';
import { mockCanStart, mockErasApi } from './mockErasApi.js';

/** An era on the map: `GET /api/eras`. */
export interface EraSummary {
  eraId: number;
  name: string;
  years: string;
  playOrder: number;
  /** Released in production (`released_at` set); always true on test. */
  released: boolean;
  /**
   * Reached 70% of the stars of the era before it in play order (spec §5). The server works
   * it out with the sim's `unlocksNextEra`; the era map recomputes it from `stars` with the
   * same helper (eraMapState.ts), so the two agree by construction.
   */
  unlocked: boolean;
  /** The player's stars in this era, out of `maxStars` (3 per race). */
  stars: number;
  maxStars: number;
}

/** `GET /api/eras`: the eras, and which mode the server is in. */
export interface ErasResponse {
  /**
   * The server runs with `ERAS_TEST_MODE` (spec §13, §16): every era is open, whatever its
   * release or lock state, and locks are still shown so they can be tested. In production
   * (false) unreleased eras are "Coming soon" and locked eras can't be entered.
   *
   * NOTE for step 7.2: the Worker must send this field on `GET /api/eras`, set from its
   * `ERAS_TEST_MODE` config, so the web app knows which mode it is in (it has no other way
   * to tell test from production).
   */
  testMode: boolean;
  /** Every era, in play order. */
  eras: EraSummary[];
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
  /**
   * The player's Legend progress on the race: its own three stars and best accuracy, tracked
   * apart from the ones above (spec §8; `era_progress` rows with `legend = 1`). Absent: no
   * Legend progress yet.
   *
   * NOTE for step 7.2: optional, added by step 8.3 so the era detail can show Legend progress
   * separately; send it once the Worker serves Legend progress.
   */
  legend?: { stars: EraRaceSummary['stars']; bestAccuracy: number | null };
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
  /**
   * The race isn't published (playable on test only), for the race intro's Draft badge.
   *
   * NOTE for step 7.2: optional, added by step 8.4 so the intro can mark a Draft race without
   * loading the whole era; send it from `era_races` with the attempt.
   */
  draft?: boolean;
  /** The pinned race file's hash (the Worker's), echoed on submit so a rebuilt race is caught. */
  modelHash?: string;
}

/** The three stars of a race (eras spec §6). */
export interface Stars {
  result: boolean;
  strategist: boolean;
  mastery: boolean;
}

/** `POST /api/eras/attempts/:id`: the finished attempt (apps/worker/src/eras.ts submitAttempt). */
export interface AttemptSubmission {
  decisions: Decision[];
  /** The game's claimed grades, as a Daily run's (POST /api/runs `grades`). */
  grades: RunSubmission['grades'];
  /** A decision was shown with the timer off (eras spec §7): the stars are marked untimed. */
  untimed: boolean;
  /** Expert: the rival's choice at each of its decision points (eras spec §7). */
  rivalClaims?: RivalChoice[];
  modelHash?: string;
}

/** The evaluated attempt (the Worker's SubmitResponse: erasEval.ts EraAttemptResult and more). */
export interface AttemptResult {
  attemptId: string;
  raceId: string;
  legend: boolean;
  untimed: boolean;
  /** Race accuracy, 0-100 (eras spec §6). */
  accuracy: number;
  /** The stars this attempt earned. */
  stars: Stars;
  masteryObjective: boolean;
  cleanCalls: boolean;
  /** The hidden objective was met (null: the race has none). */
  hidden: boolean | null;
  /** The storyline's rewrite condition was met (null: the race has no storyline). */
  rewrite: boolean | null;
  decisionAccuracies: number[];
  finishPosition: number;
  disqualified: boolean;
  result: {
    order: string[];
    finishers: string[];
    disqualified: string[];
    gaps: Record<string, number>;
  };
  calls: CallResult[];
  plan?: PlanResult;
  /** Stars earned on this attempt that the player didn't have on the race before. */
  newStars: Stars;
  /** This attempt wrote the race's history book entry (the first rewrite). */
  historyEntry: boolean;
  /** The player's best per star on the race, this attempt included. */
  progress: { stars: Stars; hiddenDone: boolean; bestAccuracy: number | null };
  /** The player's place on the race's board by best accuracy, of `total`. */
  rank: number;
  total: number;
}

/**
 * `GET /api/eras/races/:raceId/stats`: community stats (eras spec §8, §13).
 *
 * NOTE for step 7.4: the results screen reads `rewriteShare`, the share (0-1) of strategists
 * with a verified rewrite of the race, and shows nothing when it is absent or the call fails.
 */
export interface RaceStats {
  rewriteShare?: number | null;
}

export interface ErasApi {
  /** `GET /api/eras`: every era, in play order, and the server's mode. */
  eras(): Promise<ErasResponse>;
  /** `GET /api/eras/:eraId`: the era and its race cards. */
  era(eraId: number): Promise<EraDetail>;
  /** `POST /api/eras/attempts`: start an attempt on a race. */
  startAttempt(req: AttemptRequest): Promise<AttemptResponse>;
  /** Load the race file an attempt pinned (`modelUrl`). */
  loadModel(modelUrl: string): Promise<RaceModel>;
  /** `POST /api/eras/attempts/:id`: submit a finished attempt; the server evaluates it. */
  submitAttempt(attemptId: string, body: AttemptSubmission): Promise<AttemptResult>;
  /** `GET /api/eras/races/:raceId/stats`: community stats (step 7.4; may not be served yet). */
  raceStats(raceId: string): Promise<RaceStats>;
}

/** The dev flag: run Eras on the in-browser mock (`VITE_ERAS_MOCK=1`). */
export function erasMockOn(env: { VITE_ERAS_MOCK?: string } = import.meta.env): boolean {
  return env.VITE_ERAS_MOCK === '1';
}

/** The client and which races it can start: the Worker (every race: it refuses what it must), or
 * the mock (only races with a bundled race file). */
export function erasClient(mock: boolean): {
  api: ErasApi;
  canStart: (raceId: string) => boolean;
} {
  return mock
    ? { api: mockErasApi, canStart: mockCanStart }
    : { api: httpErasApi, canStart: () => true };
}

const client = erasClient(erasMockOn());

/** The client the app uses: the Worker, or the mock with `VITE_ERAS_MOCK=1`. */
export const erasApi: ErasApi = client.api;

/** Which races a given client can start (the mock: bundled race files only). */
export function canStartWith(api: ErasApi): (raceId: string) => boolean {
  return api === mockErasApi ? mockCanStart : () => true;
}
