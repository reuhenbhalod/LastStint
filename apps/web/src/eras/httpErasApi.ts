// The Eras API over HTTP: the Worker's endpoints (apps/worker/src/eras.ts; eras spec §13,
// build plans 7.2-7.4). The app's client (api.ts `erasApi`) unless `VITE_ERAS_MOCK=1`.
//
// Every call names the player by the browser's player ID (data/player.ts `anonId`), which a
// signed-in browser swaps for its account's ID; the Worker resolves a linked ID to its account.

import type { RaceModel } from '@laststint/sim';
import { apiGet, apiPost } from '../api.js';
import { anonId as browserPlayerId } from '../data/player.js';
import type {
  AttemptRequest,
  AttemptResponse,
  AttemptResult,
  AttemptSubmission,
  EraDetail,
  EraLeaderboard,
  ErasApi,
  ErasHistoryApi,
  ErasResponse,
  HistoryBook,
  RaceStats,
} from './api.js';

const RACE_ID = /^[a-z0-9-]+$/;
const badRace = (raceId: string) => Promise.reject(new RangeError(`bad race ${raceId}`));

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

    submitAttempt: (attemptId: string, body: AttemptSubmission): Promise<AttemptResult> => {
      if (!attemptId) return Promise.reject(new RangeError('no attempt to submit'));
      return post<AttemptResult>(`/api/eras/attempts/${encodeURIComponent(attemptId)}`, {
        anonId: playerId(),
        ...body,
      });
    },

    history: (): Promise<HistoryBook> => get<HistoryBook>(`/api/history?anonId=${who()}`),

    raceStats: (raceId: string): Promise<RaceStats> => {
      if (!RACE_ID.test(raceId)) return badRace(raceId);
      return get<RaceStats>(`/api/eras/races/${raceId}/stats`);
    },

    leaderboard: (raceId: string, legend: boolean): Promise<EraLeaderboard> => {
      if (!RACE_ID.test(raceId)) return badRace(raceId);
      return get<EraLeaderboard>(
        `/api/eras/races/${raceId}/leaderboard?legend=${legend}&anonId=${who()}`,
      );
    },
  };
}

export const httpErasApi = createHttpErasApi();
