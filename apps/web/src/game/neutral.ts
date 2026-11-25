// Why the safety car (or the VSC) is out: for the race's own neutralizations, the cause
// `pipeline incidents` took from FastF1 (the car that retired as it came out and its official
// status, the corner from race control); for a crash in live play, that crash. Display only:
// the race model never sees it.

import incidents from '@data/incidents.json';
import { type RaceModel, type RaceNote, type RaceState, baseRaceId } from '@laststint/sim';
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
 * The recorded cause of one of the race's SC/VSC periods, matched on its start lap. A period
 * that starts on the takeover lap may have been out already (the pipeline cuts a period running
 * at the takeover to start there): its cause is then the latest of its type at or before it.
 */
function causeOf(model: RaceModel, event: { lap: number }, type: string): Cause | undefined {
  const causes =
    (CAUSES[model.race.id] ?? CAUSES[baseRaceId(model.race.id)])?.filter((c) => c.type === type) ??
    [];
  const exact = causes.find((c) => c.lap === event.lap);
  if (exact || event.lap !== model.race.takeoverLap) return exact;
  return causes.filter((c) => c.lap < event.lap).sort((a, b) => b.lap - a.lap)[0];
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
    const cause = causeOf(model, event, type);
    return cause ? describeCause(cause) : null;
  }
  const crash = [...notes]
    .reverse()
    .find((n) => n.kind === 'incident' && n.detail === 'crash' && n.lap < lap && n.lap >= lap - 4);
  return crash?.driver ? `${surname(crash.driver)} crashed` : null;
}

/**
 * The car behind a neutralization that the race model doesn't run (it retired before the
 * takeover's field was set, Giovinazzi in Abu Dhabi 21): the map parks it where it stopped
 * while the SC or VSC is out. Null when there's none, or the model runs the car itself.
 */
export function neutralCar(
  model: RaceModel,
  lap: number,
  flag: RaceState['flag'],
): { driver: string; status: string; turn?: number; from: number } | null {
  if (flag !== 'sc' && flag !== 'vsc') return null;
  const type = flag === 'sc' ? 'SC' : 'VSC';
  const event = model.events.find(
    (e) => e.type === type && lap >= e.lap && lap < e.lap + (e.laps ?? 1),
  );
  if (!event) return null;
  const cause = causeOf(model, event, type);
  if (!cause?.driver || model.drivers.some((d) => d.code === cause.driver)) return null;
  return {
    driver: cause.driver,
    status: cause.status ?? 'Retired',
    ...(cause.turn ? { turn: cause.turn } : {}),
    from: event.lap,
  };
}
