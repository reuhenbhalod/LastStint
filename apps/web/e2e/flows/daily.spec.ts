// L3: the Daily against the real local Worker and D1 (docs/test-suite-spec.md S4). Day 1 from
// the intro to the result, with the run replayed and verified by the Worker and the streak
// counted; the same Daily again (already played: the result comes back, a second submit is
// refused); then the next day's Daily, which makes it a 2-day streak.
import { expect, test } from '../coverage.js';
import { FIXED_DATE } from './env.js';
import {
  anonIdOf,
  closeHowTo,
  dateAt,
  dayAt,
  goWithPlan,
  preparePage,
  raceToFlag,
  setTime,
  workerApi,
} from './helpers.js';

const isRunPost = (r: import('@playwright/test').Response) =>
  /\/api\/runs$/.test(r.url()) && r.request().method() === 'POST';

/** From the daily card to the result: the plan, every call, the server's verdict. */
async function playDaily(page: import('@playwright/test').Page, number: number) {
  await expect(page.getByText(`Daily Race #${number}`)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /pit wall/ }).click();
  await goWithPlan(page);
  const posted = page.waitForResponse(isRunPost, { timeout: 300_000 });
  await raceToFlag(page);
  await page.getByRole('button', { name: 'See how you did' }).click({ timeout: 90_000 });
  const res = await posted;
  await expect(page.getByText('Your calls')).toBeVisible({ timeout: 60_000 });
  return {
    status: res.status(),
    body: (await res.json()) as Record<string, unknown>,
    sent: res.request().postDataJSON() as Record<string, unknown>,
  };
}

test('Daily: play, verified, already played, next day streak', async ({ page }) => {
  test.setTimeout(600_000);
  await preparePage(page);
  const api = await workerApi();

  let firstRun: Awaited<ReturnType<typeof playDaily>> | undefined;
  await test.step('day 1: intro to result, verified by the Worker', async () => {
    await page.goto('/');
    await closeHowTo(page);
    firstRun = await playDaily(page, 1);
    expect(firstRun.status).toBe(201);
    expect(firstRun.body).toMatchObject({
      date: FIXED_DATE,
      number: 1,
      raceId: 'abu-dhabi-2021',
      rank: 1,
      total: 1,
    });
    // The Worker's score, computed from the call log (not sent by the game).
    expect(firstRun.sent).not.toHaveProperty('score');
    expect(typeof firstRun.body.score).toBe('number');
    await expect(page.getByText(/LastStint #1\b/).first()).toBeVisible();

    const anonId = await anonIdOf(page);
    const stored = await api.get(`/api/runs/${FIXED_DATE}/${anonId}`);
    expect(stored.status()).toBe(200);
    expect(await stored.json()).toMatchObject({ score: firstRun.body.score, rank: 1, total: 1 });
    const player = await (await api.get(`/api/players/${anonId}?today=${FIXED_DATE}`)).json();
    expect(player.streak).toMatchObject({ current: 1, best: 1, days: 1 });
    const board = await (await api.get(`/api/daily/${FIXED_DATE}/leaderboard`)).json();
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0].score).toBe(firstRun.body.score);
  });

  await test.step('the same Daily again: already played', async () => {
    // A reload goes straight back to the result.
    await page.goto('/');
    await expect(page.getByText('Your calls')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1-day streak')).toBeVisible();
    // Without the browser's saved run, the Worker says it's played: the game asks for the run
    // (GET /api/runs/:date/:anonId) and shows its result rather than a new race.
    await page.evaluate(() => localStorage.removeItem('pitwall:run'));
    const fetched = page.waitForResponse(
      (r) => /\/api\/runs\/\d{4}-\d{2}-\d{2}\//.test(r.url()) && r.status() === 200,
    );
    await page.reload();
    await fetched;
    await expect(page.getByText('Your calls')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /pit wall/ })).toHaveCount(0);
    // The Worker refuses a second run for the day.
    const again = await api.post('/api/runs', { data: firstRun?.sent });
    expect(again.status()).toBe(409);
    expect(await again.json()).toEqual({ error: 'already-submitted' });
  });

  await test.step('the next day: Daily #2, a 2-day streak', async () => {
    await setTime(page, dayAt(1), false);
    await page.goto('/');
    await closeHowTo(page, false);
    const second = await playDaily(page, 2);
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ date: dateAt(1), number: 2 });
    const anonId = await anonIdOf(page);
    const next = await workerApi(dayAt(1));
    const player = await (await next.get(`/api/players/${anonId}?today=${dateAt(1)}`)).json();
    expect(player.streak).toMatchObject({ current: 2, best: 2, days: 2 });
    await expect(page.getByText('2-day streak')).toBeVisible({ timeout: 30_000 });
    // Day 1's daily is no longer playable on day 3 (UTC+14 to UTC-12 has moved on).
    const late = await workerApi(dayAt(3));
    expect((await late.get(`/api/daily?date=${FIXED_DATE}`)).status()).toBe(404);
  });
});
