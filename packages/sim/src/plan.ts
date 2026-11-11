// Race plans (docs/strategy-planner-spec.md): the shape of a plan, the check every logged plan
// passes, and the calls a plan makes. No sim state here (sim.ts validates plans with it); the
// engineer's plans and their grading are in planner.ts. In a refuelling race every planned
// stop carries its fill (refuel.ts checkFill), and its pit call takes it.

import { checkFill } from './refuel.js';
import type { Decision, PaceMode, PlanId, RaceModel, RacePlan } from './types.js';

export const PLAN_IDS: readonly PlanId[] = ['a', 'b', 'c', 'own'];
export const PACES: readonly PaceMode[] = ['push', 'standard', 'manage'];
/** The most stops a plan may make. */
export const MAX_PLAN_STOPS = 3;
/** Laps between two planned stops, at least (a stint of one lap is no stint). */
export const MIN_STINT = 3;

/** Throws unless `plan` is a well-formed plan for laps after `fromLap`. */
export function validatePlan(model: RaceModel, plan: RacePlan, fromLap: number): void {
  if (!PLAN_IDS.includes(plan.id)) throw new Error(`unknown plan ${String(plan.id)}`);
  if (!Array.isArray(plan.stops) || !Array.isArray(plan.pace)) throw new Error('bad plan');
  if (plan.stops.length > MAX_PLAN_STOPS) throw new Error('too many planned stops');
  if (plan.pace.length !== plan.stops.length + 1) throw new Error('one pace per stint');
  if (plan.pace.some((p) => !PACES.includes(p))) throw new Error('unknown plan pace');
  let last = fromLap;
  for (const s of plan.stops) {
    if (!Number.isInteger(s.lap) || s.lap <= last || s.lap >= model.race.laps) {
      throw new Error(`planned stop on lap ${s.lap}`);
    }
    if (last > fromLap && s.lap - last < MIN_STINT) throw new Error('planned stops too close');
    if (!model.compounds[s.compound]) throw new Error(`unknown compound ${s.compound}`);
    checkFill(model, s.fill);
    last = s.lap;
  }
}

/** The lap each stint starts on: the lap after `fromLap`, then each stop's out-lap. */
export function stintStarts(plan: RacePlan, fromLap: number): number[] {
  return [fromLap + 1, ...plan.stops.map((s) => s.lap + 1)];
}

/**
 * The calls a plan makes from the lap after `fromLap`: a pit call on each stop's in-lap and a
 * pace call where a stint's pace differs from the one before (`pace` is the car's pace now).
 * A stop's fill (a refuelling race) rides on its pit call.
 */
export function planCalls(plan: RacePlan, fromLap: number, pace: PaceMode): Decision[] {
  const calls: Decision[] = [];
  const starts = stintStarts(plan, fromLap);
  let current = pace;
  plan.pace.forEach((p, i) => {
    if (p !== current)
      calls.push({ lap: starts[i] as number, kind: 'mode', key: 'pace', value: p });
    current = p;
  });
  for (const s of plan.stops) {
    calls.push({
      lap: s.lap,
      kind: 'pit',
      compound: s.compound,
      ...(s.fill !== undefined ? { fill: s.fill } : {}),
    });
  }
  return calls.sort((a, b) => a.lap - b.lap);
}
