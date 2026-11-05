// Runs examples/daily-race.ts, the end-to-end example in docs/sim-api.md (spec D8).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { playDailyRace } from '../examples/daily-race.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;

describe('daily race example', () => {
  it('plays Abu Dhabi 2021 with its six approved moments and scores every call', () => {
    // The moments match the UI's race script (data/scripts/abu-dhabi-2021.json).
    // The race plan is the strategy planner's now, not a moment.
    expect(abu.decisionMoments.map((m) => m.id)).toEqual([
      'vsc-cover',
      'tyres-going',
      'manage-or-push',
      'sc-stop',
      'sc-last-chance',
      'restart-stance',
    ]);
    const laps: number[] = [];
    const pick = (id: string) => (id === 'sc-stop' ? 'box-soft' : undefined);
    const { result, score, calls } = playDailyRace(
      abu,
      abu.race.seed,
      (m) => pick(m.id) ?? (m.options[0]?.id as string),
      { samples: 60, onLap: (run) => laps.push(run.state.lap) },
    );
    expect(laps.at(-1)).toBe(abu.race.laps);
    expect(calls.map((c) => [c.moment.id, c.chosen])).toEqual([
      ['vsc-cover', 'stay'],
      ['tyres-going', 'stay'],
      ['manage-or-push', 'push'],
      ['sc-stop', 'box-soft'],
      ['sc-last-chance', 'stay'],
      ['restart-stance', 'defend'],
    ]);
    expect(score.calls.every((c) => c.band !== undefined)).toBe(true);
    expect(result.finishers).toContain('HAM');
    expect(result.disqualified).toEqual([]); // boxing for softs satisfies the two-compound rule
  });

  it('the real call (stay out) is graded and scored like any other', () => {
    const { score } = playDailyRace(
      abu,
      abu.race.seed,
      (m) => m.realOptionId ?? (m.options[0]?.id as string),
      { samples: 60 },
    );
    expect(score.calls.map((c) => c.optionId)).toEqual([
      'stay',
      'stay',
      'push',
      'stay',
      'stay',
      'defend',
    ]);
  });
});
