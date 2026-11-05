// The race plan in the game (docs/strategy-planner-spec.md): words for a plan, its grade at
// takeover, and the changes the race makes to it (a stop made off-plan, one more lap out, the
// rest of a plan from a lap on). Pure; the session runs it and the screens show it.

import {
  type ClaimedGrade,
  MIN_STINT,
  type MomentGrade,
  PLAN_GRADE_ID,
  PLAN_TARGET,
  type PaceMode,
  type PlanId,
  type RacePlan,
  gradeFromHits,
} from '@boxthislap/sim';
import type { PlanState } from '../state/machine.js';

export const NO_PLAN: PlanState = {
  offered: [],
  chances: {},
  own: null,
  picked: null,
  active: null,
  live: null,
};

const TYRE: Record<string, string> = { SOFT: 'softs', MEDIUM: 'mediums', HARD: 'hards' };
export const tyres = (compound: string) => TYRE[compound] ?? compound.toLowerCase();

export const PACE_WORD: Record<PaceMode, string> = {
  push: 'Push',
  standard: 'Standard',
  manage: 'Manage',
};

/** "No stop", "One stop", "Two stops". */
export function stopsWord(plan: RacePlan): string {
  const n = plan.stops.length;
  return n === 0 ? 'No stop' : n === 1 ? 'One stop' : n === 2 ? 'Two stops' : `${n} stops`;
}

/** "Hards on lap 50, Softs on lap 61" or "Stay out to the flag". */
export function stopsLine(plan: RacePlan): string {
  if (!plan.stops.length) return 'Stay out to the flag';
  return plan.stops.map((s) => `${tyres(s.compound)} on lap ${s.lap}`).join(', ');
}

/** The pace calls worth saying: "manage, then push" ("" when it's standard throughout). */
export function paceLine(plan: RacePlan): string {
  if (plan.pace.every((p) => p === 'standard')) return '';
  const words = plan.pace.map((p) => p.toLowerCase());
  return plan.pace.length === 1 ? (words[0] ?? '') : words.join(', then ');
}

/** What the engineer says when the plan is picked. */
export function planRadio(plan: RacePlan): string {
  const pace = paceLine(plan);
  const how = plan.stops.length
    ? `Box ${plan.stops.map((s) => `lap ${s.lap} for ${tyres(s.compound)}`).join(', then ')}`
    : 'We stay out to the flag';
  return `${how}.${pace ? ` Pace: ${pace}.` : ''}`;
}

/** The ids graded at takeover: the engineer's plans, then the player's own if it was picked. */
function gradedIds(plan: PlanState): PlanId[] {
  const ids = plan.offered.map((p) => p.id);
  return plan.picked?.id === 'own' ? [...ids, 'own'] : ids;
}

/**
 * The plan's grade at takeover (as the server rebuilds it), once every plan it covers has its
 * chance; null before then. Covers the player's own plan only if they picked it.
 */
export function planGrade(plan: PlanState, takeoverLap: number): MomentGrade | null {
  const ids = gradedIds(plan);
  const chances = ids.map((id) => plan.chances[id]);
  if (!ids.length || chances.some((c) => !c)) return null;
  const samples = chances[0]?.samples as number;
  return gradeFromHits(
    takeoverLap,
    ids.map((id) => ({ id, decisions: [] })),
    PLAN_TARGET,
    samples,
    chances.map((c) => c?.hits ?? 0),
  );
}

/** The claim POST /api/runs takes for the plan (sim claimPlanGrade's shape). */
export function planClaim(plan: PlanState, takeoverLap: number): ClaimedGrade | null {
  const grade = planGrade(plan, takeoverLap);
  return grade
    ? { momentId: PLAN_GRADE_ID, probabilities: grade.options.map((o) => o.probability) }
    : null;
}

/** A plan's chance at takeover, 0-1, or null while it's graded. */
export function chanceOf(plan: PlanState, id: PlanId): number | null {
  const c = plan.chances[id];
  return c ? c.hits / c.samples : null;
}

/** The rest of a plan after `lap` has run: the stops still to come and their stints' pace. */
export function remainder(plan: RacePlan, lap: number): RacePlan {
  const done = plan.stops.filter((s) => s.lap <= lap).length;
  return { ...plan, stops: plan.stops.slice(done), pace: plan.pace.slice(done) };
}

/**
 * The plan after a stop the plan didn't make (the BOX button, a moment's call, a puncture):
 * a planned stop within a few laps of it is the one it replaced, and goes (its stint's pace
 * goes with it; the pace planned after the stop stays).
 */
export function dropNear(plan: RacePlan, lap: number, within = 4): RacePlan {
  const i = plan.stops.findIndex((s) => Math.abs(s.lap - lap) <= within);
  if (i < 0) return plan;
  return {
    ...plan,
    stops: plan.stops.filter((_, k) => k !== i),
    pace: plan.pace.filter((_, k) => k !== i),
  };
}

/** The plan with the stop on `lap` one lap later, or null if it can't go later. */
export function delayStop(plan: RacePlan, lap: number, raceLaps: number): RacePlan | null {
  const i = plan.stops.findIndex((s) => s.lap === lap);
  if (i < 0) return null;
  const next = plan.stops[i + 1];
  if (lap + 1 >= raceLaps || (next && next.lap - (lap + 1) < MIN_STINT)) return null;
  return {
    ...plan,
    stops: plan.stops.map((s, k) => (k === i ? { ...s, lap: lap + 1 } : s)),
  };
}

/** True if both plans make the same stops at the same pace. */
export function samePlan(a: RacePlan, b: RacePlan): boolean {
  return JSON.stringify([a.stops, a.pace]) === JSON.stringify([b.stops, b.pace]);
}
