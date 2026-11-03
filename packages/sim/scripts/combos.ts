// Every combination of a race's decision-moment answers, played and scored the way the server
// does (beta spec stage 3): the live check from the game's grades must equal full grading, and
// the results show whether the race's seed plays fairly (the best play shouldn't always lose).
// Races with more than MAX_COMBOS paths are checked on a fixed random sample of them, which
// still takes every option of every moment (feedback round 2); --all checks every path.
//   pnpm --filter @boxthislap/sim combos <race-id> [seed] [--all] [--max N]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playDailyRace } from '../examples/daily-race.js';
import { mulberry32 } from '../src/rng.js';
import type { RaceModel } from '../src/types.js';
import { verifyRun } from '../src/verify.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const all = args.includes('--all');
const maxAt = args.indexOf('--max');
const maxArg = maxAt >= 0 ? Number(args[maxAt + 1]) : undefined;
const [raceId, seedArg] = args.filter((a, i) => a !== '--all' && i !== maxAt && i !== maxAt + 1);
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
const MAX_COMBOS = maxArg ?? 1500;
const total = combos.length;
if (!all && total > MAX_COMBOS) {
  // A fixed shuffle (so reruns check the same paths), cut to MAX_COMBOS.
  const rng = mulberry32(seed);
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [combos[i], combos[j]] = [combos[j] as string[], combos[i] as string[]];
  }
  combos = combos.slice(0, MAX_COMBOS);
  moments.forEach((m, i) => {
    for (const o of m.options) {
      if (!combos.some((c) => c[i] === o.id)) throw new Error(`sample misses ${m.id}:${o.id}`);
    }
  });
}

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
const realPos = model.realResult.indexOf(model.userSide) + 1;
const positions = rows.map((r) => Number(/ P(\d+) /.exec(r.line)?.[1] ?? 99));
const better = positions.filter((p) => p < realPos).length;
const asGood = positions.filter((p) => p <= realPos).length;
console.log(
  `${combos.length}${combos.length < total ? ` of ${total}` : ''} combinations, ${mismatches} live/full mismatches`,
);
console.log(
  `fair: real P${realPos}; ${better} paths beat it, ${asGood} match or beat it; best P${Math.min(...positions)}`,
);
if (mismatches) process.exit(1);
