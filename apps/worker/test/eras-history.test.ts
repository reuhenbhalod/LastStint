// Eras history book, community stats and leaderboards (src/erasHistory.ts; eras spec §8, §13;
// build plan 7.4). Every count the endpoints return is checked against D1 itself: completion,
// per-era progress and badges, rewrites, the community rewrite share and star rates, and the
// leaderboard order with Legend on its own board and ties broken deterministically.

import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import type { RaceModel } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import hungary2022Json from '../../../data/races/hungary-2022.json';
import type { EraLeaderboard, HistoryBook, RaceStats } from '../src/erasHistory.js';
import worker from '../src/index.js';
import { displayName } from '../src/names.js';
import { ERAS_RACE_FILES } from '../src/races.gen.js';
import { ids } from './helpers.js';

// Hungary 2022 (Era 10, race 3) gets a storyline in this isolate's bundle, for the headline.
ERAS_RACE_FILES['hungary-2022'] = {
  ...(hungary2022Json as unknown as RaceModel),
  eras: {
    eraId: 10,
    order: 3,
    target: { type: 'win' },
    mastery: { type: 'finish_position', position: 1, label: 'Win' },
    storyline: {
      real: 'Verstappen wins from tenth',
      rewriteCondition: { type: 'win' },
      headline: 'You held Ferrari together in Budapest',
    },
  },
};

const more = {
  d: '44444444-4444-4444-8444-444444444444',
  e: '55555555-5555-4555-8555-555555555555',
  f: '66666666-6666-4666-8666-666666666666',
};

type Mode = 'production' | 'test';

async function call(path: string, mode: Mode = 'test', vars: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request(`https://api.test${path}`),
    { ...env, ERAS_TEST_MODE: mode === 'test' ? 'true' : 'false', ...vars },
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

async function json<T>(path: string, mode: Mode = 'test', vars: Record<string, string> = {}) {
  const res = await call(path, mode, vars);
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

const T0 = '2026-11-01T10:00:00.000Z';
const at = (minutes: number) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();

async function racesOf(eraId: number): Promise<string[]> {
  const { results } = await env.DB.prepare(
    'SELECT race_id FROM era_races WHERE era_id = ? ORDER BY position',
  )
    .bind(eraId)
    .all<{ race_id: string }>();
  return results.map((r) => r.race_id);
}

async function progress(
  player: string,
  raceId: string,
  s: [number, number, number],
  options: { legend?: boolean; hidden?: boolean; accuracy?: number } = {},
) {
  await env.DB.prepare(
    `INSERT INTO era_progress (player_id, race_id, legend, star_result, star_strategist,
       star_mastery, hidden_done, best_accuracy, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      player,
      raceId,
      options.legend ? 1 : 0,
      ...s,
      options.hidden ? 1 : 0,
      options.accuracy ?? null,
      T0,
    )
    .run();
}

let attemptNo = 0;

/** An attempt as the submit stores it. `accuracy` null: stored unevaluated (no result). */
async function attempt(
  player: string,
  raceId: string,
  accuracy: number | null,
  options: {
    legend?: boolean;
    submittedAt?: string;
    rewrite?: boolean;
    stars?: [boolean, boolean, boolean];
    hash?: string;
  } = {},
): Promise<string> {
  attemptNo++;
  const id = `00000000-0000-4000-8000-${String(attemptNo).padStart(12, '0')}`;
  const [result, strategist, mastery] = options.stars ?? [false, false, false];
  const evaluated =
    accuracy === null
      ? null
      : JSON.stringify({
          raceId,
          accuracy,
          rewrite: options.rewrite ?? false,
          stars: { result, strategist, mastery },
        });
  await env.DB.prepare(
    `INSERT INTO era_attempts (id, player_id, race_id, legend, seed, decisions, accuracy, result,
       created_at, submitted_at, model_hash) VALUES (?, ?, ?, ?, 1, '[]', ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      player,
      raceId,
      options.legend ? 1 : 0,
      accuracy,
      evaluated,
      T0,
      options.submittedAt ?? T0,
      options.hash ?? 'hash-v1',
    )
    .run();
  return id;
}

async function historyEntry(player: string, raceId: string, attemptId: string, when: string) {
  await env.DB.prepare(
    'INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES (?, ?, ?, ?)',
  )
    .bind(player, raceId, attemptId, when)
    .run();
}

/** An account `id` named `name`, with `anonIds` linked to it (and itself). */
async function account(id: string, name: string, anonIds: string[] = []) {
  await env.DB.prepare(
    `INSERT INTO players (id, account_sub, email, name, created_at, display_name)
     VALUES (?, ?, '', '', ?, ?)`,
  )
    .bind(id, `sub-${id}`, T0, name)
    .run();
  for (const anon of [id, ...anonIds]) {
    await env.DB.prepare('INSERT INTO player_ids (anon_id, player_id, linked_at) VALUES (?, ?, ?)')
      .bind(anon, id, T0)
      .run();
  }
}

const count = async (sql: string, ...binds: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...binds)
      .first<{ n: number }>()
  )?.n ?? -1;

describe('GET /api/history', () => {
  it('counts every collectible exactly as D1 holds it', async () => {
    const era10 = await racesOf(10);
    const era9 = await racesOf(9);
    const era8 = await racesOf(8);
    // Era 10: every star and every Legend star (Cleared, Mastered, Legend); hidden objectives
    // on two races normally and one more on Legend only.
    for (const [i, r] of era10.entries()) {
      await progress(ids.a, r, [1, 1, 1], { hidden: i < 2 });
      await progress(ids.a, r, [1, 1, 1], { legend: true, hidden: i === 5 });
    }
    // Era 9: one star on nine races (not Cleared). Era 8: one star on all ten (Cleared).
    for (const r of era9.slice(0, 9)) await progress(ids.a, r, [1, 0, 0]);
    for (const r of era8) await progress(ids.a, r, [0, 0, 1]);
    // Three rewrites: two in Era 10 (one on Legend), one in Era 8.
    const h1 = await attempt(ids.a, 'hungary-2022', 88.5, {
      rewrite: true,
      stars: [true, true, false],
      submittedAt: at(1),
    });
    await historyEntry(ids.a, 'hungary-2022', h1, at(1));
    const h2 = await attempt(ids.a, era10[0] as string, 91, {
      legend: true,
      rewrite: true,
      stars: [true, true, true],
      submittedAt: at(2),
    });
    await historyEntry(ids.a, era10[0] as string, h2, at(2));
    const h3 = await attempt(ids.a, era8[4] as string, 70, { rewrite: true, submittedAt: at(3) });
    await historyEntry(ids.a, era8[4] as string, h3, at(3));
    // Another player's rows never count toward this one's book.
    await progress(ids.b, era9[9] as string, [1, 1, 1], { hidden: true });
    const hb = await attempt(ids.b, era9[9] as string, 60, { rewrite: true });
    await historyEntry(ids.b, era9[9] as string, hb, at(4));

    const book = await json<HistoryBook>(`/api/history?anonId=${ids.a}`);

    // By hand: 49 stars (30 + 9 + 10), 30 Legend stars, 3 rewrites, 3 hidden, 4 badges. The
    // rewrites total leaves out the races the Eras side really won (no rewrite condition: the
    // modern and reconstructed 6.2 re-authoring together; hungary-2022 has one in this isolate's
    // bundle, above).
    expect(book.collectibles).toEqual({
      stars: { have: 49, total: 300 },
      legendStars: { have: 30, total: 300 },
      rewrites: { have: 3, total: 55 },
      hidden: { have: 3, total: 100 },
      badges: { have: 4, total: 30 },
    });
    expect(book.completion).toEqual({ collected: 89, total: 785, percent: (89 / 785) * 100 });

    // And the same from D1 directly.
    const mine = 'FROM era_progress WHERE player_id = ?';
    expect(book.collectibles.stars.have).toBe(
      await count(
        `SELECT sum(star_result + star_strategist + star_mastery) AS n ${mine} AND legend = 0`,
        ids.a,
      ),
    );
    expect(book.collectibles.legendStars.have).toBe(
      await count(
        `SELECT sum(star_result + star_strategist + star_mastery) AS n ${mine} AND legend = 1`,
        ids.a,
      ),
    );
    expect(book.collectibles.rewrites.have).toBe(
      await count('SELECT count(*) AS n FROM history_entries WHERE player_id = ?', ids.a),
    );
    expect(book.collectibles.hidden.have).toBe(
      await count(`SELECT count(DISTINCT race_id) AS n ${mine} AND hidden_done = 1`, ids.a),
    );
    expect(book.collectibles.stars.total).toBe(
      3 * (await count('SELECT count(*) AS n FROM era_races')),
    );

    expect(book.eras.map((e) => e.eraId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const [e10, e9, e8, e7] = book.eras;
    expect(e10).toMatchObject({
      name: 'Ground-effect era',
      playOrder: 1,
      races: 10,
      stars: { have: 30, total: 30 },
      legendStars: { have: 30, total: 30 },
      rewrites: { have: 2, total: 6 }, // belgium-2023, hungary-2024, netherlands-2023, abu-dhabi-2022: none
      hidden: { have: 3, total: 10 },
      badges: { cleared: true, mastered: true, legend: true },
      percent: (68 / 79) * 100,
    });
    expect(e9).toMatchObject({
      stars: { have: 9, total: 30 },
      rewrites: { have: 0, total: 6 }, // styria-2021, azerbaijan-2021, portugal-2021, netherlands-2021: none (the side won)
      hidden: { have: 0, total: 10 },
      badges: { cleared: false, mastered: false, legend: false },
      percent: (9 / 79) * 100,
    });
    expect(e8).toMatchObject({
      stars: { have: 10, total: 30 },
      // nor australia-2017, australia-2018, germany-2018, germany-2019, hungary-2019, turkey-2020
      rewrites: { have: 1, total: 4 },
      badges: { cleared: true, mastered: false, legend: false },
      percent: (12 / 77) * 100,
    });
    expect(e7).toMatchObject({ stars: { have: 0, total: 30 }, percent: 0 });

    // The entries, oldest first, with the rewriting attempt's accuracy and stars, the headline
    // where the race has one, and the race's community share.
    expect(book.entries).toEqual([
      {
        raceId: 'hungary-2022',
        eraId: 10,
        position: 3,
        attemptId: h1,
        achievedAt: at(1),
        legend: false,
        accuracy: 88.5,
        stars: { result: true, strategist: true, mastery: false },
        headline: 'You held Ferrari together in Budapest',
        real: 'Verstappen wins from tenth',
        community: { players: 1, rewrites: 1, share: 1 },
      },
      expect.objectContaining({
        raceId: era10[0],
        eraId: 10,
        position: 1,
        legend: true,
        accuracy: 91,
        stars: { result: true, strategist: true, mastery: true },
        headline: 'Sainz holds Alonso off in Bahrain',
        real: expect.stringContaining('Alonso, on a later second stop, passes Sainz'),
      }),
      expect.objectContaining({ raceId: era8[4], eraId: 8, position: 5, accuracy: 70 }),
    ]);
  });

  it('a new player: nothing collected, every era listed', async () => {
    const book = await json<HistoryBook>(`/api/history?anonId=${ids.c}`);
    expect(book.completion).toEqual({ collected: 0, total: 785, percent: 0 });
    expect(book.eras).toHaveLength(10);
    expect(book.entries).toEqual([]);
  });

  it('is keyed by the account a linked anonId belongs to', async () => {
    await account(ids.c, 'Box Box', [more.d]);
    await progress(ids.c, 'hungary-2022', [1, 1, 0]);
    const viaLinked = await json<HistoryBook>(`/api/history?anonId=${more.d}`);
    expect(viaLinked.collectibles.stars.have).toBe(2);
    // The unlinked anonId's own (empty) book is separate.
    const other = await json<HistoryBook>(`/api/history?anonId=${more.e}`);
    expect(other.collectibles.stars.have).toBe(0);
  });

  it('refuses a missing or malformed anonId', async () => {
    expect((await call('/api/history')).status).toBe(400);
    expect((await call('/api/history?anonId=nope')).status).toBe(400);
  });
});

describe('GET /api/eras/races/:raceId/stats', () => {
  it('the rewrite share is rewriters over players with an evaluated attempt', async () => {
    const race = 'hungary-2022';
    // a: two attempts, the second rewrites. b: rewrites on Legend. c: never rewrites.
    // d: only an unevaluated attempt (doesn't count). e: rewrites another race only.
    await attempt(ids.a, race, 60);
    const a2 = await attempt(ids.a, race, 75, { rewrite: true });
    await historyEntry(ids.a, race, a2, T0);
    const b1 = await attempt(ids.b, race, 81, { legend: true, rewrite: true });
    await historyEntry(ids.b, race, b1, T0);
    await attempt(ids.c, race, 40);
    await attempt(more.d, race, null);
    const e1 = await attempt(more.e, 'emilia-romagna-2024', 90, { rewrite: true });
    await historyEntry(more.e, 'emilia-romagna-2024', e1, T0);
    // Star rates: three players on normal, one on Legend.
    await progress(ids.a, race, [1, 1, 0], { accuracy: 75 });
    await progress(ids.c, race, [1, 0, 0], { accuracy: 40 });
    await progress(more.f, race, [1, 1, 1], { hidden: true, accuracy: 99 });
    await progress(ids.b, race, [1, 0, 0], { legend: true, accuracy: 81 });

    const stats = await json<RaceStats>(`/api/eras/races/${race}/stats`);
    const players = await count(
      'SELECT count(DISTINCT player_id) AS n FROM era_attempts WHERE race_id = ? AND result IS NOT NULL',
      race,
    );
    const rewrites = await count(
      'SELECT count(*) AS n FROM history_entries WHERE race_id = ?',
      race,
    );
    expect([players, rewrites]).toEqual([3, 2]);
    expect(stats).toEqual({
      raceId: race,
      rewrite: { players, rewrites, share: 2 / 3 },
      stars: { players: 3, result: 1, strategist: 2 / 3, mastery: 1 / 3, hidden: 1 / 3 },
      legendStars: { players: 1, result: 1, strategist: 0, mastery: 0, hidden: 0 },
    });

    // The history book shows the same share on the entry.
    const book = await json<HistoryBook>(`/api/history?anonId=${ids.a}`);
    expect(book.entries[0]?.community).toEqual({ players: 3, rewrites: 2, share: 2 / 3 });
  });

  it('a race nobody has played: zeros', async () => {
    const stats = await json<RaceStats>('/api/eras/races/bahrain-2023/stats');
    expect(stats.rewrite).toEqual({ players: 0, rewrites: 0, share: 0 });
    expect(stats.stars.players).toBe(0);
  });

  it('is cached for CACHE_SECONDS: a new rewrite shows once the cache expires', async () => {
    const race = 'emilia-romagna-2024';
    await attempt(ids.a, race, 50);
    const vars = { CACHE_SECONDS: '60' };
    const path = `/api/eras/races/${race}/stats`;
    const first = await json<RaceStats>(path, 'test', vars);
    expect(first.rewrite).toEqual({ players: 1, rewrites: 0, share: 0 });
    const b1 = await attempt(ids.b, race, 90, { rewrite: true });
    await historyEntry(ids.b, race, b1, T0);
    expect((await json<RaceStats>(path, 'test', vars)).rewrite).toEqual(first.rewrite);
    // Uncached (CACHE_SECONDS 0, the tests' default) it reads D1 again.
    expect((await json<RaceStats>(path)).rewrite).toEqual({ players: 2, rewrites: 1, share: 0.5 });
  });

  it('production shows published races of released eras only', async () => {
    expect((await call('/api/eras/races/hungary-2022/stats', 'production')).status).toBe(404);
    await env.DB.prepare(
      "UPDATE eras SET released_at = '2026-01-01T00:00:00.000Z' WHERE id = 10",
    ).run();
    expect((await call('/api/eras/races/hungary-2022/stats', 'production')).status).toBe(404);
    await env.DB.prepare("UPDATE era_races SET published = 1 WHERE race_id = 'hungary-2022'").run();
    expect((await call('/api/eras/races/hungary-2022/stats', 'production')).status).toBe(200);
    expect((await call('/api/eras/races/no-such-race/stats')).status).toBe(404);
  });
});

describe('GET /api/eras/races/:raceId/leaderboard', () => {
  const race = 'hungary-2022';
  const board = (query = '') => json<EraLeaderboard>(`/api/eras/races/${race}/leaderboard${query}`);

  async function seedBoard() {
    await account(ids.c, 'Box Box', [more.d]);
    // a: best 80 (reached at 5), also a worse 70 and an attempt on the old race file.
    await attempt(ids.a, race, 70, { submittedAt: at(1), hash: 'hash-v0' });
    await attempt(ids.a, race, 80, { submittedAt: at(5) });
    // b: 90, top.
    await attempt(ids.b, race, 90, { submittedAt: at(9), hash: 'hash-v0' });
    // c (an account): 80 reached at 2, earlier than a; 80 again at 7 doesn't move it.
    await attempt(ids.c, race, 80, { submittedAt: at(2) });
    await attempt(ids.c, race, 80, { submittedAt: at(7) });
    // e: 80 at 2 as well: the tie with c goes to the lower player ID (c).
    await attempt(more.e, race, 80, { submittedAt: at(2) });
    // f: only an unevaluated attempt: not on the board.
    await attempt(more.f, race, null);
    // Legend is its own board: a 95 there, b 60, and nothing of it on the normal board.
    await attempt(ids.a, race, 95, { legend: true, submittedAt: at(3) });
    await attempt(ids.b, race, 60, { legend: true, submittedAt: at(3) });
  }

  it('ranks by best accuracy, ties to the first to reach it, then player ID; never reset', async () => {
    await seedBoard();
    const normal = await board();
    expect(normal).toEqual({
      raceId: race,
      legend: false,
      size: 100,
      total: 4,
      entries: [
        { rank: 1, name: displayName(ids.b), accuracy: 90 },
        { rank: 2, name: 'Box Box', accuracy: 80 },
        { rank: 3, name: displayName(more.e), accuracy: 80 },
        { rank: 4, name: displayName(ids.a), accuracy: 80 },
      ],
      me: null,
    });
    // The total is D1's: players with an evaluated attempt on the race (any race file).
    expect(normal.total).toBe(
      await count(
        `SELECT count(DISTINCT player_id) AS n FROM era_attempts
         WHERE race_id = ? AND legend = 0 AND accuracy IS NOT NULL`,
        race,
      ),
    );

    const legend = await board('?legend=true');
    expect(legend).toMatchObject({
      legend: true,
      total: 2,
      entries: [
        { rank: 1, name: displayName(ids.a), accuracy: 95 },
        { rank: 2, name: displayName(ids.b), accuracy: 60 },
      ],
    });
    expect((await board('?legend=1')).entries).toEqual(legend.entries);
    expect((await board('?legend=0')).entries).toEqual(normal.entries);
  });

  it("the player's rank, through a linked anonId, on each board", async () => {
    await seedBoard();
    expect((await board(`?anonId=${more.d}`)).me).toEqual({ rank: 2, accuracy: 80 });
    expect((await board(`?anonId=${ids.a}`)).me).toEqual({ rank: 4, accuracy: 80 });
    expect((await board(`?legend=true&anonId=${ids.a}`)).me).toEqual({ rank: 1, accuracy: 95 });
    // No Legend attempt, or only an unevaluated one: no rank.
    expect((await board(`?legend=true&anonId=${ids.c}`)).me).toBeNull();
    expect((await board(`?anonId=${more.f}`)).me).toBeNull();
  });

  it('shows the top 100 only, and the rank of a player below them', async () => {
    for (let i = 0; i < 102; i++) {
      const id = `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`;
      await attempt(id, race, 100 - i * 0.5);
    }
    const last = 'aaaaaaaa-0000-4000-8000-000000000101';
    const top = await board(`?anonId=${last}`);
    expect(top.entries).toHaveLength(100);
    expect(top.total).toBe(102);
    expect(top.entries.map((e) => e.rank)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(top.me).toEqual({ rank: 102, accuracy: 100 - 101 * 0.5 });
  });

  it('refuses a bad legend or anonId; 404 for an unknown race', async () => {
    expect((await call(`/api/eras/races/${race}/leaderboard?legend=maybe`)).status).toBe(400);
    expect((await call(`/api/eras/races/${race}/leaderboard?anonId=nope`)).status).toBe(400);
    expect((await call('/api/eras/races/no-such-race/leaderboard')).status).toBe(404);
    expect((await call(`/api/eras/races/${race}/leaderboard`, 'production')).status).toBe(404);
  });
});
