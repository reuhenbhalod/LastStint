// Car faults (simulator roadmap R2; eras build plan 4.4). Same rule as the Python reference
// sim's FaultState (pipeline/faults.py), for parity.
//
// A FAULT event (a breakdown, or `damage` from a collision) is frozen on its real lap, like a
// safety car: from `lap` (for `laps` laps, or to the flag, or with `untilStop` to the car's
// next stop) its car loses `paceLoss` on every green lap (neutralized laps run at the SC/VSC
// pace whatever the car), plus `slowLap` once on the fault's own lap (a contact's lap). The magnitudes are fitted by the pipeline from the car's real laps.

import type { FaultKind, RaceEvent } from './types.js';

export const FAULT_KINDS: readonly FaultKind[] = [
  'gear-stuck',
  'power-loss',
  'puncture',
  'tyre-failure',
  'damage',
];

/** One car's fault in a run, and whether a stop has fixed it. */
export interface FaultEntry {
  event: RaceEvent;
  ended: boolean;
}

/** A run's faults by car (empty for a race with none). */
export type FaultTable = Map<string, FaultEntry[]>;

/** The race's FAULT events by car. `blindAfter`: a grader playout knows only the faults that
 * have struck by then (like the neutralizations, eras build plan 4.4). */
export function faultTable(events: readonly RaceEvent[], blindAfter?: number): FaultTable {
  const table: FaultTable = new Map();
  for (const e of events) {
    if (e.type !== 'FAULT' || !e.driver) continue;
    if (blindAfter !== undefined && e.lap > blindAfter) continue;
    table.set(e.driver, [...(table.get(e.driver) ?? []), { event: e, ended: false }]);
  }
  return table;
}

/** A copy for a forked run (it ends its own faults). `blindAfter` drops faults still to come. */
export function cloneFaults(table: FaultTable, blindAfter?: number): FaultTable {
  const out: FaultTable = new Map();
  for (const [code, list] of table) {
    const kept = list
      .filter((f) => blindAfter === undefined || f.event.lap <= blindAfter)
      .map((f) => ({ ...f }));
    if (kept.length > 0) out.set(code, kept);
  }
  return out;
}

/** What a car's faults cost it on a lap: `pace` belongs to its model pace (green laps, the
 * pass model sees it), `extra` is the slow lap on top. */
export interface FaultCost {
  pace: number;
  extra: number;
  /** The kind of a fault that struck on this lap (for the run's notes). */
  struck?: FaultKind;
  /** A contact (`damage`) struck on this lap: the car is out of the lap's pass rolls. */
  contact?: boolean;
}

const NONE: FaultCost = Object.freeze({ pace: 0, extra: 0 });

/**
 * The car's fault cost on `lap`. A stop on this lap (its out-lap) after an until-stop fault's
 * own lap ends that fault first: the new tyres are on.
 */
export function faultCost(
  table: FaultTable,
  code: string,
  lap: number,
  pitted: boolean,
  green: boolean,
): FaultCost {
  const list = table.get(code);
  if (!list) return NONE;
  let pace = 0;
  let extra = 0;
  let struck: FaultKind | undefined;
  let contact = false;
  for (const f of list) {
    const e = f.event;
    if (f.ended || lap < e.lap) continue;
    if (e.laps !== undefined && lap >= e.lap + e.laps) continue;
    if (e.untilStop && pitted && lap > e.lap) {
      f.ended = true;
      continue;
    }
    if (green) pace += e.paceLoss ?? 0;
    if (lap === e.lap) {
      extra += e.slowLap ?? 0;
      struck = e.fault;
      if (e.fault === 'damage') contact = true;
    }
  }
  if (pace === 0 && extra === 0 && !struck) return NONE;
  if (contact) return { pace, extra, struck, contact };
  return struck ? { pace, extra, struck } : { pace, extra };
}

/** The user's car's faults, for decision moments: (lap, fault) in lap order. */
export function faultsOf(events: readonly RaceEvent[], code: string): RaceEvent[] {
  return events
    .filter((e) => e.type === 'FAULT' && e.driver === code)
    .sort((a, b) => a.lap - b.lap);
}
