// Contract tests for every API route (docs/test-suite-spec.md S5): for each one, success; auth
// (signed out, a bad or expired token, a player, an admin) where it takes a token; bad input
// (missing, invalid, wrong type, oversize); not found; the rate limit where RUNS_LIMITER is
// applied; and the exact error status and body. The deeper behaviour of each route is in its
// own test file (api, admin, admin-v2, auth, eras*, survivor, tickets, versus); this file is the
// one place that walks the whole surface, route by route.

import { SELF, createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/dates.js';
import worker, { type Env } from '../src/index.js';
import { getRace } from '../src/races.js';
import { resetFlowsClock } from '../src/testClock.js';
import wranglerConfig from '../wrangler.jsonc?raw';
import { idToken, ids, play, schedule, today } from './helpers.js';

/** The real Date, captured before any test could swap it (src/testClock.ts). */
const RealDate = Date;

// ---- helpers ------------------------------------------------------------------------------

let ipCount = 0;
/** A fresh client IP per request (RUNS_LIMITER counts per IP): 10.201.x.y, this file's own. */
const freshIp = () => {
  ipCount++;
  return `10.201.${Math.floor(ipCount / 250)}.${ipCount % 250}`;
};

interface CallOptions {
  body?: unknown;
  token?: string;
  ip?: string;
  headers?: Record<string, string>;
}

/** One request to the Worker: JSON body (a string is sent as is), Bearer token, client IP. */
function call(method: string, path: string, opts: CallOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'cf-connecting-ip': opts.ip ?? freshIp(),
    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...opts.headers,
  };
  return SELF.fetch(`https://api.test${path}`, {
    method,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : typeof opts.body === 'string'
          ? opts.body
          : JSON.stringify(opts.body),
  });
}

/** The same request to the Worker with some vars changed (auth off, no limiter, test mode). */
async function callWith(vars: Partial<Env>, method: string, path: string, opts: CallOptions = {}) {
  const req = new Request(`https://api.test${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': opts.ip ?? freshIp(),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, { ...env, ...vars } as Env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** The response is exactly this error: status, code, and (if given) detail. */
async function expectError(res: Response, status: number, error: string, detail?: string | RegExp) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as { error: string; detail?: string };
  expect(body.error).toBe(error);
  if (typeof detail === 'string') expect(body.detail).toBe(detail);
  else if (detail) expect(body.detail).toMatch(detail);
  return body;
}

const admin = () => idToken();
const player = () => idToken({ sub: 'google-player', email: 'player@example.com', name: 'Player' });
const big = (n: number) => 'x'.repeat(n);

// ---- the route table ----------------------------------------------------------------------

/** Every admin route, with a body that passes validation (auth is checked first). */
const ADMIN_ROUTES: Array<[string, string, unknown?]> = [
  ['GET', '/api/admin/me'],
  ['GET', '/api/admin/races'],
  ['GET', '/api/admin/schedule'],
  ['POST', '/api/admin/schedule', { days: 1 }],
  ['POST', '/api/admin/day', { date: '2030-01-01', raceId: 'abu-dhabi-2021' }],
  ['POST', '/api/admin/repin', {}],
  ['POST', '/api/admin/runs/clear', { date: '2030-01-01' }],
  ['GET', '/api/admin/players'],
  ['GET', '/api/admin/runs'],
  ['GET', '/api/admin/runs/daily/nope'],
  ['POST', '/api/admin/runs/reverify', { date: '2030-01-01' }],
  ['POST', '/api/admin/runs/delete', { id: 'nope' }],
  ['POST', '/api/admin/announcement', { text: 'Hello' }],
  ['POST', '/api/admin/announcement/clear', {}],
  ['GET', '/api/admin/log'],
  ['GET', '/api/admin/eras'],
  ['POST', '/api/admin/eras/race', { raceId: 'hungary-2022', published: true }],
  ['POST', '/api/admin/eras/release', { eraId: 10, at: null }],
  ['GET', '/api/admin/today'],
  ['GET', '/api/admin/players/nope'],
  ['POST', '/api/admin/players/nope/name', { displayName: 'Someone' }],
  ['POST', '/api/admin/players/nope/hide', { hidden: true }],
  ['GET', '/api/admin/versus'],
  ['GET', '/api/admin/stats'],
  ['GET', '/api/admin/tickets'],
  ['POST', '/api/admin/tickets', { title: 'A bug', category: 'bug' }],
  ['PATCH', '/api/admin/tickets/1', { status: 'done' }],
  ['DELETE', '/api/admin/tickets/1'],
];

describe('the route table', () => {
  it('covers all 54 routes: 28 admin, 26 public', () => {
    expect(ADMIN_ROUTES).toHaveLength(28);
    expect(new Set(ADMIN_ROUTES.map(([m, p]) => `${m} ${p}`)).size).toBe(28);
  });
});

// ---- admin: auth on every route -----------------------------------------------------------

describe('admin auth, every admin route', () => {
  it.each(ADMIN_ROUTES)('%s %s: signed out 401, bad token 401, player 403', async (m, p, b) => {
    await expectError(await call(m, p, { body: b }), 401, 'sign-in-required');
    // Not a Bearer header.
    await expectError(
      await call(m, p, { body: b, headers: { Authorization: await admin() } }),
      401,
      'sign-in-required',
    );
    // An oversize token is refused unread.
    await expectError(await call(m, p, { body: b, token: big(8193) }), 401, 'sign-in-required');
    await expectError(await call(m, p, { body: b, token: 'a.b.c' }), 401, 'bad-credential');
    await expectError(
      await call(m, p, { body: b, token: await player() }),
      403,
      'not-admin',
      'player@example.com is not an admin',
    );
  });

  it('refuses an expired, wrong-audience, wrong-issuer, unverified or re-signed admin token', async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    for (const claims of [
      { exp: past },
      { aud: 'someone-else' },
      { iss: 'https://evil.example' },
    ]) {
      await expectError(
        await call('GET', '/api/admin/me', { token: await idToken(claims) }),
        401,
        'bad-credential',
      );
    }
    await expectError(
      await call('GET', '/api/admin/me', { token: await idToken({ email_verified: false }) }),
      403,
      'not-admin',
    );
    // The admin's claims with another token's signature.
    const [h, , s] = (await player()).split('.');
    const [, body] = (await admin()).split('.');
    await expectError(
      await call('GET', '/api/admin/me', { token: `${h}.${body}.${s}` }),
      401,
      'bad-credential',
    );
  });

  it('is 503 auth-off on every admin route when sign-in is not set up', async () => {
    const off = { GOOGLE_CLIENT_ID: '', AUTH0_DOMAIN: '', AUTH0_CLIENT_ID: '' };
    for (const [m, p, b] of ADMIN_ROUTES) {
      await expectError(
        await callWith(off, m, p, { body: b, token: await admin() }),
        503,
        'auth-off',
        'sign-in is not set up',
      );
    }
  });

  it('matches admin emails case-insensitively', async () => {
    const res = await call('GET', '/api/admin/me', {
      token: await idToken({ email: 'OTHER@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      admin: true,
      email: 'other@example.com',
      sub: 'google-admin',
    });
  });
});

// ---- admin: each route's own contract -----------------------------------------------------

describe('admin routes: success, bad input, not found', () => {
  it('GET /api/admin/races and /api/admin/players', async () => {
    const races = await call('GET', '/api/admin/races', { token: await admin() });
    expect(races.status).toBe(200);
    const { races: list } = (await races.json()) as { races: Array<{ id: string; hash: string }> };
    expect(list.some((r) => r.id === 'abu-dhabi-2021')).toBe(true);
    const players = await call('GET', '/api/admin/players', { token: await admin() });
    expect(players.status).toBe(200);
  });

  it('GET /api/admin/schedule: the window, a bad from or to', async () => {
    await schedule(today());
    const res = await call('GET', '/api/admin/schedule', { token: await admin() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      today: string;
      days: Array<{ date: string; runs: number }>;
    };
    expect(body.today).toBe(today());
    expect(body.days).toEqual([
      expect.objectContaining({ date: today(), raceId: 'abu-dhabi-2021', runs: 0, current: true }),
    ]);
    for (const q of ['?from=yesterday', '?to=2026-13-01', '?from=2026-02-30']) {
      await expectError(
        await call('GET', `/api/admin/schedule${q}`, { token: await admin() }),
        400,
        'bad-request',
      );
    }
  });

  it('POST /api/admin/schedule: days and dates checked, unknown race refused', async () => {
    const token = await admin();
    for (const body of [
      { days: 0 },
      { days: 367 },
      { days: 1.5 },
      { days: 'many' },
      { from: '2030-02-30', days: 1 },
      { from: 20300101, days: 1 },
    ]) {
      // A non-string `from` falls back to today: only `days` decides that one.
      const res = await call('POST', '/api/admin/schedule', { token, body });
      if (typeof body.from === 'number') {
        expect(res.status).toBe(200);
        continue;
      }
      await expectError(res, 400, 'bad-request', 'from must be YYYY-MM-DD and days 1-366');
    }
    await expectError(
      await call('POST', '/api/admin/schedule', {
        token,
        body: { from: '2031-01-01', days: 1, raceId: 'no-such-race' },
      }),
      400,
      'bad-race',
      'no-such-race is not a playable race',
    );
    const ok = await call('POST', '/api/admin/schedule', {
      token,
      body: { from: '2031-02-01', days: 2, raceId: 'abu-dhabi-2021' },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      added: [
        { date: '2031-02-01', raceId: 'abu-dhabi-2021' },
        { date: '2031-02-02', raceId: 'abu-dhabi-2021' },
      ],
    });
    // Not JSON at all: treated as an empty body (14 days from today).
    const empty = await call('POST', '/api/admin/schedule', { token, body: 'not json' });
    expect(empty.status).toBe(200);
  });

  it('POST /api/admin/day: missing or wrong fields, unknown race, a day with runs', async () => {
    const token = await admin();
    for (const body of [
      {},
      { date: '2030-01-01' },
      { raceId: 'abu-dhabi-2021' },
      { date: 'x', raceId: 'abu-dhabi-2021' },
      { date: '2030-01-01', raceId: 7 },
    ]) {
      const res = await call('POST', '/api/admin/day', { token, body });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad-request' });
    }
    await expectError(
      await call('POST', '/api/admin/day', { token, body: { date: '2030-01-01', raceId: 'nope' } }),
      400,
      'bad-race',
    );
    await schedule(today());
    const run = play('stay');
    const submitted = await call('POST', '/api/runs', {
      body: { date: today(), anonId: ids.a, decisions: run.decisions, grades: run.grades },
    });
    expect(submitted.status).toBe(201);
    await expectError(
      await call('POST', '/api/admin/day', {
        token,
        body: { date: today(), raceId: 'abu-dhabi-2021' },
      }),
      409,
      'day-has-runs',
      `${today()} has 1 runs; clear them first`,
    );
    const ok = await call('POST', '/api/admin/day', {
      token,
      body: { date: '2030-01-01', raceId: 'abu-dhabi-2021' },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ date: '2030-01-01', raceId: 'abu-dhabi-2021', number: 2 });
  });

  it('POST /api/admin/repin and /api/admin/runs/clear', async () => {
    const token = await admin();
    await schedule(today(), { hash: 'old-hash' });
    const repin = await call('POST', '/api/admin/repin', { token });
    expect(repin.status).toBe(200);
    expect(await repin.json()).toEqual({ repinned: [today()], skipped: [] });
    await expectError(
      await call('POST', '/api/admin/runs/clear', { token, body: { date: '1/1/2030' } }),
      400,
      'bad-request',
    );
    await expectError(await call('POST', '/api/admin/runs/clear', { token }), 400, 'bad-request');
    const clear = await call('POST', '/api/admin/runs/clear', { token, body: { date: today() } });
    expect(clear.status).toBe(200);
    expect(await clear.json()).toEqual({ cleared: 0 });
  });

  it('GET /api/admin/runs and /api/admin/runs/:mode/:id', async () => {
    const token = await admin();
    const ok = await call('GET', '/api/admin/runs', { token });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ runs: [] });
    for (const q of ['?date=tomorrow', '?mode=versus', '?date=2030-01-01&mode=x']) {
      await expectError(
        await call('GET', `/api/admin/runs${q}`, { token }),
        400,
        'bad-request',
        'date is YYYY-MM-DD and mode daily, gauntlet or eras',
      );
    }
    await expectError(await call('GET', '/api/admin/runs/versus/1', { token }), 404, 'not-found');
    for (const mode of ['daily', 'gauntlet', 'eras']) {
      await expectError(
        await call('GET', `/api/admin/runs/${mode}/nope`, { token }),
        404,
        'no-run',
      );
    }
  });

  it('POST /api/admin/runs/reverify and /api/admin/runs/delete', async () => {
    const token = await admin();
    for (const body of [
      {},
      { mode: 'daily' },
      { id: 'x' },
      { mode: 'versus', id: 'x' },
      { mode: 'daily', id: '' },
    ]) {
      await expectError(
        await call('POST', '/api/admin/runs/reverify', { token, body }),
        400,
        'bad-request',
        'send { mode, id } or { date, mode? }',
      );
    }
    await expectError(
      await call('POST', '/api/admin/runs/reverify', {
        token,
        body: { date: '2030-01-01', mode: 'x' },
      }),
      400,
      'bad-request',
      'mode is daily, gauntlet or eras',
    );
    const byDate = await call('POST', '/api/admin/runs/reverify', {
      token,
      body: { date: '2030-01-01' },
    });
    expect(byDate.status).toBe(200);
    expect(await byDate.json()).toEqual({ marked: 0 });
    for (const body of [{}, { id: 7 }, { id: '' }]) {
      await expectError(
        await call('POST', '/api/admin/runs/delete', { token, body }),
        400,
        'bad-request',
        'id is required',
      );
    }
    await expectError(
      await call('POST', '/api/admin/runs/delete', { token, body: { id: 'nope' } }),
      404,
      'no-run',
    );
  });

  it('POST /api/admin/announcement, its clear, and GET /api/announcement', async () => {
    const token = await admin();
    const none = await call('GET', '/api/announcement');
    expect(none.status).toBe(200);
    expect(await none.json()).toEqual({ announcement: null });
    const bad: Array<[unknown, string]> = [
      [{}, 'text is 1-280 characters'],
      [{ text: '   ' }, 'text is 1-280 characters'],
      [{ text: 42 }, 'text is 1-280 characters'],
      [{ text: big(281) }, 'text is 1-280 characters'],
      [{ text: 'Hi', tone: 'loud' }, 'tone is info or warning'],
      [{ text: 'Hi', endsAt: 'soon' }, 'endsAt is an ISO time'],
      [{ text: 'Hi', endsAt: 12 }, 'endsAt is an ISO time'],
      [{ text: 'Hi', endsAt: '2000-01-01T00:00:00Z' }, 'endsAt is in the past'],
    ];
    for (const [body, detail] of bad) {
      await expectError(
        await call('POST', '/api/admin/announcement', { token, body }),
        400,
        'bad-request',
        detail,
      );
    }
    const set = await call('POST', '/api/admin/announcement', {
      token,
      body: { text: big(280), tone: 'warning' },
    });
    expect(set.status).toBe(200);
    expect(await set.json()).toMatchObject({
      announcement: { text: big(280), tone: 'warning', endsAt: null },
    });
    expect(await (await call('GET', '/api/announcement')).json()).toMatchObject({
      announcement: { tone: 'warning' },
    });
    const cleared = await call('POST', '/api/admin/announcement/clear', { token });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toEqual({ announcement: null });
    expect(await (await call('GET', '/api/announcement')).json()).toEqual({ announcement: null });
  });

  it('GET /api/admin/log: the action and before filters', async () => {
    const token = await admin();
    const ok = await call('GET', '/api/admin/log', { token });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ entries: [] });
    await expectError(
      await call('GET', '/api/admin/log?action=nope', { token }),
      400,
      'bad-request',
      'no action nope',
    );
    for (const before of ['x', '0', '-1', '1.5']) {
      await expectError(
        await call('GET', `/api/admin/log?before=${before}`, { token }),
        400,
        'bad-request',
        'before is a log id',
      );
    }
    expect((await call('GET', '/api/admin/log?action=repin&before=5', { token })).status).toBe(200);
  });

  it('GET /api/admin/eras, POST eras/race and eras/release', async () => {
    const token = await admin();
    const list = await call('GET', '/api/admin/eras', { token });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ needed: 10 });
    for (const body of [
      {},
      { raceId: 'hungary-2022' },
      { raceId: 'hungary-2022', published: 'yes' },
      { raceId: 3, published: true },
    ]) {
      await expectError(
        await call('POST', '/api/admin/eras/race', { token, body }),
        400,
        'bad-request',
        'raceId and published are required',
      );
    }
    await expectError(
      await call('POST', '/api/admin/eras/race', {
        token,
        body: { raceId: 'nope', published: true },
      }),
      404,
      'no-race',
      'nope is not an Eras race',
    );
    const pub = await call('POST', '/api/admin/eras/race', {
      token,
      body: { raceId: 'hungary-2022', published: true },
    });
    expect(pub.status).toBe(200);
    expect(await pub.json()).toEqual({ raceId: 'hungary-2022', published: true });
    for (const body of [
      {},
      { eraId: 10 },
      { eraId: 'ten', at: 'now' },
      { eraId: 1.5, at: 'now' },
    ]) {
      await expectError(
        await call('POST', '/api/admin/eras/release', { token, body }),
        400,
        'bad-request',
        'eraId and at are required',
      );
    }
    await expectError(
      await call('POST', '/api/admin/eras/release', { token, body: { eraId: 10, at: 'whenever' } }),
      400,
      'bad-request',
      "at is 'now', a date, an ISO time or null",
    );
    await expectError(
      await call('POST', '/api/admin/eras/release', { token, body: { eraId: 99, at: 'now' } }),
      404,
      'no-era',
      'no era 99',
    );
    await expectError(
      await call('POST', '/api/admin/eras/release', { token, body: { eraId: 10, at: 'now' } }),
      409,
      'too-few-races',
    );
    const clear = await call('POST', '/api/admin/eras/release', {
      token,
      body: { eraId: 10, at: null },
    });
    expect(clear.status).toBe(200);
    expect(await clear.json()).toEqual({ eraId: 10, releasedAt: null });
  });

  it('GET /api/admin/today, /versus, /stats', async () => {
    const token = await admin();
    for (const p of ['/api/admin/today', '/api/admin/versus', '/api/admin/stats']) {
      const res = await call('GET', p, { token });
      expect(res.status, p).toBe(200);
      expect(typeof (await res.json())).toBe('object');
    }
  });

  it('the player page, name and hide: unknown player, bad fields', async () => {
    const token = await admin();
    await expectError(await call('GET', '/api/admin/players/nope', { token }), 404, 'no-player');
    for (const body of [{}, { displayName: 5 }, { displayName: null }]) {
      await expectError(
        await call('POST', '/api/admin/players/nope/name', { token, body }),
        400,
        'bad-request',
        'displayName is required',
      );
    }
    for (const displayName of ['ab', big(21), 'bad<name>']) {
      await expectError(
        await call('POST', '/api/admin/players/nope/name', { token, body: { displayName } }),
        400,
        'bad-name',
        'a display name is 3-20 letters, digits or spaces',
      );
    }
    await expectError(
      await call('POST', '/api/admin/players/nope/name', {
        token,
        body: { displayName: 'Fine Name' },
      }),
      404,
      'no-player',
    );
    for (const body of [{}, { hidden: 'yes' }, { hidden: 1 }]) {
      await expectError(
        await call('POST', '/api/admin/players/nope/hide', { token, body }),
        400,
        'bad-request',
        'hidden is required',
      );
    }
    await expectError(
      await call('POST', '/api/admin/players/nope/hide', { token, body: { hidden: true } }),
      404,
      'no-player',
    );
  });

  it('a real run and player: detail, reverify, delete; the player page, rename, hide', async () => {
    const token = await admin();
    await schedule(today());
    const run = play('stay');
    const submitted = await call('POST', '/api/runs', {
      body: { date: today(), anonId: ids.a, decisions: run.decisions, grades: run.grades },
    });
    expect(submitted.status).toBe(201);
    const list = (await (await call('GET', '/api/admin/runs', { token })).json()) as {
      runs: Array<{ mode: string; id: string; playerKey: string }>;
    };
    const mine = list.runs.find((r) => r.mode === 'daily' && r.playerKey === ids.a);
    expect(mine).toBeDefined();
    const id = mine?.id as string;
    const detail = await call('GET', `/api/admin/runs/daily/${id}`, { token });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ run: { id, mode: 'daily' } });
    const one = await call('POST', '/api/admin/runs/reverify', {
      token,
      body: { mode: 'daily', id },
    });
    expect(one.status).toBe(200);
    expect(await one.json()).toEqual({ marked: 1 });
    const del = await call('POST', '/api/admin/runs/delete', { token, body: { id } });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ deleted: id });
    await expectError(await call('GET', `/api/admin/runs/daily/${id}`, { token }), 404, 'no-run');
    await expectError(
      await call('POST', '/api/admin/runs/delete', { token, body: { id } }),
      404,
      'no-run',
    );

    // A signed-in player is an account the admin can open, rename and hide.
    const signed = await call('POST', '/api/auth', {
      body: {
        credential: await idToken({ sub: 'google-renamed', email: 'renamed@example.com' }),
        anonId: ids.b,
      },
    });
    const { playerId } = (await signed.json()) as { playerId: string };
    const page = await call('GET', `/api/admin/players/${playerId}`, { token });
    expect(page.status).toBe(200);
    const renamed = await call('POST', `/api/admin/players/${playerId}/name`, {
      token,
      body: { displayName: 'Renamed One' },
    });
    expect(renamed.status).toBe(200);
    const hidden = await call('POST', `/api/admin/players/${playerId}/hide`, {
      token,
      body: { hidden: true },
    });
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ id: playerId, hidden: true });
    const log = (await (await call('GET', '/api/admin/log', { token })).json()) as {
      entries: Array<{ action: string }>;
    };
    expect(log.entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(['delete-run', 'hide']),
    );
  });

  it('tickets: content type, size, JSON, fields, id, not found', async () => {
    const token = await admin();
    const list = await call('GET', '/api/admin/tickets', { token });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ tickets: [], me: 'admin@example.com' });
    await expectError(
      await call('POST', '/api/admin/tickets', {
        token,
        body: '{}',
        headers: { 'Content-Type': 'text/plain' },
      }),
      415,
      'bad-content-type',
    );
    await expectError(
      await call('POST', '/api/admin/tickets', {
        token,
        body: JSON.stringify({ title: big(70_000) }),
      }),
      413,
      'too-large',
    );
    await expectError(
      await call('POST', '/api/admin/tickets', { token, body: '{nope' }),
      400,
      'bad-json',
    );
    await expectError(
      await call('POST', '/api/admin/tickets', { token, body: { title: 'x' } }),
      400,
      'invalid',
    );
    await expectError(
      await call('POST', '/api/admin/tickets', {
        token,
        body: { title: 'x', category: 'bug', assignee: 'stranger@example.com' },
      }),
      400,
      'invalid',
      'assignee must be an admin, or empty to unassign',
    );
    const made = await call('POST', '/api/admin/tickets', {
      token,
      body: { title: 'A bug', category: 'bug' },
    });
    expect(made.status).toBe(201);
    const { ticket } = (await made.json()) as { ticket: { id: number } };
    for (const id of ['0', 'abc', '-1', '1.5']) {
      await expectError(
        await call('PATCH', `/api/admin/tickets/${id}`, { token, body: { status: 'done' } }),
        400,
        'bad-id',
      );
      await expectError(await call('DELETE', `/api/admin/tickets/${id}`, { token }), 400, 'bad-id');
    }
    await expectError(
      await call('PATCH', '/api/admin/tickets/9999', { token, body: { status: 'done' } }),
      404,
      'not-found',
      'no ticket 9999',
    );
    await expectError(await call('DELETE', '/api/admin/tickets/9999', { token }), 404, 'not-found');
    const patched = await call('PATCH', `/api/admin/tickets/${ticket.id}`, {
      token,
      body: { status: 'done' },
    });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ ticket: { id: ticket.id, status: 'done' } });
    const deleted = await call('DELETE', `/api/admin/tickets/${ticket.id}`, { token });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });
  });
});

// ---- public: the daily --------------------------------------------------------------------

describe('daily routes', () => {
  it('GET /api/health', async () => {
    const res = await call('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queueDays: 0 });
  });

  it('GET /api/daily: date checked, not playable, not scheduled, model changed', async () => {
    for (const q of ['', '?date=', '?date=2026-2-1', '?date=2026-02-30', '?date=today']) {
      await expectError(
        await call('GET', `/api/daily${q}`),
        400,
        'bad-request',
        'date must be YYYY-MM-DD',
      );
    }
    await expectError(
      await call('GET', '/api/daily?date=2000-01-01'),
      404,
      'no-daily',
      '2000-01-01 is not playable now',
    );
    await expectError(
      await call('GET', `/api/daily?date=${today()}`),
      404,
      'no-daily',
      `no daily for ${today()}`,
    );
    await schedule(today(), { hash: 'stale' });
    await expectError(
      await call('GET', `/api/daily?date=${today()}`),
      503,
      'model-changed',
      'this daily is unavailable',
    );
  });

  it('GET /api/daily: the day and its pinned model URL', async () => {
    await schedule(today());
    const res = await call('GET', `/api/daily?date=${today()}`);
    expect(res.status).toBe(200);
    const race = await getRace('abu-dhabi-2021');
    expect(await res.json()).toEqual({
      date: today(),
      number: 1,
      raceId: 'abu-dhabi-2021',
      seed: 4242,
      side: 'HAM',
      modelUrl: `https://api.test/api/races/abu-dhabi-2021?h=${race?.hash}`,
      modelHash: race?.hash,
    });
  });

  it('GET /api/races/:id: unknown, pinned and unpinned caching', async () => {
    await expectError(await call('GET', '/api/races/no-such-race'), 404, 'no-race');
    const race = await getRace('abu-dhabi-2021');
    const pinned = await call('GET', `/api/races/abu-dhabi-2021?h=${race?.hash}`);
    expect(pinned.status).toBe(200);
    expect(pinned.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(pinned.headers.get('ETag')).toBe(`"${race?.hash}"`);
    expect(((await pinned.json()) as { race: { id: string } }).race.id).toBe('abu-dhabi-2021');
    const loose = await call('GET', '/api/races/abu-dhabi-2021?h=wrong');
    expect(loose.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('POST /api/runs: body, fields, dates, verification, duplicates, 429', async () => {
    await schedule(today());
    const run = play('stay');
    const good = { date: today(), anonId: ids.a, decisions: run.decisions, grades: run.grades };
    await expectError(
      await call('POST', '/api/runs', { body: 'not json' }),
      400,
      'bad-request',
      'body must be JSON',
    );
    await expectError(
      await call('POST', '/api/runs', { body: big(64 * 1024 + 1) }),
      400,
      'bad-request',
      'body too large',
    );
    await expectError(
      await call('POST', '/api/runs', { body: 'null' }),
      400,
      'bad-request',
      'date must be YYYY-MM-DD',
    );
    await expectError(
      await call('POST', '/api/runs', { body: { ...good, date: undefined } }),
      400,
      'bad-request',
      'date must be YYYY-MM-DD',
    );
    await expectError(
      await call('POST', '/api/runs', { body: { ...good, date: 20260101 } }),
      400,
      'bad-request',
      'date must be YYYY-MM-DD',
    );
    await expectError(
      await call('POST', '/api/runs', { body: { ...good, anonId: 'me' } }),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    await expectError(
      await call('POST', '/api/runs', { body: { ...good, anonId: 12 } }),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    const future = addDays(today(), 5);
    await expectError(
      await call('POST', '/api/runs', { body: { ...good, date: future } }),
      404,
      'no-daily',
      `${future} is not playable now`,
    );
    await expectError(
      await call('POST', '/api/runs', { body: { ...good, decisions: 'all of them' } }),
      400,
      'invalid-calls',
    );
    const ok = await call('POST', '/api/runs', { body: good });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({
      date: today(),
      raceId: 'abu-dhabi-2021',
      rank: 1,
      total: 1,
    });
    await expectError(await call('POST', '/api/runs', { body: good }), 409, 'already-submitted');
    // 10 a minute from one IP (RUNS_LIMITER), counted before the body is read.
    const ip = freshIp();
    for (let i = 0; i < 10; i++) await call('POST', '/api/runs', { ip, body: 'x' });
    await expectError(await call('POST', '/api/runs', { ip, body: good }), 429, 'rate-limited');
  });

  it('GET /api/runs/:date/:anonId: bad params, none, the run', async () => {
    await expectError(await call('GET', `/api/runs/2026-1-1/${ids.a}`), 400, 'bad-request');
    await expectError(await call('GET', `/api/runs/${today()}/not-a-uuid`), 400, 'bad-request');
    await expectError(await call('GET', `/api/runs/${today()}/${ids.a}`), 404, 'no-run');
    await schedule(today());
    const run = play('stay');
    await call('POST', '/api/runs', {
      body: { date: today(), anonId: ids.a, decisions: run.decisions, grades: run.grades },
    });
    const res = await call('GET', `/api/runs/${today()}/${ids.a}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ date: today(), rank: 1, total: 1 });
  });

  it('GET /api/daily/:date/stats and /leaderboard', async () => {
    await expectError(await call('GET', '/api/daily/nope/stats'), 400, 'bad-request');
    await expectError(await call('GET', '/api/daily/nope/leaderboard'), 400, 'bad-request');
    // A future day's stats would give its race away.
    await schedule(addDays(today(), 30), { number: 2 });
    await expectError(
      await call('GET', `/api/daily/${addDays(today(), 30)}/stats`),
      404,
      'no-daily',
    );
    await expectError(await call('GET', `/api/daily/${today()}/stats`), 404, 'no-daily');
    await schedule(today());
    const stats = await call('GET', `/api/daily/${today()}/stats`);
    expect(stats.status).toBe(200);
    expect(await stats.json()).toMatchObject({ date: today(), runs: 0, meanScore: 0, scores: [] });
    const board = await call('GET', `/api/daily/${today()}/leaderboard`);
    expect(board.status).toBe(200);
    expect(await board.json()).toEqual({ date: today(), size: 100, entries: [] });
  });
});

// ---- public: accounts ---------------------------------------------------------------------

describe('sign-in, profile, player', () => {
  it.each(['/api/auth', '/api/auth/google'])(
    'POST %s: fields, credential, success',
    async (path) => {
      for (const body of [
        undefined,
        'not json',
        {},
        { credential: 'x' },
        { anonId: ids.a },
        { credential: 5, anonId: ids.a },
        { credential: big(8193), anonId: ids.a },
        { credential: 'x', anonId: 'nope' },
      ]) {
        await expectError(
          await call('POST', path, { body }),
          400,
          'bad-request',
          'credential and anonId are required',
        );
      }
      await expectError(
        await call('POST', path, { body: { credential: 'a.b.c', anonId: ids.a } }),
        401,
        'bad-credential',
      );
      await expectError(
        await call('POST', path, {
          body: {
            credential: await idToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
            anonId: ids.a,
          },
        }),
        401,
        'bad-credential',
      );
      const ok = await call('POST', path, { body: { credential: await player(), anonId: ids.b } });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ admin: false, created: true });
      const asAdmin = await call('POST', path, {
        body: { credential: await admin(), anonId: ids.c },
      });
      expect(await asAdmin.json()).toMatchObject({ admin: true });
    },
  );

  it('POST /api/auth: 503 with sign-in off, 429 after 10 a minute from one IP', async () => {
    await expectError(
      await callWith(
        { GOOGLE_CLIENT_ID: '', AUTH0_DOMAIN: '', AUTH0_CLIENT_ID: '' },
        'POST',
        '/api/auth',
        {
          body: {},
        },
      ),
      503,
      'auth-off',
      'sign-in is not set up',
    );
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await call('POST', '/api/auth', { ip, body: {} })).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    await expectError(await call('POST', '/api/auth', { ip, body: {} }), 429, 'rate-limited');
    // Its own count: the same IP can still submit a run.
    expect((await call('POST', '/api/runs', { ip, body: '{}' })).status).toBe(400);
    // No limiter bound (staging): never limited.
    const noLimit = { RUNS_LIMITER: undefined } as Partial<Env>;
    const ip2 = freshIp();
    for (let i = 0; i < 12; i++) {
      expect((await callWith(noLimit, 'POST', '/api/auth', { ip: ip2, body: {} })).status).toBe(
        400,
      );
    }
  });

  it('POST /api/profile: credential, name, team, no account, taken, success', async () => {
    await expectError(
      await callWith(
        { GOOGLE_CLIENT_ID: '', AUTH0_DOMAIN: '', AUTH0_CLIENT_ID: '' },
        'POST',
        '/api/profile',
        { body: {} },
      ),
      503,
      'auth-off',
    );
    for (const body of [undefined, {}, { credential: 3 }, { credential: big(8193) }]) {
      await expectError(
        await call('POST', '/api/profile', { body }),
        400,
        'bad-request',
        'credential is required',
      );
    }
    await expectError(
      await call('POST', '/api/profile', { body: { credential: 'a.b.c' } }),
      401,
      'bad-credential',
    );
    const credential = await player();
    const profile = (displayName: unknown, favouriteTeam: unknown = '') =>
      call('POST', '/api/profile', { body: { credential, displayName, favouriteTeam } });
    for (const name of [undefined, 'ab', big(21), 'no<tags>']) {
      await expectError(await profile(name), 400, 'bad-name');
    }
    await expectError(await profile('Good Name', big(41)), 400, 'bad-team');
    await expectError(await profile('Good Name', 'Team <b>'), 400, 'bad-team');
    await expectError(await profile('Good Name'), 404, 'no-account', 'sign in first');
    await call('POST', '/api/auth', { body: { credential, anonId: ids.a } });
    const ok = await profile('Good Name', 'Ferrari');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ displayName: 'Good Name', favouriteTeam: 'Ferrari' });
    const other = await admin();
    await call('POST', '/api/auth', { body: { credential: other, anonId: ids.b } });
    await expectError(
      await call('POST', '/api/profile', { body: { credential: other, displayName: 'GOOD NAME' } }),
      409,
      'name-taken',
      'GOOD NAME is taken',
    );
  });

  it('GET /api/players/:anonId: params, an anonymous player, an admin account', async () => {
    await expectError(await call('GET', `/api/players/nope?today=${today()}`), 400, 'bad-request');
    await expectError(await call('GET', `/api/players/${ids.a}`), 400, 'bad-request');
    await expectError(await call('GET', `/api/players/${ids.a}?today=soon`), 400, 'bad-request');
    const anon = await call('GET', `/api/players/${ids.a}?today=${today()}`);
    expect(anon.status).toBe(200);
    expect(await anon.json()).toEqual({ account: null, streak: { current: 0, best: 0, days: 0 } });
    await call('POST', '/api/auth', { body: { credential: await admin(), anonId: ids.b } });
    const signed = await call('GET', `/api/players/${ids.b}?today=${today()}`);
    expect(await signed.json()).toMatchObject({
      account: { email: 'admin@example.com', admin: true },
    });
  });
});

// ---- public: the Gauntlet -----------------------------------------------------------------

describe('survivor routes', () => {
  it('POST /api/survivor/start: anonId checked, a run dealt, 429 after 10', async () => {
    for (const body of [undefined, 'nope', {}, { anonId: 'me' }]) {
      await expectError(
        await call('POST', '/api/survivor/start', { body }),
        400,
        'bad-request',
        'anonId must be a UUID',
      );
    }
    const ok = await call('POST', '/api/survivor/start', { body: { anonId: ids.a } });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ status: 'live', rounds: 0, current: { round: 1 } });
    const ip = freshIp();
    for (let i = 0; i < 10; i++) await call('POST', '/api/survivor/start', { ip, body: {} });
    await expectError(
      await call('POST', '/api/survivor/start', { ip, body: {} }),
      429,
      'rate-limited',
    );
  });

  it('GET /api/survivor/:runId and /leaderboard', async () => {
    const board = await call('GET', '/api/survivor/leaderboard');
    expect(board.status).toBe(200);
    expect(await board.json()).toEqual({ allTime: [], week: [] });
    const { runId } = (await (
      await call('POST', '/api/survivor/start', { body: { anonId: ids.a } })
    ).json()) as {
      runId: string;
    };
    await expectError(
      await call('GET', `/api/survivor/${runId}`),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    await expectError(await call('GET', `/api/survivor/${runId}?anonId=x`), 400, 'bad-request');
    await expectError(await call('GET', `/api/survivor/nope?anonId=${ids.a}`), 404, 'no-run');
    // Another player's run reads as no run.
    await expectError(await call('GET', `/api/survivor/${runId}?anonId=${ids.b}`), 404, 'no-run');
    const mine = await call('GET', `/api/survivor/${runId}?anonId=${ids.a}`);
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({ runId, status: 'live' });
  });

  it('POST /api/survivor/:runId/round: body, run, round, verification, 429', async () => {
    const { runId } = (await (
      await call('POST', '/api/survivor/start', { body: { anonId: ids.a } })
    ).json()) as {
      runId: string;
    };
    const path = `/api/survivor/${runId}/round`;
    await expectError(
      await call('POST', path, { body: 'nope' }),
      400,
      'bad-request',
      'body must be JSON',
    );
    await expectError(
      await call('POST', path, { body: big(64 * 1024 + 1) }),
      400,
      'bad-request',
      'body too large',
    );
    await expectError(
      await call('POST', path, { body: { anonId: 'x' } }),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    await expectError(
      await call('POST', '/api/survivor/nope/round', { body: { anonId: ids.a } }),
      404,
      'no-run',
    );
    await expectError(
      await call('POST', path, { body: { anonId: ids.b, round: 1 } }),
      404,
      'no-run',
    );
    for (const round of [2, 0, '1', undefined]) {
      await expectError(
        await call('POST', path, { body: { anonId: ids.a, round } }),
        409,
        'wrong-round',
      );
    }
    await expectError(
      await call('POST', path, { body: { anonId: ids.a, round: 1, decisions: 'x' } }),
      400,
      'invalid-calls',
    );
    const ip = freshIp();
    for (let i = 0; i < 10; i++) await call('POST', path, { ip, body: 'x' });
    await expectError(await call('POST', path, { ip, body: 'x' }), 429, 'rate-limited');
  });
});

// ---- public: Versus (out of the first release, still served) ------------------------------

describe('versus routes', () => {
  it('POST /api/versus and GET /api/versus/:code', async () => {
    for (const body of [undefined, {}, { track: 'nope' }, { track: 5 }]) {
      await expectError(await call('POST', '/api/versus', { body }), 400, 'bad-track');
    }
    const made = await call('POST', '/api/versus', { body: { track: 'monza' } });
    expect(made.status).toBe(201);
    const { code } = (await made.json()) as { code: string };
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    const found = await call('GET', `/api/versus/${code.toLowerCase()}`);
    expect(found.status).toBe(200);
    for (const bad of ['ABC', 'ABCDE', 'AB1D', 'ABCI']) {
      await expectError(await call('GET', `/api/versus/${bad}`), 404, 'not-found');
    }
    await expectError(await call('GET', '/api/versus/ZZZZ'), 404, 'not-found');
  });
});

// ---- public: Eras -------------------------------------------------------------------------

/** Era 10 released, with hungary-2022 published (production gating then lets it start). */
async function releaseEra10() {
  await env.DB.prepare("UPDATE era_races SET published = 1 WHERE race_id = 'hungary-2022'").run();
  await env.DB.prepare(
    "UPDATE eras SET released_at = '2020-01-01T00:00:00.000Z' WHERE id = 10",
  ).run();
}

describe('eras routes', () => {
  it('GET /api/eras and /api/eras/:eraId', async () => {
    for (const q of ['', '?anonId=me']) {
      await expectError(
        await call('GET', `/api/eras${q}`),
        400,
        'bad-request',
        'anonId must be a UUID',
      );
    }
    const map = await call('GET', `/api/eras?anonId=${ids.a}`);
    expect(map.status).toBe(200);
    const body = (await map.json()) as { testMode: boolean; eras: unknown[] };
    expect(body).toMatchObject({ testMode: false });
    expect(body.eras).toHaveLength(10);
    for (const raw of ['x', '1.5', '1000', '-1']) {
      await expectError(
        await call('GET', `/api/eras/${raw}?anonId=${ids.a}`),
        400,
        'bad-request',
        'eraId is a number',
      );
    }
    await expectError(await call('GET', `/api/eras/99?anonId=${ids.a}`), 404, 'no-era');
    await expectError(
      await call('GET', '/api/eras/10'),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    const era = await call('GET', `/api/eras/10?anonId=${ids.a}`);
    expect(era.status).toBe(200);
    // Production: an unreleased era lists no races.
    expect(await era.json()).toMatchObject({ eraId: 10, released: false, races: [] });
  });

  it('POST /api/eras/attempts: body, fields, gating, success, 429', async () => {
    const start = (body: unknown, ip?: string) => call('POST', '/api/eras/attempts', { body, ip });
    await expectError(await start('nope'), 400, 'bad-request', 'body must be JSON');
    await expectError(await start('[1]'), 400, 'bad-request', 'body must be a JSON object');
    await expectError(await start(big(64 * 1024 + 1)), 400, 'bad-request', 'body too large');
    await expectError(
      await start({ raceId: 'hungary-2022' }),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    await expectError(await start({ anonId: ids.a }), 400, 'bad-request', 'raceId is required');
    await expectError(
      await start({ anonId: ids.a, raceId: big(65) }),
      400,
      'bad-request',
      'raceId is required',
    );
    await expectError(
      await start({ anonId: ids.a, raceId: 'hungary-2022', legend: 'yes' }),
      400,
      'bad-request',
      'legend is a boolean',
    );
    await expectError(
      await start({ anonId: ids.a, raceId: 'monaco-1950' }),
      404,
      'no-race',
      'monaco-1950 is not an Eras race',
    );
    await expectError(
      await start({ anonId: ids.a, raceId: 'hungary-2022' }),
      403,
      'era-unreleased',
    );
    await env.DB.prepare(
      "UPDATE eras SET released_at = '2020-01-01T00:00:00.000Z' WHERE id = 10",
    ).run();
    await expectError(
      await start({ anonId: ids.a, raceId: 'hungary-2022' }),
      403,
      'race-unpublished',
    );
    await releaseEra10();
    await expectError(
      await start({ anonId: ids.a, raceId: 'hungary-2022', legend: true }),
      403,
      'legend-locked',
    );
    const ok = await start({ anonId: ids.a, raceId: 'hungary-2022' });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({
      seed: expect.any(Number),
      attemptId: expect.any(String),
    });
    const ip = freshIp();
    for (let i = 0; i < 10; i++) await start({}, ip);
    await expectError(await start({}, ip), 429, 'rate-limited');
  });

  it('POST /api/eras/attempts/:id: body, attempt, fields, submitted, expired, 429', async () => {
    await releaseEra10();
    const { attemptId } = (await (
      await call('POST', '/api/eras/attempts', { body: { anonId: ids.a, raceId: 'hungary-2022' } })
    ).json()) as { attemptId: string };
    const submit = (body: unknown, id = attemptId, ip?: string) =>
      call('POST', `/api/eras/attempts/${id}`, { body, ip });
    await expectError(await submit('nope'), 400, 'bad-request', 'body must be JSON');
    await expectError(await submit({ decisions: [] }), 400, 'bad-request', 'anonId must be a UUID');
    await expectError(
      await submit({ anonId: ids.a, decisions: [] }, 'not-an-id'),
      404,
      'no-attempt',
    );
    await expectError(await submit({ anonId: ids.a, decisions: [] }, ids.c), 404, 'no-attempt');
    // Someone else's attempt reads as no attempt.
    await expectError(await submit({ anonId: ids.b, decisions: [] }), 404, 'no-attempt');
    for (const decisions of [undefined, 'x', [{ lap: 'one', kind: 'pit' }], [{ lap: 1 }], [null]]) {
      await expectError(
        await submit({ anonId: ids.a, decisions }),
        400,
        'bad-request',
        'decisions must be a list of { lap, kind, ... }',
      );
    }
    await expectError(
      await submit({ anonId: ids.a, decisions: [], untimed: 'yes' }),
      400,
      'bad-request',
      'untimed is a boolean',
    );
    const claims = await submit({ anonId: ids.a, decisions: [], rivalClaims: 'x' });
    expect(claims.status).toBe(400);
    expect(await claims.json()).toEqual({
      error: 'bad-rival-claims',
      code: 'bad-claim',
      detail: 'rivalClaims must be a list',
    });
    await expectError(
      await submit({ anonId: ids.a, decisions: [], modelHash: 'other' }),
      409,
      'model-changed',
    );
    // Expired: started more than 24 hours ago.
    await env.DB.prepare(
      "UPDATE era_attempts SET created_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
    )
      .bind(attemptId)
      .run();
    await expectError(await submit({ anonId: ids.a, decisions: [] }), 409, 'attempt-expired');
    await env.DB.prepare('UPDATE era_attempts SET submitted_at = created_at WHERE id = ?')
      .bind(attemptId)
      .run();
    await expectError(await submit({ anonId: ids.a, decisions: [] }), 409, 'already-submitted');
    const ip = freshIp();
    for (let i = 0; i < 10; i++) await submit({}, attemptId, ip);
    await expectError(await submit({}, attemptId, ip), 429, 'rate-limited');
  });

  it('GET /api/eras/races/:raceId/model: hidden until released and published', async () => {
    await expectError(await call('GET', '/api/eras/races/nope/model'), 404, 'no-race');
    await expectError(await call('GET', '/api/eras/races/hungary-2022/model'), 404, 'no-race');
    // Test mode serves every built Eras race.
    expect(
      (await callWith({ ERAS_TEST_MODE: 'true' }, 'GET', '/api/eras/races/hungary-2022/model'))
        .status,
    ).toBe(200);
    await releaseEra10();
    const res = await call('GET', '/api/eras/races/hungary-2022/model');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it('GET /api/history, race stats and leaderboard', async () => {
    await expectError(
      await call('GET', '/api/history'),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    const book = await call('GET', `/api/history?anonId=${ids.a}`);
    expect(book.status).toBe(200);
    expect(await book.json()).toMatchObject({ entries: [] });
    await expectError(await call('GET', '/api/eras/races/hungary-2022/stats'), 404, 'no-race');
    await expectError(await call('GET', `/api/eras/races/${big(65)}/stats`), 404, 'no-race');
    await expectError(
      await call('GET', '/api/eras/races/hungary-2022/leaderboard'),
      404,
      'no-race',
    );
    await expectError(
      await call('GET', '/api/eras/races/hungary-2022/leaderboard?legend=maybe'),
      400,
      'bad-request',
      'legend is true or false',
    );
    await expectError(
      await call('GET', '/api/eras/races/hungary-2022/leaderboard?anonId=me'),
      400,
      'bad-request',
      'anonId must be a UUID',
    );
    await releaseEra10();
    const stats = await call('GET', '/api/eras/races/hungary-2022/stats');
    expect(stats.status).toBe(200);
    expect(await stats.json()).toMatchObject({ raceId: 'hungary-2022' });
    const board = await call(
      'GET',
      `/api/eras/races/hungary-2022/leaderboard?legend=1&anonId=${ids.a}`,
    );
    expect(board.status).toBe(200);
    expect(await board.json()).toMatchObject({
      raceId: 'hungary-2022',
      legend: true,
      entries: [],
      me: null,
    });
  });
});

// ---- anything else ------------------------------------------------------------------------

describe('unknown routes and CORS', () => {
  it('answers an unknown path or method with 404 not-found', async () => {
    for (const [m, p] of [
      ['GET', '/api/nope'],
      ['GET', '/'],
      ['PUT', '/api/runs'],
      ['DELETE', '/api/daily'],
      ['GET', '/api/admin'],
    ] as const) {
      const res = await call(m, p);
      expect(res.status, `${m} ${p}`).toBe(404);
      expect(await res.json()).toEqual({ error: 'not-found' });
    }
  });

  it('allows the website and local dev origins only', async () => {
    const preflight = (origin: string) =>
      SELF.fetch('https://api.test/api/runs', {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
    for (const origin of [
      env.WEB_ORIGIN as string,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]) {
      expect((await preflight(origin)).headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
    expect(
      (await preflight('https://evil.example')).headers.get('Access-Control-Allow-Origin'),
    ).toBeNull();
  });

  it('ignores the flows test clock unless FLOWS_TEST is "true"', async () => {
    await schedule('2001-01-01');
    const at = { 'x-flows-now': '2001-01-01T12:00:00.000Z' };
    // Off (production, staging, these tests): the header changes nothing.
    await expectError(
      await call('GET', '/api/daily?date=2001-01-01', { headers: at }),
      404,
      'no-daily',
    );
    await expectError(
      await callWith(
        { FLOWS_TEST: 'false', FLOWS_NOW: '2001-01-01T12:00:00.000Z' },
        'GET',
        '/api/daily?date=2001-01-01',
      ),
      404,
      'no-daily',
    );
    // Only exactly "true" turns it on.
    for (const FLOWS_TEST of ['TRUE', '1', 'yes', '', undefined]) {
      await expectError(
        await callWith(
          { FLOWS_TEST, FLOWS_NOW: '2001-01-01T12:00:00.000Z' },
          'GET',
          '/api/daily?date=2001-01-01',
        ),
        404,
        'no-daily',
      );
    }
    // The global clock was never swapped: Date is the real one and reads the real time.
    expect(Date).toBe(RealDate);
    expect(new Date().getFullYear()).toBeGreaterThan(2020);
  });

  it('production and staging never set the flows clock vars (wrangler.jsonc)', () => {
    expect(wranglerConfig).toContain('"vars"');
    expect(wranglerConfig).not.toMatch(/FLOWS_TEST|FLOWS_NOW/);
    expect(env.FLOWS_TEST).toBeUndefined();
    expect(env.FLOWS_NOW).toBeUndefined();
  });

  it('with FLOWS_TEST "true", runs on the x-flows-now header or FLOWS_NOW', async () => {
    await schedule('2001-01-01');
    const on = { FLOWS_TEST: 'true', FLOWS_NOW: '2001-01-01T12:00:00.000Z' } as Partial<Env>;
    try {
      const res = await callWith(on, 'GET', '/api/daily?date=2001-01-01');
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ date: '2001-01-01' });
      // The header moves it on: a week later the day is gone.
      const req = new Request('https://api.test/api/daily?date=2001-01-01', {
        headers: { 'x-flows-now': '2001-01-08T12:00:00.000Z' },
      });
      const ctx = createExecutionContext();
      const late = await worker.fetch(req, { ...env, ...on } as Env, ctx);
      await waitOnExecutionContext(ctx);
      await expectError(late, 404, 'no-daily');
      // new Date() reads the same clock.
      expect(new Date().toISOString().slice(0, 10)).toBe('2001-01-08');
    } finally {
      resetFlowsClock();
    }
    expect(new Date().getFullYear()).toBeGreaterThan(2020);
  });
});
