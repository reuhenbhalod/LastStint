// Red flags (eras build plan 4.3): the stop, the free tyre change, the restart and the wiped
// gaps, in parity with the Python reference sim, and the two calls the moment finder adds.
// The fixture is Zandvoort 2023 from lap 61 (red flag on lap 64, rolling restart behind the
// SC), built by the pipeline from OpenF1; its golden file and variants come from
// pipeline/tests/make_redflag_fixture.py.

import { describe, expect, it } from 'vitest';
import { candidateMoments } from '../src/moments.js';
import { RESTART_QUEUE_GAP, STANDING_RESTART_GAP, redFlagPlan } from '../src/redflag.js';
import {
  BUNCH_GAP,
  forkRun,
  initRun,
  redFlagFree,
  simulate,
  stepLap,
  validateDecisions,
} from '../src/sim.js';
import type { RaceModel, RaceResult } from '../src/types.js';
import goldenJson from './fixtures/redflag-golden.json';
import zandvoortJson from './fixtures/redflag-netherlands-2023.json';

type Golden = Record<
  string,
  Record<
    string,
    Pick<RaceResult, 'order' | 'finishers'> & Record<'gaps' | 'times', Record<string, number>>
  >
>;

const zandvoort = zandvoortJson as unknown as RaceModel;
const golden = goldenJson as unknown as Golden;

/** pipeline/tests/make_redflag_fixture.py `variants`. */
function variants(): Record<string, RaceModel> {
  const standing = structuredClone(zandvoort);
  for (const e of standing.events) if (e.type === 'RED') e.restart = 'standing';
  const extra = structuredClone(standing);
  extra.drivers.find((d) => d.code === 'ALO')?.realStrategy.push({ lap: 65, to: 'INTERMEDIATE' });
  return { rolling: zandvoort, standing, 'standing-free-stop': extra };
}

const upTo = (model: RaceModel, laps: number): RaceModel => ({
  ...model,
  race: { ...model.race, laps },
});

const gapsOf = (r: RaceResult) => r.finishers.map((c) => r.gaps[c] as number);

describe.each(Object.entries(variants()))('%s matches the Python reference sim', (name, model) => {
  const expected = golden[name] ?? {};
  it.each(Object.keys(expected))('seed %s', (seed) => {
    const want = expected[seed];
    if (!want) throw new Error(`missing golden seed ${seed}`);
    const got = simulate(model, Number(seed));
    expect(got.order).toEqual(want.order);
    expect(got.finishers).toEqual(want.finishers);
    for (const code of want.finishers) {
      expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
      expect(got.gaps[code]).toBeCloseTo(want.gaps[code] as number, 3);
    }
  });
});

describe('the red flag model', () => {
  it('the fixture red flag: lap 64, stoppage on 65, one SC lap, rolling', () => {
    expect(zandvoort.events.filter((e) => e.type !== 'RETIREMENT')).toEqual([
      { lap: 64, type: 'RED', laps: 2, restart: 'rolling' },
      { lap: 66, type: 'SC', laps: 1 },
    ]);
    expect(RESTART_QUEUE_GAP).toBe(BUNCH_GAP);
  });

  it('plans the free tyre change and the restart', () => {
    const plan = redFlagPlan(zandvoort.events);
    expect([...plan.free]).toEqual([65]);
    expect([...plan.wipes]).toEqual([[65, { gap: RESTART_QUEUE_GAP, redLap: 64 }]]);
    const standing = redFlagPlan(variants().standing?.events ?? []);
    expect(standing.wipes.get(66)).toEqual({ gap: STANDING_RESTART_GAP, redLap: 64 });
    // Not resumed: no free stops, nothing wiped.
    const over = redFlagPlan([{ lap: 70, type: 'RED', laps: 3 }]);
    expect(over.free.size + over.wipes.size).toBe(0);
  });

  it('wipes the gaps at the restart: the SC queue, then a standing start spreads it', () => {
    const rolling = gapsOf(simulate(upTo(zandvoort, 65), 1));
    rolling.forEach((g, i) => expect(g).toBeCloseTo(i * RESTART_QUEUE_GAP, 9));
    const standing = gapsOf(simulate(upTo(variants().standing as RaceModel, 66), 1));
    standing.forEach((g, i) => expect(g).toBeCloseTo(i * STANDING_RESTART_GAP, 9));
  });

  it('a stop in the stoppage costs nothing', () => {
    const base = simulate(upTo(variants().standing as RaceModel, 65), 3);
    const extra = simulate(upTo(variants()['standing-free-stop'] as RaceModel, 65), 3);
    expect(extra.order).toEqual(base.order);
    expect(extra.gaps).toEqual(base.gaps);
  });

  it("the player's free call: boxing on the red-flag lap changes tyres for free", () => {
    const user = zandvoort.userSide;
    const decisions = [{ lap: 64, kind: 'pit' as const, compound: 'INTERMEDIATE' }];
    validateDecisions(zandvoort, decisions);
    const boxed = initRun(zandvoort, 2, { decisions, incidents: false });
    const stayed = initRun(zandvoort, 2, { decisions: [], incidents: false });
    for (const run of [boxed, stayed]) while (run.state.lap < 65) stepLap(run);
    expect(redFlagFree(boxed, 65)).toBe(true);
    const carB = boxed.state.cars[user];
    const carS = stayed.state.cars[user];
    expect(carB?.tyreAge).toBe(1); // fresh set, fitted in the stoppage
    expect(carB?.totalTime).toBeCloseTo(carS?.totalTime as number, 9);
    expect(boxed.state.order).toEqual(stayed.state.order);
  });

  it("a grader's blind fork from before the red flag doesn't know it", () => {
    const run = initRun(zandvoort, 1, { decisions: [], incidents: false });
    while (run.state.lap < 62) stepLap(run);
    const fork = forkRun(run, 9, [], { blindAfter: 63 });
    expect(fork.neutral.get(64)).toBeUndefined();
    expect(redFlagFree(fork, 65)).toBe(false);
    const known = forkRun(run, 9, [], { blindAfter: 64 });
    expect(redFlagFree(known, 65)).toBe(true);
  });
});

describe('red-flag decision moments', () => {
  const moments = candidateMoments(zandvoort);
  const red = moments.find((m) => m.trigger === 'RED');
  const pre = moments.find((m) => m.trigger === 'preRed');

  it('offers the restart tyre call on the red-flag lap and the box-now call before it', () => {
    expect(red?.lap).toBe(64);
    expect(pre?.lap).toBe(63);
    for (const m of [red, pre]) {
      expect(m?.options.length).toBeGreaterThanOrEqual(2);
      expect(m?.options.length).toBeLessThanOrEqual(4);
      for (const o of m?.options ?? []) validateDecisions(zandvoort, o.decisions);
    }
  });

  it('the restart call fits the tyres for the track (a wet restart: wet tyres first)', () => {
    expect(red?.options[0]?.label).toBe('Keep this set');
    expect(red?.options[1]?.label).toBe('Fit intermediates in the stoppage');
    // Alonso really kept his set through the stoppage.
    expect(red?.realOptionId).toBe('stay-out');
  });

  it('keeps no other moment within 3 laps of the red-flag calls', () => {
    for (const m of moments) {
      if (m.trigger === 'RED' || m.trigger === 'preRed') continue;
      expect(Math.abs(m.lap - 64)).toBeGreaterThanOrEqual(3);
    }
  });
});
