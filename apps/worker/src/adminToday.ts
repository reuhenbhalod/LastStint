// The admin page's Today tab (docs/admin-v2-spec.md A2): the health check. Today's and
// tomorrow's race, how many days are queued, the stale days (their race file changed since
// they were pinned: admin.ts repin fixes them) and today's runs. Dates are UTC, like the
// schedule. The announcement on the same tab is announcements.ts.
//
//   GET /api/admin/today   AdminToday

import type { Hono } from 'hono';
import { requireAdmin, schedule } from './admin.js';
import { addDays, todayUtc } from './dates.js';
import type { Env } from './index.js';
import { LOW_QUEUE_DAYS, queueDays } from './ops.js';

export interface TodayDay {
  date: string;
  number: number;
  raceId: string;
  name: string;
  runs: number;
  current: boolean;
}

export interface AdminToday {
  today: string;
  /** Today's and tomorrow's daily (null: not scheduled). */
  days: { today: TodayDay | null; tomorrow: TodayDay | null };
  /** Days in a row scheduled from today; `low` under LOW_QUEUE_DAYS. */
  queue: { days: number; low: boolean; warnUnder: number };
  /** Today's and later days pinned to an old race file. */
  stale: TodayDay[];
  /** Runs submitted for today's daily. */
  runs: { total: number; verified: number; corrected: number; disqualified: number };
}

export async function todayHealth(db: D1Database, now: number): Promise<AdminToday> {
  const today = todayUtc(now);
  const tomorrow = addDays(today, 1);
  const ahead = await schedule(db, today, addDays(today, 3650));
  const queued = await queueDays(db, now);
  const runs = await db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(verified), 0) AS verified,
              COALESCE(SUM(corrected), 0) AS corrected,
              COALESCE(SUM(disqualified), 0) AS disqualified
       FROM runs WHERE date = ?`,
    )
    .bind(today)
    .first<AdminToday['runs']>();
  return {
    today,
    days: {
      today: ahead.find((d) => d.date === today) ?? null,
      tomorrow: ahead.find((d) => d.date === tomorrow) ?? null,
    },
    queue: { days: queued, low: queued < LOW_QUEUE_DAYS, warnUnder: LOW_QUEUE_DAYS },
    stale: ahead.filter((d) => !d.current),
    runs: runs ?? { total: 0, verified: 0, corrected: 0, disqualified: 0 },
  };
}

export function registerAdminToday(app: Hono<{ Bindings: Env }>) {
  app.get('/api/admin/today', async (c) => {
    await requireAdmin(c);
    return c.json(await todayHealth(c.env.DB, Date.now()));
  });
}
