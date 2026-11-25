// L3 flows (docs/test-suite-spec.md S4, D5): whole journeys against a real local Worker and a
// fresh local D1, with fixed dates. Nothing is mocked but Google's sign-in script (the local
// Worker trusts the flows' own key instead: e2e/flows/env.ts). `pnpm e2e:flows`.
//
// Two web servers, started fresh every run (never reused, so the D1 is always clean):
//   1. e2e/flows/stack.mjs: a new local D1 in a temp directory (--persist-to), migrations,
//      the dailies from the fixed date, the Eras seed, then `wrangler dev --local` on its
//      port with the fixed clock on (FLOWS_TEST: apps/worker/src/testClock.ts).
//   2. The production web build (Google sign-in on) and `vite preview` on its port,
//      proxying /api to (1) (e2e/flows/vite.flows.config.ts).
// The browser's clock is set to the same fixed time in each test (e2e/flows/helpers.ts setTime).
// One worker: the flows share one D1 and one Worker clock. Ports: web 5351, Worker 8851 (its
// inspector 5352), apart from the mocked suite's (e2e/flows/env.ts).
import { defineConfig, devices } from '@playwright/test';
import {
  ADMIN_EMAIL,
  CLIENT_ID,
  FIXED_NOW,
  PROJECTS,
  SCHEDULED_DAYS,
  SURVIVOR_POOL,
  flowsEnv,
} from './e2e/flows/env.js';

const env = flowsEnv();
const api = `http://127.0.0.1:${env.FLOWS_API_PORT}`;
const web = `http://127.0.0.1:${env.FLOWS_WEB_PORT}`;
const config = '--config e2e/flows/vite.flows.config.ts';

export default defineConfig({
  testDir: 'e2e/flows',
  timeout: 300_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: web,
    actionTimeout: 30_000,
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  // Each project plays its own days and players (e2e/flows/env.ts PROJECTS), so they share the
  // one D1 without meeting, in either order.
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'node e2e/flows/stack.mjs',
      url: `${api}/api/health`,
      reuseExistingServer: false,
      timeout: 600_000,
      // FLOWS_DEBUG=1 shows the Worker's request log and errors.
      stdout: process.env.FLOWS_DEBUG ? 'pipe' : 'ignore',
      stderr: 'pipe',
      env: {
        ...env,
        FLOWS_FIXED_NOW: FIXED_NOW,
        FLOWS_DAYS: String(SCHEDULED_DAYS),
        FLOWS_CLIENT_ID: CLIENT_ID,
        FLOWS_ADMIN_EMAIL: ADMIN_EMAIL,
        FLOWS_ERAS_PLAYERS: JSON.stringify(Object.values(PROJECTS).map((p) => p.erasPlayer)),
        FLOWS_SURVIVOR_POOL: JSON.stringify(SURVIVOR_POOL),
      },
    },
    {
      command: `vite build ${config} && vite preview ${config} --host 127.0.0.1 --port ${env.FLOWS_WEB_PORT} --strictPort`,
      url: web,
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        FLOWS_API_PORT: env.FLOWS_API_PORT,
        VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
        VITE_AUTH0_DOMAIN: '',
        VITE_AUTH0_CLIENT_ID: '',
        VITE_API_BASE: '',
      },
    },
  ],
});
