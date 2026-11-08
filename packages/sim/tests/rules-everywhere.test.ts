// Era rules in every part of play (owner's decisions, Nov 7, 2026):
// - no made-up SC or VSC before 1993: live crashes and grader playouts obey it, as Legend does;
// - no tyre changes (2005): the engineer's plans and the moments' options never change a dry
//   set, so grading them doesn't throw;
// - Legend in grading jobs: a Legend run's GradeJob replays with Legend's safety cars.
// Race files are re-tagged in memory (no pre-1993 or 2005 race is built yet).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import canadaJson from '../../../data/races/canada-2024.json';
import { authorMoments } from '../scripts/authoring.js';
import { countHits, gradeJob, gradeMoment, runFromJob, runGradeJob } from '../src/grade.js';
import { drawnEvents, legendEvents } from '../src/legend.js';
import { candidateMoments, legendMoments, pitCompounds } from '../src/moments.js';
import { PLAN_TARGET, enginePlans, planOption } from '../src/planner.js';
import { rivalGradeJob } from '../src/rivals/expert.js';
import { illegalPitCompound } from '../src/rules.js';
import { type Run, forkRun, initRun, isFinished, stepLap, validateDecisions } from '../src/sim.js';
import type { RaceModel, RaceRules } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const canada = canadaJson as unknown as RaceModel;
const tagged = (model: RaceModel, id: string, rules?: RaceRules): RaceModel => ({
  ...model,
  race: { ...model.race, id },
  ...(rules ? { rules } : {}),
});
/** As a 2005 race would be built: its moments authored by the recipe, none hand-copied. */
const as2005 = (model: RaceModel, id: string, rules: RaceRules): RaceModel => ({
  ...tagged(model, id, rules),
  decisionMoments: [],
});

/** Neutralizations a run has beyond the race's real ones. */
const madeUp = (run: Run, model: RaceModel) =>
  run.events.length - initRun(model, run.seed, { decisions: [] }).events.length;

describe('no made-up safety car before 1993, in live play and grading', () => {
  const y1990 = tagged(abu, 'abu-dhabi-1990');
  const y1993 = tagged(abu, 'abu-dhabi-1993');

  it("a live crash brings out no SC or VSC; the race's real ones stay", () => {
    const play = (model: RaceModel, seed: number) => {
      const run = initRun(model, seed, { decisions: [] });
      while (!isFinished(run)) stepLap(run);
      return run;
    };
    // Seeds whose crash brings out a SC or VSC from 1993 (crashes are rare: ~1 race in 30).
    const seeds = Array.from({ length: 400 }, (_, i) => i).filter(
      (s) => madeUp(play(y1993, s), y1993) > 0,
    );
    expect(seeds.length).toBeGreaterThan(2);
    const incidents = (r: Run) => r.notes.filter((n) => n.kind === 'incident');
    for (const seed of seeds) {
      const old = play(y1990, seed);
      expect(madeUp(old, y1990), `seed ${seed}`).toBe(0);
      expect(old.events.length).toBe(initRun(y1990, seed, { decisions: [] }).events.length);
      // The draw is still taken, so the incidents up to the crash (who, when) are the same.
      const crash = incidents(play(y1993, seed)).find((n) => n.detail === 'crash');
      const upTo = (r: Run) => incidents(r).filter((n) => n.lap <= (crash?.lap as number));
      expect(upTo(old)).toEqual(upTo(play(y1993, seed)));
    }
  });

  it('a grader playout draws none after the decision lap; the real ones before it stay', () => {
    let modern = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const [model, old] of [
        [y1990, true],
        [y1993, false],
      ] as const) {
        const live = initRun(model, seed, { decisions: [] });
        while (live.state.lap < 40) stepLap(live);
        const fork = forkRun(live, seed, [], { blindAfter: 40 });
        const later = fork.events.filter((e) => e.lap > 40).length;
        if (old) {
          expect(later, `seed ${seed}`).toBe(0);
          expect(fork.events).toEqual(live.events.filter((e) => e.lap <= 40));
        } else modern += later;
      }
    }
    expect(modern).toBeGreaterThan(0);
  });
});

describe('no tyre changes (2005): plans and options only refuel', () => {
  // A 2005-tagged race, with 2005's rules (race_rules.rules_for_year(2005), refuelling as 4.2).
  const rules2005: RaceRules = {
    twoCompound: false,
    tyreChanges: false,
    pitLaneClosedUnderSC: false,
    vsc: false,
    drs: false,
    ers: 'none',
  };
  const races: Array<[string, RaceModel]> = [
    ['dry, no refuelling', as2005(abu, 'abu-dhabi-2005', rules2005)],
    ['dry, refuelling', as2005(abu, 'abu-dhabi-2005', { ...rules2005, refuelling: true })],
    ['wet (Canada)', as2005(canada, 'canada-2005', rules2005)],
  ];

  it.each(races)('%s: every engineer plan is a legal call and grades', (_name, model) => {
    const run = initRun(model, 1, { decisions: [], incidents: false });
    const plans = enginePlans(run);
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      for (const s of plan.stops) expect(illegalPitCompound(model, s.compound)).toBeNull();
      expect(() =>
        validateDecisions(model, [{ ...plan, kind: 'plan', lap: model.race.takeoverLap + 1 }]),
      ).not.toThrow();
    }
    const grade = gradeMoment(
      run,
      plans.map((p) => planOption(run, p)),
      PLAN_TARGET,
      4,
    );
    expect(grade.options.map((o) => o.id)).toEqual(plans.map((p) => p.id));
  });

  it('a dry plan stop names the set the car is on (it keeps it and refuels)', () => {
    const model = races[0]?.[1] as RaceModel;
    const on = model.drivers.find((d) => d.code === model.userSide)?.stateAtTakeover.compound;
    expect(pitCompounds(model)).toEqual(
      Object.keys(model.compounds).filter((c) => c === on || c === 'INTERMEDIATE' || c === 'WET'),
    );
    const run = initRun(model, 1, { decisions: [], incidents: false });
    const stops = enginePlans(run).flatMap((p) => p.stops);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((s) => s.compound === on)).toBe(true);
  });

  it.each(races)("%s: every moment's options are legal calls and grade", (_name, model) => {
    const moments = [...candidateMoments(model), ...legendMoments(model, 3)];
    expect(moments.length).toBeGreaterThan(0);
    for (const m of moments) {
      for (const o of m.options) {
        expect(() => validateDecisions(model, o.decisions), `${m.id} ${o.id}`).not.toThrow();
      }
    }
    const m = moments[0];
    if (!m) return;
    const run = initRun(model, 1, { decisions: [], incidents: false });
    while (run.state.lap < m.lap - 1) stepLap(run);
    expect(() => gradeMoment(run, m.options, m.target, 2)).not.toThrow();
  });

  it('the authoring recipe offers only legal calls', () => {
    const model = races[1]?.[1] as RaceModel;
    const authored = authorMoments(model, 2);
    expect(authored.length).toBeGreaterThan(0);
    for (const m of authored) {
      for (const o of m.options) {
        expect(() => validateDecisions(model, o.decisions), `${m.id} ${o.id}`).not.toThrow();
      }
    }
  });

  it('box options say the set is kept', () => {
    const model = races[0]?.[1] as RaceModel;
    const box = candidateMoments(model)
      .flatMap((m) => m.options)
      .filter((o) => o.id.startsWith('box-') && !/inter|wet/.test(o.id));
    expect(box.length).toBeGreaterThan(0);
    expect(box.every((o) => o.label.startsWith('Box, keep the'))).toBe(true);
  });
});

describe('Legend in grading jobs', () => {
  /** A Legend run of Abu Dhabi paused two laps after its first drawn period. */
  function legendRun(): Run {
    for (let seed = 1; seed < 200; seed++) {
      const drawn = drawnEvents(abu, legendEvents(abu, seed)).filter(
        (e) => e.lap < abu.race.laps - 6,
      );
      const first = drawn[0];
      if (!first) continue;
      const run = initRun(abu, seed, { decisions: [], legend: true });
      while (run.state.lap < first.lap + 1) stepLap(run);
      return run;
    }
    throw new Error('no Legend seed draws a period');
  }

  it('the job carries legend, and rebuilds the run with its safety cars', () => {
    const run = legendRun();
    const options = [
      { id: 'stay-out', decisions: [] },
      {
        id: 'box',
        decisions: [{ lap: run.state.lap + 1, kind: 'pit' as const, compound: 'HARD' }],
      },
    ];
    const job = gradeJob(run, options, { kind: 'beat-rival' }, 6);
    expect(job.legend).toBe(true);
    // Plain JSON, as a Web Worker receives it.
    const sent = JSON.parse(JSON.stringify(job)) as typeof job;
    const rebuilt = runFromJob(sent);
    expect(rebuilt.legend).toBe(true);
    expect(rebuilt.events).toEqual(run.events);
    expect(rebuilt.state).toEqual(run.state);
    expect(runGradeJob(sent).hits).toEqual(countHits(run, options, { kind: 'beat-rival' }, 0, 6));
    // Without it the job would replay the real race's safety cars instead.
    const { legend: _, ...withoutLegend } = sent;
    expect(runFromJob(withoutLegend).events).not.toEqual(run.events);
  });

  it('a run without Legend sends no legend field (jobs are as before)', () => {
    const run = initRun(abu, 1, { decisions: [] });
    while (run.state.lap < 40) stepLap(run);
    expect(gradeJob(run, [{ id: 'stay-out', decisions: [] }], { kind: 'win' })).not.toHaveProperty(
      'legend',
    );
  });

  it("an Expert rival's grade job carries it too", () => {
    let job: ReturnType<typeof rivalGradeJob> | null = null;
    for (let seed = 1; seed < 40 && !job; seed++) {
      const run = initRun(abu, seed, {
        decisions: [],
        legend: true,
        rivalPolicy: 'expert',
        rivalGrading: 'deferred',
      });
      while (!isFinished(run) && !run.rival?.pending) stepLap(run);
      if (run.rival?.pending) job = rivalGradeJob(run, 2);
    }
    expect(job?.legend).toBe(true);
  });
});
