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
            // data/pools.json's daily list is empty since Nov 18 (every Daily race moved to
            // Gauntlet), so the scheduling tests rotate the 21 races it held before.
            DAILY_POOL: JSON.stringify([
              'abu-dhabi-2021',
              'abu-dhabi-2024',
              'austria-2019',
              'bahrain-2021',
              'bahrain-2022',
              'canada-2022',
              'france-2019',
              'france-2021',
              'hungary-2019',
              'hungary-2025',
              'italy-2019',
              'italy-2024',
              'mexico-2019',
              'mexico-2021',
              'mexico-2024',
              'miami-2022',
              'portugal-2020',
              'spain-2020',
              'united-states-2022',
              'russia-2021',
              'canada-2024',
            ]),
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
