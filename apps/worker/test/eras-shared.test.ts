// Shared races (eras build plan, "Shared races"; src/erasOverlay.ts): a race in Eras and in the
// Daily or Gauntlet pool keeps its Daily file and hash, and Eras serves and pins the file
// merged with its overlay. The merge replays the Python merge's parity vectors
// (pipeline/tests/fixtures/eras_overlay_parity.json; pipeline/tests/test_shared_races.py).

import { SELF, createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { type RaceModel, initRun } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import abuOverlay from '../../../data/eras/abu-dhabi-2021.json';
import abuJson from '../../../data/races/abu-dhabi-2021.json';
import bahrainJson from '../../../data/races/bahrain-2021.json';
import franceJson from '../../../data/races/france-2021.json';
import hungary2019Json from '../../../data/races/hungary-2019.json';
import hungary2022Json from '../../../data/races/hungary-2022.json';
import russiaJson from '../../../data/races/russia-2021.json';
import vectors from '../../../pipeline/tests/fixtures/eras_overlay_parity.json';
import { getErasRace } from '../src/eras.js';
import { OVERLAY_KEYS, withErasOverlay } from '../src/erasOverlay.js';
import worker from '../src/index.js';
import { ERAS_OVERLAYS, ERAS_RACE_FILES, RACE_FILES } from '../src/races.gen.js';
import { getRace, modelHash } from '../src/races.js';

const FILES: Record<string, RaceModel> = {
  'abu-dhabi-2021': abuJson as unknown as RaceModel,
  'bahrain-2021': bahrainJson as unknown as RaceModel,
  'france-2021': franceJson as unknown as RaceModel,
  'hungary-2019': hungary2019Json as unknown as RaceModel,
  'russia-2021': russiaJson as unknown as RaceModel,
};
const SHARED = Object.keys(FILES);

// The Daily hashes as scheduled before Eras (Nov 7 2026): these never change.
const DAILY_HASHES: Record<string, string> = {
  'abu-dhabi-2021': 'f3d051610bb18897976f0a26a0e50ef73df42f1754e0e9a082d8a18520fed524',
  'bahrain-2021': '4bc64da4ef5a6684135ee9394292519717e0eea40705e9921af6616085a3a314',
  'france-2021': 'da4947b0158de2b130e491543b34a1d2e71e1235bff9add74211160ea5d0d2b1',
  'hungary-2019': '500a886adc23c5c7f014bbacbcfe929757aa13165ef52e9cf759df50ff94032d',
  'russia-2021': '038a27369e37f828e0f66081ba284c99ebf6af2e9f2e30ec0943928daedf06fa',
};
// Their Eras models' hashes (race file + the overlay as authored in step 6.2, Nov 8 2026):
// change only with the overlay.
const ERAS_HASHES: Record<string, string> = {
  'abu-dhabi-2021': 'b3bfaf94b20bca54c2f8539d5dced3e15d2106eb036715b6bfe4992021513b4a',
  'bahrain-2021': '3fc5e332a9dde5d1f108c5006fcc963f0be1b80bb6ab902b2be9355c91ddd82e',
  'france-2021': '3eb876094b718d969f3e1d2ace907a7618b3e7e33347d1069c416960598511c4',
  'hungary-2019': '084731e29cfbaffbad2da4e2f6af3634dbb2f9dc66a41bc52d33ee4ccd0d925e',
  'russia-2021': 'dab705886d335ca3156ed5e362b482d4876771391687bec0c4159917a7898c7b',
};

describe('withErasOverlay: parity with the pipeline merge (export.with_eras_fields)', () => {
  it.each(vectors.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const base = FILES[c.race] as RaceModel;
    const before = JSON.stringify(base);
    let merged = base;
    for (const overlay of c.overlays) merged = withErasOverlay(merged, overlay);
    expect(JSON.stringify(base)).toBe(before); // a copy: the race file is untouched
    // Key order is part of the hash, so compare serialisations, not just values.
    expect(Object.keys(merged)).toEqual(c.keys);
    const out = merged as unknown as Record<string, unknown>;
    for (const [key, block] of Object.entries(c.blocks)) {
      expect(JSON.stringify(out[key])).toBe(JSON.stringify(block));
    }
    expect(JSON.stringify(merged.events)).toBe(JSON.stringify(c.events));
    const input = base as unknown as Record<string, unknown>;
    for (const key of c.keys.filter((k) => !(k in c.blocks) && k !== 'events')) {
      expect(JSON.stringify(out[key])).toBe(JSON.stringify(input[key]));
    }
  });

  it('covers every overlay key and every shared race', () => {
    const used = new Set(vectors.cases.flatMap((c) => c.overlays.flatMap((o) => Object.keys(o))));
    expect([...used].sort()).toEqual([...OVERLAY_KEYS].sort());
    expect(new Set(vectors.cases.map((c) => c.race))).toEqual(new Set(SHARED));
  });

  it('refuses what the pipeline refuses', () => {
    const abu = FILES['abu-dhabi-2021'] as RaceModel;
    expect(() => withErasOverlay(abu, { decisionMoments: {} })).toThrow(
      /decisionMoments must be a list/,
    );
    expect(() => withErasOverlay(abu, { eras: { eraId: 9, order: 10, userSide: 'BOT' } })).toThrow(
      /eras.userSide BOT is neither the userSide HAM nor the rival VER/,
    );
    expect(() => withErasOverlay(abu, { rule: {} })).toThrow(/unknown Eras overlay keys rule/);
    expect(() => withErasOverlay(abu, [])).toThrow(/must be an object/);
    expect(() => withErasOverlay(abu, { rules: [1] })).toThrow(/rules must be an object/);
    expect(() => withErasOverlay(abu, { storylineEvents: [[52, 'SC']] })).toThrow(
      /no SC event on lap 52/,
    );
    expect(() => withErasOverlay(abu, { storylineEvents: [[53]] })).toThrow(/\[lap, type\]/);
    // null leaves a block as it is, as None does in Python.
    expect(withErasOverlay(abu, { eras: null })).toEqual(abu);
  });
});

describe('shared races', () => {
  it('bundles an overlay for exactly the shared races, and their Daily files untouched', () => {
    expect(Object.keys(ERAS_OVERLAYS).sort()).toEqual(SHARED);
    for (const id of SHARED) {
      expect(RACE_FILES[id]).toEqual(FILES[id]);
      expect(Object.hasOwn(ERAS_RACE_FILES, id)).toBe(false);
      expect(Object.keys(FILES[id] as RaceModel)).not.toContain('rules');
    }
  });

  it.each(SHARED)('%s: the Daily file and hash are unchanged', async (id) => {
    const daily = await getRace(id);
    expect(daily?.model).toBe(RACE_FILES[id]);
    expect(daily?.hash).toBe(DAILY_HASHES[id]);
    const res = await SELF.fetch(`https://api.test/api/races/${id}?h=${DAILY_HASHES[id]}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBe(`"${DAILY_HASHES[id]}"`);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(await res.text()).toBe(JSON.stringify(FILES[id]));
  });

  it.each(SHARED)('%s: the Eras model has the overlay and its own stable hash', async (id) => {
    const eras = await getErasRace(id);
    const want = withErasOverlay(FILES[id] as RaceModel, ERAS_OVERLAYS[id]);
    expect(eras?.model).toEqual(want);
    expect(eras?.model.rules).toEqual((ERAS_OVERLAYS[id] as { rules: unknown }).rules);
    expect(eras?.hash).toBe(ERAS_HASHES[id]);
    expect(eras?.hash).toBe(await modelHash(want));
    expect(eras?.hash).not.toBe(DAILY_HASHES[id]);
    // The same object and hash on every call (one merge per isolate).
    expect(await getErasRace(id)).toBe(eras);
    // The Daily view is unaffected by the merge.
    expect((await getRace(id))?.model.rules).toBeUndefined();
  });

  // Owner decision (Nov 8): the hard-call side wins, also on a shared race. The Eras model is
  // the other car's when the hard calls say so, with moments authored from that side, while
  // the Daily file keeps its side and moments.
  it.each(SHARED)('%s: the Eras model plays the hard-call side', async (id) => {
    const file = FILES[id] as RaceModel;
    const overlay = ERAS_OVERLAYS[id] as {
      eras: { userSide: string; hardCalls: Record<string, number> };
      decisionMoments?: unknown[];
    };
    const eras = (await getErasRace(id))?.model as RaceModel;
    const side = overlay.eras.userSide;
    expect(Object.keys(overlay.eras.hardCalls).sort()).toEqual([file.userSide, file.rival].sort());
    expect(eras.userSide).toBe(side);
    expect(eras.rival).toBe(side === file.userSide ? file.rival : file.userSide);
    expect(eras.decisionMoments).toEqual(overlay.decisionMoments ?? file.decisionMoments);
    if (side !== file.userSide) {
      expect(overlay.decisionMoments).toBeDefined();
      expect(eras.decisionMoments).not.toEqual(file.decisionMoments);
    }
    // The run's player car is the Eras side's, from its own takeover state.
    const run = initRun(eras, eras.race.seed, { decisions: [] });
    expect(run.state.cars[side]?.strategy).toEqual([]);
    const takeover = file.drivers.find((d) => d.code === side)?.stateAtTakeover;
    expect(eras.drivers.find((d) => d.code === eras.userSide)?.stateAtTakeover).toEqual(takeover);
    // The Daily view still plays its own side.
    const daily = (await getRace(id))?.model as RaceModel;
    expect([daily.userSide, daily.rival]).toEqual([file.userSide, file.rival]);
  });

  it('the Eras model route serves the merged model, pinned by its hash', async () => {
    const hash = ERAS_HASHES['abu-dhabi-2021'] as string;
    const req = new Request(`https://api.test/api/eras/races/abu-dhabi-2021/model?h=${hash}`);
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, { ...env, ERAS_TEST_MODE: 'true' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBe(`"${hash}"`);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    const body = (await res.json()) as RaceModel;
    expect(body).toEqual(withErasOverlay(FILES['abu-dhabi-2021'] as RaceModel, abuOverlay));
    expect(body.rules).toEqual(abuOverlay.rules);
  });

  it('a race in no Daily or Gauntlet pool is served as its file; a Daily-only race too', async () => {
    const hungary = await getErasRace('hungary-2022');
    expect(hungary?.model).toBe(ERAS_RACE_FILES['hungary-2022']);
    expect(hungary?.model).toEqual(hungary2022Json);
    expect(hungary?.hash).toBe(await modelHash(hungary2022Json));
    const spain = await getErasRace('spain-2020');
    expect(spain).toEqual(await getRace('spain-2020'));
  });
});
