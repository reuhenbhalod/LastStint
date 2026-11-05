// Every playable race (one with decision moments): the real team's calls play through, the
// server verifies the run, and the game's claimed grades score exactly as full grading does.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { playDailyRace } from '../examples/daily-race.js';
import type { RaceModel } from '../src/types.js';
import { verifyRun } from '../src/verify.js';

const dir = join(__dirname, '..', '..', '..', 'data', 'races');
const playable = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel)
  .filter((m) => m.decisionMoments.length > 0);
const SAMPLES = 40;

describe('playable races', () => {
  it('there are at least 11 (Abu Dhabi and races batch 1)', () => {
    expect(playable.length).toBeGreaterThanOrEqual(11);
  });

  it.each(playable.map((m) => [m.race.id, m] as const))(
    '%s plays through and verifies',
    (_id, model) => {
      // A moment has 2-8 options. None is on the first lap: the race plan is picked there
      // (the strategy planner), not asked as a moment.
      for (const m of model.decisionMoments) {
        expect(m.trigger).not.toBe('takeover');
        expect(m.lap).toBeGreaterThan(model.race.takeoverLap + 1);
        expect(m.options.length).toBeGreaterThanOrEqual(2);
      }
      const played = playDailyRace(
        model,
        model.race.seed,
        (m) => m.realOptionId ?? (m.options[0]?.id as string),
        { samples: SAMPLES },
      );
      const wire = JSON.parse(JSON.stringify({ d: played.decisions, g: played.grades }));
      const live = verifyRun(model, model.race.seed, wire.d, SAMPLES, wire.g);
      const full = verifyRun(model, model.race.seed, played.decisions, SAMPLES);
      expect(live).toEqual(full);
      expect(full.moments).toHaveLength(model.decisionMoments.length);
    },
    60_000,
  );
});
