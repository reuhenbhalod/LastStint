// The game modes' race pools (data/pools.json, survivor spec D3): the daily rotation and the
// survivor races (each with the seeds a run deals from). A race is in one pool, never both.
// The daily list is empty since Nov 18 2026: every Daily race moved to Gauntlet until Daily gets
// its own shorter races.

import pools from '../../../data/pools.json';

export const DAILY_POOL: readonly string[] = pools.daily;
export const SURVIVOR_POOL: Readonly<Record<string, number[]>> = pools.survivor as Record<
  string,
  number[]
>;
