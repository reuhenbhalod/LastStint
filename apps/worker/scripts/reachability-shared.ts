// Reachability for the shared races (eras build plan 6.1, "Shared races"):
//   pnpm --filter @laststint/worker reachability:shared [race-id ...] [--json]
// A race in both Eras and a Daily or Gauntlet pool keeps its Daily race file, so its eras
// block lives only in its overlay (data/eras/<race-id>.json) and the sim's checker
// (`pnpm --filter @laststint/sim reachability`, which reads data/races) never sees it. This
// runs the same check on the model the Eras API serves: the race file merged with its overlay
// (withErasOverlay). With no race ids it checks every pool race whose overlay has an eras
// block. Exits 1 if any race fails.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RaceModel } from '@laststint/sim';
import { checkRaces, formatSummary } from '../../../packages/sim/src/eras/reachability.js';
import { withErasOverlay } from '../src/erasOverlay.js';

const data = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const args = process.argv.slice(2);
const json = args.includes('--json');
const ids = args.filter((a) => !a.startsWith('--'));

const pools = read(join(data, 'pools.json')) as {
  daily?: string[];
  survivor?: Record<string, unknown>;
};
const shared = [...new Set([...(pools.daily ?? []), ...Object.keys(pools.survivor ?? {})])].sort();
const overlayPath = (id: string) => join(data, 'eras', `${id}.json`);
const hasEras = (id: string) =>
  existsSync(overlayPath(id)) && (read(overlayPath(id)) as { eras?: unknown }).eras != null;

const chosen = ids.length ? ids : shared.filter(hasEras);
for (const id of chosen) {
  if (!shared.includes(id)) {
    console.error(`reachability:shared: ${id} isn't a Daily/Gauntlet race`);
    process.exit(2);
  }
}
const models = chosen.map((id) =>
  withErasOverlay(read(join(data, 'races', `${id}.json`)) as RaceModel, read(overlayPath(id))),
);
const summary = checkRaces(models);
process.stdout.write(`${json ? JSON.stringify(summary, null, 2) : formatSummary(summary)}\n`);
process.exitCode = summary.ok ? 0 : 1;
