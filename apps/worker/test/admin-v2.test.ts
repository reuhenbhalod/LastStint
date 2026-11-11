// Admin page v2 (docs/admin-v2-spec.md): the Today, Eras, Runs, Players, Versus, Stats and Log
// tabs' endpoints, the announcement banner, the audit log every change writes, and hidden
// players left off the daily, Gauntlet and Eras leaderboards.

import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { PlayerDetail } from '../src/adminPlayers.js';
import type { RunDetail } from '../src/adminRuns.js';
import type { AdminStats } from '../src/adminStats.js';
import type { AdminToday } from '../src/adminToday.js';
import { addDays, todayUtc } from '../src/dates.js';
import { leaderboard } from '../src/db.js';
import { topOfBoard } from '../src/erasHistory.js';
import { survivorBoard } from '../src/survivor.js';
import { idToken, schedule } from './helpers.js';

async function admin(path: string, body?: unknown, token?: string) {
  const t = token ?? (await idToken());
  return SELF.fetch(`https://api.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const json = async <T = Record<string, unknown>>(res: Response | Promise<Response>) =>
  (await (await res).json()) as T;

const today = todayUtc(Date.now());

const ann = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const bo = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const anon = '8b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

async function signIn(claims: Record<string, unknown>, anonId: string) {
  const res = await SELF.fetch('https://api.test/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: await idToken(claims), anonId }),
  });
  expect(res.status).toBe(200);
}

/** A stored daily run (the row only, as a verified submission leaves it). */
async function dailyRun(
  id: string,
  anonId: string,
  score: number,
  options: { date?: string; disqualified?: boolean; calls?: Array<[string, string, string]> } = {},
) {
  const date = options.date ?? today;
  const day = await env.DB.prepare('SELECT 1 FROM daily WHERE date = ?').bind(date).first();
  if (!day) {
    const max = await env.DB.prepare('SELECT MAX(number) AS n FROM daily').first<{ n: number }>();
    await schedule(date, { number: (max?.n ?? 0) + 1 });
  }
  const calls = options.calls ?? [['sc-stop', 'box', 'red']];
  const result = {
    raceId: 'abu-dhabi-2021',
    calls: calls.map(([momentId, chosen, band]) => ({
      momentId,
      lap: 53,
      chosen,
      band,
      points: 0,
      best: 'stay',
      real: { optionId: 'box' },
      matchedReal: chosen === 'box',
    })),
  };
  await env.DB.prepare(
    `INSERT INTO runs (id, date, anon_id, decisions, score, result, created_at, mean_probability,
       finish_position, disqualified)
     VALUES (?, ?, ?, '[]', ?, ?, ?, 0.5, 1, ?)`,
  )
    .bind(
      id,
      date,
      anonId,
      score,
      JSON.stringify(result),
      new Date().toISOString(),
      options.disqualified ? 1 : 0,
    )
    .run();
  for (const [momentId, optionId, band] of calls) {
    await env.DB.prepare(
      `INSERT INTO run_calls (run_id, date, moment_id, option_id, band, matched_real)
       VALUES (?, ?, ?, ?, ?, 0)`,
    )
      .bind(id, date, momentId, optionId, band)
      .run();
  }
}

async function gauntletRun(id: string, anonId: string, rounds: number) {
  await env.DB.prepare(
    `INSERT INTO survivor_runs (id, anon_id, status, rounds, score_sum, started_at)
     VALUES (?, ?, 'over', ?, ?, ?)`,
  )
    .bind(id, anonId, rounds, rounds * 80, new Date().toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO survivor_rounds (run_id, round, race_id, seed, model_hash, score, won, result,
       submitted_at, verified)
     VALUES (?, 1, 'spain-2020', 1, 'h', 80, 1, '{"calls":[]}', ?, 1)`,
  )
    .bind(id, new Date().toISOString())
    .run();
}

/** The first race of Era 10 (the first era played). */
async function firstEraRace(): Promise<string> {
  const row = await env.DB.prepare(
    'SELECT race_id FROM era_races WHERE era_id = 10 ORDER BY position LIMIT 1',
  ).first<{ race_id: string }>();
  return row?.race_id as string;
}

async function eraAttempt(id: string, player: string, raceId: string, accuracy: number) {
  await env.DB.prepare(
    `INSERT INTO era_attempts (id, player_id, race_id, legend, seed, decisions, accuracy, result,
       created_at, submitted_at, model_hash) VALUES (?, ?, ?, 0, 1, '[]', ?, ?, ?, ?, 'h')`,
  )
    .bind(
      id,
      player,
      raceId,
      accuracy,
      JSON.stringify({ stars: { result: true, strategist: false, mastery: false }, calls: [] }),
      new Date().toISOString(),
      new Date().toISOString(),
    )
    .run();
}

async function logActions(): Promise<string[]> {
  const { entries } = await json<{ entries: Array<{ action: string }> }>(admin('/api/admin/log'));
  return entries.map((e) => e.action);
}

describe('admin v2 access', () => {
  it('needs an admin for every new endpoint', async () => {
    const stranger = await idToken({ email: 'x@example.com' });
    const gets = [
      '/api/admin/today',
      '/api/admin/eras',
      '/api/admin/runs',
      '/api/admin/runs/daily/r1',
      `/api/admin/players/${ann}`,
      '/api/admin/versus',
      '/api/admin/stats',
      '/api/admin/log',
    ];
    const posts = [
      '/api/admin/eras/race',
      '/api/admin/eras/release',
      '/api/admin/runs/reverify',
      '/api/admin/runs/delete',
      `/api/admin/players/${ann}/name`,
      `/api/admin/players/${ann}/hide`,
      '/api/admin/announcement',
      '/api/admin/announcement/clear',
    ];
    for (const path of [...gets, ...posts]) {
      const method = gets.includes(path) ? 'GET' : 'POST';
      const none = await SELF.fetch(`https://api.test${path}`, { method });
      expect(none.status, path).toBe(401);
      const res = await admin(path, method === 'POST' ? {} : undefined, stranger);
      expect(res.status, path).toBe(403);
    }
  });
});

describe('Today', () => {
  it('shows the schedule, the queue, stale days and today’s runs', async () => {
    await schedule(today, { number: 5 });
    await schedule(addDays(today, 1), { number: 6, hash: 'old' });
    await dailyRun('r1', anon, 80);
    await dailyRun('r2', bo, 40, { disqualified: true });
    await env.DB.prepare("UPDATE runs SET verified = 1, corrected = 1 WHERE id = 'r1'").run();

    const res = await json<AdminToday>(admin('/api/admin/today'));
    expect(res.today).toBe(today);
    expect(res.days.today).toMatchObject({ number: 5, raceId: 'abu-dhabi-2021', runs: 2 });
    expect(res.days.tomorrow).toMatchObject({ number: 6, current: false });
    expect(res.queue).toEqual({ days: 2, low: true, warnUnder: 7 });
    expect(res.stale.map((d) => d.date)).toEqual([addDays(today, 1)]);
    expect(res.runs).toEqual({ total: 2, verified: 1, corrected: 1, disqualified: 1 });
  });

  it('logs the old tab’s changes too', async () => {
    await admin('/api/admin/schedule', { from: today, days: 2 });
    await admin('/api/admin/repin', {});
    await admin('/api/admin/runs/clear', { date: today });
    expect(await logActions()).toEqual(['clear-run', 'repin', 'schedule']);
  });
});

describe('announcements', () => {
  it('serves one banner at a time; admins set and clear it', async () => {
    const pub = () =>
      json<{ announcement: Record<string, unknown> | null }>(
        SELF.fetch('https://api.test/api/announcement'),
      );
    expect(await pub()).toEqual({ announcement: null });

    expect((await admin('/api/admin/announcement', { text: '' })).status).toBe(400);
    expect((await admin('/api/admin/announcement', { text: 'x', tone: 'loud' })).status).toBe(400);
    const past = new Date(Date.now() - 60_000).toISOString();
    expect((await admin('/api/admin/announcement', { text: 'x', endsAt: past })).status).toBe(400);

    const set = await admin('/api/admin/announcement', { text: 'Servers move tonight.' });
    expect(set.status).toBe(200);
    const first = (await pub()).announcement;
    expect(first).toMatchObject({ text: 'Servers move tonight.', tone: 'info', endsAt: null });

    const ends = new Date(Date.now() + 3_600_000).toISOString();
    await admin('/api/admin/announcement', {
      text: 'Daily is late.',
      tone: 'warning',
      endsAt: ends,
    });
    const second = (await pub()).announcement;
    expect(second).toMatchObject({ text: 'Daily is late.', tone: 'warning', endsAt: ends });
    expect(second?.id).not.toBe(first?.id);

    await admin('/api/admin/announcement/clear', {});
    expect(await pub()).toEqual({ announcement: null });
    expect(await logActions()).toEqual(['announcement', 'announcement', 'announcement']);
  });

  it('stops showing a banner once it ends', async () => {
    await env.DB.prepare(
      `INSERT INTO announcements (text, tone, ends_at, created_at, created_by)
       VALUES ('old', 'info', ?, ?, 'a@example.com')`,
    )
      .bind(new Date(Date.now() - 1000).toISOString(), new Date().toISOString())
      .run();
    expect(await json(SELF.fetch('https://api.test/api/announcement'))).toEqual({
      announcement: null,
    });
  });
});

describe('Eras release controls', () => {
  type Era = {
    id: number;
    status: string;
    published: number;
    releasedAt: string | null;
    races: Array<{ raceId: string; published: boolean; attempts: number; players: number }>;
  };
  const eras = async () => (await json<{ eras: Era[] }>(admin('/api/admin/eras'))).eras;

  it('lists every era with its races, attempts and players', async () => {
    const list = await eras();
    expect(list).toHaveLength(10);
    expect(list[0]?.id).toBe(10); // play order: newest first
    expect(list.every((e) => e.races.length === 10 && e.status === 'coming-soon')).toBe(true);
    const race = list[0]?.races[0]?.raceId as string;
    await eraAttempt('a1', ann, race, 80);
    await eraAttempt('a2', ann, race, 90);
    await eraAttempt('a3', bo, race, 70);
    expect((await eras())[0]?.races[0]).toMatchObject({ attempts: 3, players: 2 });
  });

  it('publishes races and releases an era only with all ten published', async () => {
    const era = (await eras())[0] as Era;
    const [first, ...rest] = era.races;
    expect((await admin('/api/admin/eras/race', { raceId: 'nope', published: true })).status).toBe(
      404,
    );
    expect(
      (await admin('/api/admin/eras/race', { raceId: first?.raceId, published: true })).status,
    ).toBe(200);
    // The guard: 1 of 10 published.
    const early = await admin('/api/admin/eras/release', { eraId: era.id, at: 'now' });
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ error: 'too-few-races' });
    const later = await admin('/api/admin/eras/release', { eraId: era.id, at: '2099-01-01' });
    expect(later.status).toBe(409);

    for (const r of rest)
      await admin('/api/admin/eras/race', { raceId: r.raceId, published: true });
    const date = await admin('/api/admin/eras/release', { eraId: era.id, at: '2099-01-01' });
    expect(await date.json()).toEqual({ eraId: era.id, releasedAt: '2099-01-01T00:00:00.000Z' });
    expect((await eras())[0]).toMatchObject({ status: 'scheduled', published: 10 });
    expect((await admin('/api/admin/eras/release', { eraId: era.id, at: 'now' })).status).toBe(200);
    expect((await eras())[0]?.status).toBe('released');

    // A released era's races stay published; clearing the release needs confirmation.
    const unpublish = await admin('/api/admin/eras/race', {
      raceId: first?.raceId,
      published: false,
    });
    expect(unpublish.status).toBe(409);
    const clear = await admin('/api/admin/eras/release', { eraId: era.id, at: null });
    expect(await clear.json()).toMatchObject({ error: 'confirm-needed' });
    await admin('/api/admin/eras/release', { eraId: era.id, at: null, confirm: true });
    expect((await eras())[0]).toMatchObject({ status: 'coming-soon', releasedAt: null });

    const actions = await logActions();
    expect(actions.filter((a) => a === 'publish')).toHaveLength(10);
    expect(actions.filter((a) => a === 'release')).toHaveLength(3);
  });
});

describe('Runs', () => {
  it('finds runs by date, player and mode, and shows a run’s calls', async () => {
    await schedule(today);
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, ann);
    await dailyRun('r1', ann, 80);
    await dailyRun('r2', anon, 40, { date: addDays(today, -1) });
    await gauntletRun('s1', ann, 3);
    await eraAttempt('a1', ann, await firstEraRace(), 75);

    type Run = { mode: string; id: string; player: { email: string } | null; result: string };
    const runs = async (q: string) =>
      (await json<{ runs: Run[] }>(admin(`/api/admin/runs${q}`))).runs;
    expect((await runs('')).map((r) => r.id).sort()).toEqual(['a1', 'r1', 's1']);
    expect((await runs(`?date=${addDays(today, -1)}`)).map((r) => r.id)).toEqual(['r2']);
    const anns = await runs('?player=ANN@example');
    expect(anns.map((r) => r.mode).sort()).toEqual(['daily', 'eras', 'gauntlet']);
    expect(anns.every((r) => r.player?.email === 'ann@example.com')).toBe(true);
    expect((await runs(`?player=${anon}`)).map((r) => r.id)).toEqual(['r2']);
    expect((await runs('?mode=gauntlet')).map((r) => [r.id, r.result])).toEqual([
      ['s1', '3 rounds'],
    ]);
    expect((await admin('/api/admin/runs?mode=nope')).status).toBe(400);

    const detail = await json<RunDetail>(admin('/api/admin/runs/daily/r1'));
    expect(detail.run).toMatchObject({ id: 'r1', raceId: 'abu-dhabi-2021', score: 80 });
    expect(detail.calls).toEqual([
      expect.objectContaining({ momentId: 'sc-stop', chosen: 'box', band: 'red', real: 'box' }),
    ]);
    const g = await json<RunDetail>(admin('/api/admin/runs/gauntlet/s1'));
    expect(g.rounds).toEqual([
      expect.objectContaining({ round: 1, raceId: 'spain-2020', won: true }),
    ]);
    expect((await admin('/api/admin/runs/daily/none')).status).toBe(404);
  });

  it('marks runs for the nightly check and deletes a daily run', async () => {
    await dailyRun('r1', ann, 80);
    await dailyRun('r2', bo, 60);
    await env.DB.prepare('UPDATE runs SET verified = 1').run();
    expect(await json(admin('/api/admin/runs/reverify', { mode: 'daily', id: 'r1' }))).toEqual({
      marked: 1,
    });
    expect(await json(admin('/api/admin/runs/reverify', { date: today }))).toEqual({ marked: 2 });
    expect((await admin('/api/admin/runs/reverify', {})).status).toBe(400);

    expect((await admin('/api/admin/runs/delete', { id: 'r2' })).status).toBe(200);
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM run_calls').first<{ n: number }>();
    expect(left?.n).toBe(1);
    expect((await admin('/api/admin/runs/delete', { id: 'r2' })).status).toBe(404);
    expect(await logActions()).toEqual(['delete-run', 'reverify', 'reverify']);
  });
});

describe('player actions', () => {
  it('shows a player’s page: runs, streak and the days behind it, browsers', async () => {
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, ann);
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, anon);
    await dailyRun('r1', ann, 80, { date: addDays(today, -1) });
    await dailyRun('r2', anon, 90);
    const p = await json<PlayerDetail>(admin(`/api/admin/players/${ann}`));
    expect(p.player).toMatchObject({ id: ann, email: 'ann@example.com', hidden: false });
    expect(p.browsers.map((b) => b.anonId).sort()).toEqual([ann, anon].sort());
    expect(p.streak).toEqual({ current: 2, best: 2, days: 2 });
    expect(p.days).toEqual([today, addDays(today, -1)]);
    expect(p.runs.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    expect((await admin('/api/admin/players/nobody')).status).toBe(404);
  });

  it('edits or clears a display name', async () => {
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, ann);
    await signIn({ sub: 'google-b', email: 'bo@example.com', name: 'Bo' }, bo);
    const name = (id: string, displayName: string) =>
      admin(`/api/admin/players/${id}/name`, { displayName });
    expect((await name(ann, 'Fast Ann')).status).toBe(200);
    expect((await name(bo, 'fast ann')).status).toBe(409);
    expect((await name(bo, '!')).status).toBe(400);
    expect(await json(name(ann, ''))).toEqual({ id: ann, displayName: '' });
    const row = await env.DB.prepare('SELECT display_name FROM players WHERE id = ?')
      .bind(ann)
      .first<{ display_name: string }>();
    expect(row?.display_name).toBe('');
    expect(await logActions()).toEqual(['player-name', 'player-name']);
  });

  it('hides a player from the daily, Gauntlet and Eras leaderboards', async () => {
    await schedule(today);
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, ann);
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, anon);
    await signIn({ sub: 'google-b', email: 'bo@example.com', name: 'Bo' }, bo);
    // Ann plays on her second browser; her Eras attempt is under her account's ID.
    await dailyRun('r1', anon, 90);
    await dailyRun('r2', bo, 50);
    await gauntletRun('s1', anon, 4);
    await gauntletRun('s2', bo, 2);
    const race = await firstEraRace();
    await eraAttempt('a1', ann, race, 90);
    await eraAttempt('a2', bo, race, 60);

    const boards = async () => ({
      daily: (await leaderboard(env.DB, today)).map((r) => r.anon_id),
      gauntlet: (await survivorBoard(env.DB, Date.now())).allTime.map((r) => r.rounds),
      eras: (await topOfBoard(env.DB, race, false)).entries.map((e) => e.accuracy),
    });
    expect(await boards()).toEqual({ daily: [anon, bo], gauntlet: [4, 2], eras: [90, 60] });

    expect(await json(admin(`/api/admin/players/${ann}/hide`, { hidden: true }))).toEqual({
      id: ann,
      hidden: true,
    });
    expect(await boards()).toEqual({ daily: [bo], gauntlet: [2], eras: [60] });
    const http = await json<{ entries: unknown[] }>(
      SELF.fetch(`https://api.test/api/daily/${today}/leaderboard`),
    );
    expect(http.entries).toHaveLength(1);
    // Their runs still count for them.
    expect(
      (await json<{ runs: unknown[] }>(admin(`/api/admin/runs?player=${ann}`))).runs,
    ).toHaveLength(3);

    await admin(`/api/admin/players/${ann}/hide`, { hidden: false });
    expect((await boards()).daily).toEqual([anon, bo]);
    expect(await logActions()).toEqual(['hide', 'hide']);
    expect((await admin('/api/admin/players/nobody/hide', { hidden: true })).status).toBe(404);
  });
});

describe('Stats', () => {
  it('sums up the daily, Gauntlet, Eras, Versus and accounts', async () => {
    await schedule(today);
    await signIn({ sub: 'google-a', email: 'ann@example.com', name: 'Ann' }, ann);
    await dailyRun('r1', ann, 80);
    await dailyRun('r2', bo, 40, { disqualified: true });
    await gauntletRun('s1', ann, 3);
    await gauntletRun('s2', bo, 3);
    await gauntletRun('s3', anon, 1);
    await env.DB.prepare(
      `INSERT INTO era_progress (player_id, race_id, legend, star_result, updated_at)
       VALUES (?, ?, 0, 1, ?)`,
    )
      .bind(ann, await firstEraRace(), new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO versus_matches (code, track, players, cars, battles, started_at, finished_at)
       VALUES ('ABCD', 'bahrain', '[]', '[]', 1, ?, ?)`,
    )
      .bind(new Date().toISOString(), new Date().toISOString())
      .run();

    const s = await json<AdminStats>(admin('/api/admin/stats'));
    expect(s.daily.days).toEqual([{ date: today, players: 2, finished: 0.5, meanScore: 60 }]);
    expect(s.daily.missed[0]).toMatchObject({
      raceId: 'abu-dhabi-2021',
      momentId: 'sc-stop',
      optionId: 'box',
      runs: 2,
      share: 1,
    });
    expect(s.gauntlet).toMatchObject({
      started: 3,
      rounds: [
        { rounds: 1, runs: 1 },
        { rounds: 3, runs: 2 },
      ],
    });
    expect(s.gauntlet.best).toMatchObject({ rounds: 3, meanScore: 80 });
    expect(s.eras.playersWithStar).toBe(1);
    expect(s.eras.eras[0]).toMatchObject({ id: 10, stars: 1, players: 1 });
    expect(s.versus).toEqual({ days: [{ date: today, matches: 1 }], total: 1 });
    expect(s.accounts).toMatchObject({ total: 1, signedInShare: 0.5, recentPlayers: 2 });
    expect(s.accounts.days).toEqual([{ date: today, signups: 1 }]);
  });
});

describe('Log', () => {
  it('lists changes newest first, filtered by action', async () => {
    await admin('/api/admin/announcement', { text: 'One' });
    await admin('/api/admin/repin', {});
    const all = await json<{ entries: Array<Record<string, unknown>> }>(admin('/api/admin/log'));
    expect(all.entries.map((e) => e.action)).toEqual(['repin', 'announcement']);
    expect(all.entries[1]).toMatchObject({
      email: 'admin@example.com',
      detail: { set: { text: 'One', tone: 'info', endsAt: null } },
    });
    const one = await json<{ entries: unknown[] }>(admin('/api/admin/log?action=repin'));
    expect(one.entries).toHaveLength(1);
    expect((await admin('/api/admin/log?action=nope')).status).toBe(400);
  });
});
