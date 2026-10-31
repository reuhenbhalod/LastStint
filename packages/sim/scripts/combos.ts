// Every combination of a race's decision-moment answers, played and scored the way the server
// does (beta spec stage 3): the live check from the game's grades must equal full grading, and
// the results show whether the race's seed plays fairly (the best play shouldn't always lose).
//   pnpm --filter @boxthislap/sim combos <race-id> [seed]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playDailyRace } from '../examples/daily-race.js';
import type { RaceModel } from '../src/types.js';
import { verifyRun } from '../src/verify.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const [raceId, seedArg] = process.argv.slice(2);
if (!raceId) {
  console.error('usage: combos <race-id> [seed]');
  process.exit(2);
}
const raw = JSON.parse(
  readFileSync(join(repo, 'data', 'races', `${raceId}.json`), 'utf8'),
) as RaceModel;
const seed = seedArg ? Number(seedArg) : raw.race.seed;
const model: RaceModel = { ...raw, race: { ...raw.race, seed } };
const moments = [...model.decisionMoments].sort((a, b) => a.lap - b.lap);

let combos: string[][] = [[]];
for (const m of moments) combos = combos.flatMap((c) => m.options.map((o) => [...c, o.id]));

const rows: Array<{ score: number; line: string }> = [];
let mismatches = 0;
for (const combo of combos) {
  const pick = new Map(moments.map((m, i) => [m.id, combo[i] as string]));
  const played = playDailyRace(model, seed, (m) => pick.get(m.id) as string);
  const wire = JSON.parse(JSON.stringify({ d: played.decisions, g: played.grades }));
  const live = verifyRun(model, seed, wire.d, undefined, wire.g);
  const full = verifyRun(model, seed, played.decisions);
  const same = JSON.stringify(live) === JSON.stringify(full);
  if (!same) mismatches++;
  const calls = full.moments
    .map((m, i) => `${m.chosen}:${full.score.calls[i]?.band[0] ?? '?'}`)
    .join(' ');
  const rival = full.result.order.indexOf(model.rival) + 1;
  const flags = `${same ? '' : '  LIVE != FULL'}${full.disqualified ? '  DSQ' : ''}`;
  rows.push({
    score: full.score.score,
    line: `${full.score.score.toFixed(1).padStart(5)}  ${model.userSide} P${full.finishPosition} ${model.rival} P${rival}  ${calls}${flags}`,
  });
}
rows.sort((a, b) => b.score - a.score);
console.log(`${raceId}, seed ${seed}: score, result, calls (g/y/o/r = band)`);
for (const r of rows) console.log(r.line);
console.log(`${combos.length} combinations, ${mismatches} live/full mismatches`);
if (mismatches) process.exit(1);
