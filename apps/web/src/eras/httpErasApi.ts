// The Eras API over HTTP: the Worker's endpoints (apps/worker/src/eras.ts; eras spec §13,
// build plan 7.2). Not switched on yet: the app still uses the mock (api.ts `erasApi`).
//
// Every call names the player by the browser's player ID (data/player.ts `anonId`), which a
// signed-in browser swaps for its account's ID; the Worker resolves a linked ID to its account.

import type { RaceModel } from '@laststint/sim';
import { apiGet, apiPost } from '../api.js';
import { anonId as browserPlayerId } from '../data/player.js';
import type { AttemptRequest, AttemptResponse, EraDetail, EraSummary } from './api.js';

/**
 * `GET /api/eras`: the eras and the server's mode (`testMode` from ERAS_TEST_MODE). The same
 * shape as api.ts's `ErasResponse` (step 8.2); once that lands here, use it instead.
 */
export interface ErasResponse {
  testMode: boolean;
  eras: EraSummary[];
}

export interface HttpErasApiDeps {
  /** The player making the calls (default: this browser's player ID). */
  playerId?: () => string;
  get?: <T>(path: string) => Promise<T>;
  post?: <T>(path: string, body: unknown) => Promise<T>;
}

/** An Eras API client on the Worker. Errors are the server's (`ApiError` with its code). */
export function createHttpErasApi(deps: HttpErasApiDeps = {}) {
  const playerId = deps.playerId ?? browserPlayerId;
  const get = deps.get ?? apiGet;
  const post = deps.post ?? apiPost;
  const who = () => encodeURIComponent(playerId());

  return {
    eras: (): Promise<ErasResponse> => get<ErasResponse>(`/api/eras?anonId=${who()}`),

    era: (eraId: number): Promise<EraDetail> => {
      if (!Number.isInteger(eraId)) return Promise.reject(new RangeError(`bad era ${eraId}`));
      return get<EraDetail>(`/api/eras/${eraId}?anonId=${who()}`);
    },

    startAttempt: ({ raceId, legend }: AttemptRequest): Promise<AttemptResponse> =>
      post<AttemptResponse>('/api/eras/attempts', { anonId: playerId(), raceId, legend }),

    /** The race file an attempt pinned: `modelUrl` is absolute, from the Worker. */
    loadModel: (modelUrl: string): Promise<RaceModel> => get<RaceModel>(modelUrl),
  };
}

export const httpErasApi = createHttpErasApi();
