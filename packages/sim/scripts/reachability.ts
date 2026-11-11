// Reachability and difficulty checker CLI (eras build plan 6.1; eras spec §15):
//   pnpm --filter @laststint/sim reachability [race-id ...] [--samples N] [--seeds 1,2,3]
//                                             [--beam N] [--json]
// With no race ids it checks every race in data/pools.json "eras" (none is a pass).
// An argument ending in .json is read as a race file path instead (relative to the caller).
// Prints one block per race (pass/fail, the best path, its stars, the runtime), or the full
// reports as JSON with --json, and exits 1 if any race fails. See src/eras/reachability.ts for
// the search and its bounds.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REACH_BEAM, REACH_SEEDS, checkRaces, formatSummary } from '../src/eras/reachability.js';
import { GRADE_SAMPLES } from '../src/grade.js';
import type { RaceModel } from '../src/types.js';

const races = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data', 'races');

function usage(why: string): never {
  console.error(`reachability: ${why}`);
  console.error(
    'usage: reachability [race-id ...] [--samples N] [--seeds 1,2,3] [--beam N] [--json]',
  );
  process.exit(2);
}

function positiveInt(flag: string, value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) usage(`${flag} must be a positive integer, got ${value}`);
  return n;
}

const ids: string[] = [];
let samples = GRADE_SAMPLES;
let beamWidth = REACH_BEAM;
let seeds: readonly number[] = REACH_SEEDS;
let json = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i] as string;
  if (a === '--samples') samples = positiveInt(a, args[++i]);
  else if (a === '--beam') beamWidth = positiveInt(a, args[++i]);
  else if (a === '--seeds') {
    const list = args[++i];
    if (!list) usage('--seeds needs a comma-separated list');
    seeds = list.split(',').map((s) => {
      const n = Number(s);
      if (!Number.isInteger(n)) usage(`--seeds: ${s} is not an integer`);
      return n;
    });
  } else if (a === '--json') json = true;
  else if (a.startsWith('--')) usage(`unknown flag ${a}`);
  else ids.push(a);
}

function load(id: string): RaceModel {
  // pnpm --filter runs the script from packages/sim, so a path is the caller's.
  const path = id.endsWith('.json')
    ? resolve(process.env.INIT_CWD ?? process.cwd(), id)
    : join(races, `${id}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RaceModel;
  } catch (e) {
    usage(`can't read race ${id} (${path}): ${(e as Error).message}`);
  }
}

// With no ids: the races the eras play (data/pools.json "eras"). A race authored but swapped
// out of every era (china-2011) keeps its eras block but isn't served, so it's
// skipped; name it to check it.
const erasPool = new Set(
  Object.values(
    (
      JSON.parse(readFileSync(join(races, '..', 'pools.json'), 'utf8')) as {
        eras: Record<string, string[]>;
      }
    ).eras,
  ).flat(),
);
const all = ids.length
  ? ids.map(load)
  : readdirSync(races)
      .filter((f) => f.endsWith('.json') && erasPool.has(f.slice(0, -'.json'.length)))
      .sort()
      .map((f) => load(f.slice(0, -'.json'.length)));
if (ids.length) {
  for (const m of all.filter((r) => !r.eras))
    console.error(`reachability: ${m.race.id} has no eras block, skipped`);
}

const summary = checkRaces(all, { samples, beamWidth, seeds });
process.stdout.write(`${json ? JSON.stringify(summary, null, 2) : formatSummary(summary)}\n`);
// exitCode, not exit(): exit() can cut off a long report still being written to a pipe (CI).
process.exitCode = summary.ok ? 0 : 1;
