// Decision moments (perfection spec D3/D4; Implementation Plan 1.5 and 5.3).
//
// A moment is where the game pauses for a call: the lap, what triggered it, the target the
// call is graded on, 3-4 options (each a list of calls for that lap) and which option the
// real team took. proposeMoments() finds candidates from the race's triggers, grades every
// option from the real race's state at that lap, and keeps only genuine dilemmas. A human
// still picks the final 2-4 (plan 1.5); approved moments go in data/moments/<race>.json.

import { type GradeOption, type MomentGrade, type Target, gradeMoment } from './grade.js';
import { type Run, initRun, realDecisions, stepLap, tyreLife } from './sim.js';
import type { Decision, RaceModel } from './types.js';

/** `takeover`: the race plan when the player takes over (feedback round 2). */
export type MomentTrigger = 'SC' | 'VSC' | 'rivalPit' | 'undercut' | 'cliff' | 'takeover';

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
  SC: 0,
  VSC: 1,
  rivalPit: 2,
  undercut: 3,
  cliff: 4,
  takeover: 5,
};
/** Laps before the rival's real stop at which the undercut window is offered. */
const UNDERCUT_LEAD = 2;
/** Laps before the user's tyres reach the cliff at which that moment is offered. */
const CLIFF_LEAD = 2;

/** The real race paused just before `lap`: the user follows the real team's calls so far. */
export function pauseAt(model: RaceModel, lap: number): Run {
  const before = realDecisions(model).filter((d) => d.lap < lap);
  const run = initRun(model, model.race.seed, { decisions: before });
  while (run.state.lap < lap - 1) stepLap(run);
  return run;
}

function stayOut(): MomentOption {
  return { id: 'stay-out', label: 'Stay out', decisions: [] };
}

function boxOptions(model: RaceModel, lap: number): MomentOption[] {
  return Object.keys(model.compounds).map((compound) => ({
    id: `box-${compound.toLowerCase()}`,
    label: `Box for ${compound.toLowerCase()}s`,
    decisions: [{ lap, kind: 'pit', compound } as Decision],
  }));
}

function modeOption(lap: number, value: 'push' | 'manage'): MomentOption {
  return {
    id: value,
    label: value === 'push' ? 'Stay out and push' : 'Stay out and manage the tyres',
    decisions: [{ lap, kind: 'mode', key: 'pace', value }],
  };
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
  const found: Array<{ lap: number; trigger: MomentTrigger }> = [];

  for (const e of model.events) {
    if ((e.type === 'SC' || e.type === 'VSC') && e.lap >= first) {
      found.push({ lap: e.lap, trigger: e.type });
    }
  }
  const rival = model.drivers.find((d) => d.code === model.rival);
  for (const stop of rival?.realStrategy ?? []) {
    found.push({ lap: stop.lap - 1, trigger: 'rivalPit' });
    found.push({ lap: stop.lap - 1 - UNDERCUT_LEAD, trigger: 'undercut' });
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
  for (const { lap, trigger } of found
    .filter((f) => f.lap >= first && f.lap <= last)
    .sort((a, b) => PRIORITY[a.trigger] - PRIORITY[b.trigger] || a.lap - b.lap)) {
    if (moments.some((m) => Math.abs(m.lap - lap) < MIN_SPACING)) continue;
    const box = boxOptions(model, lap);
    const extra =
      trigger === 'cliff'
        ? modeOption(lap, 'manage')
        : trigger === 'SC' || trigger === 'VSC'
          ? null
          : modeOption(lap, 'push');
    const options = [stayOut(), ...box.slice(0, extra ? 2 : 3), ...(extra ? [extra] : [])];
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
