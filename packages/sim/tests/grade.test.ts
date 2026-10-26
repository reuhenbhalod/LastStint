// Grader (Implementation Plan 2.7; testing table: "known-answer cases, e.g. a free SC stop
// must grade best; runtime budget under 200 ms").

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import spainJson from '../../../data/races/spain-2021.json';
import { bandFor, gradeMoment, playOption, realOption } from '../src/grade.js';
import { initRun, isFinished, planRemainingStop, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const spain = spainJson as unknown as RaceModel;

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
    const run = pausedAt(spain, 23);
    const fork = playOption(run, 1, { id: 'stay-out', decisions: [] });
    expect(fork.state.cars.VER?.strategy).toEqual([{ lap: 35, to: 'MEDIUM', added: true }]);
    while (!isFinished(fork)) stepLap(fork);
    expect(fork.state.cars.VER?.tyreAge).toBe(spain.race.laps - 35 + 1);
  });
});
