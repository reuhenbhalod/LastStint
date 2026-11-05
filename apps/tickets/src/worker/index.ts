// The ticket tracker's API. The same Worker serves the built app (wrangler.jsonc `assets`);
// only /api/* reaches this code.
//
//   GET    /api/tickets       every ticket
//   POST   /api/tickets       create { title, category, ... }  -> 201 { ticket }
//   PATCH  /api/tickets/:id   change any of the fields         -> { ticket }
//   DELETE /api/tickets/:id   delete                           -> { ok: true }
//
// No sign-in for now: anyone with the URL can use it (README.md).
// Errors are { error, detail? } JSON with a 4xx/5xx status.

import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { parseTicketInput } from '../shared/tickets.js';
import { ApiError, type Env } from './errors.js';
import { createTicket, deleteTicket, listTickets, updateTicket } from './tickets.js';

export type { Env } from './errors.js';

/** Largest accepted request body (two 10,000-character fields plus the rest fit easily). */
const MAX_BODY_BYTES = 64 * 1024;

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

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

/** The request's JSON body, size-limited. */
async function jsonBody(c: Ctx): Promise<unknown> {
  if (!(c.req.header('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'bad-content-type', 'send application/json');
  }
  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new ApiError(413, 'too-large', `body is over ${MAX_BODY_BYTES} bytes`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad-json', 'body is not valid JSON');
  }
}

/** The :id route parameter, a positive integer. */
function ticketId(c: Ctx): number {
  const raw = c.req.param('id') ?? '';
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw new ApiError(400, 'bad-id', 'id must be a positive integer');
  return id;
}

app.get('/api/tickets', async (c) => c.json({ tickets: await listTickets(c.env.DB) }));

app.post('/api/tickets', async (c) => {
  const parsed = parseTicketInput(await jsonBody(c), true);
  if (!parsed.ok) throw new ApiError(400, 'invalid', parsed.error);
  const { title, category } = parsed.value;
  if (title === undefined || category === undefined) {
    throw new ApiError(400, 'invalid', 'title and category are required');
  }
  const ticket = await createTicket(c.env.DB, { ...parsed.value, title, category }, Date.now());
  return c.json({ ticket }, 201);
});

app.patch('/api/tickets/:id', async (c) => {
  const id = ticketId(c);
  const parsed = parseTicketInput(await jsonBody(c), false);
  if (!parsed.ok) throw new ApiError(400, 'invalid', parsed.error);
  const ticket = await updateTicket(c.env.DB, id, parsed.value, Date.now());
  if (!ticket) throw new ApiError(404, 'not-found', `no ticket ${id}`);
  return c.json({ ticket });
});

app.delete('/api/tickets/:id', async (c) => {
  const id = ticketId(c);
  if (!(await deleteTicket(c.env.DB, id))) throw new ApiError(404, 'not-found', `no ticket ${id}`);
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ error: 'not-found' }, 404));

export default app;
