// L3: a Gauntlet run against the real local Worker and D1 (docs/test-suite-spec.md S4). The
// flows' Worker deals from one race (SURVIVOR_POOL: Spain 2020, seed 85579, where good play
// holds Bottas off), so the run is known: start it, win round 1 with the engineer's plan and
// the first answer at each call, then lose round 2 by boxing for softs at every stop call and
// nursing the tyres (Bottas gets by). Each round is replayed and judged by the Worker; the run
// ends at the loss and is recorded (GET /api/survivor/:runId, the leaderboard).
import { expect, test } from '../coverage.js';
import { anonIdOf, closeHowTo, goWithPlan, preparePage, raceToFlag, workerApi } from './helpers.js';

const isRound = (r: import('@playwright/test').Response) =>
  /\/api\/survivor\/[^/]+\/round$/.test(r.url()) && r.request().method() === 'POST';

/** Round 2's calls: a stop for softs at every stop call, and managing the tyres. */
const losingCalls = (lap: number): string[] | undefined =>
  lap === 21 || lap === 41 || lap === 48
    ? ['Box', 'Softs']
    : lap === 26 || lap === 54
      ? ['Manage the tyres']
      : undefined;

test('Gauntlet: start, win a round, lose a round, the run recorded', async ({ page }) => {
  test.setTimeout(600_000);
  await preparePage(page);
  await page.goto('/gauntlet');
  await closeHowTo(page, false);
  await expect(page.getByRole('heading', { name: 'Gauntlet' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();

  const started = page.waitForResponse(
    (r) => r.url().endsWith('/api/survivor/start') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Start a run/ }).click();
  const start = await started;
  expect(start.status()).toBe(201);
  const run = (await start.json()) as { runId: string; current: { raceId: string; round: number } };
  expect(run.current).toMatchObject({ round: 1, raceId: 'spain-2020' });

  await test.step('round 1: won', async () => {
    await goWithPlan(page);
    const posted = page.waitForResponse(isRound, { timeout: 300_000 });
    await raceToFlag(page, { done: page.getByText('Round 1 survived') });
    const res = await posted;
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ won: true, state: { status: 'live', rounds: 1 } });
    await expect(page.getByText(/laps to run/)).toBeVisible();
    await page.getByRole('button', { name: /Next race/ }).click();
  });

  await test.step('round 2: lost, the run is over', async () => {
    await goWithPlan(page);
    const posted = page.waitForResponse(isRound, { timeout: 300_000 });
    await raceToFlag(page, {
      answer: losingCalls,
      done: page.getByText(/Lights out · run over/i),
    });
    const res = await posted;
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      won: false,
      state: { status: 'over', rounds: 1, current: null },
    });
  });

  await test.step('the run recorded by the Worker', async () => {
    const api = await workerApi();
    const anonId = await anonIdOf(page);
    const state = await (await api.get(`/api/survivor/${run.runId}?anonId=${anonId}`)).json();
    expect(state).toMatchObject({ status: 'over', rounds: 1, rank: 1, total: 1 });
    expect(state.history).toHaveLength(2);
    expect(state.history.map((h: { won: boolean }) => h.won)).toEqual([true, false]);
    const board = await (await api.get('/api/survivor/leaderboard')).json();
    expect(board.allTime).toHaveLength(1);
    expect(board.allTime[0]).toMatchObject({ rounds: 1 });
    // A finished run takes no more rounds.
    const late = await api.post(`/api/survivor/${run.runId}/round`, {
      data: { anonId, round: 2, decisions: [], grades: [] },
    });
    expect(late.status()).toBe(409);
  });
});
