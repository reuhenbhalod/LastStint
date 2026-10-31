// What the radio says at a decision moment, built from the live race so it is true on every
// path (the gap, both cars' tyres and who leads come from the run, not from fixed copy). The
// race's prose layer (Phase 5) can replace the headlines later; the facts stay computed.

import type { DecisionMoment, RaceModel, RaceState } from '@boxthislap/sim';

export interface Brief {
  /** The radio line. */
  headline: string;
  /** Short facts under it: gap, tyres, pit loss, laps left. */
  facts: string[];
}

const TYRE: Record<string, string> = { SOFT: 'softs', MEDIUM: 'mediums', HARD: 'hards' };
const tyres = (compound: string) => TYRE[compound] ?? compound.toLowerCase();
const letter = (compound: string) => compound[0] ?? '?';

/** The neutralization starting on the moment's lap, if any (known at the pause). */
function flagAt(model: RaceModel, lap: number): 'SC' | 'VSC' | null {
  for (const e of model.events) {
    if ((e.type === 'SC' || e.type === 'VSC') && lap >= e.lap && lap < e.lap + (e.laps ?? 1)) {
      return e.type;
    }
  }
  return null;
}

export function briefFor(moment: DecisionMoment, race: RaceState, model: RaceModel): Brief {
  const me = race.cars[model.userSide];
  const rival = race.cars[model.rival];
  const r = model.rival;
  const lapsLeft = model.race.laps - race.lap;
  const facts: string[] = [];
  let lead = '';
  if (me && rival && !me.retired && !rival.retired) {
    const gap = rival.totalTime - me.totalTime; // > 0: we're ahead
    lead =
      gap >= 0 ? `We lead ${r} by ${gap.toFixed(1)}s` : `${r} leads us by ${(-gap).toFixed(1)}s`;
    facts.push(lead);
    facts.push(
      `Us: ${letter(me.compound)} ${me.tyreAge} laps · ${r}: ${letter(rival.compound)} ${rival.tyreAge} laps`,
    );
  }
  const flag = flagAt(model, moment.lap);
  const { pitLoss, pitLossUnderSC, pitLossUnderVSC } = model.track;
  const stops = moment.options.some((o) => o.decisions.some((d) => d.kind === 'pit'));
  if (stops) {
    const loss = flag === 'SC' ? pitLossUnderSC : flag === 'VSC' ? pitLossUnderVSC : pitLoss;
    facts.push(
      flag
        ? `A stop costs ~${loss.toFixed(0)}s now (~${pitLoss.toFixed(0)}s under green)`
        : `A stop costs ~${loss.toFixed(0)}s`,
    );
  }
  facts.push(`${lapsLeft} laps to go`);

  const battle = moment.options.every((o) =>
    o.decisions.every((d) => d.kind === 'mode' && d.key === 'battle'),
  );
  const pace = moment.options.every((o) =>
    o.decisions.every((d) => d.kind === 'mode' && d.key === 'pace'),
  );
  let headline: string;
  if (battle) {
    const ahead = me && rival ? rival.totalTime >= me.totalTime : true;
    headline = ahead
      ? `Restart is coming. ${r} is right behind us on ${rival ? tyres(rival.compound) : 'his tyres'}. How do we race him?`
      : `Restart is coming. We're behind ${r}, on ${me ? tyres(me.compound) : 'our tyres'}. How do we race him?`;
  } else if (pace) {
    headline = `Our ${me ? tyres(me.compound) : 'tyres'} are ${me?.tyreAge ?? '?'} laps old. Push to hold the gap, or look after them for the end?`;
  } else if (flag === 'SC') {
    headline = 'Safety car! The pit lane is cheap. Box for fresh tyres, or keep track position?';
  } else if (flag === 'VSC') {
    headline = 'Virtual safety car. A cheap stop is on. Box, or stay out?';
  } else if (moment.trigger === 'rivalPit') {
    headline = `${r} has boxed. Do we cover?`;
  } else if (moment.trigger === 'undercut') {
    headline = 'We’re in the undercut window. Box now, or stay out?';
  } else {
    headline = 'Your call.';
  }
  return { headline, facts };
}
