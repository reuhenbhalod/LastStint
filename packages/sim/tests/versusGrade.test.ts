// Grading a versus race (docs/versus-spec.md V4, action spec A5): each strategy call's options by
// the chance of finishing ahead of the other car (whose real calls stand); the winner is first
// past the flag.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RaceModel } from '../src/types.js';
import { VERSUS_TRACKS, type VersusCall, type VersusSetup, initVersus } from '../src/versus.js';
import {
  type VersusAnswer,
  gradeVersus,
  gradeVersusCall,
  versusOptions,
} from '../src/versusGrade.js';

const track = VERSUS_TRACKS.find((t) => t.id === 'bahrain');
const model = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'data', 'races', `${track?.raceFile}.json`),
    'utf8',
  ),
) as RaceModel;
const setup = (seed: number): VersusSetup => ({
  track: 'bahrain',
  seed,
  players: [
    { name: 'A', car: 'balanced', startTyre: 'MEDIUM' },
    { name: 'B', car: 'balanced', startTyre: 'MEDIUM' },
  ],
});
const SAMPLES = 120;

/** A seed whose race has a safety car out on these laps. */
function scSeed(from: number, to: number): { seed: number; lap: number } {
  for (let seed = 1; seed < 2000; seed++) {
    const run = initVersus(model, setup(seed));
    const sc = [...run.neutral].filter(([, f]) => f === 'sc').map(([l]) => l);
    const first = Math.min(...sc);
    if (sc.length >= 3 && first >= from && first <= to) return { seed, lap: first };
  }
  throw new Error('no such seed');
}

describe('versus grading', () => {
  it('rates a stop under the safety car above staying out, before either car has stopped', () => {
    const { seed, lap } = scSeed(6, 10);
    // The other car stops at the end of lap 12 whatever happens.
    const calls: VersusCall[] = [{ player: 1, lap: 12, kind: 'pit', compound: 'HARD' }];
    // The call comes the lap before the SC: box at the end of the SC's first lap.
    const answer: VersusAnswer = { player: 0, lap, kind: 'neutral', option: 'stay' };
    const options = versusOptions({ options: ['box', 'stay'] });
    const grade = gradeVersusCall(model, setup(seed), calls, answer, options, SAMPLES);
    const p = (id: string) => grade.options.find((o) => o.id === id)?.probability ?? 0;
    expect(grade.best.startsWith('box-')).toBe(true);
    expect(p('box-HARD')).toBeGreaterThan(p('stay'));
  });

  it('grades the same race the same way twice; the winner is first past the flag', () => {
    const { seed, lap } = scSeed(6, 10);
    // Player 0 takes the best stop for the SC; player 1 stays out and stops late under green.
    const late: VersusCall = { player: 1, lap: 13, kind: 'pit', compound: 'SOFT' };
    const best = gradeVersusCall(
      model,
      setup(seed),
      [late],
      { player: 0, lap, kind: 'neutral', option: 'stay' },
      versusOptions({ options: ['box', 'stay'] }),
      SAMPLES,
    ).best;
    expect(best.startsWith('box-')).toBe(true);
    const calls: VersusCall[] = [{ player: 0, lap, kind: 'pit', compound: best.slice(4) }, late];
    const answers: VersusAnswer[] = [
      { player: 0, lap, kind: 'neutral', option: best },
      { player: 1, lap, kind: 'neutral', option: 'stay' },
    ];
    const one = gradeVersus(model, setup(seed), calls, answers, SAMPLES);
    const two = gradeVersus(model, setup(seed), calls, answers, SAMPLES);
    expect(two).toEqual(one);
    expect(one.scores[0].score).toBeGreaterThan(one.scores[1].score);
    expect(one.winner).toBe(one.road.order[0]);
    expect(one.by).toBe('road');
  });
});
