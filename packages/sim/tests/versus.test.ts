// Versus mode's engine (docs/versus-spec.md V1-V2, docs/versus-action-spec.md): two player cars
// on a real track's numbers, the same race from the same setup and calls, the one-stop rule,
// the safety car, the battles and the calls, and how the four cars compare when nobody makes a
// call beyond the same one stop.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RaceModel } from '../src/types.js';
import {
  DUEL,
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
/** The same one stop for both: hards at the end of lap 7. */
const oneStop: VersusCall[] = [
  { player: 0, lap: 7, kind: 'pit', compound: 'HARD' },
  { player: 1, lap: 7, kind: 'pit', compound: 'HARD' },
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

  it('runs 15 laps, with a SC or VSC in about two races in three and a gremlin in one in four', () => {
    let neutral = 0;
    let gremlins = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const run = initVersus(model('suzuka'), setup('suzuka', seed));
      if (run.neutral.size) neutral++;
      if (run.gremlin) gremlins++;
      while (!versusFinished(run)) stepVersus(run);
      expect(run.state.lap).toBe(VERSUS_LAPS);
      if (run.gremlin)
        expect(
          run.state.notes.some((n) => n.kind === 'gremlin' && n.lap === run.gremlin?.lap),
        ).toBe(true);
    }
    expect(VERSUS_LAPS).toBe(15);
    expect(neutral / 300).toBeGreaterThan(0.55);
    expect(neutral / 300).toBeLessThan(0.8);
    expect(gremlins / 300).toBeGreaterThan(0.17);
    expect(gremlins / 300).toBeLessThan(0.33);
  });

  it('fights every pass as a battle: covering the side the attacker goes shuts the door', () => {
    // Lap 1 from the grid (0.3 s apart) is always a battle; force both picks.
    const passRate = (attack: 'inside' | 'outside', defend: 'cover-inside' | 'cover-outside') => {
      let passes = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const run = initVersus(model('monza'), setup('monza', seed));
        run.neutral.clear();
        run.state.nextFlag = 'green';
        const due = versusCallsDue(run).find((m) => m.kind === 'battle');
        if (!due?.battle) throw new Error('no battle on lap 1');
        const atk = due.battle.attacker;
        callVersus(run, { player: atk, lap: 1, kind: 'battle', pick: attack, boost: false });
        callVersus(run, {
          player: atk === 0 ? 1 : 0,
          lap: 1,
          kind: 'battle',
          pick: defend,
          boost: false,
        });
        stepVersus(run);
        const [a, b] = run.state.cars;
        const leader = a.totalTime <= b.totalTime ? 0 : 1;
        if (leader === atk) passes++;
        const note = run.state.notes.find((n) => n.kind === 'battle');
        expect(note?.detail?.startsWith(`${attack}|${defend}|`)).toBe(true);
      }
      return passes / 300;
    };
    expect(DUEL.inside['cover-outside'].pass).toBeGreaterThan(DUEL.inside['cover-inside'].pass);
    expect(passRate('inside', 'cover-outside')).toBeGreaterThan(
      passRate('inside', 'cover-inside') + 0.3,
    );
    expect(passRate('outside', 'cover-inside')).toBeGreaterThan(
      passRate('outside', 'cover-outside') + 0.3,
    );
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

  it('raises the calls that matter, once each, and no filler', () => {
    const run = initVersus(model('suzuka'), setup('suzuka', 21));
    run.neutral.clear(); // a green race
    run.state.nextFlag = 'green';
    const seen: string[] = [];
    let battles = 0;
    while (!versusFinished(run)) {
      // Strategy calls first, then (asked again) the lap's battle.
      for (let k = 0; k < 2; k++) {
        for (const m of versusCallsDue(run)) {
          seen.push(`${m.player}:${m.kind}:${m.lap}`);
          if (m.kind === 'battle') {
            battles++;
            expect(m.battle?.attacker).toBe(
              run.state.cars[0].totalTime <= run.state.cars[1].totalTime ? 1 : 0,
            );
          }
          // Player 0 takes the first stop it's offered; player 1 stays out to the end.
          if (m.player === 0 && m.options.includes('box') && run.state.cars[0].stops === 0)
            callVersus(run, { player: 0, lap: m.lap, kind: 'pit', compound: 'HARD' });
        }
      }
      stepVersus(run);
    }
    // Lap 1 is a battle from the grid, for both players.
    expect(seen).toContain('0:battle:1');
    expect(seen).toContain('1:battle:1');
    expect(battles).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size).toBe(seen.length);
    // Player 1 answered player 0's stop, and never stopped: asked one last time on lap 14.
    expect(seen.some((x) => x.startsWith('1:theyPitted'))).toBe(true);
    expect(seen).toContain('1:pitWindow:14');
    expect(seen.some((x) => x.endsWith(':15') && !x.includes('battle'))).toBe(false);
    // Never a battle on the lap straight after one (no one waited here).
    const battleLaps = [
      ...new Set(seen.filter((x) => x.includes('battle')).map((x) => Number(x.split(':')[2]))),
    ];
    for (let i = 1; i < battleLaps.length; i++) {
      const gap = (battleLaps[i] as number) - (battleLaps[i - 1] as number);
      const waited = run.state.notes.some(
        (n) => n.kind === 'battle' && n.lap === battleLaps[i - 1] && n.detail?.startsWith('wait'),
      );
      if (!waited) expect(gap).toBeGreaterThan(1);
    }
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
