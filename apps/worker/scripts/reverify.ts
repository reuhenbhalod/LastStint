// Nightly re-grading (beta spec B6): every run the Worker scored from the game's claimed grades
// is re-graded here with full playouts. A run that matches is marked verified; one that doesn't
// (its claimed grades were edited) gets its true score and is marked corrected.
//
//   pnpm --filter @boxthislap/worker reverify --remote            (what CI runs nightly)
//   pnpm --filter @boxthislap/worker reverify --local --dry-run
//
// A run whose daily's race file changed since it was scheduled can't be re-graded and is
// reported and left unverified.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RaceModel } from '@boxthislap/sim';
import { modelHash } from '../src/hash.js';
import { type UnverifiedRun, recheckRun, recheckSql } from '../src/reverify.js';
import { type Target, query, repo, wrangler } from './d1.js';

const args = process.argv.slice(2);
const target: Target | null = args.includes('--remote')
  ? 'remote'
  : args.includes('--local')
    ? 'local'
    : null;
if (!target || (args.includes('--remote') && args.includes('--local'))) {
  console.error('reverify: pass --local or --remote');
  process.exit(1);
}
const dryRun = args.includes('--dry-run');

const runs = query<UnverifiedRun & { model_hash: string }>(
  target,
  `SELECT r.id, r.date, d.number, d.race_id, d.seed, d.model_hash, r.decisions, r.result
   FROM runs r JOIN daily d ON d.date = r.date WHERE r.verified = 0 ORDER BY r.created_at`,
);

const models = new Map<string, RaceModel | null>();
async function modelFor(raceId: string, hash: string): Promise<RaceModel | null> {
  const key = `${raceId}:${hash}`;
  if (!models.has(key)) {
    const file = join(repo, 'data', 'races', `${raceId}.json`);
    const model = JSON.parse(readFileSync(file, 'utf8')) as RaceModel;
    models.set(key, (await modelHash(model)) === hash ? model : null);
  }
  return models.get(key) ?? null;
}

const statements: string[] = [];
let ok = 0;
let corrected = 0;
let skipped = 0;
for (const run of runs) {
  const model = await modelFor(run.race_id, run.model_hash);
  if (!model) {
    console.warn(`run ${run.id} (${run.date}): ${run.race_id} changed since scheduling, skipped`);
    skipped++;
    continue;
  }
  const check = recheckRun(model, run);
  if (check.correct) ok++;
  else {
    corrected++;
    const before = (JSON.parse(run.result) as { score: number }).score;
    console.warn(
      `run ${run.id} (${run.date}): claimed score ${before}, true ${check.result.score}`,
    );
  }
  statements.push(...recheckSql(check));
}

console.log(
  `${runs.length} unverified: ${ok} verified, ${corrected} corrected, ${skipped} skipped`,
);

// Survivor rounds (docs/survivor-spec.md): the same re-grade. A round's win or loss is the
// replayed race, so it never changes; an edited score is corrected, and a won round's run total
// with it.
const rounds = query<{
  run_id: string;
  round: number;
  race_id: string;
  seed: number;
  model_hash: string;
  decisions: string;
  result: string;
  score: number;
  won: number;
  started_at: string;
}>(
  target,
  `SELECT s.run_id, s.round, s.race_id, s.seed, s.model_hash, s.decisions, s.result, s.score,
     s.won, r.started_at
   FROM survivor_rounds s JOIN survivor_runs r ON r.id = s.run_id
   WHERE s.verified = 0 AND s.won IS NOT NULL ORDER BY s.submitted_at`,
);
let roundsOk = 0;
let roundsFixed = 0;
for (const r of rounds) {
  const model = await modelFor(r.race_id, r.model_hash);
  if (!model) {
    console.warn(`survivor ${r.run_id} round ${r.round}: ${r.race_id} changed, skipped`);
    continue;
  }
  const check = recheckRun(model, {
    id: r.run_id,
    date: r.started_at.slice(0, 10),
    number: r.round,
    race_id: r.race_id,
    seed: r.seed,
    decisions: r.decisions,
    result: r.result,
  });
  const where = `run_id = '${r.run_id}' AND round = ${r.round}`;
  if (check.correct) {
    roundsOk++;
    statements.push(`UPDATE survivor_rounds SET verified = 1 WHERE ${where};`);
    continue;
  }
  roundsFixed++;
  const res = check.result;
  console.warn(`survivor ${r.run_id} round ${r.round}: claimed ${r.score}, true ${res.score}`);
  statements.push(
    `UPDATE survivor_rounds SET verified = 1, corrected = 1, score = ${res.score}, result = '${JSON.stringify(
      res,
    ).replace(/'/g, "''")}' WHERE ${where};`,
  );
  if (r.won) {
    statements.push(
      `UPDATE survivor_runs SET score_sum = score_sum + ${res.score - r.score} WHERE id = '${r.run_id}';`,
    );
  }
}
console.log(`${rounds.length} survivor rounds: ${roundsOk} verified, ${roundsFixed} corrected`);
if (dryRun || statements.length === 0) {
  console.log(dryRun ? '(dry run: nothing written)' : 'nothing to write');
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'reverify-')), 'reverify.sql');
  writeFileSync(file, statements.join('\n'));
  wrangler(target, '--file', file, ...(target === 'remote' ? ['--yes'] : []));
  console.log(`wrote ${statements.length} updates to the ${target} D1`);
}
