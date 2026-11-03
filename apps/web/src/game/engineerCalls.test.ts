// The race engineer's radio over whole races (race engineer spec acceptance): on every playable
// race, answering the director's calls (at random, or not at all), every answer is a call the
// race model accepts, something is said at least every 2 racing laps, and battles come up.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type RaceModel, answerMoment, engineerConfig, mulberry32 } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { overtakingCorners } from '../track/corners.js';
import { outlineFor } from '../track/outlines.js';
import { directorCall, infoLine, newMemory, ownMove } from './engineerCalls.js';
import { engineerRadio } from './engineerRadio.js';
import { quickCallLaps } from './quickCalls.js';
import { RaceLog } from './raceLog.js';

const dir = join(__dirname, '..', '..', '..', '..', 'data', 'races');
const races = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel)
  .filter((m) => m.decisionMoments.length > 0);

function play(model: RaceModel, seed: number) {
  const engine = new GameEngine(model, seed, { decisions: [] });
  const cfg = engineerConfig(model);
  const corners = overtakingCorners(outlineFor(model.race.id));
  const quick = new Set(quickCallLaps(model));
  const memory = newMemory();
  const log = new RaceLog();
  log.see(engine.state);
  const rng = mulberry32(seed);
  const said: number[] = [];
  const kinds: Record<string, number> = {};
  let lastInfo = -99;
  let radio = 0;
  while (!engine.isFinished()) {
    const moment = model.decisionMoments.find((m) => m.lap === engine.lap + 1);
    if (moment) {
      const o = moment.options[Math.floor(rng.next() * moment.options.length)];
      if (o) answerMoment((engine as unknown as { run: never }).run, moment, o.id);
    }
    engine.step();
    const events = log.see(engine.state);
    const lap = engine.lap;
    radio += engineRadioLines(model, engine, lap, cfg, corners[0] ?? 1);
    if (moment) said.push(lap - 1, lap);
    const call = directorCall(
      engine.state,
      model,
      cfg,
      events,
      engine.notes,
      corners,
      memory,
      quick.has(lap),
    );
    if (call) {
      said.push(lap);
      kinds[call.kind ?? 'quick'] = (kinds[call.kind ?? 'quick'] ?? 0) + 1;
      const pick = Math.floor(rng.next() * (call.options.length + 1));
      const o = call.options[pick];
      const next = lap + 1;
      // No answer (pick past the options): the driver's own move, if he has one.
      const calls = o ? [o.call, ...(o.also ?? [])] : [call.driverChoice];
      for (const c of calls) if (c) engine.apply({ ...c, lap: next });
    } else if (
      lap - lastInfo >= 2 &&
      engine.state.nextFlag === 'green' &&
      infoLine(engine.state, model, events)
    ) {
      lastInfo = lap;
      said.push(lap);
    }
  }
  return { engine, said, kinds, radio };
}

function engineRadioLines(
  model: RaceModel,
  engine: GameEngine,
  lap: number,
  cfg: ReturnType<typeof engineerConfig>,
  corner: number,
): number {
  return engineerRadio(engine.notes, lap, model.userSide, engine.state, cfg, corner).length;
}

describe('the race engineer’s radio', () => {
  it.each(races.map((m) => [m.race.id, m] as const))(
    '%s: valid calls, never quiet for long, battles come up',
    (_id, model) => {
      let battles = 0;
      for (const seed of [model.race.seed, 11, 23]) {
        const { said, kinds, engine } = play(model, seed);
        battles += kinds.battle ?? 0;
        // The longest stretch of green racing laps with nothing said.
        const heard = new Set(said);
        let quiet = 0;
        let longest = 0;
        const start = model.race.takeoverLap + 1;
        for (let lap = start; lap < model.race.laps; lap++) {
          const green = !model.events.some(
            (e) =>
              (e.type === 'SC' || e.type === 'VSC') &&
              lap >= e.lap - 1 &&
              lap < e.lap + (e.laps ?? 1),
          );
          const out = (engine.state.cars[model.userSide]?.retiredLap ?? 999) <= lap;
          quiet = heard.has(lap) || !green || out ? 0 : quiet + 1;
          longest = Math.max(longest, quiet);
        }
        expect(longest).toBeLessThanOrEqual(2);
      }
      expect(battles).toBeGreaterThan(0);
    },
  );

  it('a driver left to himself picks by attitude', () => {
    expect(ownMove('HAM', true)).toBe('dive-inside'); // high attitude
    expect(ownMove('BOT', false)).toBe('hold-outside'); // low
  });
});
