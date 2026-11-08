// Migration 0010 (Eras build plan 7.1): the Eras tables, seeded with the ten eras and their 100
// races (Eras spec §4, §12). Every race starts as Draft and every era unreleased (spec §16).
// The seeded races must match data/pools.json's eras block, the other list of them.

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import pools from '../../../data/pools.json';

type Era = { id: number; name: string; years: string; play_order: number; released_at: null };
type EraRace = { race_id: string; era_id: number; position: number; published: number };

async function all<T>(sql: string): Promise<T[]> {
  return (await env.DB.prepare(sql).all<T>()).results;
}

describe('migration 0010: eras', () => {
  it('applies after 0001-0009', () => {
    expect(env.TEST_MIGRATIONS.map((m) => m.name).slice(-3, -1)).toEqual([
      '0009_rename_race_ids.sql',
      '0010_eras.sql',
    ]);
  });

  it('seeds ten unreleased eras, Era 10 first in play order', async () => {
    const eras = await all<Era>('SELECT * FROM eras ORDER BY play_order');
    expect(eras).toHaveLength(10);
    expect(eras.map((e) => e.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(eras[0]).toMatchObject({ id: 10, name: 'Ground-effect era', years: '2022–2025' });
    expect(eras[9]).toMatchObject({ id: 1, name: 'Turbo era', years: '1983–1988' });
    expect(eras.every((e) => e.released_at === null)).toBe(true);
  });

  it('seeds 100 Draft races, ten per era at positions 1-10', async () => {
    const races = await all<EraRace>('SELECT * FROM era_races ORDER BY era_id, position');
    expect(races).toHaveLength(100);
    expect(races.every((r) => r.published === 0)).toBe(true);
    for (let era = 1; era <= 10; era++) {
      expect(
        races.filter((r) => r.era_id === era).map((r) => r.position),
        `era ${era}`,
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
    expect(races.find((r) => r.race_id === 'monaco-2022')).toMatchObject({
      era_id: 10,
      position: 1,
    });
    expect(races.find((r) => r.race_id === 'monaco-1988')).toMatchObject({
      era_id: 1,
      position: 10,
    });
  });

  it('matches the eras block in data/pools.json', async () => {
    const races = await all<EraRace>('SELECT * FROM era_races ORDER BY era_id, position');
    const seeded = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        String(i + 1),
        races.filter((r) => r.era_id === i + 1).map((r) => r.race_id),
      ]),
    );
    expect(seeded).toEqual(pools.eras);
  });

  it('keeps play order unique and positions unique within an era', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO eras (id, name, years, play_order) VALUES (11, 'x', 'x', 1)",
      ).run(),
    ).rejects.toThrow(/UNIQUE/);
    await expect(
      env.DB.prepare(
        "INSERT INTO era_races (race_id, era_id, position) VALUES ('x-2000', 10, 1)",
      ).run(),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('only takes attempts on Eras races', async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at)
         VALUES ('a1', 'p1', 'not-an-era-race-2000', 1, ?)`,
      )
        .bind(new Date().toISOString())
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    await env.DB.prepare(
      `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at)
       VALUES ('a1', 'p1', 'abu-dhabi-2021', 1, ?)`,
    )
      .bind(new Date().toISOString())
      .run();
    const row = await env.DB.prepare('SELECT legend, untimed, decisions FROM era_attempts').first();
    expect(row).toEqual({ legend: 0, untimed: 0, decisions: null });
  });
});

describe('migration 0011: the pinned hash and nightly columns on era_attempts', () => {
  it('applies last, after 0010', () => {
    expect(env.TEST_MIGRATIONS.map((m) => m.name).at(-1)).toBe('0011_era_attempt_hash.sql');
  });

  it('adds model_hash, grades, rival_claims, verified and corrected', async () => {
    await env.DB.prepare(
      `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at)
       VALUES ('a1', 'p1', 'abu-dhabi-2021', 1, ?)`,
    )
      .bind(new Date().toISOString())
      .run();
    const row = await env.DB.prepare(
      'SELECT model_hash, grades, rival_claims, verified, corrected FROM era_attempts',
    ).first();
    expect(row).toEqual({
      model_hash: null,
      grades: null,
      rival_claims: null,
      verified: 0,
      corrected: 0,
    });
  });
});
