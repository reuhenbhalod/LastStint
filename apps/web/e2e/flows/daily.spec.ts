// L3: the Daily against the real local Worker and D1 (docs/test-suite-spec.md S4). Day 1 from
// the intro to the result, with the run replayed and verified by the Worker and the streak
// counted, and the result shared; the same Daily again (already played: the result comes back,
// a second submit is refused); then the next day's Daily, which makes it a 2-day streak.
import type { Page, Response } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  anonIdOf,
  closeHowTo,
  flowOf,
  goWithPlan,
  preparePage,
  raceToFlag,
  setTime,
  workerApi,
} from './helpers.js';

const isRunPost = (r: Response) => /\/api\/runs$/.test(r.url()) && r.request().method() === 'POST';

/** From the daily card to the result: the plan, every call, the server's verdict. */
async function playDaily(page: Page) {
  // The card no longer shows the Daily's number (#58).
  await expect(page.getByText(/^Daily race · lap \d+ of \d+$/)).toBeVisible({ timeout: 30_000 });
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

test('Daily: play, verified, shared, already played, next day streak', async ({
  page,
  context,
}, info) => {
  test.setTimeout(600_000);
  const flow = flowOf(info);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await preparePage(page, { at: flow.now });
  const api = await workerApi(flow.now);
  // The Daily's number (one a day from FIXED_DATE): it is in the API, not on screen.
  const number = flow.base + 1;

  let firstRun: Awaited<ReturnType<typeof playDaily>> | undefined;
  await test.step('day 1: intro to result, verified by the Worker', async () => {
    await page.goto('/');
    await closeHowTo(page);
    firstRun = await playDaily(page);
    expect(firstRun.status).toBe(201);
    expect(firstRun.body).toMatchObject({
      date: flow.date,
      number,
      raceId: 'abu-dhabi-2021',
      rank: 1,
      total: 1,
    });
    // The Worker's score, computed from the call log (not sent by the game).
    expect(firstRun.sent).not.toHaveProperty('score');
    expect(typeof firstRun.body.score).toBe('number');
    // The results header: "Daily", no number.
    await expect(page.getByText(/^Daily · Abu Dhabi/)).toBeVisible();

    const anonId = await anonIdOf(page);
    const stored = await api.get(`/api/runs/${flow.date}/${anonId}`);
    expect(stored.status()).toBe(200);
    expect(await stored.json()).toMatchObject({ score: firstRun.body.score, rank: 1, total: 1 });
    const player = await (await api.get(`/api/players/${anonId}?today=${flow.date}`)).json();
    expect(player.streak).toMatchObject({ current: 1, best: 1, days: 1 });
    const board = await (await api.get(`/api/daily/${flow.date}/leaderboard`)).json();
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0].score).toBe(firstRun.body.score);
  });

  await test.step('share: the line and the link go to the clipboard', async () => {
    const share = page.getByRole('region', { name: 'Share' });
    const line = (await share.locator('p.mono').textContent()) ?? '';
    // "LastStint [WIN ]<squares>[ P<n>]": no Daily number (#58).
    expect(line).toMatch(/^LastStint (WIN )?\S+( P\d+)?$/u);
    expect(line).not.toContain('#');
    await share.getByRole('button', { name: 'Share result' }).click();
    await expect(share.getByRole('button', { name: 'Copied!' })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${line}\n${new URL(page.url()).origin}`);
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

  await test.step('the next day: the next Daily, a 2-day streak', async () => {
    await setTime(page, flow.day(1), false);
    await page.goto('/');
    await closeHowTo(page, false);
    const second = await playDaily(page);
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ date: flow.dateOf(1), number: number + 1 });
    const anonId = await anonIdOf(page);
    const next = await workerApi(flow.day(1));
    const player = await (await next.get(`/api/players/${anonId}?today=${flow.dateOf(1)}`)).json();
    expect(player.streak).toMatchObject({ current: 2, best: 2, days: 2 });
    await expect(page.getByText('2-day streak')).toBeVisible({ timeout: 30_000 });
    // Day 1's daily is no longer playable on day 3 (UTC+14 to UTC-12 has moved on).
    const late = await workerApi(flow.day(3));
    expect((await late.get(`/api/daily?date=${flow.date}`)).status()).toBe(404);
  });
});
