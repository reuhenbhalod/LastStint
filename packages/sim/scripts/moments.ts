// Moment finder CLI (perfection spec D4):
//   pnpm --filter @boxthislap/sim moments <race-id> [--samples N]
// Grades every candidate decision moment from the real race's state, prints the verdicts, and
// writes the ones that pass the plan 5.3 quality bar to data/moments/proposed/<race-id>.json.
// A human picks the final 2-4 and saves them as data/moments/<race-id>.json; the pipeline
// then embeds them in the race model.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { proposeMoments } from '../src/moments.js';
import type { RaceModel } from '../src/types.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const [raceId, ...rest] = process.argv.slice(2);
if (!raceId) {
  console.error('usage: moments <race-id> [--samples N]');
  process.exit(2);
}
const samplesFlag = rest.indexOf('--samples');
const samples = samplesFlag >= 0 ? Number(rest[samplesFlag + 1]) : undefined;

const model = JSON.parse(
  readFileSync(join(repo, 'data', 'races', `${raceId}.json`), 'utf8'),
) as RaceModel;
const proposed = proposeMoments(model, samples);

for (const m of proposed) {
  const grades = m.grade.options
    .map((o) => `${o.id} ${(o.probability * 100).toFixed(0)}% ${o.band}`)
    .join(' | ');
  const real = m.realOptionId ? ` (real: ${m.realOptionId})` : '';
  console.log(`lap ${m.lap} ${m.trigger.padEnd(8)} ${m.verdict.padEnd(10)} ${grades}${real}`);
}

const keep = proposed
  .filter((m) => m.verdict === 'keep')
  .map(({ grade: _grade, verdict: _verdict, ...moment }) => moment);
const out = join(repo, 'data', 'moments', 'proposed', `${raceId}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(keep, null, 2)}\n`);
console.log(`${keep.length} of ${proposed.length} candidates pass the quality bar -> ${out}`);
