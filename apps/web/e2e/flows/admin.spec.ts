// L3: admin edits against the real local Worker and D1 (docs/test-suite-spec.md S4), seen in
// the game. The admin signs in on /admin (the Google stand-in, helpers.ts; the Worker checks
// ADMIN_EMAILS), sets an announcement on the Today tab and changes a future day's race on the
// Schedule tab; a player then sees the banner, and on that day the new race. An account off the
// admin list is refused by the Worker.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { ADMIN_EMAIL } from './env.js';
import { closeHowTo, flowOf, idToken, preparePage, useCredential, workerApi } from './helpers.js';

const BANNER = 'Flows: the pit lane closes at noon.';
/** Day 4 (no runs, in the future): its race changes from Abu Dhabi 2021 to Spain 2020. */
const EDITED = 3;

async function adminSignIn(page: Page, token: string) {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
  await useCredential(page, token);
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
}

test('an account off the admin list is refused by the Worker', async ({ page }, info) => {
  const flow = flowOf(info);
  await preparePage(page, { at: flow.now });
  const refused = page.waitForResponse((r) => r.url().endsWith('/api/admin/me'));
  await adminSignIn(page, idToken(flow.now, { sub: 'flows-nobody', email: 'nobody@flows.test' }));
  expect((await refused).status()).toBe(403);
  await expect(page.getByText('isn’t an admin')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily schedule' })).toHaveCount(0);
});

test('admin: announcement and schedule edits show in the game', async ({ page, browser }, info) => {
  test.setTimeout(300_000);
  const flow = flowOf(info);
  const dateAt = flow.dateOf;
  const dayAt = flow.day;
  await preparePage(page, { at: flow.now });
  const token = idToken(flow.now);
  await adminSignIn(page, token);
  await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();

  await test.step('Today: set the announcement', async () => {
    await page.getByLabel('New announcement').fill(BANNER);
    const set = page.waitForResponse((r) => r.url().endsWith('/api/admin/announcement'));
    await page.getByRole('button', { name: 'Set announcement' }).click();
    expect((await set).status()).toBe(200);
    await expect(page.getByText('Announcement set.')).toBeVisible();
  });

  await test.step('Schedule: change a future day’s race', async () => {
    await page.getByRole('navigation').getByRole('link', { name: 'Schedule' }).click();
    await expect(page).toHaveURL(/\/admin\/schedule$/);
    const row = page.getByRole('row', { name: new RegExp(dateAt(EDITED)) });
    await expect(row).toContainText('Abu Dhabi 2021');
    // Today has no runs here, but past days and days with runs are locked.
    const day = page.getByRole('combobox', { name: `Race on ${dateAt(EDITED)}` });
    await expect(day).toBeEnabled({ timeout: 30_000 });
    const changed = page.waitForResponse((r) => r.url().endsWith('/api/admin/day'));
    await day.selectOption('spain-2020');
    expect((await changed).status()).toBe(200);
    await expect(page.getByText(`${dateAt(EDITED)} is now`)).toBeVisible();
    await expect(row).toContainText('Spain 2020');
  });

  await test.step('the Worker logged both edits', async () => {
    const api = await workerApi(flow.now);
    const log = await api.get('/api/admin/log', { headers: { Authorization: `Bearer ${token}` } });
    const { entries } = (await log.json()) as { entries: Array<{ action: string; email: string }> };
    expect(entries.slice(0, 2).map((e) => e.action)).toEqual(['day', 'announcement']);
    expect(entries.every((e) => e.email === ADMIN_EMAIL)).toBe(true);
  });

  await test.step('a player sees the banner, and the new race on that day', async () => {
    const player = await browser.newPage();
    await preparePage(player, { at: flow.now });
    await player.goto('/gauntlet');
    const banner = player.getByRole('status').filter({ hasText: BANNER });
    await expect(banner).toBeVisible({ timeout: 30_000 });

    const later = await browser.newPage();
    await preparePage(later, { at: dayAt(EDITED) });
    await later.goto('/');
    await closeHowTo(later);
    await expect(later.getByText(/^Daily race · lap \d+ of \d+$/)).toBeVisible();
    // Spain 2020: Verstappen's Red Bull, not Abu Dhabi's Mercedes.
    await expect(later.getByRole('button', { name: /Red Bull.*pit wall/ })).toBeVisible();
    const daily = await (await workerApi(dayAt(EDITED))).get(`/api/daily?date=${dateAt(EDITED)}`);
    expect(await daily.json()).toMatchObject({
      raceId: 'spain-2020',
      number: flow.base + EDITED + 1,
    });
    await player.close();
    await later.close();
  });

  await test.step('clearing the announcement takes the banner down', async () => {
    await page.getByRole('navigation').getByRole('link', { name: 'Today' }).click();
    const cleared = page.waitForResponse((r) => r.url().endsWith('/api/admin/announcement/clear'));
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    expect((await cleared).status()).toBe(200);
    await expect(page.getByText('Announcement cleared.')).toBeVisible();
    const player = await browser.newPage();
    await preparePage(player, { at: flow.now });
    await player.goto('/gauntlet');
    await expect(player.getByRole('heading', { name: 'Gauntlet' })).toBeVisible();
    await expect(player.getByText(BANNER)).toHaveCount(0);
    await player.close();
  });
});
