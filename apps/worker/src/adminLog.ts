// The admin audit log (docs/admin-v2-spec.md A9, migration 0030): every change made on the
// admin page writes one row (who, when, what, and its details). The Log tab lists it.
//
//   GET /api/admin/log?action=&before=   newest first, 200 at a time   -> { entries, actions }

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import type { Env } from './index.js';
import { ApiError } from './runs.js';

/** What the page changes; the Log tab filters on these. */
export const LOG_ACTIONS = [
  'schedule',
  'day',
  'repin',
  'clear-run',
  'publish',
  'release',
  'reverify',
  'delete-run',
  'player-name',
  'hide',
  'announcement',
  'ticket-create',
  'ticket-status',
  'ticket-delete',
] as const;

export type LogAction = (typeof LOG_ACTIONS)[number];

export const LOG_PAGE = 200;

export interface LogEntry {
  id: number;
  at: string;
  email: string;
  action: string;
  detail: unknown;
}

/** The statement that records one change (batch it with the change where it matters). */
export function logStatement(
  db: D1Database,
  email: string,
  action: LogAction,
  detail: unknown,
  now = Date.now(),
): D1PreparedStatement {
  return db
    .prepare('INSERT INTO admin_log (at, email, action, detail) VALUES (?, ?, ?, ?)')
    .bind(new Date(now).toISOString(), email, action, JSON.stringify(detail ?? {}));
}

/** Record one change. */
export async function logAdmin(
  db: D1Database,
  email: string,
  action: LogAction,
  detail: unknown,
): Promise<void> {
  await logStatement(db, email, action, detail).run();
}

/** The log, newest first: every action or one, before an id (the next page). */
export async function listLog(
  db: D1Database,
  action?: string,
  before?: number,
): Promise<LogEntry[]> {
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (action) {
    where.push('action = ?');
    binds.push(action);
  }
  if (before) {
    where.push('id < ?');
    binds.push(before);
  }
  const { results } = await db
    .prepare(
      `SELECT id, at, email, action, detail FROM admin_log
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY id DESC LIMIT ${LOG_PAGE}`,
    )
    .bind(...binds)
    .all<{ id: number; at: string; email: string; action: string; detail: string }>();
  return results.map((r) => ({ ...r, detail: parseDetail(r.detail) }));
}

function parseDetail(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export function registerAdminLog(app: Hono<{ Bindings: Env }>) {
  app.get('/api/admin/log', async (c) => {
    await requireAdmin(c);
    const action = c.req.query('action') || undefined;
    if (action && !(LOG_ACTIONS as readonly string[]).includes(action)) {
      throw new ApiError(400, 'bad-request', `no action ${action}`);
    }
    const raw = c.req.query('before');
    const before = raw ? Number(raw) : undefined;
    if (before !== undefined && !(Number.isInteger(before) && before > 0)) {
      throw new ApiError(400, 'bad-request', 'before is a log id');
    }
    return c.json({ entries: await listLog(c.env.DB, action, before), actions: LOG_ACTIONS });
  });
}
