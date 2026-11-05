// What the radio says at a decision moment, built from the live race so it is true on every
// path (the gap, both cars' tyres and who leads come from the run, not from fixed copy). The
// race's prose layer (Phase 5) can replace the headlines later; the facts stay computed.

import type { DecisionMoment, RaceModel, RaceState } from '@boxthislap/sim';
import { named } from '../data/names.js';

export interface TyreFact {
  code: string;
  compound: string;
  age: number;
}

export interface Brief {
  /** Short label for the moment: "Safety car", "Virtual safety car", "Restart"… */
  kind: string;
  /** The radio line. */
  headline: string;
  /** Seconds between us and the rival; > 0 when we're ahead. Null if either car is out. */
  gap: number | null;
  us: TyreFact | null;
  rival: TyreFact | null;
  /** What a stop costs right now, and under green, when the moment offers a stop. */
  stop: { now: number; green: number } | null;
  lapsLeft: number;
}

const TYRE: Record<string, string> = { SOFT: 'softs', MEDIUM: 'mediums', HARD: 'hards' };
const tyres = (compound: string) => TYRE[compound] ?? compound.toLowerCase();

/** The neutralization covering the moment's lap, if any (known at the pause), and the lap
 * it came out on. */
function neutralAt(model: RaceModel, lap: number): { type: 'SC' | 'VSC'; from: number } | null {
  for (const e of model.events) {
    if ((e.type === 'SC' || e.type === 'VSC') && lap >= e.lap && lap < e.lap + (e.laps ?? 1)) {
      return { type: e.type, from: e.lap };
    }
  }
  return null;
}

export function briefFor(moment: DecisionMoment, race: RaceState, model: RaceModel): Brief {
  const me = race.cars[model.userSide];
  const them = race.cars[model.rival];
  const r = model.rival;
  const live = me && them && !me.retired && !them.retired;
  const gap = live ? them.totalTime - me.totalTime : null;
  const neutral = neutralAt(model, moment.lap);
  const flag = neutral?.type ?? null;
  const { pitLoss, pitLossUnderSC, pitLossUnderVSC } = model.track;
  const stops = moment.options.some((o) => o.decisions.some((d) => d.kind === 'pit'));
  // A moment of headset calls only: which modes it sets.
  const modesOnly = moment.options.every((o) => o.decisions.every((d) => d.kind === 'mode'));
  const keys = new Set(
    moment.options.flatMap((o) => o.decisions.flatMap((d) => (d.kind === 'mode' ? [d.key] : []))),
  );
  const only = (key: 'battle' | 'pace') =>
    modesOnly && keys.has(key) && (key === 'pace' || keys.size === 1);

  let kind: string;
  let headline: string;
  if (only('battle') && flag) {
    kind = 'Restart';
    headline =
      gap === null || gap >= 0
        ? `Restart is coming and ${r} is right behind us. How do we race him?`
        : `Restart is coming. ${r} is ahead and we’re on ${me ? tyres(me.compound) : 'our tyres'}. How do we race him?`;
  } else if (only('battle')) {
    kind = 'Final laps';
    const left = model.race.laps - race.lap;
    headline =
      gap === null
        ? `${left} laps to go. How do we race it?`
        : gap >= 0
          ? `${left} laps to go and ${r} is ${gap.toFixed(1)}s behind. How do we race him?`
          : `${left} laps to go and ${r} is ${(-gap).toFixed(1)}s ahead. How do we race him?`;
  } else if (only('pace')) {
    kind = 'Tyres';
    headline = `Our ${me ? tyres(me.compound) : 'tyres'} are ${me?.tyreAge ?? '?'} laps old. Push to hold the gap, run to plan, or look after them for the end?`;
  } else if (flag === 'SC' && neutral && moment.lap > neutral.from) {
    kind = 'Safety car';
    headline =
      them && !them.retired && them.tyreAge < (me?.tyreAge ?? 0)
        ? `Safety car still out, restart coming. ${r} is on ${them.tyreAge}-lap-old ${tyres(them.compound)}. Last chance to box: fresh tyres, or keep track position?`
        : 'Safety car still out, restart coming. Last chance to box: fresh tyres, or keep track position?';
  } else if (flag === 'SC') {
    kind = 'Safety car';
    headline = 'Safety car! The pit lane is cheap. Box for fresh tyres, or keep track position?';
  } else if (flag === 'VSC') {
    kind = 'Virtual safety car';
    headline = 'Virtual safety car. A cheap stop is on. Box, or stay out?';
  } else if (moment.trigger === 'cliff' && stops) {
    kind = 'Tyres';
    headline = `Our ${me ? tyres(me.compound) : 'tyres'} are ${me?.tyreAge ?? '?'} laps old and the lap times are starting to drop. Box under green for fresh tyres, or run them to the end?`;
  } else if (moment.trigger === 'rivalPit') {
    kind = `${r} due in`;
    headline = `${r} is due in for tyres. Box with him to cover, or stay out?`;
  } else if (moment.trigger === 'undercut') {
    kind = 'Undercut window';
    headline = 'We’re in the undercut window. Box now, or stay out?';
  } else {
    kind = 'Decision';
    headline = 'Your call.';
  }

  return {
    kind,
    // Drivers by name in the radio line (data/names.ts).
    headline: named(headline),
    gap,
    us: me && !me.retired ? { code: model.userSide, compound: me.compound, age: me.tyreAge } : null,
    rival: them && !them.retired ? { code: r, compound: them.compound, age: them.tyreAge } : null,
    stop: stops
      ? {
          now: flag === 'SC' ? pitLossUnderSC : flag === 'VSC' ? pitLossUnderVSC : pitLoss,
          green: pitLoss,
        }
      : null,
    lapsLeft: model.race.laps - race.lap,
  };
}
