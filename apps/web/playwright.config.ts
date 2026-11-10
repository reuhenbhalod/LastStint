// The browser playthroughs (frontend spec C4; Eras build plan 10.1). The API is mocked in each
// test (e2e/mock.ts for the daily and the Gauntlet, e2e/eras.ts for Eras) with the real sim
// running the race in the page, so no Worker or network is needed.
//
// Two projects: `phone` (a 390 px iPhone 13, every spec; the Gauntlet and defend specs size
// themselves to a laptop) and `desktop` (1440 × 900: the Eras playthroughs and the daily).
// The Eras playthroughs run in parallel; runtime is recorded in docs/eras-build-plan.md 10.1.
import { defineConfig, devices } from '@playwright/test';

// E2E_PORT: another port for the preview server (two checkouts running the suite at once).
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  use: { baseURL: `http://localhost:${port}`, actionTimeout: 30_000 },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    {
      name: 'desktop',
      testMatch: /(eras-play|eras-launch|daily)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
