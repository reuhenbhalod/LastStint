// Ticket tracker (the admin page's Tickets tab, /admin/tickets): game-change tickets for the
// people running the game. Admin-only, like src/admin.ts: every request carries the admin's
// Google ID token as a Bearer token, checked by requireAdmin (401 no or bad token, 403 not on
// ADMIN_EMAILS). A new ticket records the admin's email as created_by.
//
//   GET    /api/admin/tickets         every ticket, newest first       -> { tickets }
//   POST   /api/admin/tickets         { title, category, description?, status?, notes?,
//                                    source? }: create                -> 201 { ticket }
//   PATCH  /api/admin/tickets/:id     change any of those fields       -> { ticket }
//   DELETE /api/admin/tickets/:id     delete                           -> { ok: true }
//
// completed_at is stamped when a ticket becomes done (kept while it stays done) and cleared
// when it leaves done. Bodies are JSON (415 otherwise, 413 over 64 KB, 400 bad-json / invalid).
// Every query is parameterised; the only SQL built at run time is an update's SET list, whose
// column names come from a fixed list, never from the request.

import type { Context, Hono } from 'hono';
import { requireAdmin } from './admin.js';
import type { Env } from './index.js';
import { ApiError } from './runs.js';
import {
  type Category,
  type Status,
  type Ticket,
  type TicketInput,
  parseTicketInput,
} from './ticketFields.js';

type Ctx = Context<{ Bindings: Env }>;

/** Largest accepted request body (two 10,000-character fields plus the rest fit easily). */
const MAX_BODY_BYTES = 64 * 1024;

interface Row {
  id: number;
  title: string;
  description: string;
  category: Category;
  status: Status;
  notes: string;
  source: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

function toTicket(r: Row): Ticket {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    notes: r.notes,
    source: r.source,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}

/** Every ticket, newest first (the page groups and filters them). */
export async function listTickets(db: D1Database): Promise<Ticket[]> {
  const { results } = await db
    .prepare('SELECT * FROM tickets ORDER BY created_at DESC, id DESC')
    .all<Row>();
  return results.map(toTicket);
}

export async function createTicket(
  db: D1Database,
  input: Pick<TicketInput, 'title' | 'category'> & Partial<TicketInput>,
  createdBy: string,
  now: number,
): Promise<Ticket> {
  const status = input.status ?? 'open';
  const row = await db
    .prepare(
      `INSERT INTO tickets (title, description, category, status, notes, source, created_by,
                            created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      input.title,
      input.description ?? '',
      input.category,
      status,
      input.notes ?? '',
      input.source ?? '',
      createdBy,
      now,
      now,
      status === 'done' ? now : null,
    )
    .first<Row>();
  if (!row) throw new Error('insert returned no row');
  return toTicket(row);
}

const COLUMNS = ['title', 'description', 'category', 'status', 'notes', 'source'] as const;

/**
 * Change some of a ticket's fields; null if there's no such ticket. A status change to done
 * stamps completed_at (kept if it was already done); any other status clears it.
 */
export async function updateTicket(
  db: D1Database,
  id: number,
  changes: Partial<TicketInput>,
  now: number,
): Promise<Ticket | null> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const col of COLUMNS) {
    const v = changes[col];
    if (v === undefined) continue;
    sets.push(`${col} = ?`);
    values.push(v);
  }
  if (changes.status !== undefined) {
    // SET expressions see the row's old values, so `status` here is the status before.
    sets.push(
      "completed_at = CASE WHEN ? = 'done' THEN CASE WHEN status = 'done' THEN completed_at ELSE ? END ELSE NULL END",
    );
    values.push(changes.status, now);
  }
  sets.push('updated_at = ?');
  values.push(now);
  const row = await db
    .prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values, id)
    .first<Row>();
  return row ? toTicket(row) : null;
}

/** Delete a ticket; false if there was no such ticket. */
export async function deleteTicket(db: D1Database, id: number): Promise<boolean> {
  const res = await db.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
  return res.meta.changes > 0;
}

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

export function registerTickets(app: Hono<{ Bindings: Env }>) {
  app.get('/api/admin/tickets', async (c) => {
    await requireAdmin(c);
    return c.json({ tickets: await listTickets(c.env.DB) });
  });

  app.post('/api/admin/tickets', async (c) => {
    const who = await requireAdmin(c);
    const parsed = parseTicketInput(await jsonBody(c), true);
    if (!parsed.ok) throw new ApiError(400, 'invalid', parsed.error);
    const { title, category } = parsed.value;
    if (title === undefined || category === undefined) {
      throw new ApiError(400, 'invalid', 'title and category are required');
    }
    const ticket = await createTicket(
      c.env.DB,
      { ...parsed.value, title, category },
      who.email,
      Date.now(),
    );
    return c.json({ ticket }, 201);
  });

  app.patch('/api/admin/tickets/:id', async (c) => {
    await requireAdmin(c);
    const id = ticketId(c);
    const parsed = parseTicketInput(await jsonBody(c), false);
    if (!parsed.ok) throw new ApiError(400, 'invalid', parsed.error);
    const ticket = await updateTicket(c.env.DB, id, parsed.value, Date.now());
    if (!ticket) throw new ApiError(404, 'not-found', `no ticket ${id}`);
    return c.json({ ticket });
  });

  app.delete('/api/admin/tickets/:id', async (c) => {
    await requireAdmin(c);
    const id = ticketId(c);
    if (!(await deleteTicket(c.env.DB, id))) {
      throw new ApiError(404, 'not-found', `no ticket ${id}`);
    }
    return c.json({ ok: true });
  });
}
