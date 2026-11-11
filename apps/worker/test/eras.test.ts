// Eras mode API (src/eras.ts; Eras spec §5, §8, §9, §13, §16; build plan 7.2): the map, an
// era's race cards, attempts with server seeds and a 24 h expiry, the gating by release,
// publication, lock and Legend, and its bypass in test mode. Production never shows or serves
// a Draft race.

import { SELF, createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import {
  type RaceModel,
  difficultyFor,
  legendDifficulty,
  unlockThreshold,
  unlocksNextEra,
} from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import abuOverlay from '../../../data/eras/abu-dhabi-2021.json';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import hungary2022Json from '../../../data/races/hungary-2022.json';
import { ATTEMPT_TTL_MS, attemptDifficulty, erasTestMode } from '../src/eras.js';
import { withErasOverlay } from '../src/erasOverlay.js';
import worker from '../src/index.js';
import { ERAS_RACE_FILES } from '../src/races.gen.js';
import { modelHash } from '../src/races.js';
import { abu, ids } from './helpers.js';

type Mode = 'production' | 'test';

// Hungary 2022 gets a fixture Eras block, and no decision moments, in this test isolate's
// bundle so its attempts can be submitted with an empty call log (evaluation itself:
// eras-eval.test.ts).
ERAS_RACE_FILES['hungary-2022'] = {
  ...(hungary2022Json as unknown as RaceModel),
  decisionMoments: [],
  eras: {
    eraId: 10,
    order: 3,
    target: { type: 'win' },
    mastery: { type: 'finish_position', position: 1, label: 'Win' },
  },
};

// china-2018 (Era 8 #10 since migration 0023) has no Eras block yet; this isolate's bundle gets a
// stand-in race file without one (Hungary 2022's, renamed), so the "no Eras target yet" path stays
// covered whatever china-2018's real file holds.
{
  const { eras: _eras, ...noEras } = hungary2022Json as unknown as RaceModel;
  ERAS_RACE_FILES['china-2018'] = {
    ...noEras,
    race: { ...noEras.race, id: 'china-2018' },
    decisionMoments: [],
  };
}

// Every Eras race has a race file since china-2007 and brazil-1993 were built: san-marino-2005's
// is left out of this isolate's bundle, so the not-built path stays covered (china-2007 left
// Eras in migration 0020, europe-2007 in 0026).
Reflect.deleteProperty(ERAS_RACE_FILES, 'san-marino-2005');

/** A request to the Worker with ERAS_TEST_MODE set for this call. */
async function call(mode: Mode, path: string, body?: unknown): Promise<Response> {
  const req = new Request(`https://api.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    req,
    { ...env, ERAS_TEST_MODE: mode === 'test' ? 'true' : 'false' },
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

const json = async <T>(res: Response) => (await res.json()) as T;

interface Summary {
  eraId: number;
  playOrder: number;
  released: boolean;
  unlocked: boolean;
  stars: number;
  maxStars: number;
}
interface RaceCard {
  raceId: string;
  position: number;
  stars: { result: boolean; strategist: boolean; mastery: boolean };
  hiddenDone: boolean;
  bestAccuracy: number | null;
  reconstructed: boolean;
  draft: boolean;
}
interface Detail extends Summary {
  legendUnlocked: boolean;
  races: RaceCard[];
}
interface Attempt {
  attemptId: string;
  seed: number;
  modelUrl: string;
  modelHash: string;
  difficulty: unknown;
  expiresAt: string;
}

const eras = (mode: Mode, anonId = ids.a) =>
  call(mode, `/api/eras?anonId=${anonId}`).then(json<{ testMode: boolean; eras: Summary[] }>);
const era = (mode: Mode, eraId: number, anonId = ids.a) =>
  call(mode, `/api/eras/${eraId}?anonId=${anonId}`);
const start = (mode: Mode, raceId: string, legend = false, anonId = ids.a) =>
  call(mode, '/api/eras/attempts', { anonId, raceId, legend });

const PAST = '2026-01-01T00:00:00.000Z';

async function release(eraId: number, at = PAST) {
  await env.DB.prepare('UPDATE eras SET released_at = ? WHERE id = ?').bind(at, eraId).run();
}
async function publish(...raceIds: string[]) {
  for (const id of raceIds) {
    await env.DB.prepare('UPDATE era_races SET published = 1 WHERE race_id = ?').bind(id).run();
  }
}
async function publishEra(eraId: number) {
  await release(eraId);
  await env.DB.prepare('UPDATE era_races SET published = 1 WHERE era_id = ?').bind(eraId).run();
}
async function racesOf(eraId: number): Promise<string[]> {
  const { results } = await env.DB.prepare(
    'SELECT race_id FROM era_races WHERE era_id = ? ORDER BY position',
  )
    .bind(eraId)
    .all<{ race_id: string }>();
  return results.map((r) => r.race_id);
}

/** Give a player stars on a race: [result, strategist, mastery]. */
async function stars(
  raceId: string,
  s: [number, number, number],
  options: { player?: string; legend?: boolean; hidden?: boolean; accuracy?: number } = {},
) {
  await env.DB.prepare(
    `INSERT INTO era_progress (player_id, race_id, legend, star_result, star_strategist,
       star_mastery, hidden_done, best_accuracy, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      options.player ?? ids.a,
      raceId,
      options.legend ? 1 : 0,
      ...s,
      options.hidden ? 1 : 0,
      options.accuracy ?? null,
      PAST,
    )
    .run();
}

/** Give a player `n` stars spread over an era's races (3 per race, then the rest). */
async function starsInEra(eraId: number, n: number, player = ids.a) {
  const races = await racesOf(eraId);
  let left = n;
  for (const raceId of races) {
    const k = Math.min(3, left);
    if (k <= 0) break;
    await stars(raceId, [1, k >= 2 ? 1 : 0, k >= 3 ? 1 : 0], { player });
    left -= k;
  }
}

describe('eras config', () => {
  it('is in test mode only when ERAS_TEST_MODE is exactly "true"', () => {
    expect(erasTestMode({ ERAS_TEST_MODE: 'true' })).toBe(true);
    for (const v of ['false', 'TRUE', '1', '', undefined]) {
      expect(erasTestMode({ ERAS_TEST_MODE: v })).toBe(false);
    }
  });

  it('the bundled (production) config is not test mode', async () => {
    expect(env.ERAS_TEST_MODE).toBe('false');
    const res = await SELF.fetch(`https://api.test/api/eras?anonId=${ids.a}`);
    expect((await json<{ testMode: boolean }>(res)).testMode).toBe(false);
  });
});

describe('GET /api/eras', () => {
  it('a new player: ten eras in play order, Era 10 unlocked, the rest locked', async () => {
    const body = await eras('production');
    expect(body.testMode).toBe(false);
    expect(body.eras.map((e) => e.eraId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(body.eras.map((e) => e.playOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(body.eras.map((e) => e.unlocked)).toEqual([true, ...Array(9).fill(false)]);
    expect(body.eras.every((e) => e.stars === 0 && e.maxStars === 30)).toBe(true);
    expect(body.eras[0]).toMatchObject({ name: 'Ground-effect era', years: '2022–2025' });
  });

  it('released: released_at set and reached in production; always on test', async () => {
    await release(10);
    await release(9, '2999-01-01T00:00:00.000Z');
    const prod = await eras('production');
    expect(prod.eras.map((e) => e.released)).toEqual([true, ...Array(9).fill(false)]);
    const test = await eras('test');
    expect(test.testMode).toBe(true);
    expect(test.eras.every((e) => e.released)).toBe(true);
  });

  it('one star per Era 10 race (10) is not enough; Era 9 unlocks at exactly 21', async () => {
    for (const id of await racesOf(10)) await stars(id, [1, 0, 0]);
    let body = await eras('production');
    expect(body.eras[0]?.stars).toBe(10);
    expect(body.eras[1]?.unlocked).toBe(false);

    await env.DB.prepare('DELETE FROM era_progress').run();
    await starsInEra(10, 20);
    body = await eras('production');
    expect(body.eras[0]?.stars).toBe(20);
    expect(body.eras[1]?.unlocked).toBe(false);

    await env.DB.prepare('DELETE FROM era_progress').run();
    await starsInEra(10, 21);
    body = await eras('production');
    expect(body.eras[0]?.stars).toBe(21);
    expect(body.eras[1]?.unlocked).toBe(true);
    expect(body.eras[2]?.unlocked).toBe(false);
    // The same helper the web map uses (unlocksNextEra), so the two agree.
    expect(unlockThreshold(10)).toBe(21);
    for (const [i, e] of body.eras.entries()) {
      const prev = body.eras[i - 1];
      expect(e.unlocked).toBe(i === 0 || (!!prev && unlocksNextEra(prev.stars, 10)));
    }
  });

  it('counts normal stars only (Legend is separate), and only the player’s own', async () => {
    for (const id of await racesOf(10)) await stars(id, [1, 1, 1], { legend: true });
    await starsInEra(10, 30, ids.b);
    const body = await eras('production');
    expect(body.eras[0]?.stars).toBe(0);
    expect(body.eras[1]?.unlocked).toBe(false);
  });

  it('shows locks on test too, computed the same way', async () => {
    const body = await eras('test');
    expect(body.eras.map((e) => e.unlocked)).toEqual([true, ...Array(9).fill(false)]);
  });

  it('requires a player', async () => {
    expect((await call('production', '/api/eras')).status).toBe(400);
    expect((await call('production', '/api/eras?anonId=nope')).status).toBe(400);
  });

  it("keys a linked anonymous ID by its account's player ID (sign-in merge, 7.5)", async () => {
    await env.DB.prepare(
      'INSERT INTO players (id, account_sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(ids.b, 'sub-b', 'b@example.com', 'B', PAST)
      .run();
    await env.DB.prepare('INSERT INTO player_ids (anon_id, player_id, linked_at) VALUES (?, ?, ?)')
      .bind(ids.c, ids.b, PAST)
      .run();
    await stars('bahrain-2023', [1, 1, 0], { player: ids.b });
    // The stale anonymous ID and the account's ID both see the account's progress.
    expect((await eras('production', ids.c)).eras[0]?.stars).toBe(2);
    expect((await eras('production', ids.b)).eras[0]?.stars).toBe(2);
    // An attempt from the stale ID is the account's.
    await publishEra(10);
    const a = await json<Attempt>(await start('production', 'hungary-2022', false, ids.c));
    const row = await env.DB.prepare('SELECT player_id FROM era_attempts WHERE id = ?')
      .bind(a.attemptId)
      .first<{ player_id: string }>();
    expect(row?.player_id).toBe(ids.b);
  });
});

describe('GET /api/eras/:eraId', () => {
  it('test mode: all ten races, Draft badges, the player’s progress', async () => {
    await stars('hungary-2022', [1, 0, 1], { hidden: true, accuracy: 81.5 });
    const res = await era('test', 10);
    expect(res.status).toBe(200);
    const d = await json<Detail>(res);
    expect(d).toMatchObject({ eraId: 10, playOrder: 1, released: true, unlocked: true });
    expect(d.races.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(d.races.every((r) => r.draft)).toBe(true);
    expect(d.races.find((r) => r.raceId === 'hungary-2022')).toEqual({
      raceId: 'hungary-2022',
      position: 3,
      stars: { result: true, strategist: false, mastery: true },
      hiddenDone: true,
      bestAccuracy: 81.5,
      reconstructed: (hungary2022Json as unknown as RaceModel).reconstructed === true,
      draft: true,
    });
    expect(d.races.find((r) => r.raceId === 'bahrain-2023')).toMatchObject({
      stars: { result: false, strategist: false, mastery: false },
      hiddenDone: false,
      bestAccuracy: null,
      reconstructed: false,
    });
  });

  it('production: never lists a Draft race, nor any race of an unreleased era', async () => {
    let d = await json<Detail>(await era('production', 10));
    expect(d.released).toBe(false);
    expect(d.races).toEqual([]);

    await publish('bahrain-2023', 'hungary-2022');
    d = await json<Detail>(await era('production', 10));
    expect(d.races).toEqual([]); // published, but the era isn't released

    await release(10);
    d = await json<Detail>(await era('production', 10));
    expect(d.races.map((r) => r.raceId)).toEqual(['bahrain-2023', 'hungary-2022']);
    expect(d.races.every((r) => !r.draft)).toBe(true);
  });

  it('production config (SELF) hides Draft races in a released era', async () => {
    await release(9);
    await publish('abu-dhabi-2021');
    const res = await SELF.fetch(`https://api.test/api/eras/9?anonId=${ids.a}`);
    const d = await json<Detail>(res);
    expect(d.races.map((r) => r.raceId)).toEqual(['abu-dhabi-2021']);
  });

  it('legendUnlocked once the era is Cleared: a star on every race', async () => {
    const races = await racesOf(10);
    for (const id of races.slice(0, 9)) await stars(id, [1, 0, 0]);
    expect((await json<Detail>(await era('test', 10))).legendUnlocked).toBe(false);
    await stars(races[9] as string, [0, 0, 1]);
    expect((await json<Detail>(await era('test', 10))).legendUnlocked).toBe(true);
  });

  it('refuses an unknown or malformed era, or no player', async () => {
    expect((await era('test', 11)).status).toBe(404);
    expect((await call('test', `/api/eras/ten?anonId=${ids.a}`)).status).toBe(400);
    expect((await call('test', '/api/eras/10')).status).toBe(400);
  });
});

describe('POST /api/eras/attempts', () => {
  it('starts an attempt: a fresh server seed, a pinned model and the era’s difficulty', async () => {
    await publishEra(9);
    await starsInEra(10, 21);
    const res = await start('production', 'abu-dhabi-2021');
    expect(res.status).toBe(201);
    const a = await json<Attempt>(res);
    // A shared race pins its Eras model (the race file with its overlay), not the Daily file.
    const hash = await modelHash(withErasOverlay(abu, abuOverlay));
    expect(a.modelHash).toBe(hash);
    expect(a.modelHash).not.toBe(await modelHash(abuJson));
    expect(a.modelUrl).toBe(`https://api.test/api/eras/races/abu-dhabi-2021/model?h=${hash}`);
    expect(a.difficulty).toEqual(attemptDifficulty(2, false));
    const { playOrder, era: _era, ...row } = difficultyFor(2);
    expect(playOrder).toBe(2);
    expect(a.difficulty).toEqual(row);
    expect(Number.isInteger(a.seed) && a.seed >= 0 && a.seed < 2 ** 31).toBe(true);
    expect(Date.parse(a.expiresAt) - Date.now()).toBeGreaterThan(ATTEMPT_TTL_MS - 60_000);

    const stored = await env.DB.prepare('SELECT * FROM era_attempts WHERE id = ?')
      .bind(a.attemptId)
      .first<Record<string, unknown>>();
    expect(stored).toMatchObject({
      player_id: ids.a,
      race_id: 'abu-dhabi-2021',
      legend: 0,
      seed: a.seed,
      decisions: null,
      submitted_at: null,
    });

    // Seeds are dealt fresh each attempt, never derived from the race or date.
    const seeds = new Set([a.seed]);
    for (let i = 0; i < 4; i++) {
      seeds.add((await json<Attempt>(await start('production', 'abu-dhabi-2021'))).seed);
    }
    expect(seeds.size).toBeGreaterThan(1);

    // The pinned model URL serves the race file, immutably.
    const model = await call(
      'production',
      new URL(a.modelUrl).pathname + new URL(a.modelUrl).search,
    );
    expect(model.status).toBe(200);
    expect(model.headers.get('Cache-Control')).toContain('immutable');
    expect(await modelHash(await model.json())).toBe(hash);
  });

  it('Legend attempts play at Legend settings, once the era is Cleared', async () => {
    await publishEra(10);
    for (const id of await racesOf(10)) await stars(id, [1, 0, 0]);
    const res = await start('production', 'hungary-2022', true);
    expect(res.status).toBe(201);
    const a = await json<Attempt>(res);
    expect(a.difficulty).toEqual(legendDifficulty());
    const row = await env.DB.prepare('SELECT legend FROM era_attempts WHERE id = ?')
      .bind(a.attemptId)
      .first<{ legend: number }>();
    expect(row?.legend).toBe(1);
  });

  describe('production gating', () => {
    const code = async (res: Response) => ({
      status: res.status,
      error: (await json<{ error: string }>(res)).error,
    });

    it('refuses an unreleased era', async () => {
      await publish(...(await racesOf(10)));
      expect(await code(await start('production', 'hungary-2022'))).toEqual({
        status: 403,
        error: 'era-unreleased',
      });
      await release(10, '2999-01-01T00:00:00.000Z'); // scheduled, not yet reached
      expect((await code(await start('production', 'hungary-2022'))).error).toBe('era-unreleased');
    });

    it('refuses an unpublished (Draft) race', async () => {
      await release(10);
      expect(await code(await start('production', 'hungary-2022'))).toEqual({
        status: 403,
        error: 'race-unpublished',
      });
      // Through the bundled production config, too.
      const res = await SELF.fetch('https://api.test/api/eras/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: ids.a, raceId: 'hungary-2022', legend: false }),
      });
      expect(await code(res)).toEqual({ status: 403, error: 'race-unpublished' });
    });

    it('refuses a locked era (20 stars in the era before it)', async () => {
      await publishEra(9);
      await starsInEra(10, 20);
      expect(await code(await start('production', 'abu-dhabi-2021'))).toEqual({
        status: 403,
        error: 'era-locked',
      });
    });

    it('refuses Legend before the era is Cleared', async () => {
      await publishEra(10);
      await starsInEra(10, 27); // 9 races full, one with none
      expect(await code(await start('production', 'hungary-2022', true))).toEqual({
        status: 403,
        error: 'legend-locked',
      });
      expect((await start('production', 'hungary-2022', false)).status).toBe(201);
    });

    it('test mode bypasses every gate', async () => {
      // Era 9: unreleased, Draft, locked (no Era 10 stars), and not Cleared for Legend.
      for (const legend of [false, true]) {
        expect((await start('production', 'abu-dhabi-2021', legend)).status).toBe(403);
        const res = await start('test', 'abu-dhabi-2021', legend);
        expect(res.status).toBe(201);
        const a = await json<Attempt>(res);
        expect(a.difficulty).toEqual(legend ? legendDifficulty() : attemptDifficulty(2, false));
      }
    });
  });

  it('refuses a race with no race file yet, an unknown race and a bad body', async () => {
    expect(await json<{ error: string }>(await start('test', 'san-marino-2005'))).toMatchObject({
      error: 'model-missing',
    });
    expect((await start('test', 'san-marino-2005')).status).toBe(503);
    expect((await start('test', 'spain-2020')).status).toBe(404); // a Daily race, not Eras
    expect((await call('test', '/api/eras/attempts', { anonId: 'x', raceId: 'x' })).status).toBe(
      400,
    );
    expect((await call('test', '/api/eras/attempts', { anonId: ids.a })).status).toBe(400);
    expect(
      (await call('test', '/api/eras/attempts', { anonId: ids.a, raceId: 'a', legend: 'y' }))
        .status,
    ).toBe(400);
    expect((await call('test', '/api/eras/attempts', '{nope')).status).toBe(400);
  });
});

describe('GET /api/eras/races/:raceId/model', () => {
  const model = (mode: Mode, raceId: string) => call(mode, `/api/eras/races/${raceId}/model`);

  it('production serves published races of released eras only', async () => {
    expect((await model('production', 'hungary-2022')).status).toBe(404);
    await release(10);
    expect((await model('production', 'hungary-2022')).status).toBe(404); // Draft
    await publish('hungary-2022');
    const res = await model('production', 'hungary-2022');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).not.toContain('immutable'); // not pinned
  });

  it('test serves every built Eras race; never one with no file or not in Eras', async () => {
    expect((await model('test', 'hungary-2022')).status).toBe(200);
    expect((await model('test', 'san-marino-2005')).status).toBe(404);
    expect((await model('test', 'spain-2020')).status).toBe(404);
  });

  it("an Eras-only race isn't on the public race route, so a Draft can't leak there", async () => {
    expect((await SELF.fetch('https://api.test/api/races/hungary-2022')).status).toBe(404);
    // A race shared with Daily stays served there, as before.
    expect((await SELF.fetch('https://api.test/api/races/abu-dhabi-2021')).status).toBe(200);
  });
});

describe('POST /api/eras/attempts/:id', () => {
  // The fixture Hungary 2022 has no decision moments: an empty call log and no grades is a
  // whole attempt.
  const decisions: unknown[] = [];
  const submit = (id: string, body: Record<string, unknown>) =>
    call('test', `/api/eras/attempts/${id}`, { grades: [], ...body });
  const begin = async () => json<Attempt>(await start('test', 'hungary-2022'));

  it('stores the decisions and answers with the evaluated attempt', async () => {
    const a = await begin();
    const res = await submit(a.attemptId, { anonId: ids.a, decisions, modelHash: a.modelHash });
    expect(res.status).toBe(200);
    expect(await json<{ attemptId: string; raceId: string }>(res)).toMatchObject({
      attemptId: a.attemptId,
      raceId: 'hungary-2022',
    });
    const row = await env.DB.prepare(
      'SELECT decisions, submitted_at FROM era_attempts WHERE id = ?',
    )
      .bind(a.attemptId)
      .first<{ decisions: string; submitted_at: string | null }>();
    expect(JSON.parse(row?.decisions ?? 'null')).toEqual(decisions);
    expect(row?.submitted_at).not.toBeNull();
  });

  it('refuses a double submit', async () => {
    const a = await begin();
    expect((await submit(a.attemptId, { anonId: ids.a, decisions })).status).toBe(200);
    const again = await submit(a.attemptId, { anonId: ids.a, decisions });
    expect(again.status).toBe(409);
    expect((await json<{ error: string }>(again)).error).toBe('already-submitted');
  });

  it("refuses another player's attempt and an unknown one, as no attempt", async () => {
    const a = await begin();
    for (const [id, anonId] of [
      [a.attemptId, ids.b],
      ['44444444-4444-4444-8444-444444444444', ids.a],
      ['not-a-uuid', ids.a],
    ]) {
      const res = await submit(id as string, { anonId, decisions });
      expect(res.status).toBe(404);
      expect((await json<{ error: string }>(res)).error).toBe('no-attempt');
    }
    // The owner can still submit it.
    expect((await submit(a.attemptId, { anonId: ids.a, decisions })).status).toBe(200);
  });

  it('refuses an attempt older than 24 hours', async () => {
    const a = await begin();
    const old = new Date(Date.now() - ATTEMPT_TTL_MS - 1000).toISOString();
    await env.DB.prepare('UPDATE era_attempts SET created_at = ? WHERE id = ?')
      .bind(old, a.attemptId)
      .run();
    const res = await submit(a.attemptId, { anonId: ids.a, decisions });
    expect(res.status).toBe(409);
    expect((await json<{ error: string }>(res)).error).toBe('attempt-expired');
  });

  it('accepts one just inside 24 hours', async () => {
    const a = await begin();
    const recent = new Date(Date.now() - ATTEMPT_TTL_MS + 60_000).toISOString();
    await env.DB.prepare('UPDATE era_attempts SET created_at = ? WHERE id = ?')
      .bind(recent, a.attemptId)
      .run();
    expect((await submit(a.attemptId, { anonId: ids.a, decisions })).status).toBe(200);
  });

  it('refuses a race file that changed since the start, and malformed decisions', async () => {
    const a = await begin();
    const changed = await submit(a.attemptId, { anonId: ids.a, decisions, modelHash: 'abc' });
    expect(changed.status).toBe(409);
    expect((await json<{ error: string }>(changed)).error).toBe('model-changed');
    for (const bad of [undefined, 'pit', [{ kind: 'pit' }], [{ lap: 1.5, kind: 'pit' }], [null]]) {
      expect((await submit(a.attemptId, { anonId: ids.a, decisions: bad })).status).toBe(400);
    }
    expect((await submit(a.attemptId, { anonId: 'x', decisions })).status).toBe(400);
    // None of those stored anything.
    const row = await env.DB.prepare('SELECT submitted_at FROM era_attempts WHERE id = ?')
      .bind(a.attemptId)
      .first<{ submitted_at: string | null }>();
    expect(row?.submitted_at).toBeNull();
  });

  it('refuses a race whose file has no Eras target yet (503), storing nothing', async () => {
    const a = await json<Attempt>(await start('test', 'china-2018'));
    const res = await submit(a.attemptId, { anonId: ids.a, decisions });
    expect(res.status).toBe(503);
    expect((await json<{ error: string }>(res)).error).toBe('race-not-ready');
    const row = await env.DB.prepare('SELECT submitted_at FROM era_attempts WHERE id = ?')
      .bind(a.attemptId)
      .first<{ submitted_at: string | null }>();
    expect(row?.submitted_at).toBeNull();
  });
});
