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
            // The Google path (tests sign their own Google tokens); Auth0 tests set their own.
            AUTH0_DOMAIN: '',
            AUTH0_CLIENT_ID: '',
            GOOGLE_JWKS: JSON.stringify({ keys: [pub] }),
            TEST_GOOGLE_PRIVATE_JWK: JSON.stringify(priv),
            ADMIN_EMAILS: 'Admin@Example.com, other@example.com',
            // Survivor tests deal from two bundled races: Spain 2020 (the real calls win: VER
            // holds BOT) and Canada 2022 (they lose: SAI P2 behind VER).
            SURVIVOR_POOL: JSON.stringify({ 'spain-2020': [85579], 'canada-2022': [592] }),
            // Versus rooms at test speed: short laps, picks, calls and waits.
            VERSUS_LAP_MS: '15',
            VERSUS_PICK_MS: '3000',
            VERSUS_CALL_MS: '300',
            VERSUS_BATTLE_MS: '300',
            VERSUS_RECONNECT_MS: '400',
            VERSUS_REVEAL_MS: '10',
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
