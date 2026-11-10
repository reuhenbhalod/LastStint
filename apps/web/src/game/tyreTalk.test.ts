// The tyre calls' wording (docs/tyre-calls-spec.md) on every playable race: the big tyre and
// pace calls say what the tyres are doing, not just their age, and every number they quote
// is the race's own.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type RaceModel, isWetTyre, tyreLife } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { briefFor } from './brief.js';
import { pick, startingToGo, tyreFacts, wantToBox } from './tyreTalk.js';

const dir = join(__dirname, '..', '..', '..', '..', 'data', 'races');
const races = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel);

describe('tyre facts', () => {
  it('the tyre calls lead with what the tyres are doing on every race', () => {
    let calls = 0;
    for (const model of races) {
      const engine = new GameEngine(model, 1, { decisions: [] });
      for (const m of model.decisionMoments) {
        if (m.trigger !== 'cliff') continue;
        while (engine.lap < m.lap - 1 && !engine.isFinished()) engine.step();
        const me = engine.state.cars[model.userSide];
        if (!me || me.retired || isWetTyre(me.compound) || model.weather) continue;
        const { headline } = briefFor(m, engine.state, model);
        if (!m.options.some((o) => o.decisions.some((d) => d.kind === 'pit'))) continue;
        calls++;
        expect(headline, `${model.race.id} lap ${m.lap}`).not.toMatch(/laps old/);
        // The life it quotes is the game's tyre life.
        const life = Math.round(tyreLife(model.compounds[me.compound] as never) - me.tyreWear);
        const quoted = headline.match(/About (\d+) laps? left|about (\d+) laps? in them/);
        if (quoted) expect(Number(quoted[1] ?? quoted[2])).toBe(life);
      }
    }
    expect(calls).toBeGreaterThan(5);
  });

  it('says no rejoin and no undercut when the facts are not there', () => {
    const model = races.find((m) => m.race.id === 'abu-dhabi-2021') as RaceModel;
    const engine = new GameEngine(model, 1, { decisions: [] });
    const facts = tyreFacts(engine.state, model, null);
    expect(facts.some((f) => f.includes('come out'))).toBe(false);
  });

  it('varies the driver lines by lap, the same on a replay', () => {
    expect(new Set([0, 1, 2].map((l) => startingToGo('HARD', l))).size).toBe(3);
    expect(wantToBox('SOFT', 7)).toBe(wantToBox('SOFT', 7));
    expect(pick(['a', 'b'], 5)).toBe('b');
  });
});
