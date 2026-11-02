// Quick calls (crew-chief spec D3): between the big moments, the engineer or the driver asks
// something every few laps, built from the live race (the rival closing, a battle inside a
// second, old tyres, a big gap). The race keeps running; the answer is an order for the next
// lap, logged like any live call, so the server's replay matches. Not scored.

import type { Modes, RaceModel, RaceState } from '@boxthislap/sim';
import { flagOn } from '../track/geometry.js';
import type { LapEvents } from './raceLog.js';
import type { LiveCall } from './refusal.js';

export interface QuickOption {
  id: string;
  label: string;
  /** The order this answer gives (null: no change). */
  call: LiveCall | null;
}

export interface QuickCall {
  /** Asked after this lap. */
  lap: number;
  /** Who's on the radio: "Engineer" or the driver's code. */
  from: string;
  text: string;
  options: QuickOption[];
}

/** How often a quick call comes, in laps. */
export const QUICK_EVERY = 2;

/**
 * The laps a quick call is asked after: every other lap from the takeover, but never on a big
 * moment's pause or answer lap, never under a SC or VSC, and not in the last two laps.
 */
export function quickCallLaps(model: RaceModel): number[] {
  const busy = new Set<number>();
  for (const m of model.decisionMoments) {
    busy.add(m.lap - 1);
    busy.add(m.lap);
  }
  const out: number[] = [];
  let last = model.race.takeoverLap - 1;
  for (let lap = model.race.takeoverLap + 1; lap <= model.race.laps - 2; lap++) {
    if (busy.has(lap) || flagOn(model, lap) !== 'green' || flagOn(model, lap + 1) !== 'green')
      continue;
    if (lap - last >= QUICK_EVERY) {
      out.push(lap);
      last = lap;
    }
  }
  return out;
}

const mode = (lap: number, key: keyof Modes, value: string): LiveCall =>
  ({ lap, kind: 'mode', key, value }) as LiveCall;

/** One option per mode value; picking the mode already set is "no change". */
function opt(
  id: string,
  label: string,
  modes: Modes,
  lap: number,
  key: keyof Modes,
  value: string,
): QuickOption {
  return { id, label, call: modes[key] === value ? null : mode(lap, key, value) };
}

/** Average of `ours - theirs` lap times over the last n laps (> 0: they're quicker). */
function paceDiff(log: LapEvents[], us: string, them: string, n = 3): number | null {
  const laps = log.slice(-n).filter((l) => l.lapTimes[us] && l.lapTimes[them] && !l.pits.length);
  if (laps.length < 2) return null;
  return (
    laps.reduce((t, l) => t + (l.lapTimes[us] as number) - (l.lapTimes[them] as number), 0) /
    laps.length
  );
}

/** The quick call for the lap just completed, from the race as it stands. */
export function quickCallAt(race: RaceState, model: RaceModel, log: LapEvents[]): QuickCall | null {
  const us = model.userSide;
  const r = model.rival;
  const me = race.cars[us];
  const them = race.cars[r];
  if (!me || me.retired) return null;
  const next = race.lap + 1;
  const m = me.modes;
  const gap = them && !them.retired ? them.totalTime - me.totalTime : null; // > 0: we lead
  const cliff = model.compounds[me.compound as keyof typeof model.compounds]?.cliffLap ?? 99;
  const quicker = them ? paceDiff(log, us, r) : null;
  const lapsLeft = model.race.laps - race.lap;

  if (gap !== null && gap > 0 && gap < 1.0) {
    return {
      lap: race.lap,
      from: us,
      text: `${r} is right with me, ${gap.toFixed(1)} s behind. What do you want?`,
      options: [
        opt('defend', 'Defend', m, next, 'battle', 'defend'),
        opt('hold', 'Race him normally', m, next, 'battle', 'hold'),
      ],
    };
  }
  if (gap !== null && gap < 0 && gap > -1.0) {
    return {
      lap: race.lap,
      from: us,
      text: `I’m ${(-gap).toFixed(1)} s behind ${r}. Can I go for it?`,
      options: [
        opt('attack', 'Go for it', m, next, 'battle', 'attack'),
        opt('hold', 'Be patient', m, next, 'battle', 'hold'),
      ],
    };
  }
  if (gap !== null && quicker !== null && quicker > 0.25) {
    return {
      lap: race.lap,
      from: 'Engineer',
      text: `${r} is ${quicker.toFixed(1)} s a lap quicker over the last laps. Gap ${Math.abs(gap).toFixed(1)} s. Push to answer?`,
      options: [
        opt('push', 'Push', m, next, 'pace', 'push'),
        opt('plan', 'Stay on plan', m, next, 'pace', m.pace === 'push' ? 'standard' : m.pace),
      ],
    };
  }
  if (me.tyreWear > cliff - 6 && lapsLeft > 3) {
    return {
      lap: race.lap,
      from: us,
      text: `These ${me.compound.toLowerCase()}s are ${me.tyreAge} laps old and starting to go. Do I look after them?`,
      options: [
        opt('manage', 'Manage them', m, next, 'pace', 'manage'),
        opt('push', 'Keep pushing', m, next, 'pace', m.pace === 'manage' ? 'standard' : m.pace),
      ],
    };
  }
  if (gap !== null && gap > 8) {
    return {
      lap: race.lap,
      from: 'Engineer',
      text: `Gap to ${r} is ${gap.toFixed(1)} s with ${lapsLeft} to go. Turn it down and save the tyres?`,
      options: [
        opt('manage', 'Manage', m, next, 'pace', 'manage'),
        opt('keep', 'Keep the pace', m, next, 'pace', m.pace === 'manage' ? 'standard' : m.pace),
      ],
    };
  }
  if (gap !== null && gap < -8) {
    return {
      lap: race.lap,
      from: 'Engineer',
      text: `${r} is ${(-gap).toFixed(1)} s up the road with ${lapsLeft} to go. Flat out to close it?`,
      options: [
        opt('push', 'Flat out', m, next, 'pace', 'push'),
        opt('plan', 'Save it for later', m, next, 'pace', 'standard'),
      ],
    };
  }
  return {
    lap: race.lap,
    from: 'Engineer',
    text:
      gap === null
        ? `${lapsLeft} laps to go. How do we run it?`
        : `Gap to ${r}: ${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} s, ${lapsLeft} to go. Steady, or push for a few laps?`,
    options: [
      opt('push', 'Push', m, next, 'pace', 'push'),
      opt('steady', 'Steady', m, next, 'pace', 'standard'),
    ],
  };
}
