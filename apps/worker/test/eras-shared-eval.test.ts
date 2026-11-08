// A shared race's Eras attempt (eras build plan, "Shared races") is pinned to and evaluated
// from its race file merged with its overlay, never the Daily file. Here Abu Dhabi 2021's
// overlay gets an Eras target and mastery (its Daily file has none, so evaluating the Daily
// file can't succeed).

import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { type ErasBlock, type RaceModel, difficultyFor } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import abuOverlay from '../../../data/eras/abu-dhabi-2021.json';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { getErasRace } from '../src/eras.js';
import { EraRaceNotReadyError, evaluateAttempt } from '../src/erasEval.js';
import { withErasOverlay } from '../src/erasOverlay.js';
import worker from '../src/index.js';
import { ERAS_OVERLAYS, RACE_FILES } from '../src/races.gen.js';
import { getRace, modelHash } from '../src/races.js';
import { SEED, abu, ids } from './helpers.js';

const ERAS: ErasBlock = {
  eraId: 9,
  order: 10,
  target: { type: 'win' },
  mastery: { type: 'finish_position', position: 1, label: 'Win' },
};
// A fixture overlay played from the Daily side with the Daily moments (the real overlay plays
// Verstappen, with its own moments: eras-shared.test.ts).
ERAS_OVERLAYS['abu-dhabi-2021'] = { rules: abuOverlay.rules, eras: ERAS };
const merged = withErasOverlay(abu, ERAS_OVERLAYS['abu-dhabi-2021']);

/** Box for softs at the lap-53 SC, the real call elsewhere: a win, on the merged model. */
const boxSoft = playDailyRace(merged, SEED, (m) =>
  m.id === 'sc-stop' ? 'box-soft' : (m.realOptionId ?? (m.options[0]?.id as string)),
);

async function call(path: string, body: unknown): Promise<Response> {
  const req = new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, { ...env, ERAS_TEST_MODE: 'true' }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function begin(): Promise<{ attemptId: string; modelHash: string }> {
  const res = await call('/api/eras/attempts', {
    anonId: ids.a,
    raceId: 'abu-dhabi-2021',
    legend: false,
  });
  expect(res.status).toBe(201);
  const a = (await res.json()) as { attemptId: string; modelHash: string };
  await env.DB.prepare('UPDATE era_attempts SET seed = ? WHERE id = ?')
    .bind(SEED, a.attemptId)
    .run();
  return a;
}

describe('an Eras attempt on a shared race', () => {
  it('the Daily file has no Eras block: it alone could not be evaluated', async () => {
    const daily = (await getRace('abu-dhabi-2021'))?.model as RaceModel;
    expect(daily).toBe(RACE_FILES['abu-dhabi-2021']);
    expect(daily.eras).toBeUndefined();
    expect(() =>
      evaluateAttempt({
        model: daily,
        seed: SEED,
        legend: false,
        difficulty: difficultyFor(2),
        decisions: boxSoft.decisions,
        grades: boxSoft.grades,
        rivalClaims: null,
        untimed: false,
      }),
    ).toThrow(EraRaceNotReadyError);
  });

  it('is pinned to the merged model and evaluated from it', async () => {
    const eras = await getErasRace('abu-dhabi-2021');
    expect(eras?.model).toEqual(merged);
    const a = await begin();
    expect(a.modelHash).toBe(await modelHash(merged));
    expect(a.modelHash).not.toBe((await getRace('abu-dhabi-2021'))?.hash);
    const row = await env.DB.prepare('SELECT model_hash FROM era_attempts WHERE id = ?')
      .bind(a.attemptId)
      .first<{ model_hash: string }>();
    expect(row?.model_hash).toBe(a.modelHash);

    const res = await call(`/api/eras/attempts/${a.attemptId}`, {
      anonId: ids.a,
      decisions: boxSoft.decisions,
      grades: boxSoft.grades,
      modelHash: a.modelHash,
    });
    expect(res.status).toBe(200);
    const result = (await res.json()) as { raceId: string; stars: { result: boolean } };
    expect(result.raceId).toBe('abu-dhabi-2021');
    // The overlay's target (a win) is what the result star was judged against.
    expect(result.stars.result).toBe(true);
  });

  it('refuses a submit echoing the Daily hash', async () => {
    const a = await begin();
    const res = await call(`/api/eras/attempts/${a.attemptId}`, {
      anonId: ids.a,
      decisions: boxSoft.decisions,
      grades: boxSoft.grades,
      modelHash: (await getRace('abu-dhabi-2021'))?.hash,
    });
    expect(res.status).toBe(409);
  });
});
