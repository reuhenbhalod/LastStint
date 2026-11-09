// Decision moments (perfection spec D3/D4; Implementation Plan 1.5 and 5.3).
//
// A moment is where the game pauses for a call: the lap, what triggered it, the target the
// call is graded on, 3-4 options (each a list of calls for that lap) and which option the
// real team took. proposeMoments() finds candidates from the race's triggers, grades every
// option from the real race's state at that lap, and keeps only genuine dilemmas. A human
// still picks the final 2-4 (plan 1.5); approved moments go in data/moments/<race>.json.
//
// A refuelling race (refuel.ts): every box call carries an explicit fill, so an option is still
// one call per compound. The box call the real team made (its lap and compound) carries the
// real fill (realFill), so it is the real call; every other box call fills 'standard' (the
// fewest stops from there, split evenly). The fill is a choice on the race screen's pit card;
// at a moment the option names it.

import { faultsOf } from './faults.js';
import { type GradeOption, type MomentGrade, type Target, gradeMoment } from './grade.js';
import { drawnEvents, legendEvents, removedEvents } from './legend.js';
import { realFill, refuelling } from './refuel.js';
import { illegalPitCompound } from './rules.js';
import {
  type Run,
  cleanLap,
  initRun,
  liveFuelFrom,
  realDecisions,
  stepLap,
  tyreLife,
} from './sim.js';
import type { CarState, Decision, Fill, RaceModel } from './types.js';
import { isWetTyre, wetnessOn } from './weather.js';

/** What brought a moment on (the race plan at takeover is the strategy planner's, not a
 * moment). `rain` / `drying`: the track turning wet or drying out (weather spec). `fault`: a
 * fault struck the user's car (faults.ts): nurse it or push, pit now or limp on. Red flags
 * (eras build plan 4.3): `RED`, the tyres to fit in the stoppage for the restart (free);
 * `preRed`, the lap before it, boxing now (paid) or staying out. `teamOrder` (Eras model fixes
 * M4): a sourced team order or let-by tells the player's car to let a car by (a TEAM_ORDER
 * event, scripted.ts): comply, or ignore it. */
export type MomentTrigger =
  | 'SC'
  | 'VSC'
  | 'RED'
  | 'preRed'
  | 'rivalPit'
  | 'undercut'
  | 'cliff'
  | 'rain'
  | 'drying'
  | 'fault'
  | 'teamOrder';

export interface MomentOption extends GradeOption {
  /** Short label for the UI; radio copy is written in Phase 5. */
  label: string;
}

export interface DecisionMoment {
  id: string;
  /** The calls are for this lap: the game pauses after lap - 1 (a pit call boxes this lap). */
  lap: number;
  trigger: MomentTrigger;
  target: Target;
  options: MomentOption[];
  /** The option matching what the real team did, or null if none does. */
  realOptionId: string | null;
}

/**
 * Plan 5.3 quality bar, in percentage points of the target's chance. A moment fails if no
 * option is more than NO_CHOICE behind the best, i.e. none grades orange or worse (no real
 * choice: the plan's literal 0.5 points passed moments where every call won 98-100%), or if
 * the best leads the runner-up by more than NO_TENSION (one option is obviously right).
 */
export const QUALITY = { NO_CHOICE: 5, NO_TENSION: 30 } as const;

export type Verdict = 'keep' | 'no-choice' | 'no-tension';

export interface ProposedMoment extends DecisionMoment {
  grade: MomentGrade;
  verdict: Verdict;
}

const DEFAULT_TARGET: Target = { kind: 'beat-rival' };
/** Candidates closer together than this are merged, keeping the higher-priority trigger. */
const MIN_SPACING = 3;
/** Merge priority: the events that make a call unavoidable come first. */
const PRIORITY: Record<MomentTrigger, number> = {
  RED: -1,
  preRed: -1,
  rain: 0,
  drying: 0,
  fault: 0,
  teamOrder: 0,
  SC: 0,
  VSC: 1,
  rivalPit: 2,
  undercut: 3,
  cliff: 4,
};
/** Laps before the rival's real stop at which the undercut window is offered. */
const UNDERCUT_LEAD = 2;
/** Laps before the user's tyres reach the cliff at which that moment is offered. */
const CLIFF_LEAD = 2;
/** Weather spec: the call for wet tyres comes as the track turns wet (wetness past RAIN), the
 * call back to slicks as it dries (back under DRYING). */
const RAIN = 0.05;
const DRYING = 0.12;

/** The real race paused just before `lap`: the user follows the real team's calls so far. */
export function pauseAt(model: RaceModel, lap: number): Run {
  const { takeoverLap } = model.race;
  // A real stop with its out-lap on takeover + 1 was called on the takeover lap, before the
  // player's car went live: not a call the player could make, so it stays the real stop.
  const before = realDecisions(model).filter((d) => d.lap < lap && d.lap > takeoverLap);
  const run = initRun(model, model.race.seed, { decisions: before, incidents: false });
  const user = run.state.cars[model.userSide];
  const first = model.drivers
    .find((d) => d.code === model.userSide)
    ?.realStrategy.find((s) => s.lap === takeoverLap + 1);
  // Refuelling: it fills as the real team did, to the next real stop (refuel.ts realFill).
  if (user && first) {
    user.strategy.push(
      refuelling(model) ? { ...first, fill: realFill(model, model.userSide, first.lap) } : first,
    );
  }
  while (run.state.lap < lap - 1) stepLap(run);
  // An Eras race with a fuel rule: from here the player's fuel burns live, as in live play, so
  // the hard-call counter and the author grade a skipped fill or a missed lift as running dry
  // (sim.ts liveFuelFrom). Every other race (Daily, Gauntlet) pauses as before.
  liveFuelFrom(run);
  return run;
}

function stayOut(): MomentOption {
  return { id: 'stay-out', label: 'Stay out', decisions: [] };
}

/**
 * The race's compounds a pit call may name, in the model's order (era rules, rules.ts
 * illegalPitCompound): every one, except with no tyre changes (2005), when only the dry set the
 * car is on (the stop refuels and keeps it) and the wet tyres. Every moment option's box call
 * names one of these, so grading one never throws.
 */
export function pitCompounds(model: RaceModel): string[] {
  return Object.keys(model.compounds).filter((c) => !illegalPitCompound(model, c));
}

function boxOptions(
  model: RaceModel,
  lap: number,
  compounds = pitCompounds(model),
  label = (tyre: string) => `Box for ${tyre}s`,
): MomentOption[] {
  const legal = new Set(pitCompounds(model));
  const keeps = model.rules?.tyreChanges === false;
  return compounds
    .filter((compound) => legal.has(compound))
    .map((compound) => {
      const call = boxCall(model, lap, compound);
      // No tyre changes: a dry stop keeps the set it's on.
      const tyres =
        keeps && !isWetTyre(compound)
          ? `Box, keep the ${compound.toLowerCase()}s`
          : label(compound.toLowerCase());
      return {
        id: `box-${compound.toLowerCase()}`,
        label: call.kind === 'pit' && call.fill ? `${tyres}, ${fillWords(call.fill)}` : tyres,
        decisions: [call],
      };
    });
}

/** A box option's fill, in its label: "a standard fill", "fuel for 17 laps". */
function fillWords(fill: Fill): string {
  return typeof fill === 'string' ? `a ${fill} fill` : `fuel for ${fill.laps} laps`;
}

/**
 * A grading option's box call on in-lap `lap` (the moment finder, the authoring recipe). A
 * refuelling race: the real call's fill if this is the real call (its lap and compound), else
 * 'standard'.
 */
export function boxCall(model: RaceModel, lap: number, compound: string): Decision {
  if (!refuelling(model)) return { lap, kind: 'pit', compound };
  const real = realDecisions(model).find(
    (d) => d.lap === lap && d.kind === 'pit' && d.compound === compound,
  );
  const fill = real?.kind === 'pit' ? real.fill : undefined;
  return { lap, kind: 'pit', compound, fill: fill ?? 'standard' };
}

/**
 * The race's compounds for a red flag's calls: the ones the field really fitted around it
 * (laps `from`..`to`, most fitted first: a wet restart's intermediates), then the rest
 * quickest first on a new set on lap `to` + 1 for the user's car (the sim's lap model).
 */
function tyresFor(model: RaceModel, from: number, to: number): string[] {
  const fitted = new Map<string, number>();
  for (const d of model.drivers) {
    for (const s of d.realStrategy) {
      if (s.lap >= from && s.lap <= to) fitted.set(s.to, (fitted.get(s.to) ?? 0) + 1);
    }
  }
  const user = model.drivers.find((d) => d.code === model.userSide);
  const pace = (compound: string) =>
    cleanLap(
      model,
      {
        basePace: user?.basePace ?? 0,
        compound,
        tyreWear: 0,
        tyreAge: 1,
        ...(user?.wetPace ? { wetPace: user.wetPace } : {}),
        ...(user?.dampPace !== undefined ? { dampPace: user.dampPace } : {}),
      } as CarState,
      to + 1,
    );
  return Object.keys(model.compounds).sort(
    (a, b) => (fitted.get(b) ?? 0) - (fitted.get(a) ?? 0) || pace(a) - pace(b),
  );
}

/**
 * Red flags (eras build plan 4.3). `RED` on the red flag's first lap: boxing then is the tyre
 * change in the stoppage, free (redflag.ts), so the call is which tyre to restart on. `preRed`
 * the lap before: box now and pay for it, or stay out (the stop the red flag would give free).
 */
function redFlagMoments(model: RaceModel): Found[] {
  const out: Found[] = [];
  for (const e of model.events) {
    if (e.type !== 'RED' || !e.restart) continue;
    const tyres = tyresFor(model, e.lap - 1, e.lap + (e.laps ?? 1) - 1);
    out.push({ lap: e.lap, trigger: 'RED', tyres });
    out.push({ lap: e.lap - 1, trigger: 'preRed', tyres });
  }
  return out;
}

/** A candidate moment: its lap, trigger and (red flags) the tyres to offer, in order. */
interface Found {
  lap: number;
  trigger: MomentTrigger;
  tyres?: string[];
}

const RED_TRIGGERS: ReadonlySet<MomentTrigger> = new Set(['RED', 'preRed']);

function modeOption(lap: number, value: 'push' | 'manage'): MomentOption {
  return {
    id: value,
    label: value === 'push' ? 'Stay out and push' : 'Stay out and manage the tyres',
    decisions: [{ lap, kind: 'mode', key: 'pace', value }],
  };
}

/**
 * A fault on the user's car (eras build plan 4.4), the lap after it struck. A tyre fault
 * (until the next stop): pit now or limp on (or limp on nursing it). A gear or power fault:
 * nurse the car or push it, or box for tyres.
 */
function faultOptions(model: RaceModel, lap: number, untilStop: boolean): MomentOption[] {
  const nurse: MomentOption = {
    id: 'nurse',
    label: untilStop ? 'Limp on and nurse it' : 'Nurse the car',
    decisions: [{ lap, kind: 'mode', key: 'pace', value: 'manage' }],
  };
  const box = boxOptions(model, lap);
  if (untilStop) {
    return [{ ...stayOut(), label: 'Limp on' }, ...box.slice(0, 2), nurse];
  }
  const push: MomentOption = {
    id: 'push',
    label: 'Push on',
    decisions: [{ lap, kind: 'mode', key: 'pace', value: 'push' }],
  };
  return [stayOut(), nurse, push, ...box.slice(0, 1)];
}

function realOptionId(model: RaceModel, lap: number, options: MomentOption[]): string | null {
  const call = realDecisions(model).find((d) => d.lap === lap);
  if (!call) return options.some((o) => o.id === 'stay-out') ? 'stay-out' : null;
  // A refuelling race: the real call's fill too (an option filling otherwise isn't it).
  const match = options.find((o) =>
    o.decisions.some(
      (d) =>
        d.kind === 'pit' &&
        call.kind === 'pit' &&
        d.compound === call.compound &&
        JSON.stringify(d.fill) === JSON.stringify(call.fill),
    ),
  );
  return match?.id ?? null;
}

/**
 * A trigger's 3-4 options: stay out, a box call per compound (`tyres`, in order, for a red
 * flag's calls), and a pace call off a SC/VSC or red flag.
 */
function triggerOptions(
  model: RaceModel,
  lap: number,
  trigger: MomentTrigger,
  tyres?: string[],
): MomentOption[] {
  const red = RED_TRIGGERS.has(trigger);
  const box =
    trigger === 'RED'
      ? boxOptions(model, lap, tyres, (t) => `Fit ${t}s in the stoppage`)
      : boxOptions(model, lap, tyres);
  const extra =
    trigger === 'cliff'
      ? modeOption(lap, 'manage')
      : trigger === 'SC' || trigger === 'VSC' || red
        ? null
        : modeOption(lap, 'push');
  const stay = trigger === 'RED' ? { ...stayOut(), label: 'Keep this set' } : stayOut();
  return [stay, ...box.slice(0, extra ? 2 : 3), ...(extra ? [extra] : [])];
}

/**
 * A team order to the player's car (TEAM_ORDER, scripted.ts): let the car by as the real driver
 * did (the real option), or ignore it. Offered on the order's lap, the last lap included.
 */
function teamOrderMoments(model: RaceModel, first: number, target: Target): DecisionMoment[] {
  return model.events
    .filter(
      (e) =>
        e.type === 'TEAM_ORDER' &&
        e.driver === model.userSide &&
        e.lap >= first &&
        e.lap <= model.race.laps,
    )
    .map((e) => ({
      id: `teamorder-${e.lap}-${(e.other ?? '').toLowerCase()}`,
      lap: e.lap,
      trigger: 'teamOrder' as const,
      target,
      options: [
        {
          id: 'comply',
          label: `Let ${e.other} through`,
          decisions: [{ lap: e.lap, kind: 'teamOrder', order: 'comply' }],
        },
        { id: 'ignore', label: 'Ignore the order', decisions: [] },
      ],
      realOptionId: 'comply',
    }));
}

/** Candidate moments from the race's triggers, with 3-4 options each (ungraded). */
export function candidateMoments(model: RaceModel, target = DEFAULT_TARGET): DecisionMoment[] {
  const first = model.race.takeoverLap + 1;
  const last = model.race.laps - 1;
  const found: Found[] = [...redFlagMoments(model)];

  for (const e of model.events) {
    if ((e.type === 'SC' || e.type === 'VSC') && e.lap >= first) {
      found.push({ lap: e.lap, trigger: e.type });
    }
  }
  // A fault on the user's car: the call comes on the lap after it struck. A contact over in
  // its own lap (`damage`, one lap, no pace loss) leaves nothing to call.
  const untilStop = new Map<number, boolean>();
  for (const e of faultsOf(model.events, model.userSide)) {
    if (e.fault === 'damage' && e.laps === 1 && !e.paceLoss) continue;
    found.push({ lap: e.lap + 1, trigger: 'fault' });
    untilStop.set(e.lap + 1, e.untilStop === true);
  }
  const rival = model.drivers.find((d) => d.code === model.rival);
  for (const stop of rival?.realStrategy ?? []) {
    found.push({ lap: stop.lap - 1, trigger: 'rivalPit' });
    found.push({ lap: stop.lap - 1 - UNDERCUT_LEAD, trigger: 'undercut' });
  }
  // The track turning wet, or drying out (weather spec).
  if (model.weather) {
    const w = model.weather.wetness;
    for (let lap = first; lap <= last; lap++) {
      const now = wetnessOn(w, lap);
      const before = wetnessOn(w, lap - 1);
      if (now >= RAIN && before < RAIN) found.push({ lap, trigger: 'rain' });
      if (now < DRYING && before >= DRYING) found.push({ lap, trigger: 'drying' });
    }
  }
  // The user's tyres approaching the cliff along the real race.
  const user = model.drivers.find((d) => d.code === model.userSide);
  if (user) {
    const run = pauseAt(model, first);
    while (run.state.lap < last) {
      const car = run.state.cars[model.userSide];
      const c = car ? model.compounds[car.compound] : undefined;
      const life = c ? tyreLife(c) : Number.POSITIVE_INFINITY;
      if (car && c && life < model.race.laps && car.tyreWear >= life - CLIFF_LEAD) {
        found.push({ lap: run.state.lap + 1, trigger: 'cliff' });
        break;
      }
      stepLap(run);
    }
  }

  // Team orders to the player's car: always offered (an order isn't merged away).
  const moments: DecisionMoment[] = [];
  for (const m of teamOrderMoments(model, first, target)) {
    if (!moments.some((x) => x.lap === m.lap)) moments.push(m);
  }
  for (const { lap, trigger, tyres } of found
    .filter((f) => f.lap >= first && f.lap <= last)
    .sort((a, b) => PRIORITY[a.trigger] - PRIORITY[b.trigger] || a.lap - b.lap)) {
    // The two red-flag calls are different calls a lap apart: both are kept.
    const near = (m: DecisionMoment) =>
      Math.abs(m.lap - lap) < MIN_SPACING &&
      !(RED_TRIGGERS.has(m.trigger) && RED_TRIGGERS.has(trigger));
    if (moments.some(near)) continue;
    if (trigger === 'fault') {
      const options = faultOptions(model, lap, untilStop.get(lap) ?? false);
      moments.push({
        id: `fault-${lap}`,
        lap,
        trigger,
        target,
        options,
        realOptionId: realOptionId(model, lap, options),
      });
      continue;
    }
    const options = triggerOptions(model, lap, trigger, tyres);
    moments.push({
      id: `${trigger.toLowerCase()}-${lap}`,
      lap,
      trigger,
      target,
      options,
      realOptionId: realOptionId(model, lap, options),
    });
  }
  return moments.sort((a, b) => a.lap - b.lap);
}

/**
 * The decision moments of a Legend attempt with `seed` (eras spec 8: calls follow the safety
 * cars). The race's approved moments, minus each SC/VSC moment whose lap falls in a real
 * SC/VSC period Legend removed; plus, at each drawn SC/VSC, the call the moment finder makes
 * at a real one (trigger, lap and options as candidateMoments). A drawn moment is skipped
 * outside the finder's laps (after the takeover, before the last lap) or within MIN_SPACING
 * laps of a moment already kept, like the finder's merge (the approved moment wins). Its
 * realOptionId is null: the real team never faced it. Every other moment is unchanged.
 * Deterministic from the seed; in lap order.
 */
export function legendMoments(model: RaceModel, seed: number): DecisionMoment[] {
  const removed = removedEvents(model);
  const inRemoved = (lap: number) =>
    removed.some((e) => e.lap <= lap && lap < e.lap + (e.laps ?? 1));
  const moments = model.decisionMoments.filter(
    (m) => !((m.trigger === 'SC' || m.trigger === 'VSC') && inRemoved(m.lap)),
  );
  const first = model.race.takeoverLap + 1;
  const last = model.race.laps - 1;
  for (const e of drawnEvents(model, legendEvents(model, seed))) {
    if (e.type !== 'SC' && e.type !== 'VSC') continue;
    const lap = e.lap;
    if (lap < first || lap > last || moments.some((m) => Math.abs(m.lap - lap) < MIN_SPACING)) {
      continue;
    }
    moments.push({
      id: `legend-${e.type.toLowerCase()}-${lap}`,
      lap,
      trigger: e.type,
      target: model.decisionMoments[0]?.target ?? DEFAULT_TARGET,
      options: triggerOptions(model, lap, e.type),
      realOptionId: null,
    });
  }
  return moments.sort((a, b) => a.lap - b.lap);
}

/** The plan 5.3 verdict for a graded moment. */
export function verdictFor(grade: MomentGrade): Verdict {
  const sorted = grade.options.map((o) => o.probability * 100).sort((a, b) => b - a);
  const best = sorted[0] ?? 0;
  if (sorted.every((p) => best - p <= QUALITY.NO_CHOICE)) return 'no-choice';
  if (best - (sorted[1] ?? 0) > QUALITY.NO_TENSION) return 'no-tension';
  return 'keep';
}

/** Grade every candidate from the real race's state and give each a verdict. */
export function proposeMoments(
  model: RaceModel,
  samples?: number,
  target?: Target,
): ProposedMoment[] {
  return candidateMoments(model).map((c) => {
    // A race can be graded on another goal than beating the rival (e.g. holding P2).
    const m = target ? { ...c, target } : c;
    const grade = gradeMoment(pauseAt(model, m.lap), m.options, m.target, samples);
    return { ...m, grade, verdict: verdictFor(grade) };
  });
}
