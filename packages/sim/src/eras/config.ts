// Eras config (eras build plan 1.3). Every Eras tunable lives in eras-config.json, not in
// code (eras spec §19): the unlock share (§5), the accuracy multiplier (§6), the hard-call
// edge (§4, "Which driver the player runs"), the difficulty table (§7) and Legend's settings
// (§8). This module validates that file once at load and exposes small helpers that read
// it, so the worker and the web app share one source of truth.
//
// Every helper takes the config as an optional last argument (default: the file), so tests
// and tools can try other values without editing code.

import { BAND_EDGES } from '../grade.js';
import erasConfigJson from './eras-config.json';

/** Each race awards three stars (★1 Result, ★2 Strategist, ★3 Mastery; eras spec §6). */
export const STARS_PER_RACE = 3;

export const INFORMATION_LEVELS = ['full', 'reduced', 'limited', 'minimal'] as const;
export type InformationLevel = (typeof INFORMATION_LEVELS)[number];

export const RIVAL_POLICIES = ['standard', 'standard-plus', 'smart', 'expert'] as const;
export type RivalPolicy = (typeof RIVAL_POLICIES)[number];

/** A difficulty setting: one row of the eras spec §7 table, or Legend (§8). */
export interface DifficultySettings {
  /** ★2 Strategist: race accuracy (0–100) at or above this earns the star. */
  accuracyThreshold: number;
  information: InformationLevel;
  rivalPolicy: RivalPolicy;
  decisionTimerSeconds: number;
}

export interface EraDifficulty extends DifficultySettings {
  /** 1 = the first era players meet (Era 10), 10 = the last (Era 1). */
  playOrder: number;
  era: number;
}

export type BandEdgeKey = keyof typeof BAND_EDGES;

export interface ErasConfig {
  /** ERA_UNLOCK_SHARE: share of the previous era's stars needed to unlock the next. */
  unlockShare: number;
  /** decisionAccuracy = max(0, 100 − accuracyMultiplier × winChanceLost). */
  accuracyMultiplier: number;
  /** HARD_CALL_EDGE: a BAND_EDGES key (resolved against grade.ts) or percentage points. */
  hardCallEdge: BandEdgeKey | number;
  /** Ordered by play order, 1 first. */
  difficulty: EraDifficulty[];
  legend: DifficultySettings;
}

function fail(path: string, why: string): never {
  throw new Error(`eras config: ${path} ${why}`);
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number');
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  const n = finiteNumber(value, path);
  if (!Number.isInteger(n) || n < 1) fail(path, 'must be a positive integer');
  return n;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(options as readonly string[]).includes(value))
    fail(path, `must be one of ${options.join(', ')}`);
  return value as T;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'must be an object');
  return value as Record<string, unknown>;
}

function settings(value: unknown, path: string): DifficultySettings {
  const row = record(value, path);
  const accuracyThreshold = finiteNumber(row.accuracyThreshold, `${path}.accuracyThreshold`);
  if (accuracyThreshold < 0 || accuracyThreshold > 100)
    fail(`${path}.accuracyThreshold`, 'must be between 0 and 100');
  return {
    accuracyThreshold,
    information: oneOf(row.information, INFORMATION_LEVELS, `${path}.information`),
    rivalPolicy: oneOf(row.rivalPolicy, RIVAL_POLICIES, `${path}.rivalPolicy`),
    decisionTimerSeconds: positiveInteger(row.decisionTimerSeconds, `${path}.decisionTimerSeconds`),
  };
}

/**
 * Validates a raw config (the JSON file's shape; keys starting with `_` are comments).
 * Throws on anything malformed, so a bad edit fails at load rather than mid-campaign.
 */
export function parseErasConfig(raw: unknown): ErasConfig {
  const root = record(raw, '(root)');

  const unlockShare = finiteNumber(root.unlockShare, 'unlockShare');
  if (unlockShare <= 0 || unlockShare > 1) fail('unlockShare', 'must be in (0, 1]');

  const accuracyMultiplier = finiteNumber(root.accuracyMultiplier, 'accuracyMultiplier');
  if (accuracyMultiplier <= 0) fail('accuracyMultiplier', 'must be positive');

  let hardCallEdge: BandEdgeKey | number;
  if (typeof root.hardCallEdge === 'string') {
    hardCallEdge = oneOf(
      root.hardCallEdge,
      Object.keys(BAND_EDGES) as BandEdgeKey[],
      'hardCallEdge',
    );
  } else {
    hardCallEdge = finiteNumber(root.hardCallEdge, 'hardCallEdge');
    if (hardCallEdge < 0) fail('hardCallEdge', 'must not be negative');
  }

  if (!Array.isArray(root.difficulty) || root.difficulty.length === 0)
    fail('difficulty', 'must be a non-empty array');
  const difficulty = root.difficulty.map((value, i): EraDifficulty => {
    const path = `difficulty[${i}]`;
    const row = record(value, path);
    const playOrder = positiveInteger(row.playOrder, `${path}.playOrder`);
    if (playOrder !== i + 1) fail(`${path}.playOrder`, `must be ${i + 1} (rows in play order)`);
    return { playOrder, era: positiveInteger(row.era, `${path}.era`), ...settings(row, path) };
  });
  const eras = new Set(difficulty.map((d) => d.era));
  if (eras.size !== difficulty.length) fail('difficulty', 'has a repeated era');

  return {
    unlockShare,
    accuracyMultiplier,
    hardCallEdge,
    difficulty,
    legend: settings(root.legend, 'legend'),
  };
}

/** The config from eras-config.json, validated. */
export const ERAS_CONFIG: ErasConfig = parseErasConfig(erasConfigJson);

/** The hard-call edge in percentage points, resolving a BAND_EDGES key. */
export function hardCallEdge(config: ErasConfig = ERAS_CONFIG): number {
  const edge = config.hardCallEdge;
  return typeof edge === 'number' ? edge : BAND_EDGES[edge];
}

export const ERA_UNLOCK_SHARE = ERAS_CONFIG.unlockShare;
export const ACCURACY_MULTIPLIER = ERAS_CONFIG.accuracyMultiplier;
export const HARD_CALL_EDGE = hardCallEdge(ERAS_CONFIG);

/**
 * Stars needed in an era of `races` races to unlock the next era: ceil(share × 3 × races)
 * (eras spec §5). The product is nudged down by 1e-9 before ceil so binary rounding
 * (0.7 × 3 × 10 = 20.999…96, or a value a hair over a whole number) can't add a star.
 */
export function unlockThreshold(races: number, config: ErasConfig = ERAS_CONFIG): number {
  if (!Number.isInteger(races) || races < 0)
    throw new RangeError(`unlockThreshold: races must be a non-negative integer, got ${races}`);
  return Math.max(0, Math.ceil(config.unlockShare * STARS_PER_RACE * races - 1e-9));
}

/** Whether `stars` earned in an era of `races` races unlock the next era. */
export function unlocksNextEra(
  stars: number,
  races: number,
  config: ErasConfig = ERAS_CONFIG,
): boolean {
  return stars >= unlockThreshold(races, config);
}

/**
 * One decision's accuracy (eras spec §6): max(0, 100 − multiplier × winChanceLost), where
 * winChanceLost is the percentage points the player's option gave up against the best
 * option (the grader's `behindBest`).
 */
export function decisionAccuracy(winChanceLost: number, config: ErasConfig = ERAS_CONFIG): number {
  if (!Number.isFinite(winChanceLost) || winChanceLost < 0)
    throw new RangeError(
      `decisionAccuracy: winChanceLost must be a non-negative number, got ${winChanceLost}`,
    );
  return Math.max(0, 100 - config.accuracyMultiplier * winChanceLost);
}

/**
 * Whether a decision moment is a hard call (eras spec §4): the second-best option is within
 * the hard-call edge of the best, in percentage points (inclusive, as `bandFor` is).
 */
export function isHardCall(secondBehindBest: number, config: ErasConfig = ERAS_CONFIG): boolean {
  if (!Number.isFinite(secondBehindBest) || secondBehindBest < 0)
    throw new RangeError(
      `isHardCall: secondBehindBest must be a non-negative number, got ${secondBehindBest}`,
    );
  return secondBehindBest <= hardCallEdge(config);
}

/** The difficulty row for a play order (1 = Era 10). Throws on an unknown play order. */
export function difficultyFor(playOrder: number, config: ErasConfig = ERAS_CONFIG): EraDifficulty {
  const row = config.difficulty.find((d) => d.playOrder === playOrder);
  if (!row) throw new RangeError(`difficultyFor: no difficulty for play order ${playOrder}`);
  return row;
}

/** The difficulty row for an era number (Era 10 = play order 1). Throws on an unknown era. */
export function difficultyForEra(era: number, config: ErasConfig = ERAS_CONFIG): EraDifficulty {
  const row = config.difficulty.find((d) => d.era === era);
  if (!row) throw new RangeError(`difficultyForEra: no difficulty for era ${era}`);
  return row;
}

/** Legend difficulty's settings (eras spec §8), the same for every era. */
export function legendDifficulty(config: ErasConfig = ERAS_CONFIG): DifficultySettings {
  return config.legend;
}

/** ★2 Strategist: race accuracy at or above the setting's threshold. */
export function meetsAccuracyThreshold(
  raceAccuracy: number,
  difficulty: DifficultySettings,
): boolean {
  return raceAccuracy >= difficulty.accuracyThreshold;
}
