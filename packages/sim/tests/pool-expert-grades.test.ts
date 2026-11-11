// Daily and Gauntlet are frozen (CLAUDE.md rule 3): on every pool race (data/pools.json daily
// and survivor), the grades a Daily run is played with, and an Expert rival's choices on the real
// calls (rivals/expert.ts rivalPlayout's Daily path), match the ones recorded before the
// Eras-only Expert grader fix (a SHA-256 per race, to keep the fixture small). Regenerate the
// fixture only on purpose:
//   RECORD_POOL_GRADES=1 pnpm --filter @laststint/sim test pool-expert-grades

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { playDailyRace } from '../examples/daily-race.js';
import { rivalChoices } from '../src/rivals/react.js';
import { classify, erasRace, initRun, isFinished, realDecisions, stepLap } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const data = join(__dirname, '..', '..', '..', 'data');
const fixture = join(__dirname, 'fixtures', 'pool-expert-grades.json');
const pools = JSON.parse(readFileSync(join(data, 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, number[]>;
};
const ids = [...new Set([...pools.daily, ...Object.keys(pools.survivor)])].sort();
const SAMPLES = 6;
const RIVAL_SAMPLES = 4;

function race(id: string): RaceModel {
  return JSON.parse(readFileSync(join(data, 'races', `${id}.json`), 'utf8')) as RaceModel;
}

function digest(model: RaceModel): string {
  const seed = model.race.seed;
  const hash = createHash('sha256');
  // A Daily run: every moment graded at its pause, answered with the real call (else the
  // first option).
  const played = playDailyRace(
    model,
    seed,
    (m) => m.options.find((o) => o.id === m.realOptionId)?.id ?? (m.options[0]?.id as string),
    { samples: SAMPLES },
  );
  hash.update(JSON.stringify(played.calls.map((c) => [c.moment.id, c.chosen, c.grade])));
  hash.update(JSON.stringify(played.result));
  // An Expert rival against the real team's calls: its stops queue the lap before they run.
  const run = initRun(model, seed, {
    decisions: realDecisions(model),
    rivalPolicy: 'expert',
    rivalSamples: RIVAL_SAMPLES,
  });
  while (!isFinished(run)) stepLap(run);
  hash.update(JSON.stringify(rivalChoices(run)));
  hash.update(JSON.stringify(classify(run)));
  return hash.digest('hex');
}

describe('Daily and Gauntlet grades are frozen', () => {
  it('lists the 40 pool races, none of them an Eras race file', () => {
    expect(ids.length).toBe(40);
    for (const id of ids) expect(erasRace(race(id)), id).toBe(false);
  });

  it('every pool race grades and plays its Expert rival as before', { timeout: 1_200_000 }, () => {
    const got: Record<string, string> = {};
    for (const id of ids) got[id] = digest(race(id));
    if (process.env.RECORD_POOL_GRADES || !existsSync(fixture)) {
      writeFileSync(fixture, `${JSON.stringify(got, null, 2)}\n`);
      if (!process.env.RECORD_POOL_GRADES) throw new Error(`recorded ${fixture}; rerun`);
    }
    expect(got).toEqual(JSON.parse(readFileSync(fixture, 'utf8')));
  });
});
