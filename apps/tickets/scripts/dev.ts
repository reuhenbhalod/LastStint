// Local dev: the Worker (`wrangler dev`, local D1, on :8788) and the app (`vite`, with hot
// reload, which forwards /api to the Worker). Open the URL Vite prints.
//
//   pnpm --filter @boxthislap/tickets dev

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// wrangler wants the assets directory to exist; in dev Vite serves the app, not dist/.
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });

const children: ChildProcess[] = [];

function run(cmd: string, args: string[]): void {
  const child = spawn(cmd, args, { cwd: root, stdio: 'inherit' });
  child.on('exit', (code) => {
    console.error(`${cmd} ${args[0]} exited (${code ?? 'signal'}); stopping dev`);
    stop(code ?? 1);
  });
  children.push(child);
}

function stop(code: number): void {
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

run('pnpm', ['exec', 'wrangler', 'dev', '--port', '8788']);
run('pnpm', ['exec', 'vite']);
