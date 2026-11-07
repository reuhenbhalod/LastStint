import { SELF, env } from 'cloudflare:test';
import type { Decision, RaceModel } from '@laststint/sim';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { todayUtc } from '../src/dates.js';
import { modelHash } from '../src/races.js';

export const abu = abuJson as unknown as RaceModel;
export const SEED = 4242;
export const today = () => todayUtc(Date.now());

/** Put a daily in D1 the way the schedule script does. */
export async function schedule(
  date: string,
  options: { raceId?: string; seed?: number; number?: number; hash?: string } = {},
): Promise<void> {
  const raceId = options.raceId ?? 'abu-dhabi-2021';
  await env.DB.prepare(
    `INSERT INTO daily (date, race_id, seed, side, published_at, number, model_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      date,
      raceId,
      options.seed ?? SEED,
      abu.userSide,
      new Date().toISOString(),
      options.number ?? 1,
      options.hash ?? (await modelHash(abu)),
    )
    .run();
}

/**
 * Play today's Abu Dhabi daily as the game does: `scStop` at the lap-53 SC, and at the other
 * moments the real team's call (or the first option where the real team took none).
 */
export function play(scStop: string) {
  return playDailyRace(abu, SEED, (m) =>
    m.id === 'sc-stop' ? scStop : (m.realOptionId ?? (m.options[0]?.id as string)),
  );
}

let ip = 0;

export function post(body: unknown, headers: Record<string, string> = {}) {
  ip++;
  return SELF.fetch('https://api.test/api/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': `10.0.${Math.floor(ip / 250)}.${ip % 250}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function get(path: string) {
  return SELF.fetch(`https://api.test${path}`);
}

/** Submit a played run the way the game does: its call log and its claimed grades. */
export function submit(
  anonId: string,
  run: { decisions: Decision[]; grades: unknown },
  date = today(),
) {
  return post({ date, anonId, decisions: run.decisions, grades: run.grades });
}

export const ids = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  c: '33333333-3333-4333-8333-333333333333',
};

function b64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * A Google ID token signed with the test key (vitest.config.ts): admin@example.com, verified,
 * unless `claims` say otherwise.
 */
export async function idToken(claims: Record<string, unknown> = {}): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.TEST_GOOGLE_PRIVATE_JWK),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: env.GOOGLE_CLIENT_ID,
      sub: 'google-admin',
      email: 'admin@example.com',
      email_verified: true,
      name: 'Admin',
      exp: Math.floor(Date.now() / 1000) + 600,
      ...claims,
    }),
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}
