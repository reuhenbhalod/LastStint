// Moment author (races batch 1): builds a race's decision moments to the Abu Dhabi recipe and
// keeps only real dilemmas.
//   pnpm --filter @boxthislap/sim author <race-id> [--rival CODE] [--samples N] [--max N] [--write]
// (--max caps the graded calls after the race plan: survivor races use 2.)
//
// Candidates, all graded from the real race's state at their lap (pauseAt):
//   - the race plan when you take over: run to plan, manage, push, box now (two compounds);
//   - the moment finder's stop calls (SC, VSC, the rival's stops, the undercut window, the
//     tyre cliff), offered as stay out / box per compound / box next lap;
//   - pace calls every few laps: push, standard, manage, push and attack;
//   - battle calls (defend, hold, attack) at a restart, and late in the race when the rival
//     is within reach.
// Kept: the race plan, then up to MAX_MOMENTS more that pass the quality bar (verdict
// "keep"), at least MIN_SPACING laps apart, the most tense first. --rival grades against
// another car (a "defend" race: the car behind); --write saves data/moments/<race>.json and
// puts the moments in the race file.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RaceModel } from '../src/types.js';
import { authorMoments } from './authoring.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const raceId = args[0];
if (!raceId) {
  console.error('usage: author <race-id> [--rival CODE] [--samples N] [--write]');
  process.exit(2);
}
const samples = flag('--samples') ? Number(flag('--samples')) : undefined;
const write = args.includes('--write');
const racePath = join(repo, 'data', 'races', `${raceId}.json`);
const raw = readFileSync(racePath, 'utf8');
const file = JSON.parse(raw) as RaceModel;
const model: RaceModel = { ...file, rival: flag('--rival') ?? file.rival, decisionMoments: [] };
const max = flag('--max') ? Number(flag('--max')) : undefined;
const picked = authorMoments(model, samples, (line) => console.log(line), max);
console.log(`picked ${picked.length} moments: ${picked.map((p) => `${p.id}@${p.lap}`).join(', ')}`);
if (write) {
  writeFileSync(
    join(repo, 'data', 'moments', `${raceId}.json`),
    `${JSON.stringify(picked, null, 2)}\n`,
  );
  const out = { ...JSON.parse(raw), rival: model.rival, decisionMoments: picked };
  writeFileSync(racePath, `${JSON.stringify(out, null, 2)}${raw.endsWith('\n') ? '\n' : ''}`);
  console.log(`wrote data/moments/${raceId}.json and the race file`);
}
