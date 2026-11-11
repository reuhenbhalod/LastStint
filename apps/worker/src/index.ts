// Cloudflare Worker API (Implementation Plan 4.1, docs/phase-4-backend-spec.md).
// Serves the daily, verifies every run by replaying it with the shared TS sim, and computes
// ranks, stats and the leaderboard. docs/api.md documents the endpoints for the web app.

import { ROOM_CODE, VERSUS_TRACKS } from '@boxthislap/sim';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { adminEmails, registerAdmin } from './admin.js';
import { authConfigured, verifyCredential } from './auth.js';
import { isDate, isPlayable, playableDates } from './dates.js';
import { LEADERBOARD_SIZE, dailyStats, getDaily, getRun, leaderboard } from './db.js';
import { displayName } from './names.js';
import { checkQueue, queueDays } from './ops.js';
import { accountOf, playedDates, setProfile, signIn, streakOf } from './players.js';
import { SURVIVOR_POOL } from './pools.js';
import { getRace } from './races.js';
import { ApiError, dailyWithModel, isAnonId, submitRun, withStanding } from './runs.js';
import { getState, startRun, submitRound, survivorBoard } from './survivor.js';
import { registerTickets } from './tickets.js';
import { VersusRoom } from './versus.js';

export { VersusRoom };

export interface Env {
  DB: D1Database;
  /** Run submissions per IP (Phase 4 spec C1). */
  RUNS_LIMITER?: RateLimit;
  // Production web origin allowed to call the API (e.g. https://pitwall-web.pages.dev).
  // Set via wrangler.jsonc `vars`. Empty in local dev (Vite proxy makes requests
  // same-origin, so no CORS is needed there).
  WEB_ORIGIN?: string;
  /** Seconds stats and the leaderboard are cached for (default 60; tests use 0). */
  CACHE_SECONDS?: string;
  /** Optional Discord or Slack webhook for queue alerts (a secret). */
  ALERT_WEBHOOK?: string;
  /** Google OAuth client ID for sign-in (feedback spec D3). Unset: sign-in is off. */
  GOOGLE_CLIENT_ID?: string;
  /** JWKS to trust instead of Google's published keys (tests only). */
  GOOGLE_JWKS?: string;
  /** Auth0 tenant domain and SPA client ID (docs/auth0-spec.md). Set: sign-in is Auth0's. */
  AUTH0_DOMAIN?: string;
  AUTH0_CLIENT_ID?: string;
  /** JWKS to trust instead of the Auth0 tenant's published keys (tests only). */
  AUTH0_JWKS?: string;
  /** Admins (src/admin.ts): Google account emails, comma-separated. */
  ADMIN_EMAILS?: string;
  /** A survivor pool to use instead of data/pools.json's (JSON; tests only). */
  SURVIVOR_POOL?: string;
  /** Versus mode's rooms (docs/versus-spec.md V5): one Durable Object per match. */
  VERSUS: DurableObjectNamespace;
  /** The room's clocks in ms (tests shorten them): a lap, the car pick, a big call, a
   * dropped player's wait, the reveal before the start. */
  VERSUS_LAP_MS?: string;
  VERSUS_PICK_MS?: string;
  VERSUS_CALL_MS?: string;
  VERSUS_BATTLE_MS?: string;
  VERSUS_RECONNECT_MS?: string;
  VERSUS_REVEAL_MS?: string;
}

/** The survivor races and their seeds (data/pools.json, or the tests' own). */
function survivorPool(env: Env): Readonly<Record<string, number[]>> {
  return env.SURVIVOR_POOL ? JSON.parse(env.SURVIVOR_POOL) : SURVIVOR_POOL;
}

/** Largest accepted POST /api/runs body. */
const MAX_BODY_BYTES = 64 * 1024;

const app = new Hono<{ Bindings: Env }>();

// Web (Pages) and the Worker live on different origins in production, so the browser needs
// CORS headers to call /api/*. In dev the Vite proxy forwards /api to the Worker, so those
// requests are same-origin and never hit this check.
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowed = [...DEV_ORIGINS];
      if (c.env.WEB_ORIGIN) allowed.push(c.env.WEB_ORIGIN);
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

app.onError((e, c) => {
  if (e instanceof ApiError) {
    return c.json(
      { error: e.code, ...(e.detail ? { detail: e.detail } : {}) },
      e.status as ContentfulStatusCode,
    );
  }
  console.error(e);
  return c.json({ error: 'internal' }, 500);
});

/** Serve a GET from the Cache API for CACHE_SECONDS (stats and leaderboard). */
async function cached(
  c: Context<{ Bindings: Env }>,
  build: () => Promise<Response>,
): Promise<Response> {
  const seconds = Number(c.env.CACHE_SECONDS ?? 60);
  if (!(seconds > 0)) return build();
  const cache = caches.default;
  const hit = await cache.match(c.req.raw);
  if (hit) return hit;
  const res = await build();
  if (res.ok) {
    res.headers.set('Cache-Control', `public, max-age=${seconds}`);
    c.executionCtx.waitUntil(cache.put(c.req.raw, res.clone()));
  }
  return res;
}

registerAdmin(app);
registerTickets(app);

app.get('/api/health', async (c) =>
  c.json({ ok: true, queueDays: await queueDays(c.env.DB, Date.now()) }),
);

// GET /api/daily?date=YYYY-MM-DD: the player's local date (spec B1).
app.get('/api/daily', async (c) => {
  const date = c.req.query('date');
  if (!isDate(date)) throw new ApiError(400, 'bad-request', 'date must be YYYY-MM-DD');
  if (!isPlayable(date, Date.now()))
    throw new ApiError(404, 'no-daily', `${date} is not playable now`);
  const { daily, race } = await dailyWithModel(c.env.DB, date);
  const origin = new URL(c.req.url).origin;
  return c.json({
    date: daily.date,
    number: daily.number,
    raceId: daily.race_id,
    seed: daily.seed,
    side: daily.side,
    modelUrl: `${origin}/api/races/${daily.race_id}?h=${race.hash}`,
    modelHash: race.hash,
  });
});

// GET /api/races/:id: a race model. Immutable when requested by its hash (modelUrl).
app.get('/api/races/:id', async (c) => {
  const race = await getRace(c.req.param('id'));
  if (!race) throw new ApiError(404, 'no-race');
  const pinned = c.req.query('h') === race.hash;
  return c.body(JSON.stringify(race.model), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': pinned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    ETag: `"${race.hash}"`,
  });
});

// POST /api/runs: submit a finished run (calls only; the score is computed here).
app.post('/api/runs', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  if (c.env.RUNS_LIMITER) {
    const { success } = await c.env.RUNS_LIMITER.limit({ key: ip });
    if (!success) throw new ApiError(429, 'rate-limited');
  }
  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(400, 'bad-request', 'body too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad-request', 'body must be JSON');
  }
  // CPU time per request shows in Workers observability (the clock doesn't move during compute).
  const res = await submitRun(c.env.DB, body, Date.now());
  console.log(`run verified: ${res.date} score ${res.score}`);
  return c.json(res, 201);
});

// GET /api/runs/:date/:anonId: a player's verified run again (after a refresh).
app.get('/api/runs/:date/:anonId', async (c) => {
  const { date, anonId } = c.req.param();
  if (!isDate(date) || !isAnonId(anonId)) throw new ApiError(400, 'bad-request');
  const row = await getRun(c.env.DB, date, anonId);
  if (!row) throw new ApiError(404, 'no-run');
  return c.json(await withStanding(c.env.DB, row));
});

// POST /api/auth: sign in with an ID token (Auth0's, or Google's without Auth0 set up:
// docs/auth0-spec.md); links this browser's anonId to the account and returns the account's
// player ID, which the browser adopts, and its profile. `admin` says the account is on
// ADMIN_EMAILS (verified email): the browser then keeps the token for the admin page and shows
// the Admin button. /api/auth/google is the old name.
const signInRoute = async (c: Context<{ Bindings: Env }>) => {
  if (!authConfigured(c.env)) throw new ApiError(503, 'auth-off', 'sign-in is not set up');
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  if (c.env.RUNS_LIMITER) {
    const { success } = await c.env.RUNS_LIMITER.limit({ key: `auth:${ip}` });
    if (!success) throw new ApiError(429, 'rate-limited');
  }
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const credential = body?.credential;
  const anonId = body?.anonId;
  if (typeof credential !== 'string' || credential.length > 8192 || !isAnonId(anonId)) {
    throw new ApiError(400, 'bad-request', 'credential and anonId are required');
  }
  const who = await verifyCredential(c.env, credential, Date.now());
  if (!who) throw new ApiError(401, 'bad-credential');
  const account = await signIn(c.env.DB, who, anonId, Date.now());
  const admin = who.emailVerified && adminEmails(c.env).includes(who.email.toLowerCase());
  return c.json({ ...account, admin });
};
app.post('/api/auth', signInRoute);
app.post('/api/auth/google', signInRoute);

// POST /api/profile { credential, displayName, favouriteTeam }: set the signed-in account's
// profile (docs/auth0-spec.md A4). 409 name-taken if another player has the name.
app.post('/api/profile', async (c) => {
  if (!authConfigured(c.env)) throw new ApiError(503, 'auth-off', 'sign-in is not set up');
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const credential = body?.credential;
  if (typeof credential !== 'string' || credential.length > 8192) {
    throw new ApiError(400, 'bad-request', 'credential is required');
  }
  const who = await verifyCredential(c.env, credential, Date.now());
  if (!who) throw new ApiError(401, 'bad-credential');
  return c.json(await setProfile(c.env.DB, who, body));
});

// GET /api/players/:anonId?today=YYYY-MM-DD: the player's account (if signed in) and streak,
// counted to the player's local date. An admin account says so (it shows the Admin button;
// every admin action still checks a Google token).
app.get('/api/players/:anonId', async (c) => {
  const anonId = c.req.param('anonId');
  const today = c.req.query('today');
  if (!isAnonId(anonId) || !isDate(today)) throw new ApiError(400, 'bad-request');
  const [account, dates] = await Promise.all([
    accountOf(c.env.DB, anonId),
    playedDates(c.env.DB, anonId),
  ]);
  const admin = !!account && adminEmails(c.env).includes(account.email.toLowerCase());
  return c.json({
    account: account && { ...account, admin },
    streak: streakOf(dates, today),
  });
});

// GET /api/daily/:date/stats: how everyone played the day.
app.get('/api/daily/:date/stats', (c) =>
  cached(c, async () => {
    const date = c.req.param('date');
    if (!isDate(date)) throw new ApiError(400, 'bad-request');
    // Past and current days only: a future day's stats would give its race away.
    if (date > playableDates(Date.now()).last) throw new ApiError(404, 'no-daily');
    const daily = await getDaily(c.env.DB, date);
    if (!daily) throw new ApiError(404, 'no-daily');
    const race = await getRace(daily.race_id);
    const { scores, calls } = await dailyStats(c.env.DB, date);
    const runs = scores.reduce((n, s) => n + s.runs, 0);
    const share = (n: number) => (runs ? n / runs : 0);
    return c.json({
      date,
      runs,
      meanScore: runs ? scores.reduce((t, s) => t + s.score * s.runs, 0) / runs : 0,
      scores,
      moments: (race?.model.decisionMoments ?? []).map((m) => {
        const options = m.options.map((o) => ({
          id: o.id,
          label: o.label,
          share: share(calls.find((r) => r.moment_id === m.id && r.option_id === o.id)?.runs ?? 0),
        }));
        return {
          id: m.id,
          lap: m.lap,
          realOptionId: m.realOptionId,
          matchedReal: options.find((o) => o.id === m.realOptionId)?.share ?? 0,
          options,
        };
      }),
    });
  }),
);

// GET /api/daily/:date/leaderboard: the top 100, by display name or a generated one (spec B3).
app.get('/api/daily/:date/leaderboard', (c) =>
  cached(c, async () => {
    const date = c.req.param('date');
    if (!isDate(date)) throw new ApiError(400, 'bad-request');
    const rows = await leaderboard(c.env.DB, date);
    return c.json({
      date,
      size: LEADERBOARD_SIZE,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        name: r.name || displayName(r.anon_id),
        score: r.score,
      })),
    });
  }),
);

// Survivor mode (docs/survivor-spec.md).
app.post('/api/survivor/start', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  if (c.env.RUNS_LIMITER) {
    const { success } = await c.env.RUNS_LIMITER.limit({ key: `survivor:${ip}` });
    if (!success) throw new ApiError(429, 'rate-limited');
  }
  const body = await c.req.json().catch(() => null);
  return c.json(await startRun(c.env.DB, body, Date.now(), survivorPool(c.env)), 201);
});

app.get('/api/survivor/leaderboard', (c) =>
  cached(c, async () => c.json(await survivorBoard(c.env.DB, Date.now()))),
);

app.get('/api/survivor/:runId', async (c) =>
  c.json(await getState(c.env.DB, c.req.param('runId'), c.req.query('anonId'))),
);

app.post('/api/survivor/:runId/round', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  if (c.env.RUNS_LIMITER) {
    const { success } = await c.env.RUNS_LIMITER.limit({ key: ip });
    if (!success) throw new ApiError(429, 'rate-limited');
  }
  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(400, 'bad-request', 'body too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad-request', 'body must be JSON');
  }
  const res = await submitRound(
    c.env.DB,
    c.req.param('runId'),
    body,
    Date.now(),
    survivorPool(c.env),
  );
  console.log(`survivor round verified: ${res.result.raceId} ${res.won ? 'won' : 'lost'}`);
  return c.json(res);
});

// Versus mode (docs/versus-spec.md V5): create a match (its code), look one up. The match's
// WebSocket (/api/versus/:code/ws) is routed straight to its room in fetch() below.
const VERSUS_TRACK_IDS = new Set(VERSUS_TRACKS.map((t) => t.id));
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const room = (env: Env, code: string) => env.VERSUS.get(env.VERSUS.idFromName(code));

app.post('/api/versus', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { track?: string };
  const track = body.track ?? '';
  if (!VERSUS_TRACK_IDS.has(track)) throw new ApiError(400, 'bad-track');
  for (let tries = 0; tries < 8; tries++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] as number;
    const res = await room(c.env, code).fetch('https://room/create', {
      method: 'POST',
      body: JSON.stringify({ code, track, seed }),
    });
    if (res.ok) return c.json(await res.json(), 201);
  }
  throw new ApiError(503, 'no-free-code');
});

app.get('/api/versus/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  if (!ROOM_CODE.test(code)) throw new ApiError(404, 'not-found');
  const res = await room(c.env, code).fetch('https://room/view');
  if (!res.ok) throw new ApiError(404, 'not-found');
  return c.json(await res.json());
});

app.notFound((c) => c.json({ error: 'not-found' }, 404));

const VERSUS_WS = /^\/api\/versus\/([A-Za-z]{4})\/ws$/;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // A match's WebSocket goes straight to its room (no CORS layer: a 101 can't be changed).
    const ws = VERSUS_WS.exec(new URL(request.url).pathname);
    if (ws) {
      const code = (ws[1] as string).toUpperCase();
      if (!ROOM_CODE.test(code)) return new Response('not found', { status: 404 });
      return room(env, code).fetch(new Request('https://room/ws', request));
    }
    return app.fetch(request, env, ctx);
  },
  // Daily queue check (Implementation Plan 4.6): alert when the queue runs low.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkQueue(env.DB, Date.now(), env.ALERT_WEBHOOK).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
