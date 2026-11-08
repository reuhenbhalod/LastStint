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
}

/** The client the app uses. MOCK until build-plan step 7.2 ships the endpoints. */
export const erasApi: ErasApi = mockErasApi;

// ---- history book, community stats, leaderboards (spec §8, §13; build plan 7.4) -----------
// The Worker's shapes (apps/worker/src/erasHistory.ts). A separate interface from `ErasApi`
// so the mock needn't grow until the history screen (step 8.8) uses it.

/** Collected of collectible. */
export interface Tally {
  have: number;
  total: number;
}

/** An era's badges (spec §8): derived from progress, never stored. */
export interface EraBadges {
  /** At least one star on every race of the era. */
  cleared: boolean;
  /** Every star of the era. */
  mastered: boolean;
  /** Every Legend star of the era. */
  legend: boolean;
}

/** One era's page of the history book. */
export interface HistoryEra {
  eraId: number;
  name: string;
  years: string;
  playOrder: number;
  races: number;
  stars: Tally;
  legendStars: Tally;
  rewrites: Tally;
  /** One hidden objective per race, met in either mode. */
  hidden: Tally;
  badges: EraBadges;
  /** Collected over collectible in this era, 0-100 (unrounded). */
  percent: number;
}

/** "Only 9% of strategists rewrote this race" (spec §8). */
export interface RewriteShare {
  /** Players with an evaluated attempt on the race (normal or Legend). */
  players: number;
  /** Of them, players who rewrote it (have its history book entry). */
  rewrites: number;
  /** rewrites / players, 0-1 (0 with no players). */
  share: number;
}

/** One rewrite in the history book: the attempt that first rewrote the race. */
export interface HistoryEntry {
  raceId: string;
  eraId: number;
  /** 1..10 within the era. */
  position: number;
  attemptId: string;
  achievedAt: string;
  legend: boolean;
  accuracy: number | null;
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  /** The race's authored headline and what really happened; null until the race has them. */
  headline: string | null;
  real: string | null;
  community: RewriteShare;
}

/** `GET /api/history`: the player's history book. */
export interface HistoryBook {
  /** Every collectible: 830 with the full campaign (spec §8). `percent` is 0-100, unrounded. */
  completion: { collected: number; total: number; percent: number };
  collectibles: {
    stars: Tally;
    legendStars: Tally;
    rewrites: Tally;
    hidden: Tally;
    badges: Tally;
  };
  /** Every era, in play order. */
  eras: HistoryEra[];
  /** The player's rewrites, oldest first. */
  entries: HistoryEntry[];
}

/** Shares (0-1) of a race's players holding each star and the hidden objective. */
export interface StarRates {
  /** Players with progress on the race in this mode. */
  players: number;
  result: number;
  strategist: number;
  mastery: number;
  hidden: number;
}

/** `GET /api/eras/races/:raceId/stats`: community stats (cached briefly on the server). */
export interface RaceStats {
  raceId: string;
  rewrite: RewriteShare;
  stars: StarRates;
  legendStars: StarRates;
}

export interface EraLeaderboardEntry {
  rank: number;
  /** The display name, or the generated one (as the Daily leaderboard). */
  name: string;
  accuracy: number;
}

/**
 * `GET /api/eras/races/:raceId/leaderboard?legend=`: the top 100 by best accuracy (ties to
 * whoever reached it first). Legend has its own board; neither ever resets.
 */
export interface EraLeaderboard {
  raceId: string;
  legend: boolean;
  /** Most entries shown (100). */
  size: number;
  /** Players on the board. */
  total: number;
  entries: EraLeaderboardEntry[];
  /** The player's place; null without an evaluated attempt on this board. */
  me: { rank: number; accuracy: number } | null;
}

export interface ErasHistoryApi {
  /** `GET /api/history`: the player's history book. */
  history(): Promise<HistoryBook>;
  /** `GET /api/eras/races/:raceId/stats`: community rewrite share and star rates. */
  raceStats(raceId: string): Promise<RaceStats>;
  /** `GET /api/eras/races/:raceId/leaderboard`: the normal or Legend board and the player's rank. */
  leaderboard(raceId: string, legend: boolean): Promise<EraLeaderboard>;
}
