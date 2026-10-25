// Cloudflare Worker API (Implementation Plan 4.1).
// Serves the daily, verifies every score by replaying the run with the shared TS sim, and
// computes ranks. Endpoints are stubs in Phase 0; score verification lands in Phase 4.

import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  // Production web origin allowed to call the API (e.g. https://pitwall-web.pages.dev).
  // Set via wrangler.jsonc `vars` / the Pages project. Empty in local dev (Vite proxy
  // makes requests same-origin, so no CORS is needed there).
  WEB_ORIGIN?: string;
}

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

app.get('/api/health', (c) => c.json({ ok: true }));

// GET /api/daily — today's race (date boundary decided in Phase 4).
app.get('/api/daily', (c) => c.json({ error: 'not implemented: Phase 4' }, 501));

// POST /api/runs — submit a finished run (decisions only; score computed server-side).
app.post('/api/runs', (c) => c.json({ error: 'not implemented: Phase 4' }, 501));

// GET /api/daily/:date/leaderboard — top scores for a date.
app.get('/api/daily/:date/leaderboard', (c) => c.json({ error: 'not implemented: Phase 4' }, 501));

export default {
  fetch: app.fetch,
  // Daily queue-check cron (Implementation Plan 4.6): verify the next daily exists and
  // alert if the queue runs low. Wired up in Phase 4.
  async scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // not implemented: Phase 4
  },
} satisfies ExportedHandler<Env>;
