// The admin page's Stats tab (docs/admin-v2-spec.md A4): the numbers needed to run the game,
// from data already stored (no tracking added). Days are UTC dates; "recent" is the last
// STATS_DAYS days, the missed calls the last MISSED_DAYS.
//
//   GET /api/admin/stats   AdminStats

import type { Hono } from 'hono';
import { requireAdmin } from './admin.js';
import { addDays, todayUtc } from './dates.js';
import type { Env } from './index.js';
import { displayName } from './names.js';
import { DISPLAY_NAME } from './players.js';
import { getRace } from './races.js';

export const STATS_DAYS = 30;
export const MISSED_DAYS = 7;
export const MISSED_LIMIT = 10;

export interface AdminStats {
  from: string;
  to: string;
  daily: {
    /** One row per day with runs: players, the share who finished (not disqualified), mean score. */
    days: Array<{ date: string; players: number; finished: number; meanScore: number }>;
    /** The calls most often graded orange or red on recent days. */
    missed: Array<{
      date: string;
      raceId: string;
      raceName: string;
      momentId: string;
      lap: number | null;
      optionId: string;
      option: string;
      runs: number;
      /** Of that day's runs. */
      share: number;
    }>;
  };
  gauntlet: {
    started: number;
    startedRecent: number;
    /** Rounds survived (races won) -> runs. */
    rounds: Array<{ rounds: number; runs: number }>;
    best: { name: string; rounds: number; meanScore: number; date: string } | null;
  };
  eras: {
    eras: Array<{ id: number; name: string; attempts: number; stars: number; players: number }>;
    /** Players with at least one star anywhere. */
    playersWithStar: number;
  };
  versus: { days: Array<{ date: string; matches: number }>; total: number };
  accounts: {
    total: number;
    days: Array<{ date: string; signups: number }>;
    /** Of the browsers that played a daily recently, the share linked to an account. */
    signedInShare: number;
    recentPlayers: number;
  };
}

/** One era_progress row's stars (normal, not Legend). */
const STARS = 'star_result + star_strategist + star_mastery';

export async function adminStats(db: D1Database, now: number): Promise<AdminStats> {
  const to = todayUtc(now);
  const from = addDays(to, -(STATS_DAYS - 1));
  const missedFrom = addDays(to, -(MISSED_DAYS - 1));
  const rows = await db.batch([
    db
      .prepare(
        `SELECT date, COUNT(*) AS players,
                SUM(CASE WHEN disqualified = 0 THEN 1 ELSE 0 END) AS finished,
                AVG(score) AS mean
         FROM runs WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
      )
      .bind(from, to),
    db
      .prepare(
        `SELECT c.date, c.moment_id, c.option_id, COUNT(*) AS n,
                (SELECT COUNT(*) FROM runs r WHERE r.date = c.date) AS runs,
                (SELECT race_id FROM daily d WHERE d.date = c.date) AS race_id
         FROM run_calls c WHERE c.date BETWEEN ? AND ? AND c.band IN ('orange', 'red')
         GROUP BY c.date, c.moment_id, c.option_id ORDER BY n DESC, c.date DESC LIMIT ?`,
      )
      .bind(missedFrom, to, MISSED_LIMIT),
    db
      .prepare(
        'SELECT COUNT(*) AS n, SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS recent FROM survivor_runs',
      )
      .bind(`${from}T00:00:00.000Z`),
    db.prepare(
      'SELECT rounds, COUNT(*) AS runs FROM survivor_runs GROUP BY rounds ORDER BY rounds',
    ),
    db.prepare(
      `SELECT anon_id, rounds, score_sum, started_at, ${DISPLAY_NAME('survivor_runs.anon_id')} AS name
       FROM survivor_runs WHERE rounds > 0
       ORDER BY rounds DESC, score_sum DESC, started_at LIMIT 1`,
    ),
    db.prepare(
      `SELECT e.id, e.name,
              (SELECT COUNT(*) FROM era_attempts a JOIN era_races r ON r.race_id = a.race_id
                WHERE r.era_id = e.id AND a.submitted_at IS NOT NULL) AS attempts,
              (SELECT COALESCE(SUM(${STARS}), 0) FROM era_progress p
                JOIN era_races r ON r.race_id = p.race_id
                WHERE r.era_id = e.id AND p.legend = 0) AS stars,
              (SELECT COUNT(DISTINCT p.player_id) FROM era_progress p
                JOIN era_races r ON r.race_id = p.race_id
                WHERE r.era_id = e.id AND p.legend = 0 AND ${STARS} > 0) AS players
       FROM eras e ORDER BY e.play_order`,
    ),
    db.prepare(
      `SELECT COUNT(DISTINCT player_id) AS n FROM era_progress WHERE legend = 0 AND ${STARS} > 0`,
    ),
    db
      .prepare(
        `SELECT substr(finished_at, 1, 10) AS date, COUNT(*) AS matches FROM versus_matches
         WHERE finished_at >= ? GROUP BY date ORDER BY date`,
      )
      .bind(`${from}T00:00:00.000Z`),
    db.prepare('SELECT COUNT(*) AS n FROM versus_matches'),
    db.prepare('SELECT COUNT(*) AS n FROM players'),
    db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS signups FROM players
         WHERE created_at >= ? GROUP BY date ORDER BY date`,
      )
      .bind(`${from}T00:00:00.000Z`),
    db
      .prepare(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN anon_id IN (SELECT anon_id FROM player_ids) THEN 1 ELSE 0 END) AS linked
         FROM (SELECT DISTINCT anon_id FROM runs WHERE date BETWEEN ? AND ?)`,
      )
      .bind(from, to),
  ]);
  const at = <T>(i: number) => (rows[i]?.results ?? []) as T[];
  const one = <T>(i: number) => at<T>(i)[0];

  const missed: AdminStats['daily']['missed'] = [];
  for (const m of at<{
    date: string;
    moment_id: string;
    option_id: string;
    n: number;
    runs: number;
    race_id: string | null;
  }>(1)) {
    const race = m.race_id ? await getRace(m.race_id) : null;
    const moment = race?.model.decisionMoments.find((x) => x.id === m.moment_id);
    missed.push({
      date: m.date,
      raceId: m.race_id ?? '',
      raceName: race?.model.race.name ?? m.race_id ?? '',
      momentId: m.moment_id,
      lap: moment?.lap ?? null,
      optionId: m.option_id,
      option: moment?.options.find((o) => o.id === m.option_id)?.label ?? m.option_id,
      runs: m.n,
      share: m.runs ? m.n / m.runs : 0,
    });
  }

  const best = one<{
    anon_id: string;
    rounds: number;
    score_sum: number;
    started_at: string;
    name: string;
  }>(4);
  const gauntlet = one<{ n: number; recent: number | null }>(2);
  const recent = one<{ n: number; linked: number | null }>(11);

  return {
    from,
    to,
    daily: {
      days: at<{ date: string; players: number; finished: number; mean: number }>(0).map((d) => ({
        date: d.date,
        players: d.players,
        finished: d.players ? d.finished / d.players : 0,
        meanScore: Math.round(d.mean * 10) / 10,
      })),
      missed,
    },
    gauntlet: {
      started: gauntlet?.n ?? 0,
      startedRecent: gauntlet?.recent ?? 0,
      rounds: at<{ rounds: number; runs: number }>(3),
      best: best
        ? {
            name: best.name || displayName(best.anon_id),
            rounds: best.rounds,
            meanScore: Math.round((best.score_sum / best.rounds) * 10) / 10,
            date: best.started_at.slice(0, 10),
          }
        : null,
    },
    eras: {
      eras: at<{ id: number; name: string; attempts: number; stars: number; players: number }>(5),
      playersWithStar: one<{ n: number }>(6)?.n ?? 0,
    },
    versus: {
      days: at<{ date: string; matches: number }>(7),
      total: one<{ n: number }>(8)?.n ?? 0,
    },
    accounts: {
      total: one<{ n: number }>(9)?.n ?? 0,
      days: at<{ date: string; signups: number }>(10),
      signedInShare: recent?.n ? (recent.linked ?? 0) / recent.n : 0,
      recentPlayers: recent?.n ?? 0,
    },
  };
}

export function registerAdminStats(app: Hono<{ Bindings: Env }>) {
  app.get('/api/admin/stats', async (c) => {
    await requireAdmin(c);
    return c.json(await adminStats(c.env.DB, Date.now()));
  });
}
