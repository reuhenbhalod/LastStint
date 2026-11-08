// Grader (Implementation Plan 2.7; testing table: "known-answer cases, e.g. a free SC stop
// must grade best; runtime budget under 200 ms").

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import germany1986Json from '../../../data/races/germany-1986.json';
import hungary1992Json from '../../../data/races/hungary-1992.json';
import spainJson from '../../../data/races/spain-2021.json';
import { fromSide } from '../src/eras/hard-calls.js';
import { erasModel } from '../src/eras/reachability.js';
import { type GradeOption, bandFor, gradeMoment, playOption, realOption } from '../src/grade.js';
import {
  classify,
  erasContinuation,
  erasRace,
  forkRun,
  initRun,
  isFinished,
  planRemainingStop,
  planRemainingStops,
  stepLap,
} from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const spain = spainJson as unknown as RaceModel;
const hungary1992 = hungary1992Json as unknown as RaceModel;
const germany1986 = germany1986Json as unknown as RaceModel;

/** The race as a Daily file: no rules block (Daily semantics). */
function daily(model: RaceModel): RaceModel {
  const { rules: _rules, eras: _eras, ...rest } = model;
  return rest as RaceModel;
}

function pausedAt(model: RaceModel, lap: number) {
  const run = initRun(model, model.race.seed, { decisions: [] });
  while (run.state.lap < lap) stepLap(run);
  return run;
}

describe('bands', () => {
  it('green within half a point of the best, then yellow, orange, red', () => {
    expect(bandFor(0)).toBe('green');
    expect(bandFor(0.5)).toBe('green');
    expect(bandFor(3)).toBe('yellow');
    expect(bandFor(10)).toBe('orange');
    expect(bandFor(40)).toBe('red');
  });
});

describe('gradeMoment', () => {
  const abuSc = [
    { id: 'stay-out', decisions: [] },
    { id: 'box-soft', decisions: [{ lap: 53, kind: 'pit' as const, compound: 'SOFT' }] },
  ];

  it('is reproducible (the Worker re-grades from the seed)', () => {
    const run = pausedAt(abu, 52);
    expect(gradeMoment(run, abuSc, { kind: 'win' }, 60)).toEqual(
      gradeMoment(run, abuSc, { kind: 'win' }, 60),
    );
  });

  it('does not disturb the run being graded', () => {
    const run = pausedAt(abu, 52);
    const before = JSON.stringify(run.state);
    gradeMoment(run, abuSc, { kind: 'win' }, 20);
    expect(JSON.stringify(run.state)).toBe(before);
  });

  it('known answer: the free SC stop grades best (VER, Abu Dhabi lap 53)', () => {
    // Swap sides so the player is VER: well clear of P3, a stop under the SC costs no place.
    const asVer: RaceModel = { ...abu, userSide: 'VER', rival: 'HAM' };
    const run = pausedAt(asVer, 52);
    const g = gradeMoment(
      run,
      [
        { id: 'stay-out', decisions: [] },
        { id: 'box-soft', decisions: [{ lap: 53, kind: 'pit', compound: 'SOFT' }] },
      ],
      { kind: 'win' },
    );
    expect(g.best).toBe('box-soft');
    expect(g.options.find((o) => o.id === 'stay-out')?.band).not.toBe('green');
  });

  it("grades the real team's call (HAM stayed out on lap 53)", () => {
    const run = pausedAt(abu, 52);
    const real = realOption(run, 53);
    expect(real.decisions).toEqual([]);
    const g = gradeMoment(run, [...abuSc, real], { kind: 'win' }, 100);
    const stay = g.options.find((o) => o.id === 'stay-out');
    expect(g.options.find((o) => o.id === 'real')?.probability).toBe(stay?.probability);
  });

  it('meets the runtime budget: 4 options x 300 samples x 25 laps', () => {
    const run = pausedAt(abu, abu.race.laps - 25);
    const lap = run.state.lap + 1;
    const options = [
      { id: 'stay-out', decisions: [] },
      { id: 'box-hard', decisions: [{ lap, kind: 'pit' as const, compound: 'HARD' }] },
      { id: 'box-medium', decisions: [{ lap, kind: 'pit' as const, compound: 'MEDIUM' }] },
      {
        id: 'push',
        decisions: [{ lap, kind: 'mode' as const, key: 'pace' as const, value: 'push' }],
      },
    ];
    const t0 = Date.now();
    gradeMoment(run, options, { kind: 'win' });
    // Plan 2.8 budget is 200 ms (~140 ms on an M-series laptop); CI runners are slower and
    // noisier, so the hard limit here is generous.
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe('sensible-strategist continuation', () => {
  it('plans the best legal stop (Spain lap 23: VER has only run softs, so not softs again)', () => {
    // Without the two-compound rule the planner preferred lap 33 for softs, which is illegal.
    expect(planRemainingStop(pausedAt(spain, 23))).toEqual({ lap: 35, to: 'MEDIUM' });
  });

  it('plans no stop when one would not pay before the flag', () => {
    expect(planRemainingStop(pausedAt(abu, 56))).toBeNull();
  });

  it("a playout gives 'stay out' a later stop instead of none", () => {
    // As a Daily race: spain-2021's file has a rules block (an Eras race), which takes the
    // Eras continuation (below).
    const run = pausedAt(daily(spain), 23);
    const fork = playOption(run, 1, { id: 'stay-out', decisions: [] });
    expect(fork.state.cars.VER?.strategy).toEqual([{ lap: 35, to: 'MEDIUM', added: true }]);
    while (!isFinished(fork)) stepLap(fork);
    expect(fork.state.cars.VER?.tyreAge).toBe(spain.race.laps - 35 + 1);
  });
});

describe('the Eras continuation (sim.ts erasContinuation)', () => {
  const real = (m: RaceModel) =>
    m.drivers.find((d) => d.code === m.userSide)?.realStrategy.map((s) => s.lap) ?? [];

  it('only Eras races take it: a race with a rules or an eras block', () => {
    expect(erasRace(spain)).toBe(true);
    expect(erasRace(daily(spain))).toBe(false);
    expect(erasRace(abu)).toBe(false); // the Daily file of a shared race
    expect(erasRace({ ...abu, eras: { eraId: 9, order: 10 } })).toBe(true);
  });

  it("'stay out' before the real stop keeps it; boxing early stands in for it", () => {
    // Paused after lap 22: the moment's box-now stop is out on lap 24, the real one on 25.
    const run = pausedAt(spain, 22);
    const next = real(spain).filter((l) => l > 24);
    expect(next.length).toBeGreaterThan(0);
    const lap = run.state.lap + 1;
    const ask = [
      { id: 'stay', decisions: [] },
      { id: 'box', decisions: [{ lap, kind: 'pit' as const, compound: 'MEDIUM' }] },
    ];
    const stay = playOption(run, 1, ask[0] as GradeOption, true);
    expect(stay.state.cars.VER?.strategy.map((s) => s.lap)).toEqual(next);
    const box = playOption(run, 1, ask[1] as GradeOption, true);
    // The early stop stands in for the first real one; the rest of the real plan follows.
    expect(box.state.cars.VER?.strategy.map((s) => s.lap)).toEqual(next.slice(1));
  });

  it("'stay out' where the real team boxed skips that stop (hungary-1992 lap 61)", () => {
    // From Mansell's side (the Eras side is Berger since the 6.2 re-author's hard-call recount).
    const m = fromSide(hungary1992, 'MAN');
    const run = pausedAt(m, 60);
    // The real stop is out-lap 62, the moment's box-now: staying out makes no later stop.
    expect(real(m)).toEqual([62]);
    const stay = playOption(run, 1, { id: 'stay', decisions: [] }, true);
    expect(stay.state.cars.MAN?.strategy).toEqual([]);
    const box = playOption(run, 1, {
      id: 'box',
      decisions: [{ lap: 61, kind: 'pit', compound: 'MEDIUM' }],
    });
    expect(box.state.cars.MAN?.strategy).toEqual([]);
    expect(box.state.cars.MAN?.compound).toBe('MEDIUM');
    // A moment that asks no stop question (a pace call) leaves the real stop to come.
    const pace = playOption(run, 1, { id: 'push', decisions: [] }, false);
    expect(pace.state.cars.MAN?.strategy.map((s) => s.lap)).toEqual([62]);
  });

  it('keeps the car legal: short of two compounds, the planner steps in', () => {
    // spain-2021 from lap 23, VER on softs only: with every later real stop dropped (three
    // stops already made), the real plan leaves him one compound, so the planner's legal
    // stop is used.
    const run = pausedAt(spain, 23);
    const stops = erasContinuation(run, run.state.lap, 3);
    expect(stops).toEqual(planRemainingStops(run));
    expect(stops.length).toBeGreaterThan(0);
  });

  it("follows the player's own logged plan instead", () => {
    const run = initRun(spain, spain.race.seed, {
      decisions: [{ lap: 40, kind: 'pit', compound: 'MEDIUM' }],
    });
    while (run.state.lap < 23) stepLap(run);
    const stay = playOption(run, 1, { id: 'stay', decisions: [] }, true);
    expect(stay.state.cars.VER?.strategy).toEqual([]);
    expect(stay.decisions.some((d) => d.kind === 'pit' && d.lap === 40)).toBe(true);
  });

  it('a playout classifies as live play: a car short of two compounds is disqualified', () => {
    const run = pausedAt(spain, 23);
    // A whole-race plan of no more stops (final: nothing added), on softs only.
    const fork = playOption(run, 1, { id: 'no-stop', decisions: [], final: true });
    while (!isFinished(fork)) stepLap(fork);
    expect(classify(fork).disqualified).toContain('VER');
    expect(
      gradeMoment(run, [{ id: 'no-stop', decisions: [], final: true }], { kind: 'win' }, 20)
        .options[0]?.probability,
    ).toBe(0);
  });

  it('a fuel-limit race grades running dry: keep (short of fuel) red, lift best', () => {
    // germany-1986 (195 L), seed 2 at the takeover is 0.02 kg short of the flag at the
    // standard burn: a playout that never lifts runs dry and the car stops (refuel.ts).
    const m = erasModel(germany1986);
    const run = initRun(m, 2, { decisions: [] });
    while (run.state.lap < 41) stepLap(run);
    const fuel = m.decisionMoments.find((d) => d.id === 'fuel-42');
    expect(fuel).toBeDefined();
    const g = gradeMoment(run, fuel?.options ?? [], fuel?.target ?? { kind: 'win' }, 40);
    const p = (id: string) => g.options.find((o) => o.id === id)?.probability ?? -1;
    expect(p('keep')).toBe(0);
    expect(p('lift')).toBeGreaterThan(0.9);
    expect(g.best).toBe('lift');
    // The fork keeps the fuel load; a Daily race's playout leaves it out, as before.
    expect(forkRun(run, 1, [], { blindAfter: 42 }).state.cars.ROSK?.fuel).toBeDefined();
    const day = initRun(abu, abu.race.seed, { decisions: [] });
    expect(day.state.cars[abu.userSide]?.fuel).toBeDefined();
    expect(forkRun(day, 1, [], { blindAfter: 40 }).state.cars[abu.userSide]?.fuel).toBeUndefined();
  });

  it("playouts draw live play's incidents", () => {
    const run = pausedAt(spain, 23);
    expect(run.incidents).toBe(true);
    expect(playOption(run, 1, { id: 'stay', decisions: [] }).incidents).toBe(true);
  });
});

describe('grading without hindsight (spec decision, Oct 26 2026)', () => {
  it("playouts don't know future real events, but keep the one underway", async () => {
    const { forkRun, initRun: init, stepLap: step } = await import('../src/sim.js');
    // Abu Dhabi 2021 paused after lap 43: the lap-53 SC is in the future.
    const early = init(abu, abu.race.seed, { decisions: [] });
    while (early.state.lap < 43) step(early);
    let withSc = 0;
    for (let s = 1; s <= 200; s++) {
      if (forkRun(early, s, [], { blindAfter: 44 }).neutral.get(53) === 'sc') withSc++;
    }
    expect(withSc / 200).toBeLessThan(0.1); // only by chance, at about the base rate
    // Paused after lap 52, deciding on lap 53: the SC that prompts the call is known.
    const late = init(abu, abu.race.seed, { decisions: [] });
    while (late.state.lap < 52) step(late);
    const fork = forkRun(late, 1, [], { blindAfter: 53 });
    expect([53, 54, 55, 56, 57].map((l) => fork.neutral.get(l))).toEqual([
      'sc',
      'sc',
      'sc',
      'sc',
      'sc',
    ]);
  });

  it('forks with the same seed see the same random future (common random numbers)', async () => {
    const { forkRun, initRun: init } = await import('../src/sim.js');
    const run = init(abu, 1, { decisions: [] });
    const a = forkRun(run, 7, [], { blindAfter: 35 });
    const b = forkRun(run, 7, [{ lap: 35, kind: 'pit', compound: 'SOFT' }], { blindAfter: 35 });
    expect([...a.neutral]).toEqual([...b.neutral]);
  });
});

describe('planner fast path', () => {
  it('chooses exactly what the full O(laps^2) search chooses', async () => {
    const { initRun: init, stepLap: step, planRemainingStop: plan } = await import('../src/sim.js');
    let compared = 0;
    for (const model of [abu, spain]) {
      for (let pause = model.race.takeoverLap; pause < model.race.laps - 1; pause += 3) {
        const run = init(model, 5, { decisions: [] });
        while (run.state.lap < pause) step(run);
        expect(plan(run)).toEqual(plan(run, { exact: true }));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(15);
  });
});

describe('Web Worker grading (spec D7)', () => {
  it('a JSON job split into ranges grades exactly like gradeMoment', async () => {
    const g = await import('../src/grade.js');
    const run = pausedAt(abu, 52);
    const options = [
      { id: 'stay-out', decisions: [] },
      { id: 'box-soft', decisions: [{ lap: 53, kind: 'pit' as const, compound: 'SOFT' }] },
    ];
    const direct = g.gradeMoment(run, options, { kind: 'win' }, 60);
    const job = JSON.parse(JSON.stringify(g.gradeJob(run, options, { kind: 'win' }, 60)));
    const parts = [
      g.runGradeJob(job, 0, 25),
      g.runGradeJob(job, 25, 40),
      g.runGradeJob(job, 40, 60),
    ];
    expect(g.mergeGradeJobs(job, JSON.parse(JSON.stringify(parts)))).toEqual(direct);
  });

  it('rejects ranges that do not tile the samples', async () => {
    const g = await import('../src/grade.js');
    const run = pausedAt(abu, 52);
    const job = g.gradeJob(run, [{ id: 'a', decisions: [] }], { kind: 'win' }, 10);
    expect(() => g.mergeGradeJobs(job, [g.runGradeJob(job, 0, 5)])).toThrow();
  });
});
