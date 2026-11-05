// The Worker's response shapes (docs/api.md) and the calls the game makes. The client sends
// calls and its grades, never a score; these are the server's numbers.

import type { Band, ClaimedGrade, Decision, OptionGrade } from '@boxthislap/sim';
import { apiGet, apiPost } from '../api.js';

export { ApiError } from '../api.js';

export interface DailyResponse {
  date: string;
  number: number;
  raceId: string;
  seed: number;
  side: string;
  modelUrl: string;
  modelHash: string;
}

export interface CallResult {
  momentId: string;
  lap: number;
  chosen: string;
  band: Band;
  points: number;
  probability: number;
  best: string;
  options: OptionGrade[];
  real: { optionId: string | null; probability: number; band: Band };
  matchedReal: boolean;
}

/** The race plan picked at takeover, graded (strategy planner spec D7). */
export interface PlanResult {
  chosen: string;
  band: Band;
  points: number;
  probability: number;
  best: string;
  options: OptionGrade[];
}

export interface RunResponse {
  runId: string;
  date: string;
  number: number;
  raceId: string;
  score: number;
  meanProbability: number;
  finishPosition: number;
  disqualified: boolean;
  result: {
    order: string[];
    finishers: string[];
    disqualified: string[];
    gaps: Record<string, number>;
  };
  calls: CallResult[];
  /** Absent for runs without a plan. */
  plan?: PlanResult;
  percentile: number;
  rank: number;
  total: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
}

export interface DailyStats {
  runs: number;
  meanScore: number;
  moments: Array<{
    id: string;
    matchedReal: number;
    options: Array<{ id: string; share: number }>;
  }>;
}

export interface RunSubmission {
  date: string;
  anonId: string;
  decisions: Decision[];
  grades: ClaimedGrade[];
}

export interface Account {
  playerId: string;
  name: string;
  email: string;
  /** On the admin list: the Admin button shows. */
  admin?: boolean;
  /** Sign-in only: the account was created just now. */
  created?: boolean;
}

export interface PlayerResponse {
  account: Account | null;
  streak: { current: number; best: number; days: number };
}

/** A survivor run as the server has it (docs/survivor-spec.md). */
export interface SurvivorState {
  runId: string;
  status: 'live' | 'over';
  rounds: number;
  meanScore: number;
  current: { round: number; raceId: string; seed: number } | null;
  history: Array<{
    round: number;
    raceId: string;
    won: boolean;
    score: number;
    finishPosition: number;
  }>;
  rank?: number;
  total?: number;
}

export interface SurvivorBoardEntry {
  rank: number;
  name: string;
  rounds: number;
  meanScore: number;
  live: boolean;
  date: string;
}

export const survivorApi = {
  start: (anonId: string) => apiPost<SurvivorState>('/api/survivor/start', { anonId }),
  state: (runId: string, anonId: string) =>
    apiGet<SurvivorState>(`/api/survivor/${runId}?anonId=${anonId}`),
  round: (runId: string, body: RunSubmission & { round: number }) =>
    apiPost<{ won: boolean; result: RunResponse; state: SurvivorState }>(
      `/api/survivor/${runId}/round`,
      body,
    ),
  leaderboard: () =>
    apiGet<{ allTime: SurvivorBoardEntry[]; week: SurvivorBoardEntry[] }>(
      '/api/survivor/leaderboard',
    ),
};

export const api = {
  daily: (date: string) => apiGet<DailyResponse>(`/api/daily?date=${date}`),
  run: (date: string, anonId: string) => apiGet<RunResponse>(`/api/runs/${date}/${anonId}`),
  submit: (body: RunSubmission) => apiPost<RunResponse>('/api/runs', body),
  leaderboard: (date: string) =>
    apiGet<{ entries: LeaderboardEntry[] }>(`/api/daily/${date}/leaderboard`),
  stats: (date: string) => apiGet<DailyStats>(`/api/daily/${date}/stats`),
  signIn: (credential: string, anonId: string) =>
    apiPost<Account>('/api/auth/google', { credential, anonId }),
  player: (anonId: string, today: string) =>
    apiGet<PlayerResponse>(`/api/players/${anonId}?today=${today}`),
};
