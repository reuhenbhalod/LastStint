// Legend difficulty's safety cars (eras build plan 9.2): the draw against the Python reference
// (parity vectors from pipeline/src/pipeline/legend.py), its rules, and the hook in the sim.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { circuitFor, legendEvents, legendRates, parseRaceId } from '../src/legend.js';
import { forkRun, initRun, isFinished, simulate, stepLap } from '../src/sim.js';
import type { RaceEvent, RaceModel, RaceResult } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = <T>(...path: string[]): T =>
  JSON.parse(readFileSync(join(repo, ...path), 'utf8')) as T;
const race = (id: string) => readJson<RaceModel>('data', 'races', `${id}.json`);

interface Vectors {
  cases: Record<
    string,
    {
      race: string;
      variant: 'storyline' | 'no-vsc' | null;
      seeds: Record<
        string,
        { events: RaceEvent[]; result: Pick<RaceResult, 'order' | 'finishers' | 'times'> }
      >;
    }
  >;
}

/** The same patch as legend.variant in the pipeline. */
function variant(model: RaceModel, name: 'storyline' | 'no-vsc' | null): RaceModel {
  const out = structuredClone(model);
  if (name === 'storyline') {
    for (const e of out.events) if (e.type === 'SC' || e.type === 'VSC') e.storylineEvent = true;
  } else if (name === 'no-vsc') {
    out.rules = { ...(out.rules ?? {}), vsc: false };
  }
  return out;
}

const neutral = (events: RaceEvent[]) =>
  events
    .filter((e) => e.type === 'SC' || e.type === 'VSC')
    .map((e) => `${e.type}@${e.lap}x${e.laps}`);

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

describe('Legend parity with the Python reference sim', () => {
  const vectors = readJson<Vectors>('pipeline', 'tests', 'fixtures', 'legend_parity.json');

  it.each(Object.keys(vectors.cases))('%s', (name) => {
    const c = vectors.cases[name];
    if (!c) throw new Error(`missing case ${name}`);
    const model = variant(race(c.race), c.variant);
    for (const [seed, want] of Object.entries(c.seeds)) {
      expect(legendEvents(model, Number(seed)), `${name} seed ${seed}`).toEqual(want.events);
      const got = simulate(model, Number(seed), { legend: true });
      expect(got.order).toEqual(want.result.order);
      expect(got.finishers).toEqual(want.result.finishers);
      for (const code of want.result.finishers) {
        expect(got.times[code]).toBeCloseTo(want.result.times[code] as number, 3);
      }
    }
  });
});

describe('Legend safety cars', () => {
  const abu = race('abu-dhabi-2021');

  it('are identical for the same seed', () => {
    for (const seed of [1, 7, 123456789]) {
      expect(legendEvents(abu, seed)).toEqual(legendEvents(abu, seed));
      expect(simulate(abu, seed, { legend: true })).toEqual(simulate(abu, seed, { legend: true }));
    }
  });

  it('move between seeds', () => {
    const draws = new Set(SEEDS.map((s) => neutral(legendEvents(race('spain-2021'), s)).join()));
    expect(draws.size).toBeGreaterThan(10);
  });

  it('never move a storyline event', () => {
    const model = variant(abu, 'storyline');
    const real = neutral(model.events);
    let extra = 0;
    for (const seed of SEEDS) {
      const got = neutral(legendEvents(model, seed));
      for (const e of real) expect(got).toContain(e);
      extra += got.length - real.length;
    }
    expect(extra).toBeGreaterThan(0);
  });

  it('replace the real non-storyline periods after the takeover', () => {
    const real = neutral(abu.events); // VSC lap 36, SC lap 53; takeover 34
    const hits = SEEDS.filter((s) => neutral(legendEvents(abu, s)).some((e) => real.includes(e)));
    expect(hits.length).toBeLessThan(SEEDS.length / 10);
  });

  it('draw no VSC where the rules have none', () => {
    const model = variant(abu, 'no-vsc');
    expect(SEEDS.some((s) => neutral(legendEvents(abu, s)).some((e) => e.startsWith('VSC')))).toBe(
      true,
    );
    for (const s of SEEDS) {
      expect(neutral(legendEvents(model, s)).some((e) => e.startsWith('VSC'))).toBe(false);
    }
  });

  it('keep retirements, red flags and periods already under way', () => {
    const model: RaceModel = {
      ...abu,
      events: [
        { lap: 30, type: 'SC', laps: 6 }, // started before the takeover (lap 34)
        { lap: 40, type: 'RED', laps: 1 },
        { lap: 41, type: 'RETIREMENT', driver: 'GIO' },
      ],
    };
    for (const s of SEEDS) {
      const got = legendEvents(model, s);
      for (const e of model.events) expect(got).toContainEqual(e);
    }
  });
});

describe('Legend in the sim', () => {
  const abu = race('abu-dhabi-2021');

  it('is carried on the run, and by its forks', () => {
    const run = initRun(abu, 5, { decisions: [], legend: true });
    expect(run.legend).toBe(true);
    expect(forkRun(run, 9).legend).toBe(true);
    expect(initRun(abu, 5, { decisions: [] }).legend).toBe(false);
  });

  it('runs the drawn periods in live play', () => {
    const seed = SEEDS.find((s) => neutral(legendEvents(abu, s)).length > 0) as number;
    const run = initRun(abu, seed, { decisions: [], legend: true });
    const runEvents = run.events.map((e) => `${e.flag.toUpperCase()}@${e.lap}x${e.laps}`);
    expect(runEvents).toEqual(neutral(legendEvents(abu, seed)));
    let neutralLaps = 0;
    while (!isFinished(run)) {
      stepLap(run);
      if (run.state.flag !== 'green') neutralLaps++;
    }
    expect(neutralLaps).toBeGreaterThan(0);
    expect(run.state.lap).toBe(abu.race.laps);
  });

  it('changes nothing without the flag (golden replays are untouched)', () => {
    for (const seed of [1, 2, 3]) {
      expect(simulate(abu, seed, { legend: false })).toEqual(simulate(abu, seed));
      expect(initRun(abu, seed).events).toEqual(initRun(abu, seed, { legend: false }).events);
    }
    const differs = SEEDS.slice(0, 20).filter(
      (s) =>
        JSON.stringify(simulate(abu, s, { legend: true })) !== JSON.stringify(simulate(abu, s)),
    );
    expect(differs.length).toBeGreaterThan(10);
  });
});

describe('Legend rates lookup', () => {
  it.each([
    ['abu-dhabi-2021', 'yas_marina'],
    ['europe-1997', 'jerez'],
    ['europe-2016', 'baku'],
    ['great-britain-1986', 'brands_hatch'],
    ['spain-1994-pits', 'catalunya'],
    ['atlantis-2021', null],
  ])('%s runs at %s', (id, circuit) => {
    expect(circuitFor(id)).toBe(circuit);
  });

  it('falls back to the all-track rate, flagged', () => {
    const measured = legendRates(race('abu-dhabi-2021'));
    expect(measured.circuit).toBe('yas_marina');
    expect(measured.scFallback).toBe(false);
    const unknown = legendRates({
      ...race('abu-dhabi-2021'),
      race: { ...race('abu-dhabi-2021').race, id: 'south-africa-1983' },
    });
    expect(unknown.scFallback && unknown.vscFallback).toBe(true);
  });

  it('rejects a malformed race id', () => {
    expect(() => parseRaceId('abu-dhabi')).toThrow(/event-slug/);
  });
});
