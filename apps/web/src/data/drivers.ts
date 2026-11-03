// Who's who, and how each driver takes the wall's calls: data/drivers.json (feedback round 2
// research, every driver in our races). The race model carries codes and teams only.

import db from '@data/drivers.json';

export type Tier = 'high' | 'medium' | 'low';

export interface DriverInfo {
  name: string;
  number: number;
  /** Attitude tier, from how often the driver ignores the wall. */
  tier: Tier;
  /** % of the wall's live calls (BOX, headset) the driver refuses. */
  ignores: number;
  /** % of calls they'd argue with (researched, not used in the game yet). */
  pushback: number;
  confidence: 'high' | 'medium' | 'low';
  evidence: Array<{ note: string; source: string }>;
}

const DRIVERS = db.drivers as Record<string, DriverInfo>;

export const TIER_LABEL: Record<Tier, string> = {
  high: 'High attitude',
  medium: 'Medium attitude',
  low: 'Low attitude',
};

export function driverInfo(code: string): DriverInfo | undefined {
  return DRIVERS[code];
}

/** The share (0-1) of live calls a driver refuses; a driver not in the file always listens. */
export function ignoreRate(code: string): number {
  return (DRIVERS[code]?.ignores ?? 0) / 100;
}

/** Every driver code in the file (for the coverage test). */
export const driverCodes = (): string[] => Object.keys(DRIVERS);
