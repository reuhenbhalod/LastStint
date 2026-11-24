// D1 access for the operator scripts, through Wrangler (the account is pinned in wrangler.jsonc;
// CI passes CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID).

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..');
export const repo = join(workerDir, '..', '..');

/** local and remote are production's D1 (pitwall-db); staging is pitwall-staging-db (remote). */
export type Target = 'local' | 'remote' | 'staging';

/** A local D1 kept somewhere other than .wrangler/state (`--persist-to`; local only). */
let localPersistTo: string | undefined;

/** Use the local D1 in `dir` (wrangler's --persist-to), as the browser flows' stack does. */
export function setLocalPersistTo(dir: string | undefined): void {
  localPersistTo = dir;
}

/** The `wrangler d1 execute` database and flags for a target. */
export function d1Args(target: Target): string[] {
  if (target === 'staging') return ['pitwall-staging-db', '--remote', '--env', 'staging'];
  if (target === 'local' && localPersistTo) {
    return ['pitwall-db', '--local', '--persist-to', localPersistTo];
  }
  return ['pitwall-db', `--${target}`];
}

/** Run `wrangler d1 execute` on the chosen D1; throws with Wrangler's output. */
export function wrangler(target: Target, ...args: string[]): string {
  // Run Wrangler's JS entry with this Node rather than `npx`: npx is npx.cmd on Windows, which
  // Node only spawns through a shell, and a shell would split the SQL in `--command`.
  const bin = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const res = spawnSync(process.execPath, [bin, 'd1', 'execute', ...d1Args(target), ...args], {
    cwd: workerDir,
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`wrangler failed:\n${res.stderr || res.stdout}`);
  return res.stdout;
}

export function query<T>(target: Target, sql: string): T[] {
  const out = wrangler(target, '--json', '--command', sql);
  const parsed = JSON.parse(out) as Array<{ results: T[] }>;
  return parsed[0]?.results ?? [];
}

export const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;
