// What happened on each lap, read from consecutive race states: who stopped (onto what, how
// much it cost, places lost) and each car's last lap time. Feeds the pit card and the driver
// card. Built as the screen sees laps go by, so a resumed run starts its log at the resume.

import type { RaceState } from '@boxthislap/sim';
import { useRef } from 'react';

export interface PitEvent {
  /** The lap the stop was charged on (the out-lap). */
  lap: number;
  code: string;
  compound: string;
  /** Time the stop cost against the cars that didn't stop (s), if measurable. */
  cost: number | null;
  /** Position before and after the stop (1-based). */
  from: number;
  to: number;
}

export interface LapEvents {
  lap: number;
  pits: PitEvent[];
  /** Each running car's time for the lap (s). */
  lapTimes: Record<string, number>;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** The events of `cur`'s lap, given the state one lap earlier. */
export function lapEvents(prev: RaceState, cur: RaceState): LapEvents {
  const lapTimes: Record<string, number> = {};
  for (const code of cur.order) {
    const a = prev.cars[code];
    const b = cur.cars[code];
    if (a && b && !b.retired) lapTimes[code] = b.totalTime - a.totalTime;
  }
  const typical = median(
    Object.entries(lapTimes)
      .filter(([code]) => !cur.cars[code]?.pittedThisLap)
      .map(([, t]) => t),
  );
  const pits = cur.order.flatMap((code): PitEvent[] => {
    const car = cur.cars[code];
    if (!car?.pittedThisLap || car.retired) return [];
    const t = lapTimes[code];
    return [
      {
        lap: cur.lap,
        code,
        compound: car.compound,
        // Behind a safety car the field bunches up, so the median lap measures nothing (a
        // stop came out at -4 s): the card shows places only. (A VSC slows all alike.)
        cost:
          t !== undefined && typical !== null && cur.flag !== 'sc' && t - typical > 0
            ? t - typical
            : null,
        from: prev.order.indexOf(code) + 1,
        to: cur.order.indexOf(code) + 1,
      },
    ];
  });
  return { lap: cur.lap, pits, lapTimes };
}

/** The log so far, given each new race state (one entry per lap, oldest first). The sim
 * updates its state in place, so the log keeps its own copy of the last lap to compare with. */
export class RaceLog {
  private last: RaceState | null = null;
  laps: LapEvents[] = [];

  see(race: RaceState): LapEvents[] {
    if (this.last && race.lap === this.last.lap) return this.laps;
    if (this.last && race.lap === this.last.lap + 1) {
      this.laps = [...this.laps, lapEvents(this.last, race)];
    } else if (this.last && race.lap < this.last.lap) {
      this.laps = []; // the race was restarted
    }
    this.last = structuredClone(race);
    return this.laps;
  }
}

export function useRaceLog(race: RaceState): LapEvents[] {
  const log = useRef<RaceLog | null>(null);
  log.current ??= new RaceLog();
  return log.current.see(race);
}
