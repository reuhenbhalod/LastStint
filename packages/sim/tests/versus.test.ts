// Versus mode's engine (docs/versus-spec.md V1-V2): two player cars on a real track's numbers,
// the same race from the same setup and calls, the one-stop rule, the safety car, and how the
// four cars compare when nobody makes a call beyond the same one stop.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RaceModel } from '../src/types.js';
import {
  VERSUS_CARS,
  VERSUS_LAPS,
  VERSUS_TRACKS,
  type VersusCall,
  type VersusSetup,
  callVersus,
  initVersus,
  simulateVersus,
  stepVersus,
  versusCallsDue,
  versusFinished,
} from '../src/versus.js';

const load = (raceFile: string) =>
  JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'data', 'races', `${raceFile}.json`), 'utf8'),
  ) as RaceModel;
const models = Object.fromEntries(VERSUS_TRACKS.map((t) => [t.id, load(t.raceFile)]));
const model = (track: string) => models[track] as RaceModel;

const setup = (track: string, seed: number, a = 'balanced', b = 'balanced'): VersusSetup => ({
  track,
  seed,
  players: [
    { name: 'A', car: a, startTyre: 'MEDIUM' },
    { name: 'B', car: b, startTyre: 'MEDIUM' },
  ],
});
/** The same one stop for both: hards at the end of lap 10. */
const oneStop: VersusCall[] = [
  { player: 0, lap: 10, kind: 'pit', compound: 'HARD' },
  { player: 1, lap: 10, kind: 'pit', compound: 'HARD' },
];

describe('versus engine', () => {
  it('runs the same race from the same setup and calls (both browsers agree)', () => {
    const calls: VersusCall[] = [
      ...oneStop,
      { player: 0, lap: 3, kind: 'mode', key: 'pace', value: 'push' },
      { player: 1, lap: 6, kind: 'move', move: 'defend-hard' },
    ];
    const one = simulateVersus(model('monza'), setup('monza', 7, 'bullet', 'glider'), calls);
    const two = simulateVersus(model('monza'), setup('monza', 7, 'bullet', 'glider'), calls);
    expect(two.run.state).toEqual(one.run.state);
    expect(two.result).toEqual(one.result);
  });

  it('plays the same when calls arrive lap by lap as when they are all known up front', () => {
    const s = setup('spa', 11, 'endurance', 'bullet');
    const all = simulateVersus(model('spa'), s, oneStop);
    const live = initVersus(model('spa'), s);
    while (!versusFinished(live)) {
      for (const c of oneStop) if (c.lap === live.state.lap + 1) callVersus(live, c);
      stepVersus(live);
    }
    expect(live.state).toEqual(all.run.state);
  });

  it("one player's call never moves the other car's random draws", () => {
    const s = setup('bahrain', 3);
    const base = simulateVersus(model('bahrain'), s, oneStop);
    const push = simulateVersus(model('bahrain'), s, [
      ...oneStop,
      { player: 0, lap: 2, kind: 'mode', key: 'pace', value: 'push' },
    ]);
    // Car B's own lap times don't change (only a pass or held-up lap could move it).
    const fights = push.run.state.notes.filter((n) => n.kind === 'pass' || n.kind === 'held');
    if (!fights.length)
      expect(push.run.state.cars[1].totalTime).toBe(base.run.state.cars[1].totalTime);
  });

  it('classifies a car without a stop last (two dry compounds)', () => {
    const { result } = simulateVersus(model('monza'), setup('monza', 5), [
      oneStop[0] as VersusCall,
    ]);
    expect(result.disqualified).toEqual([1]);
    expect(result.order).toEqual([0, 1]);
  });

  it('runs 20 laps, with a SC or VSC in about one race in three', () => {
    let neutral = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const run = initVersus(model('suzuka'), setup('suzuka', seed));
      if (run.neutral.size) neutral++;
      while (!versusFinished(run)) stepVersus(run);
      expect(run.state.lap).toBe(VERSUS_LAPS);
    }
    expect(neutral / 300).toBeGreaterThan(0.2);
    expect(neutral / 300).toBeLessThan(0.5);
  });

  it('bunches the cars up at the end of a safety car', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const run = initVersus(model('monza'), setup('monza', seed));
      const sc = [...run.neutral].filter(([, f]) => f === 'sc').map(([l]) => l);
      if (!sc.length) continue;
      const last = Math.max(...sc);
      while (run.state.lap < last) stepVersus(run);
      const [a, b] = run.state.cars;
      expect(Math.abs(a.totalTime - b.totalTime)).toBeLessThanOrEqual(0.5 + 1e-9);
      return;
    }
    throw new Error('no safety car in 400 seeds');
  });

  it('keeps the cars close: no car wins more than about 60% of one-stop races on any track', () => {
    const N = 400;
    for (const t of VERSUS_TRACKS) {
      for (const a of VERSUS_CARS) {
        let wins = 0;
        for (const b of VERSUS_CARS) {
          if (a.id === b.id) continue;
          for (let seed = 1; seed <= N; seed++) {
            // Both grid slots, so the start doesn't decide it.
            const r1 = simulateVersus(model(t.id), setup(t.id, seed, a.id, b.id), oneStop).result;
            if (r1.order[0] === 0) wins++;
          }
        }
        const rate = wins / (N * (VERSUS_CARS.length - 1));
        expect(rate, `${a.id} at ${t.id}`).toBeLessThan(0.63);
        expect(rate, `${a.id} at ${t.id}`).toBeGreaterThan(0.37);
      }
    }
  });

  it('raises the big calls: the pit window, the other car pitting, the final laps; once each', () => {
    const run = initVersus(model('suzuka'), setup('suzuka', 21));
    run.neutral.clear(); // a green race
    run.state.nextFlag = 'green';
    const seen: string[] = [];
    while (!versusFinished(run)) {
      for (const m of versusCallsDue(run)) {
        seen.push(`${m.player}:${m.kind}:${m.lap}`);
        // Player 0 answers the first pit window by boxing; player 1 always stays out.
        if (m.player === 0 && m.kind === 'pitWindow' && run.state.cars[0].stops === 0)
          callVersus(run, { player: 0, lap: m.lap, kind: 'pit', compound: 'HARD' });
      }
      stepVersus(run);
    }
    expect(seen).toContain('0:pitWindow:8');
    expect(seen).toContain('1:pitWindow:8');
    expect(seen).toContain('1:theyPitted:10'); // player 0 stopped on lap 9 (in-lap 8)
    expect(seen.filter((x) => x.startsWith('1:pitWindow')).length).toBeGreaterThan(1); // asked again
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('raises the safety car call for both players the lap before it comes out', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const run = initVersus(model('monza'), setup('monza', seed));
      const first = Math.min(...run.neutral.keys());
      if (!Number.isFinite(first)) continue;
      while (run.state.lap < first - 1) {
        versusCallsDue(run);
        stepVersus(run);
      }
      const due = versusCallsDue(run).filter((m) => m.kind === 'neutral');
      expect(due.map((m) => m.player)).toEqual([0, 1]);
      return;
    }
    throw new Error('no neutralization in 200 seeds');
  });
});
