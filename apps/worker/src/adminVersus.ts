// The admin page's Versus tab (docs/admin-v2-spec.md A7): recent finished matches and the rooms
// open now. Both are written by the rooms themselves (src/versus.ts); this only reads them.
//
//   GET /api/admin/versus   { matches: VersusMatch[], rooms: LiveRoom[] }

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import type { Env } from './index.js';

export const MATCHES_LIMIT = 100;
/** A room that hasn't changed for this long is left off the live list (abandoned in the lobby). */
export const ROOM_STALE_MS = 2 * 3_600_000;

export interface VersusMatch {
  id: number;
  code: string;
  track: string;
  players: string[];
  cars: Array<{ car: string; startTyre: string }>;
  winner: number | null;
  gap: number | null;
  forfeit: number | null;
  battles: number;
  startedAt: string;
  finishedAt: string;
}

export interface LiveRoom {
  code: string;
  track: string;
  phase: string;
  players: string[];
  lap: number;
  openedAt: string;
  updatedAt: string;
}

const list = <T>(s: string): T[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export async function versusOverview(db: D1Database, now: number) {
  const [matches, rooms] = await db.batch([
    db
      .prepare('SELECT * FROM versus_matches ORDER BY finished_at DESC, id DESC LIMIT ?')
      .bind(MATCHES_LIMIT),
    db
      .prepare(
        `SELECT * FROM versus_rooms WHERE closed_at IS NULL AND updated_at > ?
         ORDER BY updated_at DESC`,
      )
      .bind(new Date(now - ROOM_STALE_MS).toISOString()),
  ]);
  return {
    matches: ((matches?.results ?? []) as Array<Record<string, unknown>>).map(
      (m): VersusMatch => ({
        id: m.id as number,
        code: m.code as string,
        track: m.track as string,
        players: list<string>(m.players as string),
        cars: list<{ car: string; startTyre: string }>(m.cars as string),
        winner: m.winner as number | null,
        gap: m.gap as number | null,
        forfeit: m.forfeit as number | null,
        battles: m.battles as number,
        startedAt: m.started_at as string,
        finishedAt: m.finished_at as string,
      }),
    ),
    rooms: ((rooms?.results ?? []) as Array<Record<string, unknown>>).map(
      (r): LiveRoom => ({
        code: r.code as string,
        track: r.track as string,
        phase: r.phase as string,
        players: list<string>(r.players as string),
        lap: r.lap as number,
        openedAt: r.opened_at as string,
        updatedAt: r.updated_at as string,
      }),
    ),
  };
}

export function registerAdminVersus(app: Hono<{ Bindings: Env }>) {
  app.get('/api/admin/versus', async (c) => {
    await requireAdmin(c);
    return c.json(await versusOverview(c.env.DB, Date.now()));
  });
}
