// Runs examples/daily-race.ts, the end-to-end example in docs/sim-api.md (spec D8).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { playDailyRace } from '../examples/daily-race.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;

describe('daily race example', () => {
  it('plays Abu Dhabi 2021 with its approved lap-53 moment and scores the call', () => {
    expect(abu.decisionMoments.map((m) => m.id)).toEqual(['sc-53']);
    const laps: number[] = [];
    const { result, score, calls } = playDailyRace(abu, abu.race.seed, () => 'box-soft', {
      samples: 60,
      onLap: (run) => laps.push(run.state.lap),
    });
    expect(laps.at(-1)).toBe(abu.race.laps);
    expect(calls.map((c) => [c.moment.id, c.chosen])).toEqual([['sc-53', 'box-soft']]);
    expect(score.calls[0]?.band).toBeDefined();
    expect(score.score).toBe(score.calls[0]?.points);
    expect(result.finishers).toContain('HAM');
    expect(result.disqualified).toEqual([]); // boxing for softs satisfies the two-compound rule
  });

  it('the real call (stay out) is graded and scored like any other', () => {
    const { score } = playDailyRace(abu, abu.race.seed, (m) => m.realOptionId ?? 'stay-out', {
      samples: 60,
    });
    expect(score.calls[0]?.optionId).toBe('stay-out');
  });
});
