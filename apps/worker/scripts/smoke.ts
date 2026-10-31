// Smoke test against a running Worker: fetch today's daily and its model, play it as the game
// does (taking the real team's call at every moment), submit it, and check the server's score.
//   pnpm --filter @boxthislap/worker smoke [--url http://localhost:8787] [--date YYYY-MM-DD]
import { randomUUID } from 'node:crypto';
import type { RaceModel } from '@boxthislap/sim';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { todayUtc } from '../src/dates.js';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const base = arg('--url') ?? 'http://localhost:8787';
const date = arg('--date') ?? todayUtc(Date.now());

async function json<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

const daily = await json<{ number: number; raceId: string; seed: number; modelUrl: string }>(
  await fetch(`${base}/api/daily?date=${date}`),
);
const model = await json<RaceModel>(await fetch(daily.modelUrl));
console.log(`daily #${daily.number}: ${model.race.name} (seed ${daily.seed})`);

const played = playDailyRace(model, daily.seed, (m) => m.realOptionId ?? m.options[0]?.id ?? '');
const t0 = performance.now();
const res = await fetch(`${base}/api/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date,
    anonId: randomUUID(),
    decisions: played.decisions,
    grades: played.grades,
  }),
});
const run = await json<{ score: number; rank: number; total: number; percentile: number }>(res);
const ms = performance.now() - t0;
console.log(
  `verified in ${ms.toFixed(0)} ms: score ${run.score} (client ${played.score.score}), rank ${run.rank}/${run.total}, P${run.percentile}`,
);
if (run.score !== played.score.score) {
  console.error('MISMATCH: the server scored the run differently');
  process.exit(1);
}
