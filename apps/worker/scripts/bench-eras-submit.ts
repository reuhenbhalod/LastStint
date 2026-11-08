// CPU cost of an Eras submit's evaluation (eras build plan 7.3): erasEval.ts evaluateAttempt
// from claimed grades, on the longest bundled races by laps from the takeover, against the
// Daily submit's verifyRun on the same run. The Worker's free plan allows 10 ms of CPU a
// request; Node's V8 is close to workerd's, so treat these as estimates.
//
//   pnpm --filter @laststint/worker exec tsx scripts/bench-eras-submit.ts [raceId ...]
//
// The races have no Eras block yet (phase 6), so each gets a stand-in one: the objectives
// read the race log, which costs the same whichever target and objective are authored.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRADE_SAMPLES, type RaceModel, difficultyFor, verifyRun } from '@laststint/sim';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { evaluateAttempt } from '../src/erasEval.js';
import { repo } from './d1.js';

const RUNS = 200;
const SEED = 4242;
const races = process.argv.slice(2);
const ids = races.length ? races : ['netherlands-2022', 'hungary-2025', 'canada-2022'];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

function time(fn: () => void): { median: number; p95: number } {
  for (let i = 0; i < 20; i++) fn(); // warm the JIT, as a warm isolate is
  const ms: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    fn();
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  return { median: median(ms), p95: ms[Math.floor(ms.length * 0.95)] as number };
}

for (const id of ids) {
  const base = JSON.parse(
    readFileSync(join(repo, 'data', 'races', `${id}.json`), 'utf8'),
  ) as RaceModel;
  const model: RaceModel = {
    ...base,
    eras: {
      eraId: 10,
      order: 1,
      target: { type: 'win' },
      mastery: { type: 'no_neutralized_stop', label: '-' },
      hidden: { type: 'mode_rule', mode: 'push', maxLaps: 5, label: '-' },
      storyline: { real: '-', rewriteCondition: { type: 'win' }, headline: '-' },
    },
  };
  const played = playDailyRace(model, SEED, (m) => m.realOptionId ?? (m.options[0]?.id as string));
  const input = {
    model,
    seed: SEED,
    legend: false,
    difficulty: difficultyFor(1),
    decisions: played.decisions,
    grades: played.grades,
    rivalClaims: null,
    untimed: false,
  };
  const eras = time(() => evaluateAttempt(input));
  const daily = time(() => verifyRun(model, SEED, played.decisions, GRADE_SAMPLES, played.grades));
  const laps = model.race.laps - model.race.takeoverLap;
  console.log(
    `${id}: ${laps} laps from takeover, ${model.decisionMoments.length} moments, ${
      played.decisions.length
    } calls | eras submit median ${eras.median.toFixed(2)} ms p95 ${eras.p95.toFixed(
      2,
    )} ms | daily verify median ${daily.median.toFixed(2)} ms p95 ${daily.p95.toFixed(2)} ms`,
  );
}
