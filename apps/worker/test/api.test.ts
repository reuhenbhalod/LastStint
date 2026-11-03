// Endpoint tests on a local D1 (Phase 4 spec stages 2-3).

import {
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { addDays } from '../src/dates.js';
import worker from '../src/index.js';
import { checkQueue } from '../src/ops.js';
import { modelHash } from '../src/races.js';
import { type UnverifiedRun, recheckRun, recheckSql } from '../src/reverify.js';
import type { RunResponse } from '../src/runs.js';
import { abu, get, ids, play, post, schedule, submit, today } from './helpers.js';

// Played once (each play grades the moment with the full 300 samples).
const boxSoft = play('box-soft');
const stayOut = play('stay');

describe('GET /api/health', () => {
  it('reports how many days are scheduled from today', async () => {
    expect(await (await get('/api/health')).json()).toEqual({ ok: true, queueDays: 0 });
    for (let i = 0; i < 3; i++) await schedule(addDays(today(), i), { number: i + 1 });
    await schedule(addDays(today(), 4), { number: 5 }); // a gap ends the run of days
    expect(await (await get('/api/health')).json()).toEqual({ ok: true, queueDays: 3 });
  });
});

describe('GET /api/daily', () => {
  it("serves today's daily with a pinned model URL", async () => {
    await schedule(today(), { number: 7 });
    const res = await get(`/api/daily?date=${today()}`);
    expect(res.status).toBe(200);
    const daily = (await res.json()) as Record<string, unknown>;
    expect(daily).toMatchObject({
      date: today(),
      number: 7,
      raceId: 'abu-dhabi-2021',
      seed: 4242,
      side: 'HAM',
      modelHash: await modelHash(abu),
    });
    const model = await SELF_fetch(daily.modelUrl as string);
    expect(model.status).toBe(200);
    expect(model.headers.get('Cache-Control')).toContain('immutable');
    expect(await model.json()).toEqual(abu);
  });

  it('rejects bad dates, missing dailies and dates not playable yet', async () => {
    expect((await get('/api/daily')).status).toBe(400);
    expect((await get('/api/daily?date=2026-02-30')).status).toBe(400);
    expect((await get(`/api/daily?date=${today()}`)).status).toBe(404);
    const future = addDays(today(), 3);
    await schedule(future);
    const res = await get(`/api/daily?date=${future}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'no-daily' });
  });

  it('refuses a daily whose race model changed after scheduling', async () => {
    await schedule(today(), { hash: 'not-the-hash' });
    const res = await get(`/api/daily?date=${today()}`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'model-changed',
      detail: 'this daily is unavailable',
    });
  });
});

describe('GET /api/races/:id', () => {
  it('serves a model, cached briefly without its hash', async () => {
    const res = await get('/api/races/abu-dhabi-2021');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect((await get('/api/races/nope')).status).toBe(404);
    expect((await get('/api/races/constructor')).status).toBe(404);
  });
});

describe('POST /api/runs', () => {
  it('verifies a played run and returns the same score the game computed', async () => {
    await schedule(today(), { number: 3 });
    const res = await submit(ids.a, boxSoft);
    expect(res.status).toBe(201);
    const run = (await res.json()) as RunResponse;
    expect(run).toMatchObject({
      date: today(),
      number: 3,
      raceId: 'abu-dhabi-2021',
      score: boxSoft.score.score,
      meanProbability: boxSoft.score.meanProbability,
      finishPosition: boxSoft.result.order.indexOf('HAM') + 1,
      disqualified: false,
      rank: 1,
      percentile: 0,
      total: 1,
    });
    expect(run.result.order).toEqual(boxSoft.result.order);
    expect(run.calls.map((c) => c.momentId)).toEqual([
      'race-plan',
      'vsc-cover',
      'tyres-going',
      'manage-or-push',
      'sc-stop',
      'sc-last-chance',
      'restart-stance',
    ]);
    expect(run.calls[4]).toMatchObject({
      momentId: 'sc-stop',
      chosen: 'box-soft',
      band: boxSoft.score.calls[4]?.band,
      options: boxSoft.calls[4]?.grade.options,
      matchedReal: false,
      real: { optionId: 'stay' },
    });

    // The same result comes back after a refresh.
    const again = await get(`/api/runs/${today()}/${ids.a}`);
    expect(await again.json()).toEqual(run);
  });

  it('accepts one run per player per day', async () => {
    await schedule(today());
    expect((await submit(ids.a, boxSoft)).status).toBe(201);
    const dup = await submit(ids.a, stayOut);
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: 'already-submitted' });
  });

  it('ranks runs by score, then the tie-breaks', async () => {
    await schedule(today());
    const a = (await (await submit(ids.a, boxSoft)).json()) as RunResponse;
    const b = (await (await submit(ids.b, stayOut)).json()) as RunResponse;
    const c = (await (await submit(ids.c, stayOut)).json()) as RunResponse;
    // c ties b exactly and submitted later, so it ranks behind b.
    expect(c.score).toBe(b.score);
    expect(c.total).toBe(3);
    const better =
      a.score > b.score || (a.score === b.score && a.meanProbability > b.meanProbability);
    const final = await Promise.all(
      [ids.a, ids.b, ids.c].map(
        async (id) => (await (await get(`/api/runs/${today()}/${id}`)).json()) as RunResponse,
      ),
    );
    expect(final.map((r) => r.rank)).toEqual(better ? [1, 2, 3] : [3, 1, 2]);
    // Percentile counts strictly lower scores only.
    const lower = (s: number) => final.filter((r) => r.score < s).length;
    for (const r of final) expect(r.percentile).toBe(Math.floor((lower(r.score) * 100) / 3));
  });

  it('rejects tampered or malformed submissions', async () => {
    await schedule(today());
    const log = JSON.parse(JSON.stringify(boxSoft.decisions));
    const radio = log.findIndex((d: { kind: string }) => d.kind === 'radio');
    log[radio].optionId = 'cover-hard'; // claims the cover while having stayed out
    const tampered = await submit(ids.a, { decisions: log, grades: boxSoft.grades });
    expect(tampered.status).toBe(400);
    expect(await tampered.json()).toMatchObject({ error: 'bad-answer' });

    expect((await submit('not-a-uuid', boxSoft)).status).toBe(400);
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ date: today(), anonId: ids.b, decisions: 'x' })).status).toBe(400);
    // Grades are required and must have the right shape.
    const noGrades = await post({ date: today(), anonId: ids.b, decisions: boxSoft.decisions });
    expect(noGrades.status).toBe(400);
    expect(await noGrades.json()).toMatchObject({ error: 'bad-grades' });
    const short = await submit(ids.b, { ...boxSoft, grades: boxSoft.grades.slice(1) });
    expect(await short.json()).toMatchObject({ error: 'bad-grades' });
    expect((await submit(ids.b, boxSoft, addDays(today(), 5))).status).toBe(404);
    // Nothing was stored.
    expect((await get(`/api/runs/${today()}/${ids.a}`)).status).toBe(404);
  });

  it('rate-limits submissions per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await post({}, { 'cf-connecting-ip': '192.0.2.1' })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe('stats and leaderboard', () => {
  it('aggregates the day and lists the top runs with generated names', async () => {
    await schedule(today());
    await submit(ids.a, boxSoft);
    await submit(ids.b, stayOut);
    await submit(ids.c, stayOut);

    const stats = (await (await get(`/api/daily/${today()}/stats`)).json()) as {
      runs: number;
      meanScore: number;
      moments: Array<{
        id: string;
        matchedReal: number;
        options: Array<{ id: string; share: number }>;
      }>;
    };
    expect(stats.runs).toBe(3);
    expect(stats.meanScore).toBeCloseTo((boxSoft.score.score + 2 * stayOut.score.score) / 3, 9);
    const moment = stats.moments.find((m) => m.id === 'sc-stop');
    expect(moment).toBeDefined();
    expect(moment?.matchedReal).toBeCloseTo(2 / 3, 9);
    expect(moment?.options.find((o) => o.id === 'box-soft')?.share).toBeCloseTo(1 / 3, 9);
    expect(moment?.options.find((o) => o.id === 'box-hard')?.share).toBe(0);

    const board = (await (await get(`/api/daily/${today()}/leaderboard`)).json()) as {
      entries: Array<{ rank: number; name: string; score: number }>;
    };
    expect(board.entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    for (const e of board.entries) expect(e.name).toMatch(/^[A-Z][a-z]+ [A-Za-z ]+ \d{3}$/);
    expect(JSON.stringify(board)).not.toContain(ids.a);
  });

  it('hides stats for days that are not playable yet', async () => {
    const future = addDays(today(), 3);
    await schedule(future);
    expect((await get(`/api/daily/${future}/stats`)).status).toBe(404);
  });
});

describe('queue check (cron)', () => {
  it('alerts through the webhook when tomorrow is missing', async () => {
    await schedule(today());
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    const alert = await checkQueue(env.DB, Date.now(), 'https://hooks.test/x', send as never);
    expect(alert?.level).toBe('error');
    expect(send).toHaveBeenCalledOnce();
    const body = JSON.parse(
      (send.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.content).toContain("tomorrow's race is not scheduled");
  });

  it('warns below a week and is quiet with a full queue', async () => {
    for (let i = 0; i < 5; i++) await schedule(addDays(today(), i), { number: i + 1 });
    expect((await checkQueue(env.DB, Date.now(), undefined))?.level).toBe('warn');
    for (let i = 5; i < 8; i++) await schedule(addDays(today(), i), { number: i + 1 });
    expect(await checkQueue(env.DB, Date.now(), undefined)).toBeNull();
  });

  it('runs from the scheduled handler', async () => {
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: '0 9 * * *' }), env, ctx);
    await waitOnExecutionContext(ctx);
  });
});

function SELF_fetch(url: string) {
  return get(new URL(url).pathname + new URL(url).search);
}

describe('nightly re-grading (beta spec B6)', () => {
  it('verifies honest runs and corrects runs with edited grades', async () => {
    await schedule(today());
    expect((await submit(ids.a, boxSoft)).status).toBe(201);
    // Edited grades: claims staying out at the SC was the best call.
    const cheat = JSON.parse(JSON.stringify(stayOut.grades)) as Array<{
      momentId: string;
      probabilities: number[];
    }>;
    const sc = cheat.find((g) => g.momentId === 'sc-stop') as { probabilities: number[] };
    sc.probabilities = sc.probabilities.map((_, i) => (i === 0 ? 1 : 0));
    const claimed = (await (
      await submit(ids.b, { decisions: stayOut.decisions, grades: cheat })
    ).json()) as RunResponse;
    expect(claimed.score).toBeGreaterThan(stayOut.score.score);

    const { results } = await env.DB.prepare(
      `SELECT r.id, r.date, d.number, d.race_id, d.seed, r.decisions, r.result
       FROM runs r JOIN daily d ON d.date = r.date WHERE r.verified = 0 ORDER BY r.created_at`,
    ).all<UnverifiedRun>();
    expect(results).toHaveLength(2);
    const checks = results.map((r) => recheckRun(abu, r));
    expect(checks.map((c) => c.correct)).toEqual([true, false]);
    await env.DB.batch(checks.flatMap(recheckSql).map((q) => env.DB.prepare(q)));

    const rows = await env.DB.prepare(
      'SELECT anon_id, verified, corrected, score FROM runs ORDER BY created_at',
    ).all<{ anon_id: string; verified: number; corrected: number; score: number }>();
    expect(rows.results).toEqual([
      { anon_id: ids.a, verified: 1, corrected: 0, score: boxSoft.score.score },
      { anon_id: ids.b, verified: 1, corrected: 1, score: stayOut.score.score },
    ]);
    const fixed = (await (await get(`/api/runs/${today()}/${ids.b}`)).json()) as RunResponse;
    expect(fixed.score).toBe(stayOut.score.score);
    expect(fixed.calls.find((c) => c.momentId === 'sc-stop')?.band).toBe(
      stayOut.score.calls[4]?.band,
    );
    const band = await env.DB.prepare(
      "SELECT band FROM run_calls WHERE run_id = ? AND moment_id = 'sc-stop'",
    )
      .bind(claimed.runId)
      .first<{ band: string }>();
    expect(band?.band).toBe(stayOut.score.calls[4]?.band);
  });
});
