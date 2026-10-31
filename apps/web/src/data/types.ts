// The data the game needs to run one Daily Race. The decision moments themselves are
// derived from the model by the simulator (`candidateMoments`), not stored here.

import type { RaceModel } from '@boxthislap/sim';

export interface Daily {
  /** ISO date this race is served for (local fixture date until the Worker assigns one). */
  date: string;
  raceId: string;
  /** Daily seed: fixes the race for everyone and lets the Worker replay the run. */
  seed: number;
  model: RaceModel;
}

/** Source of today's race. Static/bundled now; backed by GET /api/daily in Phase 4. */
export interface DailyProvider {
  today(): Promise<Daily>;
}
