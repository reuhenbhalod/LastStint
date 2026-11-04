// Why the safety car (or the VSC) is out: for the race's own neutralizations, the cause
// `pipeline incidents` took from FastF1 (the car that retired as it came out and its official
// status, the corner from race control); for a crash in live play, that crash. Display only:
// the race model never sees it.

import type { RaceModel, RaceNote, RaceState } from '@boxthislap/sim';
import incidents from '@data/incidents.json';
import { driverInfo } from '../data/drivers.js';

export interface Cause {
  lap: number;
  type: string;
  driver?: string;
  /** The car's official result status ("Accident", "Gearbox"...), or "Debris" / "Hazard". */
  status?: string;
  turn?: number;
  /** Debris from a clash between these two. */
  cars?: string[];
  /** A hazard (a yellow flag) in this sector. */
  sector?: number;
}

const CAUSES = incidents as unknown as Record<string, Cause[]>;

const surname = (code: string) => driverInfo(code)?.name.split(' ').at(-1) ?? code;

/** A failure, in words. */
const FAILURE: Record<string, string> = {
  Engine: 'an engine failure',
  'Power Unit': 'a power unit failure',
  Gearbox: 'a gearbox failure',
  Transmission: 'a transmission failure',
  Differential: 'a differential failure',
  Hydraulics: 'a hydraulics failure',
  Brakes: 'a brake failure',
  Electrical: 'an electrical failure',
  Electronics: 'an electrical failure',
  'Oil leak': 'an oil leak',
  'Water leak': 'a water leak',
  Wheel: 'a loose wheel',
  Suspension: 'broken suspension',
  Overheating: 'overheating',
};

/** The cause in a few words: "Latifi crashed at Turn 14". */
export function describeCause(c: Cause): string {
  const at = c.turn ? ` at Turn ${c.turn}` : '';
  if (c.status === 'Debris') {
    const [a, b] = c.cars ?? [];
    return a && b
      ? `Debris from ${surname(a)} and ${surname(b)}'s clash${at}`
      : `Debris on the track${at}`;
  }
  if (c.status === 'Hazard') return `A hazard on track${c.sector ? ` in sector ${c.sector}` : ''}`;
  if (!c.driver) return 'Race control hasn’t said why';
  const name = surname(c.driver);
  const status = c.status ?? 'Retired';
  if (status === 'Accident') return `${name} crashed${at}`;
  if (status === 'Spun off') return `${name} spun off${at}`;
  if (status.startsWith('Collision')) return `${name} is out after a collision${at}`;
  if (status === 'Retired') return `${name} stopped on track${at}`;
  const failure = FAILURE[status] ?? `a ${status.toLowerCase()} problem`;
  return `${name} stopped with ${failure}${at}`;
}

/**
 * Why lap `lap` (the lap being driven, under `flag`) is neutralized, or null if it isn't. The
 * race's own SC/VSC first; otherwise a crash in live play in the laps just before.
 */
export function neutralCause(
  model: RaceModel,
  notes: RaceNote[],
  lap: number,
  flag: RaceState['flag'],
): string | null {
  if (flag !== 'sc' && flag !== 'vsc') return null;
  const type = flag === 'sc' ? 'SC' : 'VSC';
  const event = model.events.find(
    (e) => e.type === type && lap >= e.lap && lap < e.lap + (e.laps ?? 1),
  );
  if (event) {
    const cause = CAUSES[model.race.id]?.find((c) => c.lap === event.lap && c.type === type);
    return cause ? describeCause(cause) : null;
  }
  const crash = [...notes]
    .reverse()
    .find((n) => n.kind === 'incident' && n.detail === 'crash' && n.lap < lap && n.lap >= lap - 4);
  return crash?.driver ? `${surname(crash.driver)} crashed` : null;
}
