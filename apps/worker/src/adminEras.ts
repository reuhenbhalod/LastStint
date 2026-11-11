// The admin page's Eras tab (docs/admin-v2-spec.md A1): publish races and release eras, the
// jobs production SQL used to do. A race is Draft until published (era_races.published); an
// era is Coming soon until released (eras.released_at: a time, now or later).
//
//   GET  /api/admin/eras                 every era with its races, attempts and players
//   POST /api/admin/eras/race            { raceId, published }: publish or unpublish a race
//   POST /api/admin/eras/release         { eraId, at, confirm? }: at = 'now', a date
//                                        (YYYY-MM-DD, midnight UTC) or an ISO time; null clears
//                                        it (back to Coming soon), which needs confirm: true
//
// The release guard (eras spec D5) is enforced here: an era can't be released with fewer than
// ERA_RACES published races, and a released (or scheduled) era's races can't be unpublished.

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import { logStatement } from './adminLog.js';
import { isDate } from './dates.js';
import { getErasRace } from './eras.js';
import type { Env } from './index.js';
import { ApiError } from './runs.js';

/** Races an era needs published before it can be released. */
export const ERA_RACES = 10;

export type EraStatus = 'coming-soon' | 'scheduled' | 'released';

export interface AdminEraRace {
  raceId: string;
  name: string;
  position: number;
  published: boolean;
  /** The race file is bundled (it can be played). */
  file: boolean;
  /** Submitted attempts, and the players behind them. */
  attempts: number;
  players: number;
}

export interface AdminEra {
  id: number;
  name: string;
  years: string;
  playOrder: number;
  releasedAt: string | null;
  status: EraStatus;
  published: number;
  races: AdminEraRace[];
}

export function eraStatus(releasedAt: string | null, now: number): EraStatus {
  if (!releasedAt) return 'coming-soon';
  return releasedAt <= new Date(now).toISOString() ? 'released' : 'scheduled';
}

export async function listEras(db: D1Database, now: number): Promise<AdminEra[]> {
  const [eras, races] = await db.batch([
    db.prepare('SELECT id, name, years, play_order, released_at FROM eras ORDER BY play_order'),
    db.prepare(
      `SELECT r.race_id, r.era_id, r.position, r.published,
              (SELECT COUNT(*) FROM era_attempts a
                WHERE a.race_id = r.race_id AND a.submitted_at IS NOT NULL) AS attempts,
              (SELECT COUNT(DISTINCT a.player_id) FROM era_attempts a
                WHERE a.race_id = r.race_id AND a.submitted_at IS NOT NULL) AS players
       FROM era_races r ORDER BY r.era_id, r.position`,
    ),
  ]);
  const raceRows = (races?.results ?? []) as Array<{
    race_id: string;
    era_id: number;
    position: number;
    published: number;
    attempts: number;
    players: number;
  }>;
  const out: AdminEra[] = [];
  for (const e of (eras?.results ?? []) as Array<{
    id: number;
    name: string;
    years: string;
    play_order: number;
    released_at: string | null;
  }>) {
    const list: AdminEraRace[] = [];
    for (const r of raceRows.filter((x) => x.era_id === e.id)) {
      const race = await getErasRace(r.race_id);
      list.push({
        raceId: r.race_id,
        name: race?.model.race.name ?? r.race_id,
        position: r.position,
        published: r.published === 1,
        file: !!race,
        attempts: r.attempts,
        players: r.players,
      });
    }
    out.push({
      id: e.id,
      name: e.name,
      years: e.years,
      playOrder: e.play_order,
      releasedAt: e.released_at,
      status: eraStatus(e.released_at, now),
      published: list.filter((r) => r.published).length,
      races: list,
    });
  }
  return out;
}

/** Publish or unpublish one race. A released or scheduled era's races stay published. */
export async function setPublished(
  db: D1Database,
  email: string,
  raceId: string,
  published: boolean,
) {
  const row = await db
    .prepare(
      `SELECT r.era_id, r.published, e.released_at FROM era_races r JOIN eras e ON e.id = r.era_id
       WHERE r.race_id = ?`,
    )
    .bind(raceId)
    .first<{ era_id: number; published: number; released_at: string | null }>();
  if (!row) throw new ApiError(404, 'no-race', `${raceId} is not an Eras race`);
  if (!published && row.released_at) {
    throw new ApiError(
      409,
      'era-released',
      'this era is released or scheduled; clear its release date first',
    );
  }
  await db.batch([
    db
      .prepare('UPDATE era_races SET published = ? WHERE race_id = ?')
      .bind(published ? 1 : 0, raceId),
    logStatement(db, email, 'publish', { raceId, eraId: row.era_id, published }),
  ]);
  return { raceId, published };
}

/** The release time a request asks for: now, a date (midnight UTC) or an ISO time. */
export function releaseTime(at: unknown, now: number): string | null {
  if (at === null) return null;
  if (at === 'now') return new Date(now).toISOString();
  if (isDate(at)) return `${at}T00:00:00.000Z`;
  const t = typeof at === 'string' ? Date.parse(at) : Number.NaN;
  if (Number.isNaN(t)) {
    throw new ApiError(400, 'bad-request', "at is 'now', a date, an ISO time or null");
  }
  return new Date(t).toISOString();
}

/** Release an era (or set its release date), or clear its release. */
export async function setRelease(
  db: D1Database,
  email: string,
  eraId: number,
  at: string | null,
  confirm: boolean,
  now = Date.now(),
) {
  const era = await db
    .prepare(
      `SELECT e.released_at,
              (SELECT COUNT(*) FROM era_races r WHERE r.era_id = e.id AND r.published = 1) AS n
       FROM eras e WHERE e.id = ?`,
    )
    .bind(eraId)
    .first<{ released_at: string | null; n: number }>();
  if (!era) throw new ApiError(404, 'no-era', `no era ${eraId}`);
  if (at !== null && era.n < ERA_RACES) {
    throw new ApiError(
      409,
      'too-few-races',
      `an era needs ${ERA_RACES} published races to be released (this one has ${era.n})`,
    );
  }
  if (at === null && era.released_at && !confirm) {
    throw new ApiError(409, 'confirm-needed', 'clearing a release needs confirmation');
  }
  // Moving a released era to a later date takes it away from players until then, like clearing it.
  const liveNow = !!era.released_at && Date.parse(era.released_at) <= now;
  if (at !== null && liveNow && Date.parse(at) > now && !confirm) {
    throw new ApiError(
      409,
      'confirm-needed',
      'moving a released era to a later date takes it from players until then; confirm to do it',
    );
  }
  await db.batch([
    db.prepare('UPDATE eras SET released_at = ? WHERE id = ?').bind(at, eraId),
    logStatement(db, email, 'release', { eraId, from: era.released_at, to: at }),
  ]);
  return { eraId, releasedAt: at };
}

export function registerAdminEras(app: Hono<{ Bindings: Env }>) {
  const body = async (c: { req: { json: () => Promise<unknown> } }) =>
    ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  app.get('/api/admin/eras', async (c) => {
    await requireAdmin(c);
    return c.json({ eras: await listEras(c.env.DB, Date.now()), needed: ERA_RACES });
  });

  app.post('/api/admin/eras/race', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    if (typeof b.raceId !== 'string' || typeof b.published !== 'boolean') {
      throw new ApiError(400, 'bad-request', 'raceId and published are required');
    }
    return c.json(await setPublished(c.env.DB, who.email, b.raceId, b.published));
  });

  app.post('/api/admin/eras/release', async (c) => {
    const who = await requireAdmin(c);
    const b = await body(c);
    const eraId = Number(b.eraId);
    if (!Number.isInteger(eraId) || !('at' in b)) {
      throw new ApiError(400, 'bad-request', 'eraId and at are required');
    }
    const now = Date.now();
    const at = releaseTime(b.at, now);
    return c.json(await setRelease(c.env.DB, who.email, eraId, at, b.confirm === true, now));
  });
}
