import { difficultyForEra } from '@laststint/sim';
// MOCK Eras API, for building the Eras screens before the Worker endpoints exist (build-plan
// step 7.2). Not the real thing: no player progress, no gating, and every attempt is on the
// one bundled race file (Abu Dhabi 2021, Era 9 race 10); an attempt on any other race is
// refused. Remove once the endpoints are up.

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { RaceModel } from '@laststint/sim';
import type {
  AttemptRequest,
  AttemptResponse,
  EraDetail,
  EraDifficulty,
  EraSummary,
  ErasApi,
} from './api.js';
import { ERAS, eraById } from './catalog.js';

const MOCK_RACE = abuDhabi2021 as unknown as RaceModel;
/** The one race the mock serves. */
export const MOCK_RACE_ID = 'abu-dhabi-2021';
const MOCK_ERA_ID = 9;
const MOCK_MODEL_URL = `mock://races/${MOCK_RACE_ID}`;

/** Spec §7 play order 2 (Era 9): the mock's attempt difficulty. */
// Era 9's settings, straight from the Eras config.
const MOCK_DIFFICULTY: EraDifficulty = (({
  accuracyThreshold,
  information,
  rivalPolicy,
  decisionTimerSeconds,
}) => ({
  accuracyThreshold,
  information,
  rivalPolicy,
  decisionTimerSeconds,
}))(difficultyForEra(9));

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

let attempts = 0;

export const mockErasApi: ErasApi = {
  async eras() {
    return ERAS.map((e) => summary(e.id));
  },

  async era(eraId) {
    const detail: EraDetail = { ...summary(eraId), races: [] };
    if (eraId === MOCK_ERA_ID) {
      detail.races.push({
        raceId: MOCK_RACE_ID,
        position: 10,
        stars: { result: false, strategist: false, mastery: false },
        hiddenDone: false,
        bestAccuracy: null,
        reconstructed: false,
        draft: true,
      });
    }
    return detail;
  },

  async startAttempt({ raceId }: AttemptRequest): Promise<AttemptResponse> {
    if (raceId !== MOCK_RACE_ID) throw new Error(`mock eras API only serves ${MOCK_RACE_ID}`);
    attempts += 1;
    return {
      attemptId: `mock-attempt-${attempts}`,
      // A fresh seed per attempt, as the server will give (spec §9).
      seed: Math.floor(Math.random() * 2 ** 31),
      modelUrl: MOCK_MODEL_URL,
      difficulty: MOCK_DIFFICULTY,
    };
  },

  async loadModel(modelUrl) {
    if (modelUrl !== MOCK_MODEL_URL) throw new Error(`mock eras API has no model ${modelUrl}`);
    return MOCK_RACE;
  },
};
