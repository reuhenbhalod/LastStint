// The announcement banner (docs/admin-v2-spec.md A8, migration 0030): one at a time, shown
// under the top bar on every page. Anyone can read the current one; setting and clearing it
// are for admins (and logged).
//
//   GET  /api/announcement                  { announcement: Announcement | null }
//   POST /api/admin/announcement            { text, tone?, endsAt? }: set (replaces the current)
//   POST /api/admin/announcement/clear      clear the current one

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import { logStatement } from './adminLog.js';
import type { Env } from './index.js';
import { ApiError } from './runs.js';

export const ANNOUNCEMENT_MAX = 280;
const TONES = ['info', 'warning'] as const;
export type Tone = (typeof TONES)[number];

export interface Announcement {
  id: number;
  text: string;
  tone: Tone;
  /** When it stops showing (ISO), or null: until cleared. */
  endsAt: string | null;
  createdAt: string;
}

interface Row {
  id: number;
  text: string;
  tone: Tone;
  ends_at: string | null;
  created_at: string;
}

/** The banner showing now: the newest that isn't cleared and hasn't ended. */
export async function currentAnnouncement(
  db: D1Database,
  now: number,
): Promise<Announcement | null> {
  const row = await db
    .prepare(
      `SELECT id, text, tone, ends_at, created_at FROM announcements
       WHERE cleared_at IS NULL AND (ends_at IS NULL OR ends_at > ?)
       ORDER BY id DESC LIMIT 1`,
    )
    .bind(new Date(now).toISOString())
    .first<Row>();
  return (
    row && {
      id: row.id,
      text: row.text,
      tone: row.tone,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    }
  );
}

/** Check a set request: text 1-280 characters, a known tone, an end time in the future. */
export function parseAnnouncement(
  body: Record<string, unknown>,
  now: number,
): { text: string; tone: Tone; endsAt: string | null } {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > ANNOUNCEMENT_MAX) {
    throw new ApiError(400, 'bad-request', `text is 1-${ANNOUNCEMENT_MAX} characters`);
  }
  const tone = (body.tone ?? 'info') as Tone;
  if (!TONES.includes(tone)) throw new ApiError(400, 'bad-request', 'tone is info or warning');
  let endsAt: string | null = null;
  if (body.endsAt !== undefined && body.endsAt !== null && body.endsAt !== '') {
    const t = typeof body.endsAt === 'string' ? Date.parse(body.endsAt) : Number.NaN;
    if (Number.isNaN(t)) throw new ApiError(400, 'bad-request', 'endsAt is an ISO time');
    if (t <= now) throw new ApiError(400, 'bad-request', 'endsAt is in the past');
    endsAt = new Date(t).toISOString();
  }
  return { text, tone, endsAt };
}

export function registerAnnouncements(app: Hono<{ Bindings: Env }>) {
  app.get('/api/announcement', async (c) =>
    c.json({ announcement: await currentAnnouncement(c.env.DB, Date.now()) }),
  );

  app.post('/api/admin/announcement', async (c) => {
    const who = await requireAdmin(c);
    const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const now = Date.now();
    const a = parseAnnouncement(body, now);
    const at = new Date(now).toISOString();
    const db = c.env.DB;
    await db.batch([
      db.prepare('UPDATE announcements SET cleared_at = ? WHERE cleared_at IS NULL').bind(at),
      db
        .prepare(
          `INSERT INTO announcements (text, tone, ends_at, created_at, created_by)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(a.text, a.tone, a.endsAt, at, who.email),
      logStatement(db, who.email, 'announcement', { set: a }, now),
    ]);
    return c.json({ announcement: await currentAnnouncement(db, now) });
  });

  app.post('/api/admin/announcement/clear', async (c) => {
    const who = await requireAdmin(c);
    const now = Date.now();
    const db = c.env.DB;
    const current = await currentAnnouncement(db, now);
    await db.batch([
      db
        .prepare('UPDATE announcements SET cleared_at = ? WHERE cleared_at IS NULL')
        .bind(new Date(now).toISOString()),
      logStatement(db, who.email, 'announcement', { cleared: current?.id ?? null }, now),
    ]);
    return c.json({ announcement: null });
  });
}
