// The flows' local stack settings (docs/test-suite-spec.md S4, D5), made once per
// `playwright test` run and handed to the web servers and test workers through process.env
// (Playwright loads the config in every worker; the first load sets them, later loads reuse
// them): a fresh D1 directory, the ports, the fixed date, and a sign-in key pair that the
// local Worker trusts in place of Google's (GOOGLE_JWKS, the Worker's test path).

import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The fixed "now" every flow starts from: midday UTC, so the day is the same everywhere
 * from UTC-11 to UTC+11. Days are scheduled from this date. */
export const FIXED_NOW = '2026-06-01T12:00:00.000Z';
export const FIXED_DATE = FIXED_NOW.slice(0, 10);
/**
 * Each project plays its own days and players, so phone and desktop share the run's one D1 and
 * Worker without meeting: desktop from FIXED_DATE, phone from FIXED_DATE + 14 days. The Eras
 * player is seeded with 20 Era 10 stars (stack.mjs), one short of Era 9.
 */
export const PROJECTS = {
  desktop: { base: 0, erasPlayer: '4e7a5000-0000-4000-8000-000000000001' },
  phone: { base: 14, erasPlayer: '4e7a5000-0000-4000-8000-000000000002' },
} as const;
export type ProjectName = keyof typeof PROJECTS;
/** Days scheduled from FIXED_DATE: each project's daily, next day and edited day. */
export const SCHEDULED_DAYS = 28;
/** The Google client ID the local Worker and the flows' web build share. */
export const CLIENT_ID = 'flows-client.apps.googleusercontent.com';
export const ADMIN_EMAIL = 'admin@flows.test';
/** The Gauntlet's pool: Spain 2020 only (the real calls win it; stack.mjs). */
export const SURVIVOR_POOL = { 'spain-2020': [85579] };

export interface FlowsEnv {
  FLOWS_DIR: string;
  FLOWS_API_PORT: string;
  FLOWS_WEB_PORT: string;
  FLOWS_INSPECTOR_PORT: string;
  FLOWS_PUBLIC_JWKS: string;
  FLOWS_PRIVATE_JWK: string;
}

/**
 * The flows' own ports, apart from the mocked suite's E2E_PORTs and other local Workers (the
 * Mac is shared by parallel runs): the web app 5351, the Worker 8851, its inspector 5352.
 * FLOWS_WEB_PORT, FLOWS_API_PORT and FLOWS_INSPECTOR_PORT override them.
 */
const PORTS = { web: 5351, api: 8851, inspector: 5352 };

/** The run's settings: made on the first call (and put in process.env), then reused. */
export function flowsEnv(): FlowsEnv {
  if (!process.env.FLOWS_DIR) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pub = {
      ...publicKey.export({ format: 'jwk' }),
      kid: 'flows-key',
      alg: 'RS256',
      use: 'sig',
    };
    const priv = { ...privateKey.export({ format: 'jwk' }), kid: 'flows-key', alg: 'RS256' };
    // Made (and removed at the end) by stack.mjs, so a config load that starts no stack leaves
    // nothing behind.
    process.env.FLOWS_DIR = join(tmpdir(), `laststint-flows-${randomBytes(6).toString('hex')}`);
    process.env.FLOWS_API_PORT ??= String(PORTS.api);
    process.env.FLOWS_WEB_PORT ??= String(PORTS.web);
    process.env.FLOWS_INSPECTOR_PORT ??= String(PORTS.inspector);
    process.env.FLOWS_PUBLIC_JWKS = JSON.stringify({ keys: [pub] });
    process.env.FLOWS_PRIVATE_JWK = JSON.stringify(priv);
  }
  return {
    FLOWS_DIR: process.env.FLOWS_DIR as string,
    FLOWS_API_PORT: process.env.FLOWS_API_PORT as string,
    FLOWS_WEB_PORT: process.env.FLOWS_WEB_PORT as string,
    FLOWS_INSPECTOR_PORT: process.env.FLOWS_INSPECTOR_PORT as string,
    FLOWS_PUBLIC_JWKS: process.env.FLOWS_PUBLIC_JWKS as string,
    FLOWS_PRIVATE_JWK: process.env.FLOWS_PRIVATE_JWK as string,
  };
}
