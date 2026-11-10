// Eras account merge (Eras build plan 7.5, spec §10): signing in moves the browser's anonymous
// Eras progress to the account, keeping the best of each star per (race, legend), the best
// accuracy, every history book entry (the earlier on a clash) and every attempt.

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { Identity } from '../src/auth.js';
import { signIn } from '../src/players.js';
import { ids } from './helpers.js';

const who = (sub: string): Identity => ({
  sub,
  email: `${sub}@example.com`,
  name: sub,
  emailVerified: true,
});

const T = (d: number) => `2026-11-0${d}T12:00:00.000Z`;

async function attempt(id: string, player: string, race: string, legend = 0) {
  await env.DB.prepare(
    `INSERT INTO era_attempts (id, player_id, race_id, legend, seed, accuracy, created_at)
     VALUES (?, ?, ?, ?, 1, 0.5, ?)`,
  )
    .bind(id, player, race, legend, T(1))
    .run();
}

async function progress(
  player: string,
  race: string,
  legend: number,
  stars: [number, number, number, number],
  accuracy: number | null,
  updatedAt: string,
) {
  await env.DB.prepare(
    `INSERT INTO era_progress (player_id, race_id, legend, star_result, star_strategist,
       star_mastery, hidden_done, best_accuracy, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(player, race, legend, ...stars, accuracy, updatedAt)
    .run();
}

async function history(player: string, race: string, attemptId: string, at: string) {
  await env.DB.prepare(
    'INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES (?, ?, ?, ?)',
  )
    .bind(player, race, attemptId, at)
    .run();
}

/** Everything Eras holds, by table, in a stable order. */
async function snapshot() {
  const all = async (sql: string) => (await env.DB.prepare(sql).all()).results;
  return {
    progress: await all('SELECT * FROM era_progress ORDER BY player_id, race_id, legend'),
    history: await all('SELECT * FROM history_entries ORDER BY player_id, race_id'),
    attempts: await all('SELECT id, player_id FROM era_attempts ORDER BY id'),
  };
}

describe('Eras account merge', () => {
  it('merges an anonymous browser into the account, and a second sign-in moves nothing', async () => {
    const account = (await signIn(env.DB, who('acct'), ids.a, Date.now())).playerId;
    expect(account).toBe(ids.a);
    const anon = ids.b;

    await attempt('acc-1', account, 'bahrain-2023');
    await attempt('acc-2', account, 'styria-2021');
    await attempt('anon-1', anon, 'bahrain-2023');
    await attempt('anon-2', anon, 'styria-2021');
    await attempt('anon-3', anon, 'bahrain-2021', 1);

    // bahrain-2023, no legend: both have it, stars OR'd, accuracy max, latest update.
    await progress(account, 'bahrain-2023', 0, [1, 0, 0, 0], 0.6, T(5));
    await progress(anon, 'bahrain-2023', 0, [0, 1, 0, 1], 0.8, T(3));
    // bahrain-2023 with the legend: only the anon has it, kept separate from legend 0.
    await progress(anon, 'bahrain-2023', 1, [0, 0, 1, 0], 0.4, T(4));
    // styria-2021: the account's accuracy is unknown (NULL), the anon's wins.
    await progress(account, 'styria-2021', 0, [0, 0, 1, 0], null, T(2));
    await progress(anon, 'styria-2021', 0, [1, 0, 0, 0], 0.7, T(6));
    // bahrain-2021: the anon's accuracy is NULL, the account's stays.
    await progress(account, 'bahrain-2021', 0, [0, 0, 0, 0], 0.3, T(1));
    await progress(anon, 'bahrain-2021', 0, [0, 0, 0, 0], null, T(1));

    // History: monaco clashes (the anon's is earlier and wins), spain clashes (the account's
    // is earlier and stays), bahrain is the anon's alone.
    await history(account, 'bahrain-2023', 'acc-1', T(5));
    await history(anon, 'bahrain-2023', 'anon-1', T(2));
    await history(account, 'styria-2021', 'acc-2', T(1));
    await history(anon, 'styria-2021', 'anon-2', T(3));
    await history(anon, 'bahrain-2021', 'anon-3', T(4));

    const signed = await signIn(env.DB, who('acct'), anon, Date.now());
    expect(signed.playerId).toBe(account);

    const after = await snapshot();
    expect(after.progress).toEqual([
      {
        player_id: account,
        race_id: 'bahrain-2021',
        legend: 0,
        star_result: 0,
        star_strategist: 0,
        star_mastery: 0,
        hidden_done: 0,
        best_accuracy: 0.3,
        updated_at: T(1),
      },
      {
        player_id: account,
        race_id: 'bahrain-2023',
        legend: 0,
        star_result: 1,
        star_strategist: 1,
        star_mastery: 0,
        hidden_done: 1,
        best_accuracy: 0.8,
        updated_at: T(5),
      },
      {
        player_id: account,
        race_id: 'bahrain-2023',
        legend: 1,
        star_result: 0,
        star_strategist: 0,
        star_mastery: 1,
        hidden_done: 0,
        best_accuracy: 0.4,
        updated_at: T(4),
      },
      {
        player_id: account,
        race_id: 'styria-2021',
        legend: 0,
        star_result: 1,
        star_strategist: 0,
        star_mastery: 1,
        hidden_done: 0,
        best_accuracy: 0.7,
        updated_at: T(6),
      },
    ]);
    expect(after.history).toEqual([
      { player_id: account, race_id: 'bahrain-2021', attempt_id: 'anon-3', achieved_at: T(4) },
      { player_id: account, race_id: 'bahrain-2023', attempt_id: 'anon-1', achieved_at: T(2) },
      { player_id: account, race_id: 'styria-2021', attempt_id: 'acc-2', achieved_at: T(1) },
    ]);
    expect(after.attempts.every((a) => a.player_id === account)).toBe(true);
    expect(after.attempts).toHaveLength(5);

    // Signing in again (from either browser) changes nothing.
    await signIn(env.DB, who('acct'), anon, Date.now());
    await signIn(env.DB, who('acct'), account, Date.now());
    expect(await snapshot()).toEqual(after);
  });

  it("never moves another account's progress off a shared browser", async () => {
    // ids.a becomes account A's player ID, with A's progress under it.
    const a = (await signIn(env.DB, who('owner-a'), ids.a, Date.now())).playerId;
    await attempt('a-1', a, 'bahrain-2023');
    await progress(a, 'bahrain-2023', 0, [1, 1, 1, 1], 0.9, T(1));
    await history(a, 'bahrain-2023', 'a-1', T(1));
    const before = await snapshot();

    // Account B signs in on the same browser: it gets a fresh ID and none of A's progress.
    const b = (await signIn(env.DB, who('owner-b'), ids.a, Date.now())).playerId;
    expect(b).not.toBe(a);
    expect(await snapshot()).toEqual(before);
  });

  it('leaves progress in place when the account is made from the browser itself', async () => {
    await attempt('c-1', ids.c, 'bahrain-2023');
    await progress(ids.c, 'bahrain-2023', 0, [1, 0, 0, 0], 0.5, T(1));
    await history(ids.c, 'bahrain-2023', 'c-1', T(1));
    const before = await snapshot();

    const account = await signIn(env.DB, who('fresh'), ids.c, Date.now());
    expect(account).toMatchObject({ playerId: ids.c, created: true });
    expect(await snapshot()).toEqual(before);
  });
});
