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
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0010_eras.sql');
    expect(names.slice(at - 1, at + 1)).toEqual(['0009_rename_race_ids.sql', '0010_eras.sql']);
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
    expect(races.find((r) => r.race_id === 'bahrain-2023')).toMatchObject({
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
  it('applies after 0010', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0011_era_attempt_hash.sql');
    expect(names[at - 1]).toBe('0010_eras.sql');
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

describe('migration 0012: four Eras races swapped', () => {
  const SWAPS = [
    { gone: 'brazil-2024', race_id: 'belgium-2023', era_id: 10, position: 8 },
    // great-britain-2016 left Era 7 #9 again in 0018 (for malaysia-2015).
    {
      gone: 'brazil-2016',
      race_id: 'great-britain-2016',
      era_id: 7,
      position: 9,
      later: 'malaysia-2015',
    },
    { gone: 'japan-1989', race_id: 'france-1990', era_id: 2, position: 1 },
    { gone: 'san-marino-1985', race_id: 'germany-1986', era_id: 1, position: 4 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0012_swap_eras_races.sql');
    if (!m) throw new Error('0012 missing');
    return m;
  };

  it('applies after 0011', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0012_swap_eras_races.sql');
    expect(names[at - 1]).toBe('0011_era_attempt_hash.sql');
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      const now = s.later ?? s.race_id;
      expect(races.find((r) => r.race_id === now)).toEqual({
        race_id: now,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes a removed race's attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0012 for one race, with a player who played it and another.
    await env.DB.prepare(
      "UPDATE era_races SET race_id = 'brazil-2024' WHERE race_id = 'belgium-2023'",
    ).run();
    const now = new Date().toISOString();
    for (const [id, race] of [
      ['a-old', 'brazil-2024'],
      ['a-kept', 'abu-dhabi-2021'],
    ]) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    const belgium = await env.DB.prepare(
      "SELECT era_id, position FROM era_races WHERE race_id = 'belgium-2023'",
    ).first();
    expect(belgium).toEqual({ era_id: 10, position: 8 });
  });
});

describe('migration 0013: three more Eras races swapped (Era 10 and Era 9)', () => {
  const SWAPS = [
    { gone: 'monaco-2022', race_id: 'bahrain-2023', era_id: 10, position: 1 },
    { gone: 'spain-2021', race_id: 'styria-2021', era_id: 9, position: 2 },
    { gone: 'saudi-arabia-2021', race_id: 'great-britain-2021', era_id: 9, position: 9 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0013_swap_eras_races_e10_e9.sql');
    if (!m) throw new Error('0013 missing');
    return m;
  };

  it('applies after 0012', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0013_swap_eras_races_e10_e9.sql');
    expect(names[at - 1]).toBe('0012_swap_eras_races.sql');
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes a removed race's attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0013 for one race, with a player who played it and another.
    await env.DB.prepare(
      "UPDATE era_races SET race_id = 'saudi-arabia-2021' WHERE race_id = 'great-britain-2021'",
    ).run();
    const now = new Date().toISOString();
    for (const [id, race] of [
      ['a-old', 'saudi-arabia-2021'],
      ['a-kept', 'abu-dhabi-2021'],
    ]) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    const britain = await env.DB.prepare(
      "SELECT era_id, position FROM era_races WHERE race_id = 'great-britain-2021'",
    ).first();
    expect(britain).toEqual({ era_id: 9, position: 9 });
  });
});

describe('migration 0014: five more Eras races swapped (Era 10 and Era 9, second batch)', () => {
  const SWAPS = [
    { gone: 'great-britain-2022', race_id: 'great-britain-2023', era_id: 10, position: 2 },
    { gone: 'singapore-2023', race_id: 'japan-2023', era_id: 10, position: 4 },
    { gone: 'miami-2024', race_id: 'emilia-romagna-2024', era_id: 10, position: 6 },
    { gone: 'monaco-2025', race_id: 'abu-dhabi-2022', era_id: 10, position: 10 },
    { gone: 'brazil-2021', race_id: 'netherlands-2021', era_id: 9, position: 8 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0014_swap_eras_races_e10_e9_b.sql');
    if (!m) throw new Error('0014 missing');
    return m;
  };

  it('applies after 0013', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0014_swap_eras_races_e10_e9_b.sql');
    expect(names[at - 1]).toBe('0013_swap_eras_races_e10_e9.sql');
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0014 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'abu-dhabi-2021'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0015: australia-2025 swapped for saudi-arabia-2023 (Era 10, third batch)', () => {
  const SWAP = { gone: 'australia-2025', race_id: 'saudi-arabia-2023', era_id: 10, position: 9 };
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0015_swap_eras_races_e10_c.sql');
    if (!m) throw new Error('0015 missing');
    return m;
  };

  it('applies after 0014', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names.indexOf('0015_swap_eras_races_e10_c.sql')).toBeGreaterThan(
      names.indexOf('0014_swap_eras_races_e10_e9_b.sql'),
    );
  });

  it("puts the new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    expect(races.find((r) => r.race_id === SWAP.race_id)).toEqual({
      race_id: SWAP.race_id,
      era_id: SWAP.era_id,
      position: SWAP.position,
      published: 0,
    });
    expect(races.find((r) => r.race_id === SWAP.gone)).toBeUndefined();
  });

  it("deletes the removed race's attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0015, with a player who played the removed race and one race
    // that stays.
    await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
      .bind(SWAP.gone, SWAP.race_id)
      .run();
    const now = new Date().toISOString();
    const played = [
      ['a-old', SWAP.gone],
      ['a-kept', 'abu-dhabi-2021'],
    ] as const;
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
      .bind(SWAP.race_id)
      .first();
    expect(row).toEqual({ era_id: SWAP.era_id, position: SWAP.position });
  });
});

describe('migration 0016: an Era 9 race swapped (stats-picked, owner pre-approved Nov 9)', () => {
  const SWAPS = [{ gone: 'hungary-2021', race_id: 'portugal-2021', era_id: 9, position: 5 }];
  const NAME = '0016_swap_eras_races_e9.sql';
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === NAME);
    if (!m) throw new Error('0016 missing');
    return m;
  };

  it('applies after 0014', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names.indexOf(NAME)).toBeGreaterThan(names.indexOf('0014_swap_eras_races_e10_e9_b.sql'));
  });

  it("puts the new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed race's attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0016, with a player who played the removed race and one race
    // that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'abu-dhabi-2021'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0017: three Era 8 races swapped', () => {
  const SWAPS = [
    { gone: 'monaco-2017', race_id: 'australia-2017', era_id: 8, position: 1 },
    { gone: 'azerbaijan-2017', race_id: 'australia-2018', era_id: 8, position: 2 },
    { gone: 'russia-2018', race_id: 'spain-2017', era_id: 8, position: 4 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0017_swap_eras_races_era8.sql');
    if (!m) throw new Error('0017 missing');
    return m;
  };

  it('applies after 0014', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names.indexOf('0017_swap_eras_races_era8.sql')).toBeGreaterThan(
      names.indexOf('0014_swap_eras_races_e10_e9_b.sql'),
    );
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0017 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'germany-2018'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['germany-2018']);
    expect(await ids('era_progress')).toEqual(['germany-2018']);
    expect(await ids('history_entries')).toEqual(['germany-2018']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0018: six Era 7 races swapped (picked by robust G1)', () => {
  const SWAPS = [
    { gone: 'canada-2014', race_id: 'brazil-2014', era_id: 7, position: 2 },
    { gone: 'hungary-2014', race_id: 'canada-2016', era_id: 7, position: 3 },
    { gone: 'monaco-2015', race_id: 'singapore-2014', era_id: 7, position: 4 },
    { gone: 'hungary-2015', race_id: 'abu-dhabi-2015', era_id: 7, position: 5 },
    { gone: 'monaco-2016', race_id: 'bahrain-2015', era_id: 7, position: 8 },
    { gone: 'great-britain-2016', race_id: 'malaysia-2015', era_id: 7, position: 9 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0018_swap_eras_races_era7.sql');
    if (!m) throw new Error('0018 missing');
    return m;
  };

  it('applies after 0014', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0018_swap_eras_races_era7.sql');
    expect(at).toBeGreaterThan(names.indexOf('0014_swap_eras_races_e10_e9_b.sql'));
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0018 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'abu-dhabi-2021'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0019: three Era 6 races swapped (worst robust-G1 first)', () => {
  const SWAPS = [
    { gone: 'monaco-2011', race_id: 'italy-2010', era_id: 6, position: 4 },
    { gone: 'canada-2011', race_id: 'australia-2013', era_id: 6, position: 5 },
    { gone: 'australia-2010', race_id: 'bahrain-2012', era_id: 6, position: 1 },
  ];
  const NAME = '0019_swap_eras_races_e6.sql';
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === NAME);
    if (!m) throw new Error('0019 missing');
    return m;
  };

  it('applies after every earlier swap', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf(NAME);
    expect(at).toBeGreaterThan(names.indexOf('0014_swap_eras_races_e10_e9_b.sql'));
    expect(names.slice(0, at).every((n) => n < NAME)).toBe(true);
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0019 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'abu-dhabi-2010'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2010']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2010']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2010']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0020: seven Era 5 races swapped (overnight, by stats)', () => {
  const SWAPS = [
    { gone: 'japan-2005', race_id: 'europe-2009', era_id: 5, position: 2 },
    { gone: 'hungary-2006', race_id: 'france-2007', era_id: 5, position: 3 },
    { gone: 'brazil-2006', race_id: 'san-marino-2006', era_id: 5, position: 4 },
    { gone: 'china-2007', race_id: 'great-britain-2007', era_id: 5, position: 5 },
    { gone: 'monaco-2008', race_id: 'bahrain-2006', era_id: 5, position: 8 },
    { gone: 'brazil-2008', race_id: 'turkey-2008', era_id: 5, position: 9 },
    { gone: 'brazil-2009', race_id: 'malaysia-2006', era_id: 5, position: 10 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0020_swap_eras_races_era5.sql');
    if (!m) throw new Error('0020 missing');
    return m;
  };

  it('applies after 0014', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names.indexOf('0020_swap_eras_races_era5.sql')).toBeGreaterThan(
      names.indexOf('0014_swap_eras_races_e10_e9_b.sql'),
    );
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0020 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'abu-dhabi-2021'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['abu-dhabi-2021']);
    expect(await ids('era_progress')).toEqual(['abu-dhabi-2021']);
    expect(await ids('history_entries')).toEqual(['abu-dhabi-2021']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0021: seven Era 4 races swapped', () => {
  const SWAPS = [
    { gone: 'germany-2000', race_id: 'canada-2003', era_id: 4, position: 1 },
    { gone: 'malaysia-2001', race_id: 'san-marino-2000', era_id: 4, position: 3 },
    { gone: 'brazil-2003', race_id: 'hungary-2001', era_id: 4, position: 5 },
    { gone: 'hungary-2003', race_id: 'austria-2001', era_id: 4, position: 6 },
    { gone: 'united-states-2003', race_id: 'france-2001', era_id: 4, position: 7 },
    { gone: 'japan-2003', race_id: 'italy-2001', era_id: 4, position: 8 },
    { gone: 'monaco-2004', race_id: 'san-marino-2003', era_id: 4, position: 10 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0021_swap_eras_races_era4.sql');
    if (!m) throw new Error('0021 missing');
    return m;
  };

  it('applies after 0014', () => {
    // 0015-0020 belong to other swap batches; this one only needs to follow 0014.
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names.indexOf('0021_swap_eras_races_era4.sql')).toBeGreaterThan(
      names.indexOf('0014_swap_eras_races_e10_e9_b.sql'),
    );
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0021 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'japan-2000'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['japan-2000']);
    expect(await ids('era_progress')).toEqual(['japan-2000']);
    expect(await ids('history_entries')).toEqual(['japan-2000']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0022: three Era 3 races swapped (stats picks)', () => {
  const SWAPS = [
    { gone: 'belgium-1998', race_id: 'germany-1996', era_id: 3, position: 8 },
    { gone: 'malaysia-1999', race_id: 'germany-1997', era_id: 3, position: 9 },
    { gone: 'europe-1999', race_id: 'san-marino-1999', era_id: 3, position: 10 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0022_swap_eras_races_era3.sql');
    if (!m) throw new Error('0022 missing');
    return m;
  };

  it('applies after 0014', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0022_swap_eras_races_era3.sql');
    expect(at).toBeGreaterThan(names.indexOf('0014_swap_eras_races_e10_e9_b.sql'));
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
    // hungary-1997 stays in its slot.
    expect(races.find((r) => r.race_id === 'hungary-1997')).toMatchObject({
      era_id: 3,
      position: 5,
    });
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0022 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'hungary-1997'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['hungary-1997']);
    expect(await ids('era_progress')).toEqual(['hungary-1997']);
    expect(await ids('history_entries')).toEqual(['hungary-1997']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});

describe('migration 0023: the last two failing Era 8 races swapped (stats picks)', () => {
  it('applies after 0022', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names.indexOf('0023_swap_eras_races_era8_b.sql')).toBeGreaterThan(
      names.indexOf('0022_swap_eras_races_era3.sql'),
    );
  });
});

describe('migration 0024: two more Era 7 races swapped (stats picks, third round)', () => {
  const SWAPS = [
    { gone: 'bahrain-2014', race_id: 'united-states-2014', era_id: 7, position: 1 },
    { gone: 'united-states-2015', race_id: 'germany-2016', era_id: 7, position: 6 },
  ];
  const migration = () => {
    const m = env.TEST_MIGRATIONS.find((x) => x.name === '0024_swap_eras_races_era7_c.sql');
    if (!m) throw new Error('0024 missing');
    return m;
  };

  it('applies after 0022', () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    const at = names.indexOf('0024_swap_eras_races_era7_c.sql');
    expect(at).toBeGreaterThan(names.indexOf('0022_swap_eras_races_era3.sql'));
    expect(at).toBeGreaterThan(names.indexOf('0018_swap_eras_races_era7.sql'));
  });

  it("puts each new race in the old one's era and position, still Draft", async () => {
    const races = await all<EraRace>('SELECT * FROM era_races');
    expect(races).toHaveLength(100);
    for (const s of SWAPS) {
      expect(races.find((r) => r.race_id === s.race_id)).toEqual({
        race_id: s.race_id,
        era_id: s.era_id,
        position: s.position,
        published: 0,
      });
      expect(races.find((r) => r.race_id === s.gone)).toBeUndefined();
    }
  });

  it("deletes the removed races' attempts, stars and history entries, and keeps the rest", async () => {
    // Back to the state before 0024 for every swap, with a player who played each removed race
    // and one race that stays.
    for (const s of SWAPS) {
      await env.DB.prepare('UPDATE era_races SET race_id = ?1 WHERE race_id = ?2')
        .bind(s.gone, s.race_id)
        .run();
    }
    const now = new Date().toISOString();
    const played = [
      ...SWAPS.map((s, i) => [`a-old-${i}`, s.gone] as const),
      ['a-kept', 'brazil-2014'] as const,
    ];
    for (const [id, race] of played) {
      await env.DB.prepare(
        `INSERT INTO era_attempts (id, player_id, race_id, seed, created_at) VALUES (?1, 'p1', ?2, 1, ?3)`,
      )
        .bind(id, race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO era_progress (player_id, race_id, star_result, updated_at) VALUES ('p1', ?1, 1, ?2)`,
      )
        .bind(race, now)
        .run();
      await env.DB.prepare(
        `INSERT INTO history_entries (player_id, race_id, attempt_id, achieved_at) VALUES ('p1', ?1, ?2, ?3)`,
      )
        .bind(race, id, now)
        .run();
    }
    await env.DB.batch(migration().queries.map((q) => env.DB.prepare(q)));

    const ids = async (table: string) =>
      (await all<{ race_id: string }>(`SELECT race_id FROM ${table}`)).map((r) => r.race_id);
    expect(await ids('era_attempts')).toEqual(['brazil-2014']);
    expect(await ids('era_progress')).toEqual(['brazil-2014']);
    expect(await ids('history_entries')).toEqual(['brazil-2014']);
    for (const s of SWAPS) {
      const row = await env.DB.prepare('SELECT era_id, position FROM era_races WHERE race_id = ?1')
        .bind(s.race_id)
        .first();
      expect(row, s.race_id).toEqual({ era_id: s.era_id, position: s.position });
    }
  });
});
