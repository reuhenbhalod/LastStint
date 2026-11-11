// The rival policies as decided Nov 7 (eras spec §7 "Rival policies"; eras build plan 9.1):
// every rule function against the Python reference's vectors (parity), each policy's
// behaviour in a live run, Expert's grader through the background-worker job path, and the
// server's check of the rival's claimed choices.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gradeJob, gradeMoment, runFromJob } from '../src/grade.js';
import { regradeRivalPoints, replayWithRivalClaims } from '../src/rivals/claims.js';
import {
  gradeRivalMoment,
  mergeRivalGradeJobs,
  rivalGradeJob,
  runRivalGradeJob,
} from '../src/rivals/expert.js';
import {
  COVER_WINDOWS,
  EXPERT_SAMPLES,
  RivalPolicyError,
  coverWindow,
  playoutPolicy,
} from '../src/rivals/policy.js';
import {
  type RivalChoice,
  RivalClaimError,
  resolveRivalDecision,
  rivalChoices,
} from '../src/rivals/react.js';
import {
  boxNowCompound,
  decisionReasons,
  latestStop,
  overcutLap,
  planTime,
  rivalOptions,
  sameLapCover,
  wetSwitch,
} from '../src/rivals/rules.js';
import {
  COVER_WINDOW,
  DEFAULT_MODES,
  type Run,
  type RunOptions,
  classify,
  forkRun,
  initRun,
  isFinished,
  stepLap,
  tyreLife,
} from '../src/sim.js';
import type { CarState, Compound, Decision, FlagState, PitStop, RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = <T>(...path: string[]): T =>
  JSON.parse(readFileSync(join(repo, ...path), 'utf8')) as T;
const race = (id: string) => readJson<RaceModel>('data', 'races', `${id}.json`);

function carFor(
  model: RaceModel,
  code: string,
  compound: Compound,
  tyreAge: number,
  strategy: PitStop[] = [],
): CarState {
  const d = model.drivers.find((x) => x.code === code);
  if (!d) throw new Error(`no driver ${code}`);
  return {
    code,
    team: d.team,
    basePace: d.basePace,
    noise: d.noise,
    ...(d.wetPace ? { wetPace: d.wetPace } : {}),
    compound,
    tyreAge,
    tyreWear: tyreAge,
    compoundsUsed: [compound],
    totalTime: 0,
    strategy,
    pittedThisLap: false,
    retired: false,
    retiredLap: null,
    modes: { ...DEFAULT_MODES },
  };
}

type Flag = Exclude<FlagState, 'green'>;
interface RuleCase {
  lap: number;
  compound?: Compound;
  tyreAge?: number;
  strategy?: PitStop[];
  known?: Record<string, Flag>;
  planTime?: number;
  latestStop?: number;
  overcutLap?: number | null;
  wetSwitch?: [Compound | null, Compound | null];
  boxNow?: string | null;
  boxNowPlanned?: string | null;
  cover?: {
    strategy: PitStop[];
    gap: number;
    userTo: string;
    window: [string | null, string | null];
    underSc: string | null;
  };
}
interface RuleVectors {
  coverWindows: Record<string, number>;
  races: Record<
    string,
    {
      life: Record<string, number>;
      cases: RuleCase[];
      wet: Array<{
        lap: number;
        compound: Compound;
        tyreAge: number;
        switch: [Compound | null, Compound | null];
      }>;
    }
  >;
  reasons: Array<{
    args: [number, number, boolean, Flag | null, Flag | null, boolean, boolean];
    reasons: string[];
  }>;
  options: Array<{
    args: [number, number, PitStop[], PitStop[], string | null];
    options: Array<{ id: string; stops: PitStop[] }>;
  }>;
}

const vectors = readJson<RuleVectors>('pipeline', 'tests', 'fixtures', 'rival_rules.json');

describe('rule functions (parity with pipeline rival_policy.py)', () => {
  it('cover windows: Standard 4, Standard+ and up 7', () => {
    expect(COVER_WINDOWS).toEqual(vectors.coverWindows);
    expect(coverWindow('standard')).toBe(COVER_WINDOW);
    expect(coverWindow('standard-plus')).toBe(COVER_WINDOW + 3);
    expect(playoutPolicy('expert')).toBe('smart');
    expect(playoutPolicy('smart')).toBe('smart');
    expect(EXPERT_SAMPLES).toBe(100);
  });

  it.each(Object.keys(vectors.races))('%s: plan time, overcut, wet switch, box now', (id) => {
    const model = race(id);
    const v = vectors.races[id];
    if (!v) throw new Error(id);
    for (const [c, life] of Object.entries(v.life))
      expect(tyreLife(model.compounds[c] as never), c).toBe(life);
    let checked = 0;
    for (const c of v.cases) {
      const where = `${id} lap ${c.lap}`;
      if (c.cover) {
        const car = carFor(model, model.rival, 'MEDIUM', 5, c.cover.strategy);
        const at = { lap: c.lap, gap: c.cover.gap, userStop: { to: c.cover.userTo } };
        [4, 7].forEach((window, k) =>
          expect(sameLapCover(model, car, { ...at, nextFlag: undefined, window }), where).toBe(
            c.cover?.window[k],
          ),
        );
        expect(sameLapCover(model, car, { ...at, nextFlag: 'sc', window: 7 })).toBe(
          c.cover.underSc,
        );
        continue;
      }
      const strategy = c.strategy ?? [];
      const car = carFor(model, model.rival, c.compound as Compound, c.tyreAge as number, strategy);
      const known = new Map(Object.entries(c.known ?? {}).map(([k, f]) => [Number(k), f]));
      expect(planTime(model, car, c.lap, strategy, known), where).toBeCloseTo(
        c.planTime as number,
        6,
      );
      expect(latestStop(model, car, c.lap), where).toBe(c.latestStop);
      expect(overcutLap(model, car, c.lap, known), where).toBe(c.overcutLap);
      expect([wetSwitch(model, car, c.lap, 0), wetSwitch(model, car, c.lap, 1)], where).toEqual(
        c.wetSwitch,
      );
      const bare = { ...car, strategy: [] };
      expect(boxNowCompound(model, bare, c.lap, null, known), where).toBe(c.boxNow);
      expect(boxNowCompound(model, car, c.lap, null), where).toBe(c.boxNowPlanned);
      checked++;
    }
    for (const w of v.wet) {
      const car = carFor(model, model.rival, w.compound, w.tyreAge);
      expect([wetSwitch(model, car, w.lap, 0), wetSwitch(model, car, w.lap, 1)]).toEqual(w.switch);
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('decision reasons', () => {
    for (const { args, reasons } of vectors.reasons) {
      const [lap, laps, userStopsNext, flagNow, flagNext, rivalStopsNext, wet] = args;
      expect(
        decisionReasons({
          lap,
          laps,
          userStopsNext,
          flagNow: flagNow ?? undefined,
          flagNext: flagNext ?? undefined,
          rivalStopsNext,
          wetSwitch: wet,
        }),
        JSON.stringify(args),
      ).toEqual(reasons);
    }
  });

  it('rival options', () => {
    for (const { args, options } of vectors.options) {
      const [lap, laps, before, after, boxTo] = args;
      expect(rivalOptions({ lap, laps, before, after, boxTo }), JSON.stringify(args)).toEqual(
        options,
      );
    }
  });

  it('the overcut never runs the tyres past their life minus the margin', () => {
    const model = race('spain-2021');
    for (const age of [2, 12, 25, 40]) {
      const car = carFor(model, model.rival, 'MEDIUM', age, [{ lap: 60, to: 'SOFT' }]);
      const to = overcutLap(model, car, 30);
      const life = tyreLife(model.compounds.MEDIUM as never);
      expect(latestStop(model, car, 30)).toBe(31 + Math.max(0, Math.floor(life - 3 - age)));
      if (to !== null) expect(to).toBeLessThanOrEqual(latestStop(model, car, 30));
    }
  });
});

// --- the policies in live play --------------------------------------------------------------

const pit = (lap: number, compound: string): Decision => ({ lap, kind: 'pit', compound });

/** Play to the flag; an Expert rival takes Smart's move at every point (its rules only). */
function playRules(model: RaceModel, calls: Decision[], options: RunOptions = {}): Run {
  const expert = options.rivalPolicy === 'expert';
  const run = initRun(model, 1, {
    decisions: calls,
    incidents: false,
    ...options,
    ...(expert ? { rivalGrading: 'deferred' as const } : {}),
  });
  while (!isFinished(run)) {
    stepLap(run);
    if (run.rival?.pending) resolveRivalDecision(run, 'smart');
  }
  return run;
}
const rivalNotes = (run: Run) =>
  run.notes
    .filter((n) => n.kind === 'rival-cover' || n.kind === 'rival-stays-out')
    .map((n) => ({ lap: n.lap, kind: n.kind, detail: n.detail }));

describe('Standard+', () => {
  const model = race('spain-2021');
  // HAM's next stop is lap 29: the cover on lap 22 is 7 laps before it, outside Standard's 4.
  it('covers a green undercut with its own stop within 7 laps, where Standard doesn’t', () => {
    const calls = [pit(21, 'MEDIUM')];
    expect(rivalNotes(playRules(model, calls, { rivalPolicy: 'standard' }))).toEqual([]);
    expect(rivalNotes(playRules(model, calls, { rivalPolicy: 'standard-plus' }))).toEqual([
      { lap: 22, kind: 'rival-cover', detail: 'MEDIUM' },
    ]);
  });

  it('is Standard inside Standard’s window', () => {
    for (const lap of [24, 26, 38]) {
      const calls = [pit(lap, 'MEDIUM')];
      const a = playRules(model, calls, { rivalPolicy: 'standard' });
      const b = playRules(model, calls, { rivalPolicy: 'standard-plus' });
      expect(b.state).toEqual(a.state);
      expect(b.notes).toEqual(a.notes);
    }
  });
});

describe('Smart', () => {
  it('overcuts an uncovered green stop to its best predicted lap', () => {
    const model = race('spain-2021');
    // The player stops on lap 31; HAM (stopped on 29, next planned 43) can't cover it.
    const calls = [pit(30, 'SOFT')];
    expect(rivalNotes(playRules(model, calls, { rivalPolicy: 'standard-plus' }))).toEqual([]);
    const run = initRun(model, 1, { decisions: calls, incidents: false, rivalPolicy: 'smart' });
    while (run.state.lap < 30) stepLap(run);
    stepLap(run); // lap 31: the stop is charged
    const rival = run.state.cars[model.rival] as CarState;
    // What the rule predicted from the state after the stop.
    expect(run.notes.filter((n) => n.lap === 31)).toEqual([
      { lap: 31, kind: 'rival-stays-out', driver: model.rival, detail: 'until lap 48' },
    ]);
    expect(rival.strategy.filter((s) => s.lap > 31).map((s) => s.lap)).toEqual([48]);
    expect(48).toBeLessThanOrEqual(latestStop(model, rival, 31));
  });

  it('leaves the real team’s stop to the rival’s real answer', () => {
    const model = race('spain-2021');
    const real = model.drivers.find((d) => d.code === model.userSide)?.realStrategy[0];
    if (!real) throw new Error('no real stop');
    const calls = [pit(real.lap - 1, real.to)];
    const a = playRules(model, calls, { rivalPolicy: 'standard-plus' });
    const b = playRules(model, calls, { rivalPolicy: 'smart' });
    expect(b.state).toEqual(a.state);
  });

  it('switches to wet tyres on the crossover lap (Expert one lap before)', () => {
    const model = race('russia-2021');
    const switchLap = (policy: 'standard' | 'smart' | 'expert') => {
      const run = initRun(model, 1, {
        decisions: [],
        incidents: false,
        rivalPolicy: policy,
        ...(policy === 'expert' ? { rivalGrading: 'deferred' as const } : {}),
      });
      let predicted: number | null = null;
      while (!isFinished(run)) {
        const rival = run.state.cars[model.rival] as CarState;
        const lead = policy === 'expert' ? 1 : 0;
        if (predicted === null && wetSwitch(model, rival, run.state.lap, lead))
          predicted = run.state.lap + 1;
        stepLap(run);
        if (run.rival?.pending) resolveRivalDecision(run, 'smart');
        const after = run.state.cars[model.rival] as CarState;
        if (after.pittedThisLap && after.compound === 'INTERMEDIATE')
          return { lap: run.state.lap, predicted };
      }
      return { lap: null, predicted };
    };
    const real = model.drivers.find((d) => d.code === model.rival)?.realStrategy;
    const standard = switchLap('standard');
    const smart = switchLap('smart');
    const expert = switchLap('expert');
    expect(standard.lap).toBe(real?.find((s) => s.to === 'INTERMEDIATE')?.lap);
    // The rule's first firing is the switch, a lap after the decision: the crossover lap.
    expect(smart.lap).toBe(smart.predicted);
    expect(smart.lap).not.toBe(standard.lap);
    expect(expert.lap).toBe((smart.lap as number) - 1);
    // Smart's crossover is the first lap a fresh set of inters is faster than its slicks.
    const run = initRun(model, 1, { decisions: [], incidents: false, rivalPolicy: 'smart' });
    while (run.state.lap < (smart.lap as number) - 2) stepLap(run);
    const before = run.state.cars[model.rival] as CarState;
    expect(wetSwitch(model, before, run.state.lap, 0)).toBeNull();
  });
});

describe('Expert', () => {
  it('covers a green stop on the same lap the player stops', () => {
    const model = race('spain-2021');
    const calls = [pit(23, 'MEDIUM')];
    // Standard+ covers the lap after the user's lap-24 stop; Expert on lap 24 itself.
    expect(rivalNotes(playRules(model, calls, { rivalPolicy: 'smart' }))).toEqual([
      { lap: 24, kind: 'rival-cover', detail: 'MEDIUM' },
    ]);
    const run = playRules(model, calls, { rivalPolicy: 'expert' });
    expect(rivalNotes(run)).toEqual([{ lap: 23, kind: 'rival-cover', detail: 'MEDIUM' }]);
    expect(run.rival?.points[0]?.reasons).toContain('player-stop');
  });

  it('decides at its decision points, and its playouts race Smart rivals', () => {
    const model = race('abu-dhabi-2021');
    const run = initRun(model, 1, { decisions: [pit(40, 'HARD')], rivalPolicy: 'expert' });
    while (!isFinished(run)) stepLap(run);
    const points = run.rival?.points ?? [];
    expect(points.length).toBeGreaterThan(1);
    for (const p of points) {
      expect(p.source).toBe('inline');
      expect(p.options.map((o) => o.id)).toContain(p.chosen);
      expect(p.options[0]?.id).toBe('smart');
      expect(p.reasons.length).toBeGreaterThan(0);
      // The grader's pick: the best chance (the first on a tie).
      const probs = p.options.map((o) => p.probabilities?.[o.id] ?? 0);
      expect(p.probabilities?.[p.chosen]).toBe(Math.max(...probs));
    }
    const reasons = new Set(points.flatMap((p) => p.reasons));
    expect(reasons.has('player-stop')).toBe(true);
    expect(reasons.has('neutral-next')).toBe(true); // the lap-36 VSC and the lap-53 SC
    expect(rivalChoices(run)).toEqual(points.map((p) => ({ lap: p.lap, option: p.chosen })));

    const paused = initRun(model, 1, { decisions: [], rivalPolicy: 'expert' });
    stepLap(paused);
    const playout = forkRun(paused, 9, [], { blindAfter: paused.state.lap + 1 });
    expect(playout.rivalPolicy).toBe('smart');
    expect(playout.rival).toBeUndefined();
    expect(forkRun(paused, 9).rivalPolicy).toBe('expert');
  });

  it('is deterministic, and the player’s grader runs in an Expert race', () => {
    const model = race('abu-dhabi-2021');
    const play = () => {
      const run = initRun(model, 4, { decisions: [], rivalPolicy: 'expert', rivalSamples: 20 });
      while (run.state.lap < 44) stepLap(run);
      return run;
    };
    const a = play();
    const b = play();
    expect(b.state).toEqual(a.state);
    expect(b.rival?.points).toEqual(a.rival?.points);
    const opts = [
      { id: 'stay', decisions: [] },
      { id: 'box', decisions: [pit(45, 'MEDIUM')] },
    ];
    const g = gradeMoment(a, opts, { kind: 'beat-rival' }, 10);
    expect(g.options).toHaveLength(2);
  });

  it('refuses to run on while a deferred decision waits', () => {
    const model = race('abu-dhabi-2021');
    const run = initRun(model, 1, {
      decisions: [],
      rivalPolicy: 'expert',
      rivalGrading: 'deferred',
    });
    while (!run.rival?.pending) stepLap(run);
    expect(() => stepLap(run)).toThrow(RivalPolicyError);
    expect(() => resolveRivalDecision(run, 'nope' as never)).toThrow(RivalClaimError);
    resolveRivalDecision(run, 'smart');
    expect(() => resolveRivalDecision(run, 'smart')).toThrow(/no rival decision/);
    expect(() => stepLap(run)).not.toThrow();
  });

  it('rejects bad settings', () => {
    const model = race('abu-dhabi-2021');
    const claims: RivalChoice[] = [{ lap: 40, option: 'smart' }];
    expect(() =>
      initRun(model, 1, { decisions: [], rivalPolicy: 'smart', rivalChoices: claims }),
    ).toThrow(RivalPolicyError);
    expect(() =>
      initRun(model, 1, { decisions: [], rivalPolicy: 'expert', rivalSamples: 0 }),
    ).toThrow(/samples/);
    expect(() =>
      initRun(model, 1, { decisions: [], rivalPolicy: 'expert', rivalGrading: 'x' as never }),
    ).toThrow(/grading/);
  });
});

// --- the background grading workers' path ---------------------------------------------------

describe('Expert in the grading workers', () => {
  const model = race('abu-dhabi-2021');
  const calls = [pit(40, 'HARD')];

  it('a rival grade job, split across workers, matches grading in the run', () => {
    const inline = initRun(model, 2, { decisions: calls, rivalPolicy: 'expert' });
    while (!isFinished(inline)) stepLap(inline);

    const run = initRun(model, 2, {
      decisions: calls,
      rivalPolicy: 'expert',
      rivalGrading: 'deferred',
    });
    let jobs = 0;
    while (!isFinished(run)) {
      stepLap(run);
      const pending = run.rival?.pending;
      if (!pending) continue;
      // Plain JSON, as posted to a Web Worker.
      const job = JSON.parse(JSON.stringify(rivalGradeJob(run)));
      expect(job.samples).toBe(EXPERT_SAMPLES);
      const results = [runRivalGradeJob(job, 0, 37), runRivalGradeJob(job, 37, 100)];
      const merged = mergeRivalGradeJobs(job, results);
      expect(merged).toEqual(gradeRivalMoment(run, pending.options, EXPERT_SAMPLES));
      resolveRivalDecision(run, merged.best as never, merged.probabilities);
      jobs++;
    }
    expect(jobs).toBe(inline.rival?.points.length);
    expect(rivalChoices(run)).toEqual(rivalChoices(inline));
    expect(run.state).toEqual(inline.state);
    expect(() => mergeRivalGradeJobs(rivalGradeJobAt(model, calls), [])).toThrow(/tile/);
  });

  it('a player grade job carries the rival and rebuilds the same race', () => {
    const run = initRun(model, 2, { decisions: calls, rivalPolicy: 'expert' });
    while (run.state.lap < 45) stepLap(run);
    const job = JSON.parse(
      JSON.stringify(gradeJob(run, [{ id: 'stay', decisions: [] }], { kind: 'beat-rival' }, 5)),
    );
    expect(job.rivalPolicy).toBe('expert');
    expect(job.rivalChoices).toEqual(rivalChoices(run));
    expect(runFromJob(job).state).toEqual(run.state);
    // Without the rival's choices the rebuilt race can't go past its first decision.
    expect(() => runFromJob({ ...job, rivalChoices: [] })).toThrow(RivalPolicyError);

    const smart = initRun(model, 2, { decisions: calls, rivalPolicy: 'smart' });
    while (smart.state.lap < 45) stepLap(smart);
    const sjob = gradeJob(smart, [], { kind: 'win' });
    expect(sjob.rivalPolicy).toBe('smart');
    expect(sjob.rivalChoices).toBeUndefined();
    expect(runFromJob(sjob).state).toEqual(smart.state);
    const std = initRun(model, 2, { decisions: calls });
    stepLap(std);
    expect('rivalPolicy' in gradeJob(std, [], { kind: 'win' })).toBe(false);
  });
});

function rivalGradeJobAt(model: RaceModel, calls: Decision[]) {
  const run = initRun(model, 2, {
    decisions: calls,
    rivalPolicy: 'expert',
    rivalGrading: 'deferred',
  });
  while (!run.rival?.pending) stepLap(run);
  return rivalGradeJob(run);
}

// --- the server's check of claimed rival choices --------------------------------------------

describe('claimed rival choices (server check)', () => {
  const model = race('abu-dhabi-2021');
  const calls = [pit(40, 'HARD'), pit(50, 'SOFT')];
  const inline = initRun(model, 6, { decisions: calls, rivalPolicy: 'expert' });
  while (!isFinished(inline)) stepLap(inline);
  const claims = rivalChoices(inline);

  it('a legal claim replays the race exactly', () => {
    expect(claims.length).toBeGreaterThan(1);
    const replay = replayWithRivalClaims(model, 6, calls, JSON.parse(JSON.stringify(claims)));
    expect(replay.run.state).toEqual(inline.state);
    expect(replay.result).toEqual(classify(inline));
    expect(replay.points.map((p) => p.source)).toEqual(claims.map(() => 'claim'));
    expect(replay.points.map((p) => p.options)).toEqual(inline.rival?.points.map((p) => p.options));
    // Deterministic.
    expect(replayWithRivalClaims(model, 6, calls, claims).run.state).toEqual(replay.run.state);
  });

  it('another legal option replays too, as a different race', () => {
    const point = inline.rival?.points.find((p) => p.options.length > 1) ?? null;
    if (!point) throw new Error('no point with a choice');
    const other = point.options.find((o) => o.id !== point.chosen)?.id as never;
    const changed = claims.map((c) => (c.lap === point.lap ? { ...c, option: other } : c));
    // Later points can differ once the rival's plan has: claim Smart's move from there on.
    const replay = (() => {
      const run = initRun(model, 6, {
        decisions: calls,
        rivalPolicy: 'expert',
        rivalGrading: 'deferred',
      });
      while (!isFinished(run)) {
        stepLap(run);
        const p = run.rival?.pending;
        if (p)
          resolveRivalDecision(
            run,
            p.lap === point.lap ? other : (changed.find((c) => c.lap === p.lap)?.option ?? 'smart'),
          );
      }
      return run;
    })();
    const ok = replayWithRivalClaims(model, 6, calls, rivalChoices(replay));
    expect(ok.run.state).toEqual(replay.state);
    expect(ok.points.find((p) => p.lap === point.lap)?.chosen).toBe(other);
  });

  it('rejects an option that isn’t legal at its point', () => {
    const point = inline.rival?.points.find((p) => p.options.length < 3);
    if (!point) throw new Error('every point has all three options');
    const missing = (['smart', 'stay-out', 'box-now'] as const).find(
      (id) => !point.options.some((o) => o.id === id),
    ) as never;
    const bad = claims.map((c) => (c.lap === point.lap ? { ...c, option: missing } : c));
    expect(() => replayWithRivalClaims(model, 6, calls, bad)).toThrow(
      expect.objectContaining({ code: 'illegal-option' }),
    );
  });

  it('rejects claims off the decision points, missing, duplicated or malformed', () => {
    const laps = new Set(claims.map((c) => c.lap));
    const off = [...Array(model.race.laps).keys()].find(
      (l) => l > model.race.takeoverLap && !laps.has(l),
    ) as number;
    const code = (cs: unknown) => {
      try {
        replayWithRivalClaims(model, 6, calls, cs as RivalChoice[]);
      } catch (e) {
        return (e as RivalClaimError).code;
      }
      return 'ok';
    };
    expect(code(claims)).toBe('ok');
    expect(code([...claims, { lap: off, option: 'smart' }])).toBe('not-a-decision-point');
    expect(code(claims.slice(1))).toBe('missing-claim');
    expect(code([...claims, claims[0]])).toBe('duplicate-claim');
    expect(code([{ lap: 'x', option: 'smart' }])).toBe('bad-claim');
    expect(code([{ lap: 40, option: 'pit' }])).toBe('bad-claim');
    expect(code('smart')).toBe('bad-claim');
  });

  it('the nightly re-grade finds an honest claim the grader’s best', () => {
    const regrade = regradeRivalPoints(model, 6, calls, claims);
    expect(regrade.map((r) => r.lap)).toEqual(claims.map((c) => c.lap));
    for (const r of regrade) expect(r.best).toBe(r.claimed);
  });

  it('replays and re-grades a Legend race with Legend’s safety cars', () => {
    // Seed 3: Legend draws a SC on laps 42-46, and the rival boxes under it after lap 41.
    const legend = initRun(model, 3, { decisions: [], rivalPolicy: 'expert', legend: true });
    while (!isFinished(legend)) stepLap(legend);
    const mine = rivalChoices(legend);
    expect(mine).toContainEqual({ lap: 41, option: 'box-now' });
    const replay = replayWithRivalClaims(model, 3, [], mine, { legend: true });
    expect(replay.run.state).toEqual(legend.state);
    // Without Legend lap 41 isn't a decision point (the real race is green there).
    expect(() => replayWithRivalClaims(model, 3, [], mine)).toThrow(RivalClaimError);
    const regrade = regradeRivalPoints(model, 3, [], mine, { legend: true });
    expect(regrade.map((r) => r.lap)).toEqual(mine.map((c) => c.lap));
    for (const r of regrade) expect(r.best).toBe(r.claimed);
  });
});
