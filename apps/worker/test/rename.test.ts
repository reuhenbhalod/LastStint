// Migration 0009 (Eras build plan 0.1): a daily scheduled on a race under its old ID, with the
// old file's hash, is served and accepts runs once the IDs are renamed. The old file is the
// renamed file with its old ID put back (the ID is the only change), hashed the same way.

import { applyD1Migrations, env, reset } from 'cloudflare:test';
import type { RaceModel } from '@laststint/sim';
import { beforeEach, describe, expect, it } from 'vitest';
import usJson from '../../../data/races/united-states-2022.json';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { addDays } from '../src/dates.js';
import { modelHash } from '../src/races.js';
import { get, ids, submit, today } from './helpers.js';

const RENAME = '0009_rename_race_ids.sql';
const us = usJson as unknown as RaceModel;
// The old ID, built from parts so a search for old IDs finds them only in the migration.
const OLD_ID = ['usa', 2022].join('-');
const usOld = { ...us, race: { ...us.race, id: OLD_ID } };

beforeEach(async () => {
  // The database as production has it before the deploy: every migration up to 0008.
  await reset();
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name !== RENAME),
  );
});

async function scheduleOld(date: string, number: number, hash: string) {
  await env.DB.prepare(
    `INSERT INTO daily (date, race_id, seed, side, published_at, number, model_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(date, OLD_ID, us.race.seed, us.userSide, new Date().toISOString(), number, hash)
    .run();
}

async function migrate() {
  const rename = env.TEST_MIGRATIONS.filter((m) => m.name === RENAME);
  expect(rename).toHaveLength(1);
  await applyD1Migrations(env.DB, rename);
}

describe('migration 0009: renamed race IDs', () => {
  it('moves an old-ID daily to united-states-2022 and keeps it playable', async () => {
    await scheduleOld(today(), 1, await modelHash(usOld));
    // Before: the deployed Worker no longer knows the old ID, so the day is unavailable.
    expect((await get(`/api/daily?date=${today()}`)).status).toBe(503);

    await migrate();
    const res = await get(`/api/daily?date=${today()}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      raceId: 'united-states-2022',
      seed: us.race.seed,
      side: us.userSide,
      modelHash: await modelHash(us),
    });

    const run = playDailyRace(
      us,
      us.race.seed,
      (m) => m.realOptionId ?? (m.options[0]?.id as string),
    );
    const sent = await submit(ids.a, run);
    expect(sent.status).toBe(201);
  });

  it('leaves a day pinned to an older build as stale as it was', async () => {
    await scheduleOld(addDays(today(), 1), 2, 'an-older-build');
    await migrate();
    const row = await env.DB.prepare(
      'SELECT race_id, model_hash FROM daily WHERE number = 2',
    ).first<{ race_id: string; model_hash: string }>();
    expect(row).toEqual({ race_id: 'united-states-2022', model_hash: 'an-older-build' });
  });

  it('renames survivor rounds too', async () => {
    await env.DB.prepare(
      `INSERT INTO survivor_runs (id, anon_id, started_at) VALUES ('run-1', ?, ?)`,
    )
      .bind(ids.a, new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO survivor_rounds (run_id, round, race_id, seed, model_hash)
       VALUES ('run-1', 1, ?, 1, ?)`,
    )
      .bind(OLD_ID, await modelHash(usOld))
      .run();
    await migrate();
    const row = await env.DB.prepare('SELECT race_id, model_hash FROM survivor_rounds').first<{
      race_id: string;
      model_hash: string;
    }>();
    expect(row).toEqual({ race_id: 'united-states-2022', model_hash: await modelHash(us) });
  });

  it('leaves other races alone', async () => {
    await env.DB.prepare(
      `INSERT INTO daily (date, race_id, seed, side, published_at, number, model_hash)
       VALUES (?, 'abu-dhabi-2021', 1, 'HAM', ?, 3, 'h')`,
    )
      .bind(today(), new Date().toISOString())
      .run();
    await migrate();
    const row = await env.DB.prepare('SELECT race_id, model_hash FROM daily').first<{
      race_id: string;
      model_hash: string;
    }>();
    expect(row).toEqual({ race_id: 'abu-dhabi-2021', model_hash: 'h' });
  });
});
