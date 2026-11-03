// What each option means, so the player makes the call they intend (tyres-and-track spec
// T1-T2). Every number comes from the race model: the compounds' pace, wear and drop-off, the
// sim's lap-time model (cleanLap) for what fresh tyres would gain, and the headset modes'
// effects. Lap time only: the grade still weighs the stop, traffic and passing.

import { type CarState, type RaceModel, cleanLap, modeEffects } from '@boxthislap/sim';

export interface TyreOutlook {
  compound: string;
  /** Seconds a lap slower than softs when new (0 for the softest). */
  newPace: number;
  /** Laps of wear before the compound falls off. */
  dropOff: number;
  /** Lasts to the flag from a stop now. */
  toFlag: boolean;
  /** Seconds gained over the green laps left against staying out on the current tyres (lap
   * time only; > 0 is faster). Null when the car isn't running. */
  gain: number | null;
  /** Green-flag laps the gain is counted over (laps behind a SC or VSC are run at its pace). */
  greenLaps: number;
  good: string;
  bad: string;
}

const LINES: Record<string, { good: string; bad: string }> = {
  SOFT: {
    good: 'Fastest grip: a short run to the flag, attacking, a restart.',
    bad: 'Wears quickest and falls off early on a long stint.',
  },
  MEDIUM: {
    good: 'The middle ground: quicker than hards, lasts longer than softs.',
    bad: 'Neither the fastest nor the longest-lasting.',
  },
  HARD: {
    good: 'Lasts longest and wears slowest: a long run to the flag.',
    bad: 'Slowest when new; less to attack or defend with.',
  },
};

/** Laps run behind a safety car or VSC (everyone at its pace: tyres don't matter). */
function neutralLaps(model: RaceModel): Set<number> {
  const laps = new Set<number>();
  for (const e of model.events) {
    if (e.type !== 'SC' && e.type !== 'VSC') continue;
    for (let l = e.lap; l < e.lap + (e.laps ?? 1); l++) laps.add(l);
  }
  return laps;
}

/** Green-lap times summed over laps [from, to] on a given set. Tyre age advances every lap;
 * wear advances one a green lap and one a lap behind a SC too, as in the sim. */
function stint(
  model: RaceModel,
  car: CarState,
  compound: string,
  age: number,
  wear: number,
  from: number,
  to: number,
  neutral: Set<number>,
): number {
  let t = 0;
  for (let lap = from, a = age, w = wear; lap <= to; lap++, a++, w++) {
    if (!neutral.has(lap)) t += cleanLap(model, { ...car, compound, tyreAge: a, tyreWear: w }, lap);
  }
  return t;
}

/**
 * Each compound's outlook for a stop called on `lap` (box at the end of it): pace, drop-off,
 * whether it reaches the flag, and the lap-time gain over the rest of the race vs staying out.
 */
export function tyreOutlooks(
  model: RaceModel,
  car: CarState | undefined,
  lap: number,
  compounds: string[],
): TyreOutlook[] {
  const total = model.race.laps;
  const neutral = neutralLaps(model);
  let greenLaps = 0;
  for (let l = lap + 1; l <= total; l++) if (!neutral.has(l)) greenLaps++;
  const softest = Math.min(...Object.values(model.compounds).map((c) => c.offset));
  const stayOut =
    car && !car.retired
      ? stint(model, car, car.compound, car.tyreAge, car.tyreWear, lap + 1, total, neutral)
      : null;
  return compounds.map((compound) => {
    const c = model.compounds[compound as keyof typeof model.compounds];
    const fresh =
      car && !car.retired ? stint(model, car, compound, 0, 0, lap + 1, total, neutral) : null;
    return {
      compound,
      newPace: c ? c.offset - softest : 0,
      dropOff: c?.cliffLap ?? 0,
      toFlag: c ? total - lap <= c.cliffLap : true,
      gain: stayOut !== null && fresh !== null ? stayOut - fresh : null,
      greenLaps,
      ...(LINES[compound] ?? { good: '', bad: '' }),
    };
  });
}

/** One line per headset option: what it does in this race's era. */
export function modeLine(model: RaceModel, key: string, value: string): string | null {
  const e = (modeEffects(model) as Record<string, Record<string, Record<string, number>>> | null)?.[
    key
  ]?.[value];
  if (!e) return null;
  const parts: string[] = [];
  const d = e.lapDelta ?? 0;
  if (Math.abs(d) >= 0.01) parts.push(`${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)} s a lap`);
  const w = e.wearMult ?? 1;
  if (w > 1.001) parts.push(`tyres wear ${Math.round((w - 1) * 100)}% faster`);
  if (w < 0.999) parts.push(`tyres wear ${Math.round((1 - w) * 100)}% slower`);
  if ((e.attackLogit ?? 0) > 0) parts.push('better chance to pass');
  if ((e.defendLogit ?? 0) < 0) parts.push('harder to pass you');
  if ((e.errorMult ?? 1) > 1.001) parts.push('more mistakes');
  const charge = e.charge ?? 0;
  if (charge > 0) parts.push(`battery +${charge}% a lap`);
  if (charge < 0) parts.push(`uses ${-charge}% of the battery a lap`);
  // Failures, punctures and crashes (the sim's incidents): what provokes them.
  if (key === 'pace' && value === 'push') parts.push('more risk of a failure or puncture');
  if (key === 'battle' && (value === 'attack' || value === 'defend'))
    parts.push('more crash risk in a fight');
  return parts.length ? parts.join(' · ') : 'No change: the baseline';
}

/** The headset call an option makes, if it's a single mode call. */
export function modeOf(decisions: Array<{ kind: string; key?: string; value?: string }>) {
  const m = decisions.length === 1 ? decisions[0] : undefined;
  return m?.kind === 'mode' && m.key && m.value ? { key: m.key, value: m.value } : null;
}
