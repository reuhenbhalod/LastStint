// API tests run inside workerd with a local D1, like apps/worker's.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  // wrangler.jsonc's assets directory must exist, built or not.
  mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
      testTimeout: 60_000,
    },
  };
});
