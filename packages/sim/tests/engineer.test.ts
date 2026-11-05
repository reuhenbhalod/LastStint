// The race engineer side of the user's car (race engineer spec): battle moves, contact and a
// broken front wing, track limits, lapped cars, the driver's requests and trust, and that all of
// it replays exactly from the call log.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import canadaJson from '../../../data/races/canada-2022.json';
import { battlesFor, moodOf, startTrust } from '../src/engineer.js';
import {
  type Run,
  classify,
  engineerConfig,
  forkRun,
  initRun,
  isFinished,
  stepLap,
  validateDecisions,
} from '../src/sim.js';
import type { BattleMove, Decision, RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;
const canada = canadaJson as unknown as RaceModel;
const cfg = engineerConfig(abu) as NonNullable<ReturnType<typeof engineerConfig>>;

/** A live run stepped to the first green lap where the user's car has a car `side` within the
 * battle window, or null. */
function toBattle(model: RaceModel, seed: number, side: 'ahead' | 'behind'): Run | null {
  const run = initRun(model, seed, { decisions: [] });
  while (!isFinished(run) && run.state.lap < model.race.laps - 2) {
    const b = battlesFor(run.state, model, cfg)[side];
    if (b && run.state.nextFlag === 'green' && run.state.flag === 'green') return run;
    stepLap(run);
  }
  return null;
}

/** Share of `n` battle laps where the move (or none) ends with the user ahead of the other car. */
function aheadShare(model: RaceModel, side: 'ahead' | 'behind', move: BattleMove | null, n = 120) {
  let ahead = 0;
  let laps = 0;
  for (let seed = 1; laps < n && seed < 2000; seed++) {
    const run = toBattle(model, seed, side);
    if (!run) continue;
    const other = battlesFor(run.state, model, cfg)[side]?.code as string;
    const lap = run.state.lap + 1;
    const calls: Decision[] = move ? [{ lap, kind: 'battle', move }] : [];
    const fork = forkRun(run, seed * 7 + 3, calls);
    stepLap(fork);
    const order = fork.state.order;
    if (order.indexOf(model.userSide) < order.indexOf(other)) ahead++;
    laps++;
  }
  return ahead / laps;
}

describe('race engineer', () => {
  it('starts the driver’s trust from his attitude, and only in live play', () => {
    expect(startTrust(cfg, 'HAM')).toBeLessThan(startTrust(cfg, 'BOT'));
    const live = initRun(abu, 1, { decisions: [] });
    expect(live.state.engineer?.trust).toBe(startTrust(cfg, 'HAM'));
    expect(moodOf(cfg, live.state.engineer?.trust as number)).toBe('calm');
    expect(initRun(abu, 1).state.engineer).toBeUndefined();
    expect(initRun(abu, 1, { decisions: [], incidents: false }).state.engineer).toBeUndefined();
  });

  it('trust swings hard (battles and trust spec D3) and settles back from either side', () => {
    // Starts calm-ish, 50-80 by attitude.
    for (const code of ['HAM', 'BOT', 'VER']) {
      expect(startTrust(cfg, code)).toBeGreaterThanOrEqual(50);
      expect(startTrust(cfg, code)).toBeLessThanOrEqual(80);
    }
    // One contact takes a calm driver a mood down; two bad calls in a row, two.
    const d = cfg.trust.deltas;
    expect(moodOf(cfg, 70 + d.contact)).toBe('tense');
    expect(moodOf(cfg, 70 + d.contact + d['passed-anyway'])).toBe('frustrated');
    // And good calls win him back fast.
    expect(moodOf(cfg, 40 + 2 * d['pass-called'])).toBe('calm');
    // Above where he started, quiet laps bring him back down.
    const run = initRun(abu, 1, { decisions: [] });
    const eng = run.state.engineer as NonNullable<typeof run.state.engineer>;
    eng.trust = eng.baseTrust + 20;
    eng.lastEvent = run.state.lap;
    for (let i = 0; i < 4; i++) stepLap(run);
    expect(eng.trust).toBeLessThan(eng.baseTrust + 20);
    expect(eng.trust).toBeGreaterThanOrEqual(eng.baseTrust);
  });

  it('battle moves change the pass odds', () => {
    const attack = aheadShare(canada, 'ahead', 'dive-inside');
    const sit = aheadShare(canada, 'ahead', null);
    const wait = aheadShare(canada, 'ahead', 'wait-drs');
    expect(attack).toBeGreaterThan(sit);
    expect(wait).toBeLessThan(attack);
    const hard = aheadShare(canada, 'behind', 'defend-hard');
    const none = aheadShare(canada, 'behind', null);
    const yieldTo = aheadShare(canada, 'behind', 'let-go');
    expect(hard).toBeGreaterThanOrEqual(none);
    expect(yieldTo).toBeLessThan(none);
  });

  it('contact breaks the front wing; the next stop fixes it and costs more', () => {
    let found = false;
    for (let seed = 1; seed < 3000 && !found; seed++) {
      const run = toBattle(canada, seed, 'ahead');
      if (!run) continue;
      const lap = run.state.lap + 1;
      const fork = forkRun(run, seed, [{ lap, kind: 'battle', move: 'dive-inside' }]);
      stepLap(fork);
      const wing = fork.notes.find((n) => n.kind === 'contact' && n.detail === 'wing');
      if (!wing) continue;
      found = true;
      const eng = fork.state.engineer;
      expect(eng?.damage).toBeGreaterThan(0);
      // The driver blames the call.
      expect(fork.notes.some((n) => n.kind === 'trust' && n.detail === 'contact')).toBe(true);
      expect(eng?.trust).toBeLessThan(eng?.baseTrust as number);
      // Box for a new nose.
      const pit = forkRun(fork, seed, [{ lap: fork.state.lap + 1, kind: 'pit', compound: 'HARD' }]);
      stepLap(pit);
      stepLap(pit);
      expect(pit.notes.some((n) => n.kind === 'nose')).toBe(true);
      expect(pit.state.engineer?.damage).toBe(0);
    }
    expect(found).toBe(true);
  });

  it('adds a track-limits penalty at the flag', () => {
    const run = initRun(abu, 3, { decisions: [] });
    const eng = run.state.engineer;
    if (!eng) throw new Error('no engineer');
    while (!isFinished(run)) stepLap(run);
    const before = classify(run);
    eng.penalty = 60;
    const after = classify(run);
    expect(after.times.HAM).toBeCloseTo((before.times.HAM as number) + 60, 6);
    expect(after.order.indexOf('HAM')).toBeGreaterThan(before.order.indexOf('HAM'));
  });

  it('a furious driver picks his own battle moves', () => {
    let rogue = false;
    for (let seed = 1; seed < 400 && !rogue; seed++) {
      const run = toBattle(canada, seed, 'ahead');
      if (!run?.state.engineer) continue;
      run.state.engineer.trust = 5;
      run.state.engineer.baseTrust = 5;
      const fork = forkRun(run, seed);
      stepLap(fork);
      rogue = fork.notes.some((n) => n.kind === 'rogue');
    }
    expect(rogue).toBe(true);
  });

  it('judges a refused request: tyres past the cliff prove him right', () => {
    const run = initRun(abu, 5, { decisions: [] });
    while (run.state.lap < 50) stepLap(run);
    const lap = run.state.lap + 1;
    const fork = forkRun(run, 9, [{ lap, kind: 'reply', request: 'box', yes: false }]);
    // HAM's hards from lap 14 are far past their cliff by now.
    for (let i = 0; i < 3; i++) stepLap(fork);
    const verdict = fork.notes.find((n) => n.kind === 'trust' && n.detail?.startsWith('request'));
    expect(verdict?.detail).toBe('request-wrong');
  });

  it('replays every new call exactly from the log', () => {
    const start = canada.race.takeoverLap;
    const calls: Decision[] = [
      { lap: start + 2, kind: 'battle', move: 'dive-inside' },
      { lap: start + 3, kind: 'limits', careful: true },
      { lap: start + 4, kind: 'blue', action: 'go-round' },
      { lap: start + 5, kind: 'reply', request: 'push', yes: false },
      { lap: start + 6, kind: 'battle', move: 'defend-hard', driver: true },
    ];
    const play = () => {
      const run = initRun(canada, 77, {
        decisions: calls.map((d, i) => ({ ...d, at: start + i })),
      });
      while (!isFinished(run)) stepLap(run);
      return run;
    };
    const a = play();
    const b = play();
    expect(classify(a)).toEqual(classify(b));
    expect(a.notes).toEqual(b.notes);
    expect(a.state.engineer).toEqual(b.state.engineer);
  });

  it('a fork never changes its parent’s engineer state', () => {
    const run = initRun(canada, 4, { decisions: [] });
    for (let i = 0; i < 5; i++) stepLap(run);
    const snapshot = JSON.stringify(run.state.engineer);
    const fork = forkRun(run, 1, [
      { lap: run.state.lap + 1, kind: 'reply', request: 'box', yes: false },
    ]);
    while (!isFinished(fork)) stepLap(fork);
    expect(JSON.stringify(run.state.engineer)).toBe(snapshot);
  });

  it('rejects malformed engineer calls', () => {
    const lap = abu.race.takeoverLap + 1;
    const bad = [
      { lap, kind: 'battle', move: 'teleport' },
      { lap, kind: 'limits', careful: 'yes' },
      { lap, kind: 'blue', action: 'ram' },
      { lap, kind: 'reply', request: 'box', yes: 1 },
      { lap, kind: 'reply', request: 'win', yes: true },
    ] as unknown as Decision[];
    for (const d of bad) expect(() => validateDecisions(abu, [d])).toThrow();
    expect(() =>
      validateDecisions(abu, [{ lap, kind: 'battle', move: 'cover-inside', driver: true }]),
    ).not.toThrow();
  });
});
