// Schedule dailies (Implementation Plan 5.4, Phase 4 spec C4): pick eligible races, number the
// days, pin each model's hash, and write to D1 via Wrangler. Every day of a race uses the race
// file's own seed, which is chosen so the race plays like the real one (Abu Dhabi 2021: HAM
// reaches the lap-53 SC 11.9s ahead, so boxing isn't free; beta spec B1).
//
//   pnpm --filter @laststint/worker schedule --local --from 2026-11-01 --days 14
//   pnpm --filter @laststint/worker schedule --remote --days 7 --race abu-dhabi-2021
//   pnpm --filter @laststint/worker schedule --staging --days 7
//
// Options:
//   --local | --remote | --staging
//                          which D1 to write (one is required): --local and --remote are
//                          production's pitwall-db; --staging is pitwall-staging-db (remote,
//                          docs/staging.md)
//   --from YYYY-MM-DD      first date (default: today, UTC)
//   --days N               how many dates (default 1)
//   --race ID              schedule this race on every date (default: shuffle eligible races)
//   --allow-ineligible     allow races that aren't eligible (local or staging, for testing)
//   --dry-run              print the plan without writing
//
// A race is eligible when it's in the daily pool (data/pools.json), has approved decision
// moments, and its Gate G1 status in docs/g1-report.md is pass or borderline. Dates already scheduled are never changed.

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDays, isDate, todayUtc } from '../src/dates.js';
import { modelHash } from '../src/hash.js';
import { pickRaces } from '../src/shuffle.js';
import { type Target, wrangler as d1, query as d1Query, repo, sqlString } from './d1.js';

interface Model {
  race: { id: string; seed: number };
  userSide: string;
  rival?: string;
  decisionMoments: unknown[];
}

function fail(message: string): never {
  console.error(`schedule: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = {
    target: '' as '' | Target,
    from: todayUtc(Date.now()),
    days: 1,
    race: undefined as string | undefined,
    allowIneligible: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => argv[++i] ?? fail(`${a} needs a value`);
    if (a === '--local' || a === '--remote' || a === '--staging') {
      if (args.target) fail('pass only one of --local, --remote and --staging');
      args.target = a.slice(2) as Target;
    } else if (a === '--from') args.from = value();
    else if (a === '--days') args.days = Number(value());
    else if (a === '--race') args.race = value();
    else if (a === '--allow-ineligible') args.allowIneligible = true;
    else if (a === '--dry-run') args.dryRun = true;
    else fail(`unknown option ${a}`);
  }
  if (!args.target) fail('pass --local, --remote or --staging');
  if (!isDate(args.from)) fail('--from must be YYYY-MM-DD');
  if (!Number.isInteger(args.days) || args.days < 1 || args.days > 366) {
    fail('--days must be 1-366');
  }
  if (args.allowIneligible && args.target === 'remote') {
    fail('--allow-ineligible is for local or staging testing only');
  }
  return args as typeof args & { target: Target };
}

/** Gate G1 status per race, from the generated report's tables. */
export function g1Statuses(report: string): Map<string, string> {
  const statuses = new Map<string, string>();
  for (const line of report.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    // | race | duel | status | ...
    if (cells.length > 4 && /^[a-z0-9-]+-\d{4}$/.test(cells[1] ?? '')) {
      statuses.set(cells[1] as string, cells[3] as string);
    }
  }
  return statuses;
}

function loadModels(): Map<string, Model> {
  const dir = join(repo, 'data', 'races');
  const models = new Map<string, Model>();
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const model = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Model;
    models.set(model.race.id, model);
  }
  return models;
}

function wrangler(target: Target, ...args: string[]): string {
  try {
    return d1(target, ...args);
  } catch (e) {
    return fail((e as Error).message);
  }
}

function query<T>(target: Target, sql: string): T[] {
  try {
    return d1Query<T>(target, sql);
  } catch (e) {
    return fail((e as Error).message);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const models = loadModels();
  const statuses = g1Statuses(readFileSync(join(repo, 'docs', 'g1-report.md'), 'utf8'));
  const daily = (
    JSON.parse(readFileSync(join(repo, 'data', 'pools.json'), 'utf8')) as {
      daily: string[];
    }
  ).daily;
  // In the daily pool (survivor races never play as dailies), with moments, passing G1.
  const eligible = (id: string) => {
    const m = models.get(id);
    const status = statuses.get(id);
    return (
      daily.includes(id) &&
      !!m &&
      m.decisionMoments.length > 0 &&
      (status === 'pass' || status === 'borderline')
    );
  };

  let pool: string[];
  if (args.race) {
    if (!models.has(args.race)) fail(`unknown race ${args.race}`);
    if (!eligible(args.race) && !args.allowIneligible) {
      fail(
        `${args.race} is not eligible (moments: ${models.get(args.race)?.decisionMoments.length}, G1: ${statuses.get(args.race) ?? 'not validated'})`,
      );
    }
    pool = [args.race];
  } else {
    pool = [...models.keys()].filter(eligible);
    if (pool.length === 0) fail('no eligible races');
  }

  const existing = query<{ date: string; number: number; race_id: string }>(
    args.target,
    'SELECT date, number, race_id FROM daily ORDER BY number',
  );
  const taken = new Set(existing.map((r) => r.date));
  const plan: string[] = [];
  let number = existing.reduce((n, r) => Math.max(n, r.number), 0);
  const open: string[] = [];
  for (let i = 0; i < args.days; i++) {
    const date = addDays(args.from, i);
    if (taken.has(date)) plan.push(`${date}  already scheduled, skipped`);
    else open.push(date);
  }
  const facts = pool.map((id) => {
    const m = models.get(id) as Model;
    return { id, userSide: m.userSide, rival: m.rival };
  });
  const existingDays = existing.map((r) => ({ date: r.date, raceId: r.race_id }));

  const rows: string[] = [];
  const now = new Date().toISOString();
  for (const { date, raceId: id } of pickRaces(facts, existingDays, open)) {
    const model = models.get(id) as Model;
    const seed = model.race.seed;
    number++;
    const hash = await modelHash(model);
    rows.push(
      `INSERT INTO daily (date, race_id, seed, side, published_at, number, model_hash) VALUES (${[
        sqlString(date),
        sqlString(id),
        seed,
        sqlString(model.userSide),
        sqlString(now),
        number,
        sqlString(hash),
      ].join(', ')});`,
    );
    plan.push(`${date}  #${number}  ${id}  seed ${seed}  ${model.userSide}  ${hash.slice(0, 12)}`);
  }

  console.log(plan.sort().join('\n'));
  if (args.dryRun || rows.length === 0) {
    console.log(args.dryRun ? '(dry run: nothing written)' : 'nothing to write');
    return;
  }
  const file = join(mkdtempSync(join(tmpdir(), 'schedule-')), 'daily.sql');
  writeFileSync(file, rows.join('\n'));
  wrangler(args.target, '--file', file, ...(args.target === 'local' ? [] : ['--yes']));
  const db = args.target === 'staging' ? 'staging (pitwall-staging-db)' : args.target;
  console.log(`wrote ${rows.length} dailies to the ${db} D1`);
}

await main();
