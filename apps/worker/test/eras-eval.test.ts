// Eras server evaluation (src/erasEval.ts, src/eras.ts submit; build plan 7.3; eras spec §6,
// §7, §8, §9, §18): a submit is replayed with the attempt's seed and evaluated on the server,
// progress keeps the best per star (a worse attempt lowers nothing; Legend is its own), a
// rewrite writes one history entry, tampering is refused or corrected, the pinned hash is
// checked server-side, and the nightly re-grade corrects edited claims.
//
// No bundled race has an `eras` block yet (content is phase 6), so this file gives Abu Dhabi
// 2021 (Era 9, play order 2: a Standard rival) one, in this test isolate's copy of the bundle.

import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { type ErasBlock, type RaceModel, difficultyFor, legendDifficulty } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { playDailyRace } from '../../../packages/sim/examples/daily-race.js';
import { getErasRace } from '../src/eras.js';
import {
  BadRivalClaimsError,
  type EraAttemptResult,
  EraRaceNotReadyError,
  RivalUnavailableError,
  evaluateAttempt,
  rivalReplay,
} from '../src/erasEval.js';
import worker from '../src/index.js';
import { RACE_FILES } from '../src/races.gen.js';
import { type UnverifiedAttempt, recheckAttempt, recheckAttemptSql } from '../src/reverify.js';
import { SEED, abu, ids } from './helpers.js';

const ERAS: ErasBlock = {
  eraId: 9,
  order: 10,
  target: { type: 'win' },
  storyline: {
    real: 'The title goes the other way on the last lap',
    rewriteCondition: { type: 'win' },
    headline: 'Test headline',
  },
  mastery: { type: 'finish_position', position: 1, label: 'Win' },
  hidden: { type: 'stop_count', max: 5, label: 'At most five stops' },
};
const model: RaceModel = { ...abu, eras: ERAS };
RACE_FILES['abu-dhabi-2021'] = model;

/** The game's play: `scStop` at the lap-53 SC, the real team's call elsewhere. */
const play = (scStop: string) =>
  playDailyRace(model, SEED, (m) =>
    m.id === 'sc-stop' ? scStop : (m.realOptionId ?? (m.options[0]?.id as string)),
  );
// Both win; boxing for softs is a clean race (three stars), staying out is a red call.
const boxSoft = play('box-soft');
const stayOut = play('stay');

type Grades = Array<{ momentId: string; probabilities: number[]; real?: number }>;
/** Edited grades: staying out at the SC claimed as the best call (shape still valid). */
function cheatGrades(): Grades {
  const g = JSON.parse(JSON.stringify(stayOut.grades)) as Grades;
  const sc = g.find((c) => c.momentId === 'sc-stop') as Grades[number];
  sc.probabilities = sc.probabilities.map((_, i) => (i === 0 ? 1 : 0));
  return g;
}

async function call(path: string, body?: unknown): Promise<Response> {
  const req = new Request(`https://api.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, { ...env, ERAS_TEST_MODE: 'true' }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}
const json = async <T>(res: Response) => (await res.json()) as T;

interface Submitted extends EraAttemptResult {
  attemptId: string;
  newStars: { result: boolean; strategist: boolean; mastery: boolean };
  historyEntry: boolean;
  progress: {
    stars: { result: boolean; strategist: boolean; mastery: boolean };
    hiddenDone: boolean;
    bestAccuracy: number | null;
  };
  rank: number;
  total: number;
}

/** Start an Abu Dhabi attempt and pin its seed to the one the plays above used. */
async function begin(legend = false, anonId = ids.a): Promise<string> {
  const res = await call('/api/eras/attempts', { anonId, raceId: 'abu-dhabi-2021', legend });
  expect(res.status).toBe(201);
  const { attemptId } = await json<{ attemptId: string }>(res);
  await env.DB.prepare('UPDATE era_attempts SET seed = ? WHERE id = ?').bind(SEED, attemptId).run();
  return attemptId;
}

const submit = (attemptId: string, body: Record<string, unknown>, anonId = ids.a) =>
  call(`/api/eras/attempts/${attemptId}`, { anonId, ...body });
const send = (run: typeof boxSoft, extra: Record<string, unknown> = {}) => ({
  decisions: run.decisions,
  grades: run.grades,
  ...extra,
});

async function attemptRow(id: string) {
  return env.DB.prepare('SELECT * FROM era_attempts WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
}
async function progress(player = ids.a, legend = 0) {
  return env.DB.prepare(
    `SELECT star_result, star_strategist, star_mastery, hidden_done, best_accuracy
     FROM era_progress WHERE player_id = ? AND race_id = 'abu-dhabi-2021' AND legend = ?`,
  )
    .bind(player, legend)
    .first<Record<string, number | null>>();
}
async function history(player = ids.a) {
  return (
    await env.DB.prepare('SELECT attempt_id FROM history_entries WHERE player_id = ?')
      .bind(player)
      .all<{ attempt_id: string }>()
  ).results;
}

/** What the nightly script reads (scripts/reverify.ts). */
async function unverified(): Promise<UnverifiedAttempt[]> {
  return (
    await env.DB.prepare(
      `SELECT a.id, a.player_id, a.race_id, a.legend, a.seed, e.play_order, a.decisions,
         a.rival_claims, a.untimed, a.result
       FROM era_attempts a JOIN era_races r ON r.race_id = a.race_id
       JOIN eras e ON e.id = r.era_id
       WHERE a.verified = 0 AND a.submitted_at IS NOT NULL AND a.decisions IS NOT NULL
       ORDER BY a.submitted_at, a.id`,
    ).all<UnverifiedAttempt>()
  ).results;
}
async function nightly() {
  const checks = [];
  for (const a of await unverified()) {
    const check = recheckAttempt(model, a);
    checks.push(check);
    if (check) await env.DB.batch(recheckAttemptSql(check, a).map((q) => env.DB.prepare(q)));
  }
  return checks;
}

describe('POST /api/eras/attempts/:id: evaluation', () => {
  it('a correct submit: replayed, evaluated, stars and the history entry written', async () => {
    const id = await begin();
    const res = await submit(id, send(boxSoft));
    expect(res.status).toBe(200);
    const body = await json<Submitted>(res);
    expect(body).toMatchObject({
      attemptId: id,
      raceId: 'abu-dhabi-2021',
      legend: false,
      untimed: false,
      stars: { result: true, strategist: true, mastery: true },
      newStars: { result: true, strategist: true, mastery: true },
      rewrite: true,
      historyEntry: true,
      finishPosition: 1,
      rank: 1,
      total: 1,
    });
    expect(body.accuracy).toBeGreaterThan(difficultyFor(2).accuracyThreshold);
    expect(body.calls).toHaveLength(abu.decisionMoments.length);
    expect(body.decisionAccuracies).toHaveLength(abu.decisionMoments.length);

    const row = await attemptRow(id);
    expect(row).toMatchObject({ accuracy: body.accuracy, untimed: 0, verified: 0 });
    expect(JSON.parse(row?.result as string)).toEqual(
      Object.fromEntries(
        Object.entries(body).filter(
          ([k]) =>
            !['attemptId', 'newStars', 'historyEntry', 'progress', 'rank', 'total'].includes(k),
        ),
      ),
    );
    expect(JSON.parse(row?.grades as string)).toEqual(boxSoft.grades);
    expect(await progress()).toEqual({
      star_result: 1,
      star_strategist: 1,
      star_mastery: 1,
      hidden_done: 1,
      best_accuracy: body.accuracy,
    });
    expect(await history()).toEqual([{ attempt_id: id }]);
  });

  it('a worse attempt lowers nothing; a rewrite writes one history entry', async () => {
    const first = await begin();
    const good = await json<Submitted>(await submit(first, send(boxSoft)));
    const second = await begin();
    const res = await submit(second, send(stayOut));
    expect(res.status).toBe(200);
    const worse = await json<Submitted>(res);
    expect(worse.stars).toEqual({ result: true, strategist: true, mastery: false });
    expect(worse.accuracy).toBeLessThan(good.accuracy);
    expect(worse.newStars).toEqual({ result: false, strategist: false, mastery: false });
    expect(worse.rewrite).toBe(true);
    expect(worse.historyEntry).toBe(false);
    expect(worse.progress).toEqual({
      stars: { result: true, strategist: true, mastery: true },
      hiddenDone: true,
      bestAccuracy: good.accuracy,
    });
    expect(await progress()).toMatchObject({
      star_mastery: 1,
      hidden_done: 1,
      best_accuracy: good.accuracy,
    });
    // The history book keeps the first rewrite.
    expect(await history()).toEqual([{ attempt_id: first }]);
  });

  it('a better attempt after a worse one adds what it earned', async () => {
    const worse = await json<Submitted>(await submit(await begin(), send(stayOut)));
    expect(worse.newStars).toEqual({ result: true, strategist: true, mastery: false });
    // The hidden objective waits for all three stars.
    expect(await progress()).toMatchObject({ star_mastery: 0, hidden_done: 0 });
    const better = await json<Submitted>(await submit(await begin(), send(boxSoft)));
    expect(better.newStars).toEqual({ result: false, strategist: false, mastery: true });
    expect(better.progress.hiddenDone).toBe(true);
    expect(better.progress.bestAccuracy).toBe(better.accuracy);
  });

  it('stores untimed and still awards the stars; refuses a non-boolean', async () => {
    const id = await begin();
    expect((await submit(id, send(boxSoft, { untimed: 'yes' }))).status).toBe(400);
    const body = await json<Submitted>(await submit(id, send(boxSoft, { untimed: true })));
    expect(body.untimed).toBe(true);
    expect(body.stars).toEqual({ result: true, strategist: true, mastery: true });
    const row = await attemptRow(id);
    expect(row?.untimed).toBe(1);
    expect(JSON.parse(row?.result as string).untimed).toBe(true);
  });

  it('ranks by best accuracy among the race’s players', async () => {
    await submit(await begin(false, ids.b), send(boxSoft), ids.b);
    const mine = await json<Submitted>(await submit(await begin(), send(stayOut)));
    expect(mine).toMatchObject({ rank: 2, total: 2 });
  });
});

describe('POST /api/eras/attempts/:id: Legend', () => {
  it('Legend progress is its own: a normal submit never touches it', async () => {
    await env.DB.prepare(
      `INSERT INTO era_progress (player_id, race_id, legend, star_result, star_strategist,
         star_mastery, hidden_done, best_accuracy, updated_at)
       VALUES (?, 'abu-dhabi-2021', 1, 0, 1, 0, 0, 12.5, '2026-01-01T00:00:00.000Z')`,
    )
      .bind(ids.a)
      .run();
    await submit(await begin(), send(boxSoft));
    expect(await progress(ids.a, 1)).toEqual({
      star_result: 0,
      star_strategist: 1,
      star_mastery: 0,
      hidden_done: 0,
      best_accuracy: 12.5,
    });
    expect(await progress(ids.a, 0)).toMatchObject({ star_mastery: 1 });
  });

  it('a Legend attempt (Expert rival) is stored and answered 501 until the sim can check it', async () => {
    expect(legendDifficulty().rivalPolicy).toBe('expert');
    const id = await begin(true);
    const claims = [{ lap: 40, option: 'stay-out' }];
    const res = await submit(id, send(boxSoft, { rivalClaims: claims, untimed: true }));
    expect(res.status).toBe(501);
    expect(await json<{ error: string; rivalPolicy: string }>(res)).toMatchObject({
      error: 'rival-unavailable',
      rivalPolicy: 'expert',
    });
    const row = await attemptRow(id);
    expect(JSON.parse(row?.rival_claims as string)).toEqual(claims);
    expect(row).toMatchObject({ untimed: 1, result: null, accuracy: null });
    expect(row?.submitted_at).not.toBeNull();
    // No progress of either kind, and the nightly job leaves it for later.
    expect(await progress(ids.a, 1)).toBeNull();
    expect(await progress(ids.a, 0)).toBeNull();
    expect(await nightly()).toEqual([null]);
    expect((await attemptRow(id))?.verified).toBe(0);
    // A second submit finds it submitted.
    expect((await submit(id, send(boxSoft))).status).toBe(409);
  });
});

describe('POST /api/eras/attempts/:id: tampering', () => {
  it('ignores stars, accuracy and a result the client claims', async () => {
    const id = await begin();
    const body = await json<Submitted>(
      await submit(
        id,
        send(stayOut, {
          stars: { result: true, strategist: true, mastery: true },
          accuracy: 100,
          result: { finishPosition: 1 },
        }),
      ),
    );
    expect(body.stars.mastery).toBe(false);
    expect(body.accuracy).toBeLessThan(100);
    expect(await progress()).toMatchObject({ star_mastery: 0 });
  });

  it('refuses illegal decisions, impossible or missing grades, and stores nothing', async () => {
    const id = await begin();
    const edited = JSON.parse(JSON.stringify(boxSoft.decisions)) as Array<Record<string, unknown>>;
    const radio = edited.find((d) => d.kind === 'radio' && d.momentId === 'sc-stop');
    if (radio) radio.optionId = 'box-wets';
    const impossible = JSON.parse(JSON.stringify(boxSoft.grades)) as Grades;
    (impossible[0] as Grades[number]).probabilities[0] = 0.12345;
    const shortGrades = boxSoft.grades.slice(1);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ decisions: edited, grades: boxSoft.grades }, 'bad-answer'],
      [{ decisions: boxSoft.decisions.slice(0, -3), grades: boxSoft.grades }, 'missing-answer'],
      [{ decisions: boxSoft.decisions, grades: impossible }, 'bad-grades'],
      [{ decisions: boxSoft.decisions, grades: shortGrades }, 'bad-grades'],
      [{ decisions: boxSoft.decisions }, 'bad-grades'],
      [send(boxSoft, { rivalClaims: [{ lap: 3 }] }), 'bad-rival-claims'],
      [send(boxSoft, { rivalClaims: 'stay' }), 'bad-rival-claims'],
    ];
    for (const [body, error] of cases) {
      const res = await submit(id, body);
      expect(res.status, error).toBe(400);
      expect((await json<{ error: string }>(res)).error).toBe(error);
    }
    const row = await attemptRow(id);
    expect(row).toMatchObject({ submitted_at: null, decisions: null, result: null });
    expect(await progress()).toBeNull();
    // The honest submission still goes through.
    expect((await submit(id, send(boxSoft))).status).toBe(200);
  });

  it('accepts edited grades of a valid shape, as a Daily run; the nightly job corrects them', async () => {
    const id = await begin();
    const cheat = await json<Submitted>(
      await submit(id, { decisions: stayOut.decisions, grades: cheatGrades() }),
    );
    expect(cheat.stars.mastery).toBe(true); // what the edited claims earn
    const [check] = await nightly();
    expect(check?.correct).toBe(false);
    expect(check?.result.stars).toEqual({ result: true, strategist: true, mastery: false });
    const row = await attemptRow(id);
    expect(row).toMatchObject({ verified: 1, corrected: 1, accuracy: check?.result.accuracy });
    expect(JSON.parse(row?.result as string).stars.mastery).toBe(false);
    // The progress it alone gave is taken back; the rewrite (a replayed result) stands.
    expect(await progress()).toEqual({
      star_result: 1,
      star_strategist: 1,
      star_mastery: 0,
      hidden_done: 0,
      best_accuracy: check?.result.accuracy as number,
    });
    expect(await history()).toEqual([{ attempt_id: id }]);
  });

  it('the nightly correction never lowers a star earned on another attempt', async () => {
    const honest = await begin();
    const good = await json<Submitted>(await submit(honest, send(boxSoft)));
    const cheated = await begin();
    await submit(cheated, { decisions: stayOut.decisions, grades: cheatGrades() });
    const checks = await nightly();
    expect(checks.map((c) => c?.correct)).toEqual([true, false]);
    expect(await progress()).toEqual({
      star_result: 1,
      star_strategist: 1,
      star_mastery: 1,
      hidden_done: 1,
      best_accuracy: good.accuracy,
    });
    expect(await attemptRow(honest)).toMatchObject({ verified: 1, corrected: 0 });
    expect(await history()).toEqual([{ attempt_id: honest }]);
    // A second night finds nothing left.
    expect(await unverified()).toEqual([]);
  });
});

describe('POST /api/eras/attempts/:id: the pinned race file', () => {
  it('stores the hash at the start', async () => {
    const id = await begin();
    const bundled = await getErasRace('abu-dhabi-2021');
    expect((await attemptRow(id))?.model_hash).toBe(bundled?.hash);
  });

  it('refuses a hash mismatch: a rebuilt file, an attempt with no pin, a wrong echo', async () => {
    for (const set of ["'an-older-build'", 'NULL']) {
      const id = await begin();
      await env.DB.prepare(`UPDATE era_attempts SET model_hash = ${set} WHERE id = ?`)
        .bind(id)
        .run();
      const res = await submit(id, send(boxSoft));
      expect(res.status).toBe(409);
      expect((await json<{ error: string }>(res)).error).toBe('model-changed');
      expect((await attemptRow(id))?.submitted_at).toBeNull();
    }
    const id = await begin();
    const res = await submit(id, send(boxSoft, { modelHash: 'abc' }));
    expect(res.status).toBe(409);
    // No echo at all is fine: the server has the pin.
    expect((await submit(id, send(boxSoft))).status).toBe(200);
  });
});

describe('evaluateAttempt', () => {
  const input = {
    model,
    seed: SEED,
    legend: false,
    difficulty: difficultyFor(2),
    decisions: boxSoft.decisions,
    grades: boxSoft.grades,
    rivalClaims: null,
    untimed: false,
  };

  it('matches the client’s preview of the same race (claimed grades are the full ones)', () => {
    const claimed = evaluateAttempt(input);
    const full = evaluateAttempt({ ...input, grades: undefined });
    expect(full).toEqual(claimed);
  });

  it('refuses rivals the server cannot replay yet, and claims for a rival that makes none', () => {
    for (const p of ['standard-plus', 'smart', 'expert'] as const) {
      expect(() =>
        evaluateAttempt({ ...input, difficulty: { ...difficultyFor(2), rivalPolicy: p } }),
      ).toThrow(RivalUnavailableError);
    }
    expect(() => rivalReplay('standard', [])).toThrow(BadRivalClaimsError);
    expect(() => rivalReplay('expert', 'x')).toThrow(BadRivalClaimsError);
    expect(rivalReplay('standard', null)).toBe('standard');
  });

  it('refuses a race with no Eras block, or one built for the other driver', () => {
    expect(() => evaluateAttempt({ ...input, model: abu })).toThrow(EraRaceNotReadyError);
    expect(() =>
      evaluateAttempt({ ...input, model: { ...model, eras: { ...ERAS, userSide: 'VER' } } }),
    ).toThrow(EraRaceNotReadyError);
  });
});
