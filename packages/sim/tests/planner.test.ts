// The strategy planner (docs/strategy-planner-spec.md): the engineer's plans, the calls a plan
// makes, plans as graded options, and a run's plan verified and scored like a moment.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import bahrainJson from '../../../data/races/bahrain-2021.json';
import { gradeMoment } from '../src/grade.js';
import { planCalls, validatePlan } from '../src/plan.js';
import { PLAN_TARGET, enginePlans, planOption } from '../src/planner.js';
import {
  type Run,
  classify,
  decide,
  initRun,
  isFinished,
  ruleSatisfied,
  stepLap,
} from '../src/sim.js';
import type { Decision, RaceModel, RacePlan } from '../src/types.js';
import { VerifyError, claimPlanGrade, verifyRun } from '../src/verify.js';

const abu = { ...(abuJson as unknown as RaceModel), decisionMoments: [] };
const bahrain = { ...(bahrainJson as unknown as RaceModel), decisionMoments: [] };
const SAMPLES = 40;

/** A live run at takeover with `plan` logged and its calls made as their laps come. */
function playPlan(model: RaceModel, plan: RacePlan, seed = model.race.seed): Run {
  const run = initRun(model, seed, { decisions: [] });
  const lap = model.race.takeoverLap;
  decide(run, { lap: lap + 1, kind: 'plan', ...plan });
  const calls = planCalls(plan, lap, 'standard');
  while (!isFinished(run)) {
    // The game makes each call on the lap before it (the heads-up).
    for (const c of calls.filter((d) => d.lap === run.state.lap + 1)) decide(run, c);
    stepLap(run);
  }
  return run;
}

function reasonFor(model: RaceModel, decisions: unknown, claimed?: unknown): string {
  try {
    verifyRun(model, model.race.seed, decisions, SAMPLES, claimed);
  } catch (e) {
    if (e instanceof VerifyError) return e.code;
    throw e;
  }
  return 'ok';
}

describe('the engineer’s plans', () => {
  it('offers up to three legal, different plans, the same every time', () => {
    for (const model of [abu, bahrain]) {
      const run = initRun(model, 1, { decisions: [] });
      const plans = enginePlans(run);
      expect(plans.length).toBeGreaterThanOrEqual(2);
      expect(plans.length).toBeLessThanOrEqual(3);
      expect(plans.map((p) => p.id)).toEqual(['a', 'b', 'c'].slice(0, plans.length));
      expect(enginePlans(initRun(model, 1, { decisions: [] }))).toEqual(plans);
      const car = run.state.cars[model.userSide] as NonNullable<Run['state']['cars'][string]>;
      for (const p of plans) {
        expect(() => validatePlan(model, p, model.race.takeoverLap)).not.toThrow();
        const used = new Set([
          ...car.compoundsUsed,
          car.compound,
          ...p.stops.map((s) => s.compound),
        ]);
        expect(ruleSatisfied(car) || used.size >= 2).toBe(true);
      }
      // Fewest stops first.
      const stops = plans.map((p) => p.stops.length);
      expect([...stops].sort()).toEqual(stops);
    }
  });

  it('a plan’s calls: a pit call on each in-lap, a pace call where the pace changes', () => {
    const plan: RacePlan = {
      id: 'own',
      stops: [{ lap: 40, compound: 'HARD' }],
      pace: ['manage', 'push'],
    };
    expect(planCalls(plan, 34, 'standard')).toEqual([
      { lap: 35, kind: 'mode', key: 'pace', value: 'manage' },
      { lap: 40, kind: 'pit', compound: 'HARD' },
      { lap: 41, kind: 'mode', key: 'pace', value: 'push' },
    ]);
    expect(planCalls({ id: 'a', stops: [], pace: ['standard'] }, 34, 'standard')).toEqual([]);
  });

  it('rejects malformed plans', () => {
    const lap = abu.race.takeoverLap;
    const bad: unknown[] = [
      { id: 'z', stops: [], pace: ['standard'] },
      { id: 'own', stops: [], pace: [] },
      { id: 'own', stops: [], pace: ['flat-out'] },
      { id: 'own', stops: [{ lap, compound: 'HARD' }], pace: ['standard', 'standard'] },
      { id: 'own', stops: [{ lap: abu.race.laps, compound: 'HARD' }], pace: ['standard', 'push'] },
      { id: 'own', stops: [{ lap: 40, compound: 'WET' }], pace: ['standard', 'push'] },
      {
        id: 'own',
        stops: [
          { lap: 40, compound: 'HARD' },
          { lap: 41, compound: 'SOFT' },
        ],
        pace: ['standard', 'standard', 'push'],
      },
    ];
    for (const p of bad) expect(() => validatePlan(abu, p as RacePlan, lap)).toThrow();
  });

  it('a plan is graded as itself: a no-stop plan never gains a stop', () => {
    const run = initRun(abu, 3, { decisions: [] });
    const noStop = enginePlans(run).find((p) => p.stops.length === 0);
    expect(noStop).toBeDefined();
    const grade = gradeMoment(run, [planOption(run, noStop as RacePlan)], PLAN_TARGET, 5);
    expect(grade.options[0]?.id).toBe(noStop?.id);
    // Played out: the user's car never boxes.
    const played = playPlan(abu, noStop as RacePlan, 3);
    const car = played.state.cars[abu.userSide];
    const start = initRun(abu, 3, { decisions: [] }).state.cars[abu.userSide];
    expect(car?.strategy).toEqual([]);
    expect(car?.compound).toBe(start?.compound);
    expect(car?.tyreAge).toBe((start?.tyreAge as number) + abu.race.laps - abu.race.takeoverLap);
  });
});

describe('a run’s plan, verified', () => {
  const run = initRun(bahrain, bahrain.race.seed, { decisions: [] });
  const offered = enginePlans(run);
  const picked = offered[1] as RacePlan;

  it('grades the plan and counts it as a call in the score; claims give the same', () => {
    const played = playPlan(bahrain, picked);
    const full = verifyRun(bahrain, bahrain.race.seed, played.decisions, SAMPLES);
    expect(full.plan?.chosen).toBe(picked.id);
    expect(full.plan?.grade.options.map((o) => o.id)).toEqual(offered.map((p) => p.id));
    expect(full.score.calls).toHaveLength(1);
    expect(full.result).toEqual(classify(played));
    const claimed = verifyRun(bahrain, bahrain.race.seed, played.decisions, SAMPLES, [
      claimPlanGrade(full.plan?.grade as never),
    ]);
    expect(claimed.plan).toEqual(full.plan);
    expect(claimed.score).toEqual(full.score);
  });

  it('grades a plan the player built alongside the engineer’s', () => {
    const own: RacePlan = {
      id: 'own',
      stops: [{ lap: 30, compound: 'HARD' }],
      pace: ['standard', 'manage'],
    };
    const played = playPlan(bahrain, own);
    const v = verifyRun(bahrain, bahrain.race.seed, played.decisions, SAMPLES);
    expect(v.plan?.grade.options.map((o) => o.id)).toEqual([...offered.map((p) => p.id), 'own']);
    expect(v.plan?.chosen).toBe('own');
  });

  it('rejects an engineer’s plan that isn’t the one offered, and a second plan', () => {
    const forged: RacePlan = { ...picked, stops: [{ lap: 30, compound: 'HARD' }] };
    expect(reasonFor(bahrain, playPlan(bahrain, forged).decisions)).toBe('bad-answer');
    const lap = bahrain.race.takeoverLap;
    const twice: Decision[] = [
      { lap: lap + 1, at: lap, kind: 'plan', ...picked },
      { lap: lap + 2, at: lap, kind: 'plan', ...picked },
    ];
    expect(reasonFor(bahrain, twice)).toBe('bad-answer');
    const late: Decision[] = [{ lap: lap + 3, at: lap + 2, kind: 'plan', ...picked }];
    expect(reasonFor(bahrain, late)).toBe('bad-answer');
  });

  it('a claim must grade the plan, with a chance per plan', () => {
    const played = playPlan(bahrain, picked);
    expect(reasonFor(bahrain, played.decisions, [])).toBe('bad-grades');
    expect(
      reasonFor(bahrain, played.decisions, [
        { momentId: 'plan', probabilities: [0.5, 0.5, 0.5, 0.5] },
      ]),
    ).toBe('bad-grades');
    expect(
      reasonFor(bahrain, played.decisions, [{ momentId: 'plan', probabilities: [0.333] }]),
    ).toBe('bad-grades');
  });

  it('a run without a plan still verifies, with no plan grade', () => {
    const r = initRun(bahrain, bahrain.race.seed, { decisions: [] });
    while (!isFinished(r)) stepLap(r);
    const v = verifyRun(bahrain, bahrain.race.seed, r.decisions, SAMPLES);
    expect(v.plan).toBeNull();
  });
});
