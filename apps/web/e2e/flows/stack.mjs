// The flows' local API (docs/test-suite-spec.md S4, D5), started by playwright.flows.config.ts:
// a fresh local D1 in FLOWS_DIR (never .wrangler/state, never remote), every migration applied,
// the dailies scheduled from the fixed date, the Eras seed below, then `wrangler dev --local` on
// FLOWS_API_PORT with that D1. The Worker's vars for the run go in an env file (--env-file):
// the fixed clock (FLOWS_TEST, FLOWS_NOW: apps/worker/src/testClock.ts), the Google sign-in
// test path (GOOGLE_JWKS: the flows' own key, Auth0 off), the admin, and the Gauntlet's pool.
//
// Settings come from the environment (e2e/flows/env.ts via the config): FLOWS_DIR,
// FLOWS_API_PORT, FLOWS_PUBLIC_JWKS, FLOWS_FIXED_NOW, FLOWS_DAYS, FLOWS_CLIENT_ID,
// FLOWS_ADMIN_EMAIL, FLOWS_ERAS_PLAYERS, FLOWS_SURVIVOR_POOL,
// FLOWS_INSPECTOR_PORT.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'worker');
const wranglerBin = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const tsxBin = join(workerDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`stack: ${k} is not set (run through playwright.flows.config.ts)`);
  return v;
};
const dir = need('FLOWS_DIR');
const port = need('FLOWS_API_PORT');
const fixedNow = need('FLOWS_FIXED_NOW');
const d1Dir = join(dir, 'd1');

function run(args, what) {
  const t = Date.now();
  const res = spawnSync(process.execPath, args, {
    cwd: workerDir,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error(`stack: ${what} failed`);
  }
  console.log(`stack: ${what} (${Date.now() - t} ms)`);
}

// A fresh local D1: this run's own directory, emptied first.
rmSync(d1Dir, { recursive: true, force: true });
mkdirSync(d1Dir, { recursive: true });
run(
  [wranglerBin, 'd1', 'migrations', 'apply', 'pitwall-db', '--local', '--persist-to', d1Dir],
  'migrations',
);
// The dailies from the fixed date (Abu Dhabi 2021 every day: the flows know its calls). The
// race is in the daily pool with moments, so it is eligible as in production.
run(
  [
    tsxBin,
    'scripts/schedule.ts',
    '--local',
    '--persist-to',
    d1Dir,
    '--from',
    fixedNow.slice(0, 10),
    '--days',
    need('FLOWS_DAYS'),
    '--race',
    'abu-dhabi-2021',
  ],
  'schedule',
);

// Eras as production will have it: Eras 10 and 9 published and released a month before the
// fixed date (ERAS_TEST_MODE stays false, so the unlock rule applies), and each project's Eras
// player with 20 Era 10 stars on the nine races other than belgium-2023: one short of Era 9
// (21 of 30).
const players = JSON.parse(need('FLOWS_ERAS_PLAYERS'));
const released = '2026-05-01T00:00:00.000Z';
const seeded = [
  'bahrain-2023',
  'great-britain-2023',
  'hungary-2022',
  'japan-2023',
  'netherlands-2023',
  'emilia-romagna-2024',
  'hungary-2024',
  'saudi-arabia-2023',
  'abu-dhabi-2022',
];
// 3+3+3+3+3+3+2+0+0 = 20.
const stars = [3, 3, 3, 3, 3, 3, 2, 0, 0];
const sql = [
  'UPDATE era_races SET published = 1 WHERE era_id IN (10, 9);',
  `UPDATE eras SET released_at = '${released}' WHERE id IN (10, 9);`,
  ...players.flatMap((player) =>
    seeded.map((raceId, i) => {
      const n = stars[i];
      return `INSERT INTO era_progress (player_id, race_id, legend, star_result, star_strategist, star_mastery, hidden_done, best_accuracy, updated_at) VALUES ('${player}', '${raceId}', 0, ${n >= 1 ? 1 : 0}, ${n >= 2 ? 1 : 0}, ${n >= 3 ? 1 : 0}, 0, 90, '${released}');`;
    }),
  ),
];
const seedFile = join(dir, 'seed.sql');
writeFileSync(seedFile, sql.join('\n'));
run(
  [
    wranglerBin,
    'd1',
    'execute',
    'pitwall-db',
    '--local',
    '--persist-to',
    d1Dir,
    '--file',
    seedFile,
  ],
  'eras seed',
);

const envFile = join(dir, 'worker.env');
const vars = {
  FLOWS_TEST: 'true',
  FLOWS_NOW: fixedNow,
  CACHE_SECONDS: '0',
  ERAS_TEST_MODE: 'false',
  GOOGLE_CLIENT_ID: need('FLOWS_CLIENT_ID'),
  GOOGLE_JWKS: need('FLOWS_PUBLIC_JWKS'),
  AUTH0_DOMAIN: '',
  AUTH0_CLIENT_ID: '',
  ADMIN_EMAILS: need('FLOWS_ADMIN_EMAIL'),
  SURVIVOR_POOL: need('FLOWS_SURVIVOR_POOL'),
};
// One KEY='value' per line (single quotes: the JSON values hold double quotes).
writeFileSync(
  envFile,
  `${Object.entries(vars)
    .map(([k, v]) => `${k}='${v}'`)
    .join('\n')}\n`,
);

const dev = spawn(
  process.execPath,
  [
    wranglerBin,
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    port,
    '--inspector-port',
    need('FLOWS_INSPECTOR_PORT'),
    '--persist-to',
    d1Dir,
    '--env-file',
    envFile,
    '--show-interactive-dev-session=false',
  ],
  { cwd: workerDir, stdio: 'inherit', env: { ...process.env, CI: '1' } },
);
const stop = () => dev.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
// The run's D1 goes with the Worker.
dev.on('exit', (code, signal) => {
  // On stderr, which the flows' config always shows: a Worker gone mid-run is otherwise silent.
  console.error(`stack: wrangler dev exited (code ${code}, signal ${signal})`);
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
