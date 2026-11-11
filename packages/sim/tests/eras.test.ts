// Era config blocks (eras build plan 1.2): headset.json has a block for every schema era, so a
// race tagged with any era replays and plays live with engineer calls and incidents, and the
// eras before DRS / a battery have no `wait-drs`, `overtake-button` or ERS modes (roadmap R5).
// The race files are re-tagged in memory here; data/races is left alone.

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import canadaJson from '../../../data/races/canada-2022.json';
import schema from '../../../packages/schema/race-model.schema.json';
import { battlesFor } from '../src/engineer.js';
import headset from '../src/headset.json';
import {
  type Run,
  engineerConfig,
  forkRun,
  initRun,
  isFinished,
  modeEffects,
  simulate,
  stepLap,
  validateDecisions,
} from '../src/sim.js';
import type { Decision, Era, RaceModel } from '../src/types.js';

const ERAS = (schema as { properties: { era: { enum: Era[] } } }).properties.era.enum;
const abu = abuJson as unknown as RaceModel;
const canada = canadaJson as unknown as RaceModel;

const retag = (model: RaceModel, era: Era): RaceModel => ({ ...model, era });

// Roadmap R5, at the schema enum's granularity (see each block's `_rules`).
const RULES: Record<Era, { drs: boolean; ers: boolean }> = {
  '1988-1993': { drs: false, ers: false },
  '1994-2009': { drs: false, ers: false },
  '2010-2013': { drs: true, ers: true },
  '2014-2025': { drs: true, ers: true },
  '2026+': { drs: false, ers: true },
};

/** A live run stepped to the first green lap with a car within the battle window ahead. */
function toBattle(model: RaceModel, seed: number): Run | null {
  const cfg = engineerConfig(model);
  if (!cfg) return null;
  const run = initRun(model, seed, { decisions: [] });
  while (!isFinished(run) && run.state.lap < model.race.laps - 2) {
    const b = battlesFor(run.state, model, { ...cfg, battleWindow: 1.0 }).ahead;
    if (b && run.state.nextFlag === 'green' && run.state.flag === 'green') return run;
    stepLap(run);
  }
  return null;
}

describe('era config blocks', () => {
  it('headset.json has a block for every schema era, and no other', () => {
    const blocks = Object.keys(headset).filter((k) => !k.startsWith('_'));
    expect(blocks.sort()).toEqual([...ERAS].sort());
    expect(Object.keys(RULES).sort()).toEqual([...ERAS].sort());
  });

  it('blocks other than 2014-2025 are marked as copied from it', () => {
    const h = headset as unknown as Record<string, { _copiedFrom?: string }>;
    for (const era of ERAS) {
      expect(h[era]?._copiedFrom).toBe(era === '2014-2025' ? undefined : '2014-2025');
    }
  });
});

describe.each(ERAS)('a race tagged %s', (era) => {
  const model = retag(abu, era);
  const rules = RULES[era];

  it('replays exactly as the real race does (the era only touches live play)', () => {
    for (const seed of [1, 2, 3]) expect(simulate(model, seed)).toEqual(simulate(abu, seed));
  });

  it('plays live to the flag with the race engineer, and incidents fire', () => {
    let incidents = 0;
    let strikes = 0;
    for (let seed = 0; seed < 200; seed++) {
      const run = initRun(model, seed, { decisions: [] });
      expect(run.state.engineer).toBeDefined();
      while (!isFinished(run)) stepLap(run);
      if (run.notes.some((n) => n.kind === 'incident')) incidents++;
      if (run.notes.some((n) => n.kind === 'strike')) strikes++;
    }
    expect(incidents).toBeGreaterThan(0);
    expect(strikes).toBeGreaterThan(0);
  });

  it('takes a battle call and fights the car ahead', () => {
    const m = retag(canada, era);
    let fought = false;
    for (let seed = 1; seed < 400 && !fought; seed++) {
      const run = toBattle(m, seed);
      if (!run) continue;
      const fork = forkRun(run, seed, [
        { lap: run.state.lap + 1, kind: 'battle', move: 'dive-inside' },
      ]);
      stepLap(fork);
      fought = fork.notes.some((n) => n.kind === 'battle' && n.lap === fork.state.lap);
    }
    expect(fought).toBe(true);
  });

  it(`${rules.drs ? 'has' : 'has no'} DRS and ${rules.ers ? 'has' : 'has no'} battery`, () => {
    const lap = model.race.takeoverLap + 1;
    const call = (d: Decision) => () => validateDecisions(model, [d]);
    const drs = call({ lap, kind: 'battle', move: 'wait-drs' });
    const button = call({ lap, kind: 'battle', move: 'overtake-button' });
    const deploy = call({ lap, kind: 'mode', key: 'ers', value: 'deploy' });
    if (rules.drs) expect(drs).not.toThrow();
    else expect(drs).toThrow(/wait-drs/);
    const live = initRun(model, 1, { decisions: [] });
    if (rules.ers) {
      expect(button).not.toThrow();
      expect(deploy).not.toThrow();
      expect(live.state.cars[model.userSide]?.battery).toBeTypeOf('number');
      expect(modeEffects(model)?.ers).toBeDefined();
    } else {
      expect(button).toThrow(/overtake-button/);
      expect(deploy).toThrow(/unknown mode/);
      expect(live.state.cars[model.userSide]?.battery).toBeUndefined();
      expect(modeEffects(model)?.ers).toBeUndefined();
    }
    // The other battle moves and headset modes are there in every era.
    expect(call({ lap, kind: 'battle', move: 'defend-hard' })).not.toThrow();
    expect(call({ lap, kind: 'mode', key: 'pace', value: 'push' })).not.toThrow();
  });
});
