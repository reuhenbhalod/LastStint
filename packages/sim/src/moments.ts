// Decision moments (perfection spec D3/D4; Implementation Plan 1.5 and 5.3).
//
// A moment is where the game pauses for a call: the lap, what triggered it, the target the
// call is graded on, 3-4 options (each a list of calls for that lap) and which option the
// real team took. proposeMoments() finds candidates from the race's triggers, grades every
// option from the real race's state at that lap, and keeps only genuine dilemmas. A human
// still picks the final 2-4 (plan 1.5); approved moments go in data/moments/<race>.json.

import { faultsOf } from './faults.js';
import { type GradeOption, type MomentGrade, type Target, gradeMoment } from './grade.js';
import { type Run, cleanLap, initRun, realDecisions, stepLap, tyreLife } from './sim.js';
import type { CarState, Decision, RaceModel } from './types.js';
import { wetnessOn } from './weather.js';

/** What brought a moment on (the race plan at takeover is the strategy planner's, not a
 * moment). `rain` / `drying`: the track turning wet or drying out (weather spec). `fault`: a
 * fault struck the user's car (faults.ts): nurse it or push, pit now or limp on. Red flags
 * (eras build plan 4.3): `RED`, the tyres to fit in the stoppage for the restart (free);
 * `preRed`, the lap before it, boxing now (paid) or staying out. */
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
  | 'fault';

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
  if (user && first) user.strategy.push({ ...first });
  while (run.state.lap < lap - 1) stepLap(run);
  return run;
}

function stayOut(): MomentOption {
  return { id: 'stay-out', label: 'Stay out', decisions: [] };
}

function boxOptions(
  model: RaceModel,
  lap: number,
  compounds = Object.keys(model.compounds),
  label = (tyre: string) => `Box for ${tyre}s`,
): MomentOption[] {
  return compounds.map((compound) => ({
    id: `box-${compound.toLowerCase()}`,
    label: label(compound.toLowerCase()),
    decisions: [{ lap, kind: 'pit', compound } as Decision],
  }));
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
  const match = options.find((o) =>
    o.decisions.some(
      (d) => d.kind === 'pit' && call.kind === 'pit' && d.compound === call.compound,
    ),
  );
  return match?.id ?? null;
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
  // A fault on the user's car: the call comes on the lap after it struck.
  const untilStop = new Map<number, boolean>();
  for (const e of faultsOf(model.events, model.userSide)) {
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

  const moments: DecisionMoment[] = [];
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
    const options = [stay, ...box.slice(0, extra ? 2 : 3), ...(extra ? [extra] : [])];
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
