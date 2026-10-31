// D1 access for the operator scripts, through Wrangler (the account is pinned in wrangler.jsonc;
// CI passes CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID).

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..');
export const repo = join(workerDir, '..', '..');
const DB_NAME = 'pitwall-db';

export type Target = 'local' | 'remote';

/** Run `wrangler d1 execute` on the local or remote D1; throws with Wrangler's output. */
export function wrangler(target: Target, ...args: string[]): string {
  const res = spawnSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, `--${target}`, ...args], {
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
