// An Eras race (docs/laststint-eras-mode-spec.md §9): each load starts a fresh attempt on the
// Eras API, which deals the seed and pins the race file, then loads that file. Follows the
// DailyProvider interface the game runs on (data/types.ts), like SurvivorProvider.

import { ApiError } from '../api.js';
import type { Daily, DailyProvider } from '../data/types.js';
import { type AttemptResponse, type ErasApi, erasApi } from './api.js';

/** The race of an attempt, with the attempt it belongs to (for submitting it later). */
export interface EraDaily extends Daily {
  attemptId: string;
  legend: boolean;
  difficulty: AttemptResponse['difficulty'];
  /** The race isn't published: playable on test only (spec §5), shown with a Draft badge. */
  draft: boolean;
  /** The pinned race file's hash, echoed on submit (absent from the mock). */
  modelHash?: string;
}

export class EraProvider implements DailyProvider {
  constructor(
    private readonly raceId: string,
    private readonly legend = false,
    private readonly api: ErasApi = erasApi,
  ) {}

  async today(): Promise<EraDaily> {
    if (!this.raceId) throw new Error('no race to start an attempt on');
    const attempt = await this.api
      .startAttempt({ raceId: this.raceId, legend: this.legend })
      .catch((e: unknown) => {
        throw friendlyStartError(e);
      });
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
      // Never posted as a daily run: submitted as the attempt (eras/submit.ts).
      source: 'eras',
      // Played as the server replays it: the era's rival and Legend's safety cars.
      run: { rivalPolicy: attempt.difficulty.rivalPolicy, legend: this.legend },
      attemptId: attempt.attemptId,
      legend: this.legend,
      difficulty: attempt.difficulty,
      draft: attempt.draft === true,
      ...(attempt.modelHash ? { modelHash: attempt.modelHash } : {}),
    };
  }
}

/**
 * The error a refused attempt shows. A race taken down in production (`403 race-unpublished`,
 * for example to fix it) reads as plain words rather than the server's code; anything else is
 * passed on as it is.
 */
export function friendlyStartError(e: unknown): unknown {
  if (e instanceof ApiError && e.code === 'race-unpublished') {
    return new Error('This race isn’t available yet.');
  }
  return e;
}

/** The Eras attempt a loaded race belongs to, or null if it isn't one. */
export function eraDailyOf(daily: Daily | null): EraDaily | null {
  if (!daily || daily.source !== 'eras') return null;
  const d = daily as Partial<EraDaily>;
  return typeof d.attemptId === 'string' && d.difficulty ? (daily as EraDaily) : null;
}
