// Google sign-in and streaks (feedback spec D3), against a test signing key that stands in for
// Google's (vitest.config.ts).

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { accountKey, verifyCredential, verifyGoogleToken } from '../src/auth.js';
import { addDays } from '../src/dates.js';
import type { Env } from '../src/index.js';
import { signIn as signInDb, streakOf } from '../src/players.js';
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
      displayName: '',
      favouriteTeam: '',
      needsProfile: true, // no display name yet: the game asks for the profile
      admin: false,
      created: true, // a new account: the game shows how to play once
    });
    const second = (await (await signIn(await idToken({}), ids.b)).json()) as {
      playerId: string;
      created: boolean;
    };
    expect(second.playerId).toBe(ids.a);
    expect(second.created).toBe(false); // signing in again: no walkthrough
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

describe('Auth0 (docs/auth0-spec.md)', () => {
  // The test key stands in for the tenant's; Auth0's issuer and our SPA client ID.
  const auth0 = {
    AUTH0_DOMAIN: 'laststint.test',
    AUTH0_CLIENT_ID: 'spa-client',
    AUTH0_JWKS: env.GOOGLE_JWKS,
  } as Env;
  const auth0Claims = { iss: 'https://laststint.test/', aud: 'spa-client' };

  it('takes an Auth0 ID token when Auth0 is set up, and not a Google one', async () => {
    const who = await verifyCredential(
      auth0,
      await idToken({ ...auth0Claims, sub: 'auth0|abc', email_verified: true }),
      Date.now(),
    );
    expect(who).toEqual({
      sub: 'auth0|abc',
      email: 'driver@example.com',
      name: 'Test Driver',
      emailVerified: true,
    });
    expect(await verifyCredential(auth0, await idToken({}), Date.now())).toBeNull();
    // Our client ID only, and Auth0's issuer only.
    const wrong = await idToken({ ...auth0Claims, aud: 'someone-else' });
    expect(await verifyCredential(auth0, wrong, Date.now())).toBeNull();
  });

  it('finds an old Google account from a Google sign-in through Auth0', async () => {
    expect(accountKey('google-oauth2|google-1')).toBe('google-1');
    expect(accountKey('auth0|abc')).toBe('auth0|abc');
    // An account made with the old Google button...
    const old = (await (await signIn(await idToken({}), ids.a)).json()) as { playerId: string };
    // ...is the one Google-through-Auth0 signs in to.
    const who = await verifyCredential(
      auth0,
      await idToken({ ...auth0Claims, sub: 'google-oauth2|google-1' }),
      Date.now(),
    );
    expect(who?.sub).toBe('google-1');
    const again = await signInDb(env.DB, who as NonNullable<typeof who>, ids.b, Date.now());
    expect(again.playerId).toBe(old.playerId);
    expect(again.created).toBe(false);
  });
});

describe('POST /api/profile (docs/auth0-spec.md A4)', () => {
  const profile = async (credential: string, displayName: string, favouriteTeam = '') =>
    fetchApi('/api/profile', { credential, displayName, favouriteTeam });

  it('sets the display name and team, unique names only, and the leaderboard shows it', async () => {
    const me = await idToken({});
    await signIn(me, ids.a);
    const res = await profile(me, '  Box Box  ', 'McLaren');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ displayName: 'Box Box', favouriteTeam: 'McLaren' });
    const player = await (await get(`/api/players/${ids.a}?today=${today()}`)).json();
    expect(player).toMatchObject({
      account: { displayName: 'Box Box', favouriteTeam: 'McLaren', needsProfile: false },
    });

    // Someone else can't take it, whatever the case.
    const other = await idToken({ sub: 'google-2', email: 'two@example.com' });
    await signIn(other, ids.b);
    const taken = await profile(other, 'box BOX');
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ error: 'name-taken' });
    // Too short, odd characters, a bad token, no account.
    expect((await profile(other, 'ab')).status).toBe(400);
    expect((await profile(other, 'Box<script>')).status).toBe(400);
    expect((await profile('garbage', 'Fine Name')).status).toBe(401);
    expect((await profile(await idToken({ sub: 'nobody' }), 'Fine Name')).status).toBe(404);

    // The leaderboard: the display name for a player who has one.
    await schedule(today());
    expect((await submit(ids.a, play('stay'))).status).toBe(201);
    const board = (await (await get(`/api/daily/${today()}/leaderboard`)).json()) as {
      entries: Array<{ name: string }>;
    };
    expect(board.entries[0]?.name).toBe('Box Box');
  });
});
