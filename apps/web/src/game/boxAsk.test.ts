// The driver's "box?" request when his tyres are gone: answered "stay out" (or not at all), he
// asks again only as they get worse, past their life and then with nothing left, never just
// because a few laps went by. Over every race, never boxing.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type RaceModel, answerMoment, engineerConfig } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { overtakingCorners } from '../track/corners.js';
import { outlineFor } from '../track/outlines.js';
import { directorCall, newMemory } from './engineerCalls.js';
import { quickCallLaps } from './quickCalls.js';
import { RaceLog } from './raceLog.js';

const dir = join(__dirname, '..', '..', '..', '..', 'data', 'races');
const races = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel)
  .filter((m) => m.decisionMoments.length > 0);

/** Every box request in a race played on the real calls at each moment, staying out else. */
function asks(model: RaceModel) {
  const engine = new GameEngine(model, model.race.seed, { decisions: [] });
  const cfg = engineerConfig(model);
  const corners = overtakingCorners(outlineFor(model.race.id));
  const quick = new Set(quickCallLaps(model));
  const memory = newMemory();
  const log = new RaceLog();
  log.see(engine.state);
  const out: Array<{ set: number; level: number }> = [];
  while (!engine.isFinished()) {
    const moment = model.decisionMoments.find((m) => m.lap === engine.lap + 1);
    if (moment?.realOptionId)
      answerMoment((engine as unknown as { run: never }).run, moment, moment.realOptionId);
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
    // The worn-tyre request (weather asks are requests too, with their own gate).
    if (call && memory.last.reqBox === lap && memory.boxAsk) out.push({ ...memory.boxAsk });
  }
  return out;
}

describe('the box request after a "stay out"', () => {
  it('asks again on a set of tyres only when they are worse, at most three times', () => {
    let total = 0;
    for (const model of races) {
      const seen = new Map<number, number[]>();
      for (const a of asks(model)) seen.set(a.set, [...(seen.get(a.set) ?? []), a.level]);
      for (const [set, levels] of seen) {
        total += levels.length;
        expect(levels.length, `${model.race.id} set from lap ${set}`).toBeLessThanOrEqual(3);
        levels.forEach((l, i) => {
          if (i > 0)
            expect(l, `${model.race.id} set from lap ${set}`).toBeGreaterThan(
              levels[i - 1] as number,
            );
        });
      }
    }
    // The request still comes up somewhere.
    expect(total).toBeGreaterThan(0);
  });
});
