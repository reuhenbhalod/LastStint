// Legend difficulty's safety cars (eras build plan 9.2): the draw against the Python reference
// (parity vectors from pipeline/src/pipeline/legend.py), its rules, and the hook in the sim.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  circuitFor,
  drawnEvents,
  legendEvents,
  legendLoss,
  legendRates,
  parseRaceId,
  realFlags,
  removedEvents,
} from '../src/legend.js';
import { candidateMoments, legendMoments } from '../src/moments.js';
import type { DecisionMoment } from '../src/moments.js';
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
      variant: Variant;
      seeds: Record<
        string,
        { events: RaceEvent[]; result: Pick<RaceResult, 'order' | 'finishers' | 'times'> }
      >;
    }
  >;
}

type Variant = 'storyline' | 'no-vsc' | '1990' | null;

/** The same patch as legend.variant in the pipeline. */
function variant(model: RaceModel, name: Variant): RaceModel {
  const out = structuredClone(model);
  if (name === 'storyline') {
    for (const e of out.events) if (e.type === 'SC' || e.type === 'VSC') e.storylineEvent = true;
  } else if (name === 'no-vsc') {
    out.rules = { ...(out.rules ?? {}), vsc: false };
  } else if (name === '1990') {
    out.race.id = `${parseRaceId(out.race.id)[0]}-1990`;
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

describe('No Legend safety cars before 1993', () => {
  const abu = race('abu-dhabi-2021');

  it('a 1990 race draws no SC or VSC, and loses its real non-storyline ones', () => {
    const m = variant(abu, '1990');
    for (const s of SEEDS) expect(neutral(legendEvents(m, s))).toEqual([]);
    // 1993 draws again.
    const m93 = { ...m, race: { ...m.race, id: 'abu-dhabi-1993' } };
    expect(SEEDS.some((s) => neutral(legendEvents(m93, s)).length > 0)).toBe(true);
  });

  it("keeps a 1990 race's storyline events and periods already under way", () => {
    const m = variant(variant(abu, 'storyline'), '1990');
    for (const s of SEEDS) expect(neutral(legendEvents(m, s))).toEqual(neutral(abu.events));
    const early: RaceModel = { ...m, events: [{ lap: 30, type: 'SC', laps: 6 }] };
    for (const s of SEEDS.slice(0, 10))
      expect(neutral(legendEvents(early, s))).toEqual(['SC@30x6']);
  });
});

describe('Legend calls follow the safety cars', () => {
  const abu = race('abu-dhabi-2021'); // SC/VSC moments at 36 (VSC), 53, 55, 57 (SC)
  const scIds = ['vsc-cover', 'sc-stop', 'sc-last-chance', 'restart-stance'];
  const otherIds = ['tyres-going', 'manage-or-push'];

  it('drops the moments of a removed SC/VSC and keeps every other moment as it is', () => {
    expect(removedEvents(abu).map((e) => e.lap)).toEqual([36, 53]);
    for (const s of SEEDS) {
      const ids = legendMoments(abu, s).map((m) => m.id);
      for (const id of scIds) expect(ids).not.toContain(id);
      for (const m of abu.decisionMoments.filter((x) => otherIds.includes(x.id))) {
        expect(legendMoments(abu, s)).toContainEqual(m);
      }
    }
  });

  it('keeps the moments of a storyline SC/VSC', () => {
    const m = variant(abu, 'storyline');
    for (const s of SEEDS.slice(0, 20)) {
      const ids = legendMoments(m, s).map((x) => x.id);
      for (const id of [...scIds, ...otherIds]) expect(ids).toContain(id);
    }
  });

  it("puts the finder's SC/VSC call at each drawn SC/VSC", () => {
    let made = 0;
    for (const s of SEEDS) {
      const moments = legendMoments(abu, s);
      expect(legendMoments(abu, s)).toEqual(moments); // deterministic
      const kept = moments.filter((m) => !m.id.startsWith('legend-'));
      for (const e of drawnEvents(abu, legendEvents(abu, s))) {
        const at = moments.find((m) => m.id === `legend-${e.type.toLowerCase()}-${e.lap}`);
        const room =
          e.lap > abu.race.takeoverLap &&
          e.lap < abu.race.laps &&
          !kept.some((m) => Math.abs(m.lap - e.lap) < 3);
        expect(!!at, `seed ${s} ${e.type}@${e.lap}`).toBe(room);
        if (!at) continue;
        made++;
        expect(at).toMatchObject({ lap: e.lap, trigger: e.type, realOptionId: null });
        expect(at.options.map((o) => o.id)).toEqual([
          'stay-out',
          'box-soft',
          'box-medium',
          'box-hard',
        ]);
      }
      // No two moments on top of each other.
      const laps = moments.map((m) => m.lap);
      expect(new Set(laps).size).toBe(laps.length);
    }
    expect(made).toBeGreaterThan(10);
  });

  it('a drawn call has the options the finder gives a real SC on that lap', () => {
    const s = SEEDS.find((x) => legendMoments(abu, x).some((m) => m.trigger === 'SC')) as number;
    const drawn = legendMoments(abu, s).find((m) => m.trigger === 'SC') as DecisionMoment;
    const real: RaceModel = {
      ...abu,
      events: [{ lap: drawn.lap, type: 'SC', laps: 3 }],
      decisionMoments: [],
    };
    const found = candidateMoments(real).find((m) => m.lap === drawn.lap);
    expect(found?.trigger).toBe('SC');
    expect(drawn.options).toEqual(found?.options);
  });
});

describe("Legend stops pay the lap's real conditions", () => {
  const abu = race('abu-dhabi-2021'); // VSC laps 36-38: LEC 36, ALO/GAS/PER/VER 37 measured
  const vscLaps = [36, 37, 38];
  const flagsOn = (m: RaceModel, s: number) => {
    const run = initRun(m, s, { legend: true });
    return (lap: number) => run.neutral.get(lap);
  };

  it('keeps a measured loss only under the flag it was measured under', () => {
    const neutral = new Map([[37, 'sc' as const]]);
    expect(realFlags(abu).get(37)).toBe('vsc');
    expect(legendLoss(abu, new Map([[37, 'vsc' as const]]), { loss: 10 }, 37)).toBe(10);
    expect(legendLoss(abu, new Map(), { loss: 10 }, 37)).toBeUndefined(); // now green
    expect(legendLoss(abu, neutral, { loss: 10 }, 37)).toBeUndefined(); // now a SC
    expect(legendLoss(abu, neutral, {}, 37)).toBeUndefined();
    expect(legendLoss(abu, new Map(), { loss: 22 }, 20)).toBe(22); // green, still green
  });

  it('a real VSC stop on a now-green lap costs the green loss', () => {
    // As if the real race had been green on laps 36-38: no VSC, those stops unmeasured (they
    // pay the track's green figure). Legend draws the same periods (the VSC is never kept).
    const green: RaceModel = structuredClone(abu);
    green.events = green.events.filter((e) => e.type !== 'VSC');
    for (const d of green.drivers) {
      for (const st of d.realStrategy) if (vscLaps.includes(st.lap)) st.loss = undefined;
    }
    const seeds = SEEDS.filter((s) => vscLaps.every((l) => flagsOn(abu, s)(l) === undefined));
    expect(seeds.length).toBeGreaterThan(50);
    for (const s of seeds.slice(0, 20)) {
      expect(legendEvents(green, s)).toEqual(legendEvents(abu, s));
      expect(simulate(abu, s, { legend: true })).toEqual(simulate(green, s, { legend: true }));
    }
    // Without Legend the measured (VSC) losses still count.
    expect(simulate(abu, 1)).not.toEqual(simulate(green, 1));
  });

  it('a real green stop under a drawn SC/VSC costs the SC/VSC loss', () => {
    // NOR's lap-49 stop is a measured green stop.
    const s = SEEDS.find((x) => flagsOn(abu, x)(49) !== undefined) as number;
    expect(s).toBeDefined();
    const unmeasured: RaceModel = structuredClone(abu);
    for (const st of unmeasured.drivers.find((d) => d.code === 'NOR')?.realStrategy ?? []) {
      if (st.lap === 49) st.loss = undefined;
    }
    expect(simulate(abu, s, { legend: true })).toEqual(simulate(unmeasured, s, { legend: true }));
    // A seed where lap 49 stays green keeps NOR's measured loss.
    const g = SEEDS.find((x) => flagsOn(abu, x)(49) === undefined) as number;
    expect(simulate(abu, g, { legend: true })).not.toEqual(
      simulate(unmeasured, g, { legend: true }),
    );
  });

  it("a player's call on the real stop pays the same", () => {
    const s = SEEDS.find((x) => vscLaps.every((l) => flagsOn(abu, x)(l) === undefined)) as number;
    const play = (m: RaceModel) => {
      const run = initRun({ ...m, userSide: 'LEC' }, s, {
        decisions: [{ lap: 35, kind: 'pit', compound: 'MEDIUM' }], // LEC's real stop (out-lap 36)
        legend: true,
        incidents: false,
      });
      while (run.state.lap < 36) stepLap(run);
      return run.state.cars.LEC?.totalTime as number;
    };
    const unmeasured: RaceModel = structuredClone(abu);
    for (const st of unmeasured.drivers.find((d) => d.code === 'LEC')?.realStrategy ?? []) {
      st.loss = undefined;
    }
    // The measured 12.1 s VSC stop pays the green figure, as an unmeasured stop does.
    expect(play(abu)).toBeCloseTo(play(unmeasured), 9);
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
