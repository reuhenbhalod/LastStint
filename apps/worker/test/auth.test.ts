// Google sign-in and streaks (feedback spec D3), against a test signing key that stands in for
// Google's (vitest.config.ts).

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { verifyGoogleToken } from '../src/auth.js';
import { addDays } from '../src/dates.js';
import { streakOf } from '../src/players.js';
import { get, ids, play, schedule, submit, today } from './helpers.js';

const CLIENT = env.GOOGLE_CLIENT_ID as string;
const KEYS = JSON.parse(env.GOOGLE_JWKS as string).keys;

function b64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function idToken(claims: Record<string, unknown>, kid = 'test-key'): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.TEST_GOOGLE_PRIVATE_JWK),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: CLIENT,
      sub: 'google-1',
      email: 'driver@example.com',
      name: 'Test Driver',
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

function signIn(credential: string, anonId: string) {
  return fetchApi('/api/auth/google', { credential, anonId });
}

async function fetchApi(path: string, body: unknown) {
  const { SELF } = await import('cloudflare:test');
  return SELF.fetch(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('verifyGoogleToken', () => {
  it('accepts a good token and returns the account', async () => {
    expect(await verifyGoogleToken(await idToken({}), CLIENT, Date.now(), KEYS)).toEqual({
      sub: 'google-1',
      email: 'driver@example.com',
      name: 'Test Driver',
      emailVerified: false,
    });
  });

  it('rejects a wrong audience, issuer, expired token, unknown key or tampered body', async () => {
    const now = Date.now();
    const bad = [
      await idToken({ aud: 'someone-else' }),
      await idToken({ iss: 'https://evil.example' }),
      await idToken({ exp: Math.floor(now / 1000) - 1 }),
      await idToken({}, 'other-key'),
      'not.a.token',
      'garbage',
    ];
    const good = await idToken({});
    const [h, , s] = good.split('.');
    bad.push(`${h}.${b64url(JSON.stringify({ sub: 'google-2', aud: CLIENT }))}.${s}`);
    for (const t of bad) expect(await verifyGoogleToken(t, CLIENT, now, KEYS)).toBeNull();
  });
});

describe('streakOf', () => {
  it('counts days in a row to today, or to yesterday while today is unplayed', () => {
    const d = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'];
    expect(streakOf(d, '2026-11-06')).toEqual({ current: 2, best: 3, days: 5 });
    expect(streakOf(d, '2026-11-07')).toEqual({ current: 2, best: 3, days: 5 });
    expect(streakOf(d, '2026-11-08')).toEqual({ current: 0, best: 3, days: 5 });
    expect(streakOf([], '2026-11-08')).toEqual({ current: 0, best: 0, days: 0 });
  });
});

describe('POST /api/auth/google + GET /api/players/:anonId', () => {
  it('refuses a bad credential or body', async () => {
    expect((await signIn('garbage', ids.a)).status).toBe(401);
    expect((await signIn(await idToken({}), 'not-a-uuid')).status).toBe(400);
  });

  it('makes the first browser the account, and a second browser adopts it', async () => {
    const first = await signIn(await idToken({}), ids.a);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      playerId: ids.a,
      name: 'Test Driver',
      email: 'driver@example.com',
    });
    const second = (await (await signIn(await idToken({}), ids.b)).json()) as { playerId: string };
    expect(second.playerId).toBe(ids.a);
    const me = await (await get(`/api/players/${ids.b}?today=${today()}`)).json();
    expect(me).toMatchObject({ account: { playerId: ids.a, name: 'Test Driver' } });
  });

  it("counts a run from any of the account's browsers, once a day", async () => {
    await schedule(today());
    const run = play('stay');
    expect((await submit(ids.b, run)).status).toBe(201);
    const before = await (await get(`/api/players/${ids.a}?today=${today()}`)).json();
    expect(before).toEqual({ account: null, streak: { current: 0, best: 0, days: 0 } });

    await signIn(await idToken({}), ids.a); // account = a
    await signIn(await idToken({}), ids.b); // b joins it, with today's run
    const after = await (await get(`/api/players/${ids.a}?today=${today()}`)).json();
    expect(after).toMatchObject({ streak: { current: 1, best: 1, days: 1 } });
    // Today's run already exists for the account, whichever browser asks.
    expect((await get(`/api/runs/${today()}/${ids.a}`)).status).toBe(200);
    const again = await submit(ids.a, run);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: 'already-submitted' });
    // A streak survives until the end of the next day.
    const tomorrow = await (await get(`/api/players/${ids.a}?today=${addDays(today(), 1)}`)).json();
    expect(tomorrow).toMatchObject({ streak: { current: 1 } });
  });
});
