// The Eras API over HTTP: the Worker's endpoints (apps/worker/src/eras.ts; eras spec §13,
// build plan 7.2). Not switched on yet: the app still uses the mock (api.ts `erasApi`).
//
// Every call names the player by the browser's player ID (data/player.ts `anonId`), which a
// signed-in browser swaps for its account's ID; the Worker resolves a linked ID to its account.

import type { RaceModel } from '@laststint/sim';
import { apiGet, apiPost } from '../api.js';
import { anonId as browserPlayerId } from '../data/player.js';
import type {
  AttemptRequest,
  AttemptResponse,
  EraDetail,
  EraLeaderboard,
  ErasApi,
  ErasHistoryApi,
  ErasResponse,
  HistoryBook,
  RaceStats,
} from './api.js';

export interface HttpErasApiDeps {
  /** The player making the calls (default: this browser's player ID). */
  playerId?: () => string;
  get?: <T>(path: string) => Promise<T>;
  post?: <T>(path: string, body: unknown) => Promise<T>;
}

/** An Eras API client on the Worker. Errors are the server's (`ApiError` with its code). */
export function createHttpErasApi(deps: HttpErasApiDeps = {}): ErasApi & ErasHistoryApi {
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

    history: (): Promise<HistoryBook> => get<HistoryBook>(`/api/history?anonId=${who()}`),

    raceStats: (raceId: string): Promise<RaceStats> =>
      get<RaceStats>(`/api/eras/races/${encodeURIComponent(raceId)}/stats`),

    leaderboard: (raceId: string, legend: boolean): Promise<EraLeaderboard> =>
      get<EraLeaderboard>(
        `/api/eras/races/${encodeURIComponent(raceId)}/leaderboard?legend=${legend}&anonId=${who()}`,
      ),
  };
}

export const httpErasApi = createHttpErasApi();
