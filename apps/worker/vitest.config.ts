// Worker tests run inside workerd with a local D1 (Implementation Plan, "Testing": Worker).
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, CACHE_SECONDS: '0' },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
      testTimeout: 60_000,
    },
  };
});
