// Daily and Gauntlet are frozen (CLAUDE.md rule 3), radio included: on every pool race the
// director's calls (lap, kind, who, text, options), answered at random on a fixed seed, match
// the sequence recorded before the Eras-only radio changes (a SHA-256 per race over its seeds' call
// lines, to keep the fixture small) (the safety-car stop question's
// stop-question gap, b9fbf17, is Eras-gated). Regenerate the fixture only on purpose:
//   RECORD_POOL_RADIO=1 pnpm --filter @laststint/web test engineerCalls.pool

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type RaceModel, answerMoment, engineerConfig, mulberry32 } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { overtakingCorners } from '../track/corners.js';
import { outlineFor } from '../track/outlines.js';
import { directorCall, newMemory } from './engineerCalls.js';
import { quickCallLaps } from './quickCalls.js';
import { RaceLog } from './raceLog.js';

const data = join(__dirname, '..', '..', '..', '..', 'data');
const fixture = join(__dirname, '..', 'data', 'fixtures', 'pool-radio-calls.json');
const pools = JSON.parse(readFileSync(join(data, 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, number[]>;
};
const ids = [...new Set([...pools.daily, ...Object.keys(pools.survivor)])].sort();
const SEEDS = Array.from({ length: Number(process.env.POOL_RADIO_SEEDS ?? 40) }, (_, i) => i + 1);

function calls(model: RaceModel, seed: number): string[] {
  const engine = new GameEngine(model, seed, { decisions: [] });
  const cfg = engineerConfig(model);
  const corners = overtakingCorners(outlineFor(model.race.id));
  const quick = new Set(quickCallLaps(model));
  const memory = newMemory();
  const log = new RaceLog();
  log.see(engine.state);
  const rng = mulberry32(seed);
  const out: string[] = [];
  while (!engine.isFinished()) {
    const moment = model.decisionMoments.find((m) => m.lap === engine.lap + 1);
    if (moment) {
      const o = moment.options[Math.floor(rng.next() * moment.options.length)];
      if (o) answerMoment((engine as unknown as { run: never }).run, moment, o.id);
    }
    engine.step();
    const events = log.see(engine.state);
    const lap = engine.lap;
    const pendingPit = engine.decisions.some((d) => d.kind === 'pit' && d.lap > lap);
    const call = directorCall(
      engine.state,
      model,
      cfg,
      events,
      engine.notes,
      corners,
      memory,
      quick.has(lap),
      pendingPit,
    );
    if (!call) continue;
    out.push(
      `${lap} ${call.kind ?? 'quick'} ${call.from}: ${call.text} [${call.options.map((o) => o.id).join(',')}]`,
    );
    const o = call.options[Math.floor(rng.next() * (call.options.length + 1))];
    const next = lap + 1;
    for (const c of o ? [o.call, ...(o.also ?? [])] : [call.driverChoice])
      if (c) engine.apply({ ...c, lap: next });
  }
  return out;
}

describe('Daily and Gauntlet radio is frozen', () => {
  it('every pool race asks the same calls on the same laps as before', () => {
    const got: Record<string, string> = {};
    for (const id of ids) {
      const model = JSON.parse(
        readFileSync(join(data, 'races', `${id}.json`), 'utf8'),
      ) as RaceModel;
      const hash = createHash('sha256');
      for (const seed of SEEDS) hash.update(`#${seed}\n${calls(model, seed).join('\n')}\n`);
      got[id] = hash.digest('hex');
    }
    if (process.env.RECORD_POOL_RADIO) writeFileSync(fixture, `${JSON.stringify(got, null, 1)}\n`);
    const want = JSON.parse(readFileSync(fixture, 'utf8')) as Record<string, string>;
    expect(Object.keys(got)).toEqual(Object.keys(want));
    for (const id of ids) expect(got[id], id).toBe(want[id]);
  }, 120_000);
});
