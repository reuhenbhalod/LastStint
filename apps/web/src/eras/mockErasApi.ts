import { type DifficultySettings, difficultyForEra, legendDifficulty } from '@laststint/sim';
// MOCK Eras API, for building the Eras screens before the Worker endpoints exist (build-plan
// step 7.2). Not the real thing: no player progress and no gating. Every era lists its ten race
// cards (from the catalog, spec §4), all Draft as on test; an attempt can only start on a race
// that has a race file in this build (data/races/), and is refused on any other. It reports
// test mode (`testMode: true`), as the staging server will. Remove once the endpoints are up.

import type { RaceModel } from '@laststint/sim';
import type {
  AttemptRequest,
  AttemptResponse,
  EraDetail,
  EraRaceSummary,
  EraSummary,
  ErasApi,
} from './api.js';
import { ERAS, eraById, eraRace, racesOfEra } from './catalog.js';

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
    return {
      attemptId: `mock-attempt-${attempts}`,
      // A fresh seed per attempt, as the server will give (spec §9).
      seed: Math.floor(Math.random() * 2 ** 31),
      modelUrl: `mock://races/${raceId}`,
      // The era's settings from the Eras config, or Legend's (spec §7, §8).
      difficulty: settings(legend ? legendDifficulty() : difficultyForEra(race.eraId)),
    };
  },

  async loadModel(modelUrl) {
    const raceId = MODEL_URL.exec(modelUrl)?.[1];
    const load = raceId ? raceFile(raceId) : undefined;
    if (!load) throw new Error(`mock eras API has no model ${modelUrl}`);
    return (await load()).default;
  },
};
