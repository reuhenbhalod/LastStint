import { type DifficultySettings, difficultyForEra, legendDifficulty } from '@laststint/sim';
// MOCK Eras API, for building the Eras screens before the Worker endpoints exist (build-plan
// step 7.2). Not the real thing: no player progress and no gating. Every era lists its ten race
// cards (from the catalog, spec §4), all Draft as on test; an attempt can only start on a race
// that has a race file in this build (data/races/), and is refused on any other. It reports
// test mode (`testMode: true`), as the staging server will. Remove once the endpoints are up.

import type { RaceModel } from '@laststint/sim';
import { ApiError } from '../api.js';
import type {
  AttemptRequest,
  AttemptResponse,
  AttemptResult,
  EraDetail,
  EraRaceSummary,
  EraSummary,
  ErasApi,
  Stars,
} from './api.js';
import { ERAS, eraById, eraRace, racesOfEra } from './catalog.js';
import { mockEvaluate } from './mockEvaluate.js';

// The race files bundled with the app, loaded on demand (as data/provider.ts does).
const RACE_FILES = import.meta.glob<{ default: RaceModel }>('../../../../data/races/*.json');
const raceFile = (raceId: string) => RACE_FILES[`../../../../data/races/${raceId}.json`];
const MODEL_URL = /^mock:\/\/races\/([a-z0-9-]+)$/;

/** Whether the mock can start an attempt on a race: an Eras race with a bundled race file. */
export function mockCanStart(raceId: string): boolean {
  return eraRace(raceId) !== undefined && raceFile(raceId) !== undefined;
}

/** Just the settings of a difficulty row (no era fields), as the server sends them. */
function settings({
  accuracyThreshold,
  information,
  rivalPolicy,
  decisionTimerSeconds,
}: DifficultySettings): DifficultySettings {
  return { accuracyThreshold, information, rivalPolicy, decisionTimerSeconds };
}

function summary(eraId: number): EraSummary {
  const era = eraById(eraId);
  if (!era) throw new Error(`no era ${eraId}`);
  return {
    eraId: era.id,
    name: era.name,
    years: era.years,
    playOrder: era.playOrder,
    released: true,
    // As on test (spec §13): everything is open; only Era 10 is unlocked by progress.
    unlocked: era.playOrder === 1,
    stars: 0,
    maxStars: 30,
  };
}

/**
 * Whether a race is rebuilt by full reconstruction. The spec's data table (§4, "Data
 * availability by era") has the laps of 1983–1995 races reconstructed; a stand-in for the race
 * file's `eras.reconstructed` flag, which the server will send.
 */
function reconstructed(raceId: string): boolean {
  const year = Number(raceId.slice(-4));
  return Number.isInteger(year) && year <= 1995;
}

let attempts = 0;

/** The mock's attempts and the player's best per race (this page only). */
const started = new Map<
  string,
  { raceId: string; legend: boolean; seed: number; difficulty: DifficultySettings; done: boolean }
>();
const best = new Map<string, AttemptResult['progress']>();
const NO_STARS: Stars = { result: false, strategist: false, mastery: false };

export const mockErasApi: ErasApi = {
  async eras() {
    return { testMode: true, eras: ERAS.map((e) => summary(e.id)) };
  },

  async era(eraId) {
    const races = racesOfEra(eraId).map(
      (r): EraRaceSummary => ({
        raceId: r.raceId,
        position: r.position,
        stars: { result: false, strategist: false, mastery: false },
        hiddenDone: false,
        bestAccuracy: null,
        reconstructed: reconstructed(r.raceId),
        // Nothing is published yet: every race is Draft, playable on test only.
        draft: true,
      }),
    );
    const detail: EraDetail = { ...summary(eraId), races };
    return detail;
  },

  async startAttempt({ raceId, legend }: AttemptRequest): Promise<AttemptResponse> {
    const race = eraRace(raceId);
    if (!race) throw new Error(`${raceId} is not an Eras race`);
    if (!mockCanStart(raceId)) throw new Error(`no race file for ${raceId} in this build yet`);
    attempts += 1;
    const attemptId = `mock-attempt-${attempts}`;
    // A fresh seed per attempt, as the server will give (spec §9).
    const seed = Math.floor(Math.random() * 2 ** 31);
    // The era's settings from the Eras config, or Legend's (spec §7, §8).
    const difficulty = settings(legend ? legendDifficulty() : difficultyForEra(race.eraId));
    started.set(attemptId, { raceId, legend, seed, difficulty, done: false });
    return {
      attemptId,
      seed,
      modelUrl: `mock://races/${raceId}`,
      difficulty,
      // Nothing is published yet, as on the era cards.
      draft: true,
    };
  },

  async submitAttempt(attemptId, body) {
    const attempt = started.get(attemptId);
    if (!attempt) throw new ApiError(404, 'no-attempt');
    if (attempt.done) throw new ApiError(409, 'already-submitted');
    const model = await this.loadModel(`mock://races/${attempt.raceId}`);
    const evaluated = mockEvaluate(model, attempt, body);
    attempt.done = true;
    const key = `${attempt.raceId}:${attempt.legend}`;
    const had = best.get(key) ?? { stars: NO_STARS, hiddenDone: false, bestAccuracy: null };
    const s = evaluated.stars;
    const stars: Stars = {
      result: had.stars.result || s.result,
      strategist: had.stars.strategist || s.strategist,
      mastery: had.stars.mastery || s.mastery,
    };
    const progress = {
      stars,
      hiddenDone:
        had.hiddenDone ||
        (evaluated.hidden === true && stars.result && stars.strategist && stars.mastery),
      bestAccuracy: Math.max(had.bestAccuracy ?? 0, evaluated.accuracy),
    };
    best.set(key, progress);
    return {
      attemptId,
      ...evaluated,
      newStars: {
        result: stars.result && !had.stars.result,
        strategist: stars.strategist && !had.stars.strategist,
        mastery: stars.mastery && !had.stars.mastery,
      },
      historyEntry: evaluated.rewrite === true,
      progress,
      // The mock has one player.
      rank: 1,
      total: 1,
    };
  },

  async raceStats() {
    // No community in the mock: nothing to show.
    return null;
  },

  async loadModel(modelUrl) {
    const raceId = MODEL_URL.exec(modelUrl)?.[1];
    const load = raceId ? raceFile(raceId) : undefined;
    if (!load) throw new Error(`mock eras API has no model ${modelUrl}`);
    return (await load()).default;
  },
};
