// Cloudflare Worker API (Implementation Plan 4.1, docs/phase-4-backend-spec.md).
// Serves the daily, verifies every run by replaying it with the shared TS sim, and computes
// ranks, stats and the leaderboard. docs/api.md documents the endpoints for the web app.

import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { verifyGoogleToken } from './auth.js';
import { isDate, isPlayable, playableDates } from './dates.js';
import { LEADERBOARD_SIZE, dailyStats, getDaily, getRun, leaderboard } from './db.js';
import { displayName } from './names.js';
import { checkQueue, queueDays } from './ops.js';
import { accountOf, playedDates, signIn, streakOf } from './players.js';
import { getRace } from './races.js';
import { ApiError, dailyWithModel, isAnonId, submitRun, withStanding } from './runs.js';

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
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
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

// POST /api/auth/google: sign in with a Google ID token; links this browser's anonId to the
// account and returns the account's player ID, which the browser adopts.
app.post('/api/auth/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, 'auth-off', 'sign-in is not set up');
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
  const keys = c.env.GOOGLE_JWKS ? JSON.parse(c.env.GOOGLE_JWKS).keys : undefined;
  const who = await verifyGoogleToken(credential, clientId, Date.now(), keys);
  if (!who) throw new ApiError(401, 'bad-credential');
  return c.json(await signIn(c.env.DB, who, anonId, Date.now()));
});

// GET /api/players/:anonId?today=YYYY-MM-DD: the player's account (if signed in) and streak,
// counted to the player's local date.
app.get('/api/players/:anonId', async (c) => {
  const anonId = c.req.param('anonId');
  const today = c.req.query('today');
  if (!isAnonId(anonId) || !isDate(today)) throw new ApiError(400, 'bad-request');
  const [account, dates] = await Promise.all([
    accountOf(c.env.DB, anonId),
    playedDates(c.env.DB, anonId),
  ]);
  return c.json({ account, streak: streakOf(dates, today) });
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

// GET /api/daily/:date/leaderboard: the top 100, with generated names (spec B3).
app.get('/api/daily/:date/leaderboard', (c) =>
  cached(c, async () => {
    const date = c.req.param('date');
    if (!isDate(date)) throw new ApiError(400, 'bad-request');
    const rows = await leaderboard(c.env.DB, date);
    return c.json({
      date,
      size: LEADERBOARD_SIZE,
      entries: rows.map((r, i) => ({ rank: i + 1, name: displayName(r.anon_id), score: r.score })),
    });
  }),
);

app.notFound((c) => c.json({ error: 'not-found' }, 404));

export default {
  fetch: app.fetch,
  // Daily queue check (Implementation Plan 4.6): alert when the queue runs low.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkQueue(env.DB, Date.now(), env.ALERT_WEBHOOK).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
