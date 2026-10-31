// One end-to-end playthrough of the Daily Race in a real browser (frontend spec C4). The API is
// mocked in the test (e2e/daily.spec.ts) with the real sim verifying the run, so the test needs
// no Worker or network.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
