// Why and where a car's race ended: the real retirements (`pipeline incidents`, from FastF1's
// result statuses and race control) and live play's crashes and failures. The track map parks
// a car that stops where it stopped, with the reason. Display only.

import retirements from '@data/retirements.json';
import type { RaceNote } from '@laststint/sim';

interface Retirement {
  lap: number;
  status: string;
  turn?: number;
}

const RETIRED = retirements as unknown as Record<string, Record<string, Retirement>>;

/** The real retirement of `code` in race `raceId` on `lap`, if it's the one happening. */
export function realRetirement(raceId: string, code: string, lap: number): Retirement | null {
  const r = RETIRED[raceId]?.[code];
  return r && Math.abs(r.lap - lap) <= 1 ? r : null;
}

/** A result status in a word or two, for the map ("crash", "engine"...). */
export function shortWhy(status: string): string {
  const s = status.toLowerCase();
  if (s === 'accident') return 'crash';
  if (s.startsWith('collision')) return 'collision';
  if (s === 'spun off') return 'spun off';
  if (s === 'retired' || s === 'did not finish') return 'stopped';
  if (s === 'power unit') return 'power unit';
  return s;
}

/** Why `code` is out on `lap`: live play's own incident first, then the real retirement. */
export function outReason(raceId: string, code: string, lap: number, notes: RaceNote[]): string {
  const live = notes.find((n) => n.kind === 'incident' && n.driver === code && n.lap === lap);
  if (live?.detail === 'crash') return 'crash';
  if (live?.detail === 'mechanical') return 'failure';
  const real = realRetirement(raceId, code, lap);
  return real ? shortWhy(real.status) : 'stopped';
}
