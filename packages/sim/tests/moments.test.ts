// Decision moments and scoring (perfection spec D3, D4, D5).

import { describe, expect, it } from 'vitest';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { BAND_POINTS, type MomentGrade, scoreRun } from '../src/grade.js';
import { QUALITY, candidateMoments, pauseAt, proposeMoments, verdictFor } from '../src/moments.js';
import { validateDecisions } from '../src/sim.js';
import type { RaceModel } from '../src/types.js';

const abu = abuJson as unknown as RaceModel;

function grade(probs: Record<string, number>, bands: Record<string, string> = {}): MomentGrade {
  return {
    lap: 40,
    samples: 300,
    target: { kind: 'win' },
    best: Object.keys(probs)[0] as string,
    options: Object.entries(probs).map(([id, probability]) => ({
      id,
      probability,
      behindBest: 0,
      band: (bands[id] ?? 'green') as 'green',
    })),
  };
}

describe('candidate moments', () => {
  const moments = candidateMoments(abu);

  it('finds the Abu Dhabi 2021 VSC and offers 2-4 valid options with the real call marked', () => {
    const vsc = moments.find((m) => m.trigger === 'VSC');
    expect(vsc?.lap).toBe(36);
    expect(vsc?.realOptionId).toBe('stay-out'); // Mercedes kept Hamilton out
    for (const m of moments) {
      expect(m.options.length).toBeGreaterThanOrEqual(2);
      expect(m.options.length).toBeLessThanOrEqual(4);
      for (const o of m.options) validateDecisions(abu, o.decisions);
    }
  });

  it('keeps candidates at least 3 laps apart and inside the playable window', () => {
    const laps = moments.map((m) => m.lap);
    for (let i = 1; i < laps.length; i++) {
      expect((laps[i] as number) - (laps[i - 1] as number)).toBeGreaterThanOrEqual(3);
    }
    expect(Math.min(...laps)).toBeGreaterThan(abu.race.takeoverLap);
    expect(Math.max(...laps)).toBeLessThan(abu.race.laps);
  });

  it('pauses the real race just before the moment', () => {
    expect(pauseAt(abu, 36).state.lap).toBe(35);
  });
});

describe('quality bar (plan 5.3)', () => {
  it('rejects a moment with no real choice (no option worse than yellow)', () => {
    expect(verdictFor(grade({ a: 0.5, b: 0.498, c: 0.5 }))).toBe('no-choice');
    expect(verdictFor(grade({ a: 1.0, b: 0.98, c: 0.99 }))).toBe('no-choice');
  });

  it('keeps the SC over a nearby lower-priority trigger', () => {
    const laps = candidateMoments(abu).map((m) => `${m.trigger}@${m.lap}`);
    expect(laps).toContain('SC@53');
  });

  it('rejects a moment with one obviously right option', () => {
    expect(verdictFor(grade({ a: 0.9, b: 0.4 }))).toBe('no-tension');
  });

  it('keeps a genuine dilemma', () => {
    expect(verdictFor(grade({ a: 0.6, b: 0.5, c: 0.3 }))).toBe('keep');
    expect(QUALITY.NO_TENSION).toBe(30);
  });

  it('Abu Dhabi 2021 has auto-proposed moments that pass the bar (spec S4 acceptance)', () => {
    const kept = proposeMoments(abu, 100).filter((m) => m.verdict === 'keep');
    expect(kept.length).toBeGreaterThanOrEqual(1);
  });
});

describe('scoring (spec D5)', () => {
  it('averages band points over the calls', () => {
    const run = scoreRun([
      { grade: grade({ a: 0.6, b: 0.5 }, { a: 'green', b: 'yellow' }), chosen: 'a' },
      { grade: grade({ a: 0.6, b: 0.2 }, { a: 'green', b: 'red' }), chosen: 'b' },
    ]);
    expect(run.score).toBe((BAND_POINTS.green + BAND_POINTS.red) / 2);
    expect(run.calls.map((c) => c.band)).toEqual(['green', 'red']);
    expect(run.meanProbability).toBeCloseTo(0.4);
  });

  it('rejects a choice that was not an option', () => {
    expect(() => scoreRun([{ grade: grade({ a: 0.5 }), chosen: 'z' }])).toThrow();
  });
});
