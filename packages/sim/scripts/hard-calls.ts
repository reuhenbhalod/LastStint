// Hard-call counter CLI (eras build plan 1.5), run by `pipeline hard-calls <race-id>`:
//   pnpm --filter @laststint/sim hard-calls <race-file.json> [--samples N]
// Grades every candidate moment from each storyline driver's side on the real race and
// prints one JSON object on stdout: { hardCalls, gaveUp, userSide, decidedBy, samples }.
// The pipeline writes eras.hardCalls and eras.userSide into data/eras/<race-id>.json.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countHardCalls } from '../src/eras/hard-calls.js';
import { GRADE_SAMPLES } from '../src/grade.js';
import type { RaceModel } from '../src/types.js';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('usage: hard-calls <race-file.json> [--samples N]');
  process.exit(2);
}
const samplesFlag = rest.indexOf('--samples');
const samples = samplesFlag >= 0 ? Number(rest[samplesFlag + 1]) : GRADE_SAMPLES;
if (!Number.isInteger(samples) || samples < 1) {
  console.error(`hard-calls: --samples must be a positive integer, got ${rest[samplesFlag + 1]}`);
  process.exit(2);
}

// pnpm --filter runs the script from packages/sim, so resolve against the caller's directory.
const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
const model = JSON.parse(readFileSync(path, 'utf8')) as RaceModel;
const result = countHardCalls(model, samples);
process.stdout.write(`${JSON.stringify({ ...result, samples })}\n`);
