// Rival policies (eras build plan 9.1): the policy selector and its hook in the sim, Standard
// replaying today's behaviour exactly, Smart's wet-crossover rule against the vectors the
// Python reference sim checks too (parity), and the rival's grader (Expert's mechanism).

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RIVAL_POLICIES } from '../src/eras/config.js';
import {
  RIVAL_GRADE_STREAM,
  type RivalOption,
  countRivalHits,
  gradeRivalMoment,
  rivalAhead,
  rivalPlayout,
  rivalSampleSeed,
} from '../src/rivals/expert.js';
import {
  DEFAULT_RIVAL_POLICY,
  IMPLEMENTED_RIVAL_POLICIES,
  RIVAL_POLICY_GAPS,
  RIVAL_POLICY_NAMES,
  RivalPolicyError,
  resolveRivalPolicy,
} from '../src/rivals/policy.js';
import { wetCrossover } from '../src/rivals/wet.js';
import {
  DEFAULT_MODES,
  forkRun,
  initRun,
  isFinished,
  realDecisions,
  simulate,
  stepLap,
} from '../src/sim.js';
import type { CarState, Compound, Decision, RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = <T>(...path: string[]): T =>
  JSON.parse(readFileSync(join(repo, ...path), 'utf8')) as T;
const race = (id: string) => readJson<RaceModel>('data', 'races', `${id}.json`);

describe('rival policy selector', () => {
  it('names the same policies as the eras config, Standard first', () => {
    expect([...RIVAL_POLICY_NAMES]).toEqual([...RIVAL_POLICIES]);
    expect(DEFAULT_RIVAL_POLICY).toBe('standard');
  });

  it('defaults to standard', () => {
    expect(resolveRivalPolicy(undefined)).toBe('standard');
    expect(resolveRivalPolicy('standard')).toBe('standard');
  });

  it.each(['', 'Standard', 'legend', 3, null, ['standard']])('rejects %j', (bad) => {
    expect(() => resolveRivalPolicy(bad)).toThrow(/unknown rival policy/);
  });

  it.each(['standard-plus', 'smart', 'expert'])('fails loudly on %s, with its spec gap', (p) => {
    expect(IMPLEMENTED_RIVAL_POLICIES).not.toContain(p);
    expect(RIVAL_POLICY_GAPS[p as keyof typeof RIVAL_POLICY_GAPS]).toBeTruthy();
    expect(() => resolveRivalPolicy(p)).toThrow(RivalPolicyError);
    expect(() => resolveRivalPolicy(p)).toThrow(`${p} is not implemented`);
  });

  it('initRun takes the policy, keeps it in forks, and refuses an undefined one', () => {
    const model = race('abu-dhabi-2021');
    expect(initRun(model, 1).rivalPolicy).toBe('standard');
    const run = initRun(model, 1, { decisions: [], rivalPolicy: 'standard' });
    stepLap(run);
    expect(forkRun(run, 2).rivalPolicy).toBe('standard');
    expect(() => initRun(model, 1, { decisions: [], rivalPolicy: 'expert' })).toThrow(
      RivalPolicyError,
    );
    expect(() =>
      initRun(model, 1, { decisions: [], rivalPolicy: 'hard' as unknown as 'standard' }),
    ).toThrow(/unknown rival policy/);
  });
});

type Golden = Record<
  string,
  { order: string[]; finishers: string[]; times: Record<string, number> }
>;
const GOLDEN = readdirSync(join(repo, 'data', 'golden'))
  .filter((f) => f.endsWith('.json') && f !== 'rng-vectors.json')
  .map((f) => f.replace(/\.json$/, ''));

describe('standard is today’s rival', () => {
  it.each(GOLDEN)('%s: every golden seed replays with rivalPolicy standard', (id) => {
    const model = race(id);
    const golden = readJson<Golden>('data', 'golden', `${id}.json`);
    for (const [seed, want] of Object.entries(golden)) {
      const got = simulate(model, Number(seed), { rivalPolicy: 'standard' });
      expect(got.order).toEqual(want.order);
      expect(got.finishers).toEqual(want.finishers);
      for (const code of want.finishers)
        expect(got.times[code]).toBeCloseTo(want.times[code] as number, 3);
    }
  });

  // Live play, where the rival reacts: the explicit policy must give the very same race as
  // none at all, notes (rival covers and stays out) included.
  // `covers`: the calls make the rival cover (seeds 1-3), so the comparison has teeth.
  const live: Array<[string, (m: RaceModel) => Decision[], boolean]> = [
    ['abu-dhabi-2021', (m) => realDecisions(m), false],
    // A stop under the lap-36 VSC, and green-flag stops inside the cover window.
    ['abu-dhabi-2021', () => [{ lap: 35, kind: 'pit', compound: 'HARD' }], true],
    ['abu-dhabi-2021', () => [{ lap: 49, kind: 'pit', compound: 'MEDIUM' }], true],
    ['spain-2021', () => [{ lap: 26, kind: 'pit', compound: 'MEDIUM' }], true],
    ['russia-2021', (m) => realDecisions(m), false],
  ];
  it.each(live)('%s live: explicit standard equals the default', (id, calls, covers) => {
    const model = race(id);
    for (const seed of [1, 2, 3]) {
      const a = initRun(model, seed, { decisions: calls(model) });
      const b = initRun(model, seed, { decisions: calls(model), rivalPolicy: 'standard' });
      while (!isFinished(a)) stepLap(a);
      while (!isFinished(b)) stepLap(b);
      expect(b.state).toEqual(a.state);
      expect(b.notes).toEqual(a.notes);
      if (covers) expect(b.notes.some((n) => n.kind === 'rival-cover')).toBe(true);
    }
  });
});

interface Vectors {
  worn: number;
  races: Record<
    string,
    Array<{
      driver: string;
      compound: Compound;
      tyreAge: number;
      laps: Array<{ lap: number; crossover: Compound | null; gap: Record<string, number> }>;
    }>
  >;
}

function carFor(model: RaceModel, code: string, compound: Compound, tyreAge: number): CarState {
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
    strategy: [],
    pittedThisLap: false,
    retired: false,
    retiredLap: null,
    modes: { ...DEFAULT_MODES },
  };
}

describe('Smart’s wet crossover (parity with rival_policy.wet_crossover)', () => {
  const vectors = readJson<Vectors>('pipeline', 'tests', 'fixtures', 'rival_wet_crossover.json');

  it.each(Object.keys(vectors.races))('%s matches the Python vectors', (id) => {
    const model = race(id);
    for (const c of vectors.races[id] ?? []) {
      const car = carFor(model, c.driver, c.compound, c.tyreAge);
      for (const row of c.laps) {
        expect(wetCrossover(model, car, row.lap), `${c.driver} lap ${row.lap}`).toBe(row.crossover);
      }
    }
  });

  it('covers both switches and no-switches', () => {
    const rows = Object.values(vectors.races).flatMap((cs) => cs.flatMap((c) => c.laps));
    expect(rows.length).toBeGreaterThan(500);
    expect(rows.some((r) => r.crossover === 'INTERMEDIATE')).toBe(true);
    expect(rows.some((r) => r.crossover === 'WET')).toBe(true);
    expect(rows.some((r) => r.crossover === null)).toBe(true);
  });

  it('is null in a dry race, on wet tyres, and with no wet tyre in the model', () => {
    const dry = race('abu-dhabi-2021');
    expect(wetCrossover(dry, carFor(dry, dry.rival, 'HARD', 20), 40)).toBeNull();
    const wet = race('russia-2021');
    expect(wetCrossover(wet, carFor(wet, wet.rival, 'INTERMEDIATE', 3), 50)).toBeNull();
    const slicksOnly = {
      ...wet,
      compounds: { HARD: wet.compounds.HARD, MEDIUM: wet.compounds.MEDIUM },
    } as RaceModel;
    const car = carFor(slicksOnly, wet.rival, 'HARD', 12);
    for (let lap = 39; lap <= 53; lap++) expect(wetCrossover(slicksOnly, car, lap)).toBeNull();
  });

  it('follows an explicit wetness (a grader fork’s forecast)', () => {
    const wet = race('russia-2021');
    const car = carFor(wet, wet.rival, 'HARD', 12);
    expect(wetCrossover(wet, car, 40, 0)).toBeNull();
    expect(wetCrossover(wet, car, 40, 0.3)).toBe('INTERMEDIATE');
  });
});

describe('the rival’s grader (Expert’s mechanism)', () => {
  const model = race('abu-dhabi-2021');
  // Paused after lap 40, the user having called a stop for hards on it.
  const paused = () => {
    const run = initRun(model, model.race.seed, {
      decisions: [{ lap: 40, kind: 'pit', compound: 'HARD' }],
    });
    while (run.state.lap < 40) stepLap(run);
    return run;
  };
  const options = (lap: number): RivalOption[] => [
    { id: 'box-now', stops: [{ lap: lap + 1, to: 'HARD', added: true }] },
    { id: 'box-later', stops: [{ lap: lap + 6, to: 'HARD', added: true }] },
  ];

  it('is deterministic from the run’s seed and lap, on its own stream', () => {
    const run = paused();
    const a = gradeRivalMoment(run, options(run.state.lap), 12);
    const b = gradeRivalMoment(paused(), options(run.state.lap), 12);
    expect(b).toEqual(a);
    expect(a.lap).toBe(40);
    expect(Object.keys(a.probabilities)).toEqual(['box-now', 'box-later']);
    expect(RIVAL_GRADE_STREAM).not.toBe(3000);
    expect(rivalSampleSeed(run, 0)).not.toBe(rivalSampleSeed(run, 1));
  });

  it('counts sample ranges that add up', () => {
    const run = paused();
    const opts = options(run.state.lap);
    const whole = countRivalHits(run, opts, 0, 10);
    const parts = [countRivalHits(run, opts, 0, 4), countRivalHits(run, opts, 4, 10)];
    expect(whole).toEqual(whole.map((_, k) => (parts[0]?.[k] ?? 0) + (parts[1]?.[k] ?? 0)));
  });

  it('plays the rival’s option and drops the player’s calls it can’t know yet', () => {
    const run = initRun(model, model.race.seed, {
      decisions: [
        { lap: 38, kind: 'pit', compound: 'HARD' },
        { lap: 50, kind: 'pit', compound: 'MEDIUM' },
      ],
    });
    while (run.state.lap < 42) stepLap(run);
    const fork = rivalPlayout(run, 1, { id: 'x', stops: [{ lap: 45, to: 'MEDIUM' }] });
    expect(fork.decisions).toEqual([]);
    expect(fork.state.cars[model.rival]?.strategy).toEqual([{ lap: 45, to: 'MEDIUM' }]);
    // The user's later stop is the sensible strategist's, not the logged lap-50 call.
    const userStops = fork.state.cars[model.userSide]?.strategy ?? [];
    expect(userStops.every((s) => s.added)).toBe(true);
    // The parent run is untouched.
    expect(run.decisions).toHaveLength(2);
  });

  it('rejects bad options and empty grades', () => {
    const run = paused();
    expect(() => gradeRivalMoment(run, [])).toThrow(/no rival options/);
    expect(() => gradeRivalMoment(run, options(40), 0)).toThrow(/samples/);
    expect(() => rivalPlayout(run, 1, { id: 'past', stops: [{ lap: 40, to: 'HARD' }] })).toThrow(
      /stop on lap 40/,
    );
    expect(() =>
      rivalPlayout(run, 1, { id: 'odd', stops: [{ lap: 45, to: 'SUPERSOFT' }] }),
    ).toThrow(/no SUPERSOFT/);
    expect(() => rivalPlayout(initRun(model, 1), 1, { id: 'x', stops: [] })).toThrow(/live run/);
  });

  it('scores the rival ahead only when it finishes ahead', () => {
    const run = paused();
    const { userSide, rival } = model;
    const result = (order: string[], finishers = order) => ({
      order,
      finishers,
      gaps: {},
      times: {},
      disqualified: [],
    });
    expect(rivalAhead(run, result([rival, userSide]))).toBe(true);
    expect(rivalAhead(run, result([userSide, rival]))).toBe(false);
    expect(rivalAhead(run, result([rival, userSide], [rival]))).toBe(true);
    expect(rivalAhead(run, result([userSide, rival], [userSide]))).toBe(false);
  });
});
