// Worker tests run inside workerd with a local D1 (Implementation Plan, "Testing": Worker).
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  // A signing key standing in for Google's (sign-in tests): the Worker trusts its public half.
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pub = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const priv = { ...privateKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            CACHE_SECONDS: '0',
            GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
            GOOGLE_JWKS: JSON.stringify({ keys: [pub] }),
            TEST_GOOGLE_PRIVATE_JWK: JSON.stringify(priv),
            ADMIN_EMAILS: 'Admin@Example.com, other@example.com',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
      testTimeout: 60_000,
    },
  };
});
