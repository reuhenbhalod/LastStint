// Eras history book, community stats and leaderboards (eras spec §8, §13; build plan 7.4).
//
//   GET /api/history?anonId=                         the player's history book: completion %,
//                                                    collectible counts, per-era progress and
//                                                    badges, and every rewrite entry
//   GET /api/eras/races/:raceId/stats                community stats: rewrite share, star rates
//   GET /api/eras/races/:raceId/leaderboard?legend=&anonId=
//                                                    top 100 by best accuracy, and the player's
//                                                    rank (Legend has its own board)
//
// The player is resolved as every Eras route does (eras.ts playerOf: the linked account, else
// the anonId). Counts come straight from D1: stars, Legend stars and hidden objectives from
// era_progress, rewrites from history_entries, badges derived from them (spec §12: never
// stored). The totals are the campaign's (every era_races row; 830 with the 100 races, less
// one rewrite for each race the Eras side really won: it has no rewrite condition, hasRewrite).
//
// Community stats (spec §8: "Only 9% of strategists rewrote this race") are one grouped
// summary of every race, cached in the Cache API for CACHE_SECONDS (as the Daily stats are):
// a read costs a cache hit, the submit path writes nothing extra, and no migration is needed.
// The rewrite share is the players with a history book entry on the race over the players with
// an evaluated attempt on it (normal or Legend); both follow the nightly re-grade, which moves
// or deletes an entry whose attempt was corrected (reverify.ts).
//
// Leaderboards are ranked by each player's best accuracy over their evaluated attempts (the
// era_attempts_race_accuracy index; the same value as era_progress.best_accuracy), with ties
// to whoever reached it first, then by player ID. They never reset: no model_hash filter, so a
// content update keeps every attempt on the board (decided Nov 7).

import type { Context, Hono } from 'hono';
import { erasTestMode, getErasRace, hasRewrite, playerOf } from './eras.js';
import type { Env } from './index.js';
import { displayName } from './names.js';
import { DISPLAY_NAME, NOT_HIDDEN } from './players.js';
import { ApiError, isAnonId } from './runs.js';

type Ctx = Context<{ Bindings: Env }>;

export const ERAS_LEADERBOARD_SIZE = 100;
const STARS = 3;
/** Era badges per era: Cleared, Mastered, Legend (spec §8). */
const BADGES = 3;

// ---- response shapes (web apps/web/src/eras/api.ts mirrors them) --------------------------

export interface Tally {
  have: number;
  total: number;
}

export interface EraBadges {
  /** At least one star on every race of the era. */
  cleared: boolean;
  /** Every star of the era. */
  mastered: boolean;
  /** Every Legend star of the era. */
  legend: boolean;
}

export interface HistoryEra {
  eraId: number;
  name: string;
  years: string;
  playOrder: number;
  races: number;
  stars: Tally;
  legendStars: Tally;
  rewrites: Tally;
  hidden: Tally;
  badges: EraBadges;
  /** Collected over collectible in this era, 0-100. */
  percent: number;
}

export interface RewriteShare {
  /** Players with an evaluated attempt on the race. */
  players: number;
  /** Of them, players who rewrote it. */
  rewrites: number;
  /** rewrites / players, 0-1 (0 with no players). */
  share: number;
}

export interface HistoryEntry {
  raceId: string;
  eraId: number;
  position: number;
  attemptId: string;
  achievedAt: string;
  /** The rewriting attempt's mode, accuracy and stars (spec §8). */
  legend: boolean;
  accuracy: number | null;
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  /** The race's authored headline and what really happened; null until the race has them. */
  headline: string | null;
  real: string | null;
  community: RewriteShare;
}

export interface HistoryBook {
  completion: { collected: number; total: number; percent: number };
  collectibles: {
    stars: Tally;
    legendStars: Tally;
    rewrites: Tally;
    hidden: Tally;
    badges: Tally;
  };
  /** Every era, in play order. */
  eras: HistoryEra[];
  /** The player's rewrites, oldest first. */
  entries: HistoryEntry[];
}

export interface StarRates {
  /** Players with progress on the race in this mode. */
  players: number;
  /** Shares of them, 0-1, holding each star and the hidden objective. */
  result: number;
  strategist: number;
  mastery: number;
  hidden: number;
}

export interface RaceStats {
  raceId: string;
  rewrite: RewriteShare;
  stars: StarRates;
  legendStars: StarRates;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  accuracy: number;
}

export interface EraLeaderboard {
  raceId: string;
  legend: boolean;
  size: number;
  /** Players on the board. */
  total: number;
  entries: LeaderboardEntry[];
  /** The asking player's place; null without an anonId or without an evaluated attempt. */
  me: { rank: number; accuracy: number } | null;
}

// ---- caching ------------------------------------------------------------------------------

/** A JSON value from the Cache API under `key`, built and stored for CACHE_SECONDS on a miss. */
async function cachedJson<T>(c: Ctx, key: string, build: () => Promise<T>): Promise<T> {
  const seconds = Number(c.env.CACHE_SECONDS ?? 60);
  if (!(seconds > 0)) return build();
  const cache = caches.default;
  const req = new Request(`${new URL(c.req.url).origin}/__cache/eras/${key}`);
  const hit = await cache.match(req);
  if (hit) return (await hit.json()) as T;
  const value = await build();
  const res = new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${seconds}` },
  });
  c.executionCtx.waitUntil(cache.put(req, res));
  return value;
}

// ---- community summary --------------------------------------------------------------------

interface RaceCommunity {
  rewrite: RewriteShare;
  stars: StarRates;
  legendStars: StarRates;
}

type Community = Record<string, RaceCommunity>;

const share = (n: number, of: number) => (of > 0 ? n / of : 0);

const noRates = (): StarRates => ({ players: 0, result: 0, strategist: 0, mastery: 0, hidden: 0 });

/** Every race's community numbers, straight from D1 (three grouped queries in one batch). */
export async function communitySummary(db: D1Database): Promise<Community> {
  const [players, rewrites, progress] = await db.batch([
    db.prepare(
      `SELECT race_id, count(DISTINCT player_id) AS n FROM era_attempts
       WHERE result IS NOT NULL GROUP BY race_id`,
    ),
    db.prepare('SELECT race_id, count(*) AS n FROM history_entries GROUP BY race_id'),
    db.prepare(
      `SELECT race_id, legend, count(*) AS players, sum(star_result) AS result,
         sum(star_strategist) AS strategist, sum(star_mastery) AS mastery,
         sum(hidden_done) AS hidden
       FROM era_progress GROUP BY race_id, legend`,
    ),
  ]);
  const out: Community = {};
  const entry = (raceId: string): RaceCommunity => {
    let e = out[raceId];
    if (!e) {
      e = {
        rewrite: { players: 0, rewrites: 0, share: 0 },
        stars: noRates(),
        legendStars: noRates(),
      };
      out[raceId] = e;
    }
    return e;
  };
  for (const r of (players?.results ?? []) as Array<{ race_id: string; n: number }>) {
    entry(r.race_id).rewrite.players = r.n;
  }
  for (const r of (rewrites?.results ?? []) as Array<{ race_id: string; n: number }>) {
    entry(r.race_id).rewrite.rewrites = r.n;
  }
  for (const e of Object.values(out))
    e.rewrite.share = share(e.rewrite.rewrites, e.rewrite.players);
  type ProgressSum = {
    race_id: string;
    legend: number;
    players: number;
    result: number;
    strategist: number;
    mastery: number;
    hidden: number;
  };
  for (const r of (progress?.results ?? []) as ProgressSum[]) {
    const rates: StarRates = {
      players: r.players,
      result: share(r.result, r.players),
      strategist: share(r.strategist, r.players),
      mastery: share(r.mastery, r.players),
      hidden: share(r.hidden, r.players),
    };
    if (r.legend === 1) entry(r.race_id).legendStars = rates;
    else entry(r.race_id).stars = rates;
  }
  return out;
}

const community = (c: Ctx) => cachedJson(c, 'community', () => communitySummary(c.env.DB));

const noCommunity = (): RaceCommunity => ({
  rewrite: { players: 0, rewrites: 0, share: 0 },
  stars: noRates(),
  legendStars: noRates(),
});

// ---- history book -------------------------------------------------------------------------

interface EraRow {
  id: number;
  name: string;
  years: string;
  play_order: number;
}

interface ProgressRow {
  race_id: string;
  legend: number;
  star_result: number;
  star_strategist: number;
  star_mastery: number;
  hidden_done: number;
}

interface EntryRow {
  race_id: string;
  attempt_id: string;
  achieved_at: string;
  legend: number | null;
  accuracy: number | null;
  result: string | null;
}

const starsOf = (p: ProgressRow | undefined) =>
  p ? p.star_result + p.star_strategist + p.star_mastery : 0;

function attemptStars(result: string | null): HistoryEntry['stars'] {
  let parsed: { stars?: Partial<HistoryEntry['stars']> } | null = null;
  try {
    parsed = result === null ? null : JSON.parse(result);
  } catch (e) {
    console.error('era_attempts.result is not JSON', e);
  }
  const s = parsed?.stars;
  return { result: !!s?.result, strategist: !!s?.strategist, mastery: !!s?.mastery };
}

const tally = (have: number, total: number): Tally => ({ have, total });

/** The player's history book, counted from D1. */
export async function historyBook(
  db: D1Database,
  playerId: string,
  communityOf: () => Promise<Community>,
): Promise<HistoryBook> {
  const [eras, races, progress, entries] = await db.batch([
    db.prepare('SELECT id, name, years, play_order FROM eras ORDER BY play_order'),
    db.prepare('SELECT race_id, era_id, position FROM era_races ORDER BY era_id, position'),
    db
      .prepare(
        `SELECT race_id, legend, star_result, star_strategist, star_mastery, hidden_done
         FROM era_progress WHERE player_id = ?`,
      )
      .bind(playerId),
    db
      .prepare(
        `SELECT h.race_id, h.attempt_id, h.achieved_at, a.legend, a.accuracy, a.result
         FROM history_entries h LEFT JOIN era_attempts a ON a.id = h.attempt_id
         WHERE h.player_id = ? ORDER BY h.achieved_at, h.race_id`,
      )
      .bind(playerId),
  ]);
  const allRaces = (races?.results ?? []) as Array<{
    race_id: string;
    era_id: number;
    position: number;
  }>;
  const normal = new Map<string, ProgressRow>();
  const legend = new Map<string, ProgressRow>();
  for (const p of (progress?.results ?? []) as ProgressRow[]) {
    (p.legend === 1 ? legend : normal).set(p.race_id, p);
  }
  const entryRows = (entries?.results ?? []) as EntryRow[];
  const rewritten = new Set(entryRows.map((e) => e.race_id));

  const eraList: HistoryEra[] = [];
  for (const era of (eras?.results ?? []) as EraRow[]) {
    const own = allRaces.filter((r) => r.era_id === era.id);
    const n = own.length;
    const stars = own.reduce((t, r) => t + starsOf(normal.get(r.race_id)), 0);
    const legendStars = own.reduce((t, r) => t + starsOf(legend.get(r.race_id)), 0);
    const rewrites = own.filter((r) => rewritten.has(r.race_id)).length;
    // Only races with a rewrite condition have one to collect (eras.ts hasRewrite).
    const rewritable = own.filter((r) => hasRewrite(r.race_id)).length;
    // One hidden objective per race (spec §6), met in either mode.
    const hidden = own.filter(
      (r) => normal.get(r.race_id)?.hidden_done === 1 || legend.get(r.race_id)?.hidden_done === 1,
    ).length;
    const badges: EraBadges = {
      cleared: n > 0 && own.every((r) => starsOf(normal.get(r.race_id)) > 0),
      mastered: n > 0 && stars === STARS * n,
      legend: n > 0 && legendStars === STARS * n,
    };
    const badgeCount = Number(badges.cleared) + Number(badges.mastered) + Number(badges.legend);
    const collected = stars + legendStars + rewrites + hidden + badgeCount;
    const total = STARS * n * 2 + rewritable + n + BADGES;
    eraList.push({
      eraId: era.id,
      name: era.name,
      years: era.years,
      playOrder: era.play_order,
      races: n,
      stars: tally(stars, STARS * n),
      legendStars: tally(legendStars, STARS * n),
      rewrites: tally(rewrites, rewritable),
      hidden: tally(hidden, n),
      badges,
      percent: (collected / total) * 100,
    });
  }

  const sum = (pick: (e: HistoryEra) => Tally) =>
    eraList.reduce((t, e) => tally(t.have + pick(e).have, t.total + pick(e).total), tally(0, 0));
  const badgeTally = tally(
    eraList.reduce(
      (t, e) => t + Number(e.badges.cleared) + Number(e.badges.mastered) + Number(e.badges.legend),
      0,
    ),
    BADGES * eraList.length,
  );
  const collectibles = {
    stars: sum((e) => e.stars),
    legendStars: sum((e) => e.legendStars),
    rewrites: sum((e) => e.rewrites),
    hidden: sum((e) => e.hidden),
    badges: badgeTally,
  };
  const parts = Object.values(collectibles);
  const collected = parts.reduce((t, p) => t + p.have, 0);
  const total = parts.reduce((t, p) => t + p.total, 0);

  const shared = entryRows.length > 0 ? await communityOf() : {};
  const raceOf = new Map(allRaces.map((r) => [r.race_id, r]));
  const out: HistoryEntry[] = [];
  for (const e of entryRows) {
    const race = raceOf.get(e.race_id);
    const storyline = (await getErasRace(e.race_id))?.model.eras?.storyline;
    out.push({
      raceId: e.race_id,
      eraId: race?.era_id ?? 0,
      position: race?.position ?? 0,
      attemptId: e.attempt_id,
      achievedAt: e.achieved_at,
      legend: e.legend === 1,
      accuracy: e.accuracy,
      stars: attemptStars(e.result),
      headline: storyline?.headline ?? null,
      real: storyline?.real ?? null,
      community: (shared[e.race_id] ?? noCommunity()).rewrite,
    });
  }

  return {
    completion: { collected, total, percent: total > 0 ? (collected / total) * 100 : 0 },
    collectibles,
    eras: eraList,
    entries: out,
  };
}

// ---- leaderboards -------------------------------------------------------------------------

/**
 * Each player's best accuracy on the race (normal or Legend), and when an attempt first reached
 * it. Binds ?1 race, ?2 legend. The order: best accuracy, then who reached it first, then the
 * player ID, so equal boards always come out the same. Hidden players (admin) aren't on it.
 */
const BOARD = `WITH best AS (
    SELECT player_id, max(accuracy) AS accuracy FROM era_attempts
    WHERE race_id = ?1 AND legend = ?2 AND accuracy IS NOT NULL AND ${NOT_HIDDEN('player_id')}
    GROUP BY player_id),
  board AS (
    SELECT b.player_id, b.accuracy,
      (SELECT min(a.submitted_at) FROM era_attempts a
        WHERE a.race_id = ?1 AND a.legend = ?2 AND a.player_id = b.player_id
          AND a.accuracy = b.accuracy) AS reached
    FROM best b),
  ranked AS (
    SELECT player_id, accuracy,
      row_number() OVER (ORDER BY accuracy DESC, reached, player_id) AS rank,
      count(*) OVER () AS total
    FROM board)`;

interface BoardRow {
  player_id: string;
  accuracy: number;
  rank: number;
  total: number;
  name: string;
}

export async function topOfBoard(db: D1Database, raceId: string, legend: boolean) {
  const { results } = await db
    .prepare(
      `${BOARD} SELECT player_id, accuracy, rank, total,
         ${DISPLAY_NAME('ranked.player_id')} AS name
       FROM ranked ORDER BY rank LIMIT ${ERAS_LEADERBOARD_SIZE}`,
    )
    .bind(raceId, legend ? 1 : 0)
    .all<BoardRow>();
  return {
    total: results[0]?.total ?? 0,
    entries: results.map(
      (r): LeaderboardEntry => ({
        rank: r.rank,
        name: r.name || displayName(r.player_id),
        accuracy: r.accuracy,
      }),
    ),
  };
}

export async function rankOnBoard(
  db: D1Database,
  raceId: string,
  legend: boolean,
  playerId: string,
): Promise<{ rank: number; accuracy: number; total: number } | null> {
  return db
    .prepare(`${BOARD} SELECT rank, accuracy, total FROM ranked WHERE player_id = ?3`)
    .bind(raceId, legend ? 1 : 0, playerId)
    .first<{ rank: number; accuracy: number; total: number }>();
}

// ---- endpoints ----------------------------------------------------------------------------

/** The race, if this mode shows it: every Eras race on test, published and released in production. */
async function visibleRace(c: Ctx, raceId: string): Promise<void> {
  if (raceId.length > 64) throw new ApiError(404, 'no-race');
  const row = await c.env.DB.prepare(
    `SELECT r.published, e.released_at FROM era_races r JOIN eras e ON e.id = r.era_id
     WHERE r.race_id = ?`,
  )
    .bind(raceId)
    .first<{ published: number; released_at: string | null }>();
  const released = !!row?.released_at && row.released_at <= new Date().toISOString();
  if (!row || !(erasTestMode(c.env) || (released && row.published === 1))) {
    throw new ApiError(404, 'no-race');
  }
}

function legendParam(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === '0' || value === 'false') return false;
  if (value === '1' || value === 'true') return true;
  throw new ApiError(400, 'bad-request', 'legend is true or false');
}

export function registerErasHistory(app: Hono<{ Bindings: Env }>) {
  app.get('/api/history', async (c) => {
    const playerId = await playerOf(c.env.DB, c.req.query('anonId'));
    return c.json(await historyBook(c.env.DB, playerId, () => community(c)));
  });

  app.get('/api/eras/races/:raceId/stats', async (c) => {
    const raceId = c.req.param('raceId');
    await visibleRace(c, raceId);
    const stats: RaceStats = { raceId, ...((await community(c))[raceId] ?? noCommunity()) };
    return c.json(stats);
  });

  app.get('/api/eras/races/:raceId/leaderboard', async (c) => {
    const raceId = c.req.param('raceId');
    const legend = legendParam(c.req.query('legend'));
    const anonId = c.req.query('anonId');
    if (anonId !== undefined && !isAnonId(anonId)) {
      throw new ApiError(400, 'bad-request', 'anonId must be a UUID');
    }
    await visibleRace(c, raceId);
    const top = await cachedJson(c, `board/${raceId}/${legend ? 1 : 0}`, () =>
      topOfBoard(c.env.DB, raceId, legend),
    );
    const mine = anonId
      ? await rankOnBoard(c.env.DB, raceId, legend, await playerOf(c.env.DB, anonId))
      : null;
    const board: EraLeaderboard = {
      raceId,
      legend,
      size: ERAS_LEADERBOARD_SIZE,
      // The live count when the player's rank was just read, so rank <= total always holds.
      total: mine ? mine.total : top.total,
      entries: top.entries,
      me: mine ? { rank: mine.rank, accuracy: mine.accuracy } : null,
    };
    return c.json(board);
  });
}
