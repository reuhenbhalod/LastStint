// Daily and Gauntlet are frozen (CLAUDE.md rule 3): on every pool race (data/pools.json daily
// and survivor) the grades at every decision moment and live play to the flag match the ones
// recorded before the Eras-only player stint-pace change (sim.ts playerStintOffset). Each race
// is paused at each moment twice (no calls so far, and the real calls so far) and every option
// plus the real one is graded on a fixed sample count; live play runs the real calls and the
// no-call run to the flag, on the race's seed and on each of its Gauntlet seeds. A SHA-256 per
// race over that JSON keeps the fixture small.
// Regenerate the fixture only on purpose:
//   RECORD_POOL_GRADES=1 pnpm --filter @laststint/sim test pool-grades

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gradeMoment, realOption } from '../src/grade.js';
import { type Run, initRun, isFinished, realDecisions, stepLap } from '../src/sim.js';
import type { Decision, RaceModel } from '../src/types.js';

const data = join(__dirname, '..', '..', '..', 'data');
const fixture = join(__dirname, 'fixtures', 'pool-grades.json');
const pools = JSON.parse(readFileSync(join(data, 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, number[]>;
};
const ids = [...new Set([...pools.daily, ...Object.keys(pools.survivor)])].sort();
const SAMPLES = Number(process.env.POOL_GRADE_SAMPLES ?? 24);

function race(id: string): RaceModel {
  return JSON.parse(readFileSync(join(data, 'races', `${id}.json`), 'utf8')) as RaceModel;
}

function paused(model: RaceModel, decisions: Decision[], lap: number): Run {
  const run = initRun(model, model.race.seed, { decisions });
  while (run.state.lap < lap && !isFinished(run)) stepLap(run);
  return run;
}

function finish(
  model: RaceModel,
  decisions: Decision[],
  seed: number,
): [string[], Record<string, [number, boolean]>] {
  const run = initRun(model, seed, { decisions });
  while (!isFinished(run)) stepLap(run);
  const cars = Object.entries(run.state.cars).map(([code, c]): [string, [number, boolean]] => [
    code,
    [c.totalTime, !!c.retired],
  ]);
  return [run.state.order, Object.fromEntries(cars)];
}

function digest(model: RaceModel): string {
  const real = realDecisions(model);
  const out: unknown[] = [];
  for (const m of model.decisionMoments) {
    for (const calls of [[], real.filter((d) => d.lap < m.lap)]) {
      const run = paused(model, calls, m.lap - 1);
      const options = [...m.options, realOption(run, m.lap)];
      out.push([m.id, calls.length, gradeMoment(run, options, m.target, SAMPLES)]);
    }
  }
  // Live play to the flag on the race's own seed (Daily) and on each Gauntlet seed.
  for (const seed of [model.race.seed, ...(pools.survivor[model.race.id] ?? [])]) {
    out.push(seed, finish(model, real, seed), finish(model, [], seed));
  }
  return createHash('sha256').update(JSON.stringify(out)).digest('hex');
}

describe('pool races: Daily and Gauntlet grades are frozen', () => {
  if (process.env.RECORD_POOL_GRADES) {
    it('records the fixture', () => {
      const hashes = Object.fromEntries(ids.map((id) => [id, digest(race(id))]));
      writeFileSync(fixture, `${JSON.stringify({ samples: SAMPLES, hashes }, null, 2)}\n`);
    }, 600_000);
    return;
  }
  const recorded = JSON.parse(readFileSync(fixture, 'utf8')) as {
    samples: number;
    hashes: Record<string, string>;
  };
  it('covers all 39 pool races', () => {
    expect(ids).toHaveLength(39);
    expect(Object.keys(recorded.hashes).sort()).toEqual(ids);
    expect(recorded.samples).toBe(SAMPLES);
  });
  for (const id of ids) {
    it(`${id}: grades and live play are unchanged`, () => {
      expect(digest(race(id))).toBe(recorded.hashes[id]);
    }, 120_000);
  }
});
