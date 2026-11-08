// An Eras race (docs/laststint-eras-mode-spec.md §9): each load starts a fresh attempt on the
// Eras API, which deals the seed and pins the race file, then loads that file. Follows the
// DailyProvider interface the game runs on (data/types.ts), like SurvivorProvider.

import type { Daily, DailyProvider } from '../data/types.js';
import { type AttemptResponse, type ErasApi, erasApi } from './api.js';

/** The race of an attempt, with the attempt it belongs to (for submitting it later). */
export interface EraDaily extends Daily {
  attemptId: string;
  legend: boolean;
  difficulty: AttemptResponse['difficulty'];
}

export class EraProvider implements DailyProvider {
  constructor(
    private readonly raceId: string,
    private readonly legend = false,
    private readonly api: ErasApi = erasApi,
  ) {}

  async today(): Promise<EraDaily> {
    if (!this.raceId) throw new Error('no race to start an attempt on');
    const attempt = await this.api.startAttempt({ raceId: this.raceId, legend: this.legend });
    const model = await this.api.loadModel(attempt.modelUrl);
    if (model.race.id !== this.raceId) {
      throw new Error(`attempt ${attempt.attemptId} served ${model.race.id}, not ${this.raceId}`);
    }
    return {
      // Unique per attempt: the save slot only restores this attempt's race.
      date: `eras:${attempt.attemptId}`,
      raceId: this.raceId,
      seed: attempt.seed,
      model,
      // TODO(8.4/8.7): an 'eras' source (data/types.ts, state/machine.ts) so the race and
      // result screens label and submit an attempt. Until then it plays like practice: graded
      // locally, never posted as a daily run.
      source: 'practice',
      practiceReason: 'Eras attempt',
      attemptId: attempt.attemptId,
      legend: this.legend,
      difficulty: attempt.difficulty,
    };
  }
}
