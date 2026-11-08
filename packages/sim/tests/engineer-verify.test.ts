// Every playable race, played with race engineer calls (a battle move whenever a car is within
// a second, a lapped car, track-limit care, a turned-down request), verifies exactly: the
// server's full re-grade gives the game's result and score (race engineer spec acceptance).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { playDailyRace } from '../examples/daily-race.js';
import { battlesFor } from '../src/engineer.js';
import { type Run, decide, engineerConfig } from '../src/sim.js';
import type { BattleMove, RaceModel } from '../src/types.js';
import { verifyRun } from '../src/verify.js';

const dir = join(__dirname, '..', '..', '..', 'data', 'races');
const races = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel)
  .filter((m) => m.decisionMoments.length > 0);
const SAMPLES = 10;
const ATTACK: BattleMove[] = ['dive-inside', 'round-outside', 'wait-drs'];
const DEFEND: BattleMove[] = ['cover-inside', 'hold-outside', 'defend-hard', 'let-go'];

describe('race engineer runs verify on every race', () => {
  it.each(races.map((m) => [m.race.id, m] as const))('%s', (_id, model) => {
    const cfg = engineerConfig(model);
    if (!cfg) throw new Error('no engineer config');
    // A race without DRS (eras rules, roadmap R5) has no wait-drs move.
    const attack = model.rules?.drs === false ? ATTACK.filter((m) => m !== 'wait-drs') : ATTACK;
    let k = 0;
    const between = (run: Run) => {
      const next = run.state.lap + 1;
      const b = battlesFor(run.state, model, cfg);
      k++;
      if (b.ahead)
        decide(run, { lap: next, kind: 'battle', move: attack[k % attack.length] as BattleMove });
      else if (b.behind)
        decide(run, { lap: next, kind: 'battle', move: DEFEND[k % 4] as BattleMove });
      if (k % 7 === 0) decide(run, { lap: next, kind: 'blue', action: 'go-round' });
      if (k % 11 === 0) decide(run, { lap: next, kind: 'reply', request: 'box', yes: false });
      if (k === 5) decide(run, { lap: next, kind: 'limits', careful: true });
    };
    const played = playDailyRace(
      model,
      model.race.seed,
      (m) => m.options[k % m.options.length]?.id as string,
      {
        samples: SAMPLES,
        between,
      },
    );
    const wire = JSON.parse(JSON.stringify(played.decisions));
    const v = verifyRun(model, model.race.seed, wire, SAMPLES);
    expect(v.result).toEqual(played.result);
    expect(v.score).toEqual(played.score);
  });
});
