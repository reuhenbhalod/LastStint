// The admin Schedule tab (/admin/schedule, docs/test-suite-spec.md S3): play any race (seed,
// Play link, the race preview), and the daily schedule: schedule the next N days (all races or
// one), pick a day's race, re-pin stale days, clear my own run today; with the read-only days,
// the empty schedule, a busy action and the errors. admin.spec.ts covers the first look.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { STUB_PAGE, TODAY, fakeAdmin, openTab, signIn } from './adminApi.js';

const SPAIN = 'Spain 2020: Verstappen vs Bottas';
const CANADA = 'Canada 2022: Sainz vs Verstappen';
const ABU = 'Abu Dhabi 2021: Hamilton vs Verstappen';

const card = (page: Page, name: string) =>
  page.locator('article', { has: page.getByText(name, { exact: true }) });
const row = (page: Page, date: string) => page.getByRole('row', { name: new RegExp(`^${date}`) });

async function open(page: Page) {
  await openTab(page, '/admin/schedule');
  await expect(page.getByRole('heading', { name: 'Daily schedule' })).toBeVisible();
  // The race list is loaded (the day rows name their races from it).
  await expect(card(page, SPAIN)).toBeVisible();
}

test('the race list: a seed changes the Play link, and Play opens the race', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const spain = card(page, SPAIN);
  await expect(spain).toContainText('VER (Red Bull Racing)');
  await expect(spain).toContainText('5 calls · 48 laps');
  const seed = spain.getByRole('textbox', { name: 'Seed' });
  await expect(seed).toHaveValue('27170');
  const play = spain.getByRole('link', { name: 'Play' });
  await expect(play).toHaveAttribute('href', '/?race=spain-2020&seed=27170');
  await seed.fill('12 34');
  await expect(play).toHaveAttribute('href', '/?race=spain-2020&seed=12%2034');
  await seed.fill('99');
  await play.click();
  await expect(page.getByText(STUB_PAGE)).toBeVisible();
  const url = new URL(page.url());
  expect([url.pathname, url.searchParams.get('race'), url.searchParams.get('seed')]).toEqual([
    '/',
    'spain-2020',
    '99',
  ]);
});

test('the race preview opens, switches and closes', async ({ page, isMobile }) => {
  await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const spain = card(page, SPAIN);
  const preview = page.getByRole('complementary', { name: 'Race preview' });
  const button = spain.getByRole('button', { name: 'Preview' });
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(preview.getByRole('heading', { name: SPAIN })).toBeVisible();
  await expect(preview).toContainText(/Ground fit\s*median \d+\.\d m from the real track/);
  await expect(preview).toContainText('Seed27170');
  await expect(preview).toContainText('SideVER (Red Bull Racing) against BOT');
  await expect(preview).toContainText('PoolsDaily');
  await expect(preview).toContainText('Laps66, taking over on lap 18');
  await expect(preview.getByRole('heading', { name: 'Moments (5)' })).toBeVisible();
  await expect(preview.getByRole('listitem').first()).toContainText('Lap 21 · Tyre cliff');
  await expect(preview.getByRole('listitem').first()).toContainText('Box, mediums (real call)');
  await expect(page).toHaveURL(/\/admin\/schedule$/);
  if (!isMobile) {
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    // Pressing it again closes it; another race's Preview switches to it.
    await button.click();
    await expect(preview).toHaveCount(0);
    await button.click();
    await card(page, CANADA).getByRole('button', { name: 'Preview' }).click();
    await expect(preview.getByRole('heading', { name: CANADA })).toBeVisible();
    await expect(preview).toContainText('Lap 20 · Virtual safety car');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Close the preview' })).toBeHidden();
  } else {
    // On a phone the preview is a sheet over the list; tapping beside it closes it.
    await page
      .getByRole('button', { name: 'Close the preview' })
      .click({ position: { x: 20, y: 20 } });
    await expect(preview).toHaveCount(0);
    await button.click();
  }
  await preview.getByRole('button', { name: 'Close' }).click();
  await expect(preview).toHaveCount(0);
});

test('the schedule table: today, stale days and the read-only days', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await expect(row(page, TODAY)).toContainText(`${TODAY} · today`);
  await expect(row(page, TODAY)).toContainText('Current');
  await expect(row(page, '2026-11-12')).toContainText(CANADA);
  await expect(row(page, '2026-11-12')).toContainText('Stale: re-pin');
  // A past day and a day with runs can't change race; a future day without runs can.
  await expect(page.getByRole('combobox', { name: 'Race on 2026-11-10' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: `Race on ${TODAY}` })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Race on 2026-11-12' })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Race on 2026-11-13' })).toHaveValue(
    'spain-2020',
  );
});

test('pick a race for a day', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await page.getByRole('combobox', { name: 'Race on 2026-11-13' }).selectOption({ label: ABU });
  await expect(page.getByText(`2026-11-13 is now ${ABU}.`)).toBeVisible();
  expect(api.calls('POST', '/api/admin/day').map((c) => c.body)).toEqual([
    { date: '2026-11-13', raceId: 'abu-dhabi-2021' },
  ]);
  await expect(row(page, '2026-11-13')).toContainText(ABU);
  await expect(page.getByRole('combobox', { name: 'Race on 2026-11-13' })).toHaveValue(
    'abu-dhabi-2021',
  );

  // The server refusing (a run came in meanwhile) says so and leaves the day as it was.
  api.fail('POST', '/api/admin/day', { status: 409, error: 'day-has-runs' });
  await page.getByRole('combobox', { name: 'Race on 2026-11-12' }).selectOption({ label: SPAIN });
  await expect(page.getByText('The server said day-has-runs (409).')).toBeVisible();
  await expect(row(page, '2026-11-12')).toContainText(CANADA);
});

test('schedule the next days: all races, or only one', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const next = page.getByRole('textbox', { name: 'Days to schedule' });
  const which = page.getByRole('combobox', { name: 'Races to schedule' });
  await expect(next).toHaveValue('14');
  await expect(which).toHaveValue('');

  await next.fill('2');
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(
    page.getByText('Scheduled 2 new days (days already scheduled are kept).'),
  ).toBeVisible();
  expect(api.last('POST', '/api/admin/schedule')).toEqual({ from: TODAY, days: 2 });
  await expect(row(page, '2026-11-15')).toContainText(ABU);
  // A new day's race can be picked (six rows now).
  await page.getByRole('combobox', { name: 'Race on 2026-11-14' }).selectOption({ label: CANADA });
  await expect(page.getByText(`2026-11-14 is now ${CANADA}.`)).toBeVisible();
  await expect(row(page, '2026-11-14')).toContainText(CANADA);

  await next.fill('1');
  await which.selectOption({ label: `Only ${SPAIN}` });
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(
    page.getByText('Scheduled 1 new day (days already scheduled are kept).'),
  ).toBeVisible();
  expect(api.last('POST', '/api/admin/schedule')).toEqual({
    from: TODAY,
    days: 1,
    raceId: 'spain-2020',
  });
  await expect(row(page, '2026-11-16')).toContainText(SPAIN);

  // A count the server refuses.
  await next.fill('0');
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(page.getByText('The server said bad-request (400).')).toBeVisible();
  await expect(page.getByText('Scheduled', { exact: false })).toHaveCount(0);
});

test('re-pin stale days', async ({ page }) => {
  const api = await fakeAdmin(page, (s) => {
    s.today.stale = [s.schedule.days[2] as (typeof s.today.stale)[number]];
  });
  await signIn(page);
  await open(page);
  await expect(row(page, '2026-11-12')).toContainText('Stale: re-pin');
  await page.getByRole('button', { name: 'Re-pin stale days' }).click();
  await expect(page.getByText('Re-pinned 1 day(s) to the current race files.')).toBeVisible();
  expect(api.calls('POST', '/api/admin/repin').map((c) => c.body)).toEqual([{}]);
  await expect(row(page, '2026-11-12')).toContainText('Current');
  // The table reloads after every change.
  expect(api.calls('GET', '/api/admin/schedule')).toHaveLength(2);
});

test('clear my run today, then again with no run left', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await page.evaluate(() => localStorage.setItem('pitwall:run', '{"date":"2026-11-11"}'));
  await page.getByRole('button', { name: 'Clear my run today' }).click();
  await expect(
    page.getByText(`Cleared your run for ${TODAY}: you can play it again.`),
  ).toBeVisible();
  expect(api.calls('POST', '/api/admin/runs/clear').map((c) => c.body)).toEqual([{ date: TODAY }]);
  expect(await page.evaluate(() => localStorage.getItem('pitwall:run'))).toBeNull();
  await page.getByRole('button', { name: 'Clear my run today' }).click();
  await expect(page.getByText(`You have no run on ${TODAY}.`)).toBeVisible();
});

test('while a change runs the actions wait; an empty schedule', async ({ page }) => {
  const api = await fakeAdmin(page, (s) => {
    s.schedule.days = [];
  });
  await signIn(page);
  await open(page);
  await expect(page.getByText('Nothing scheduled around today. Use Schedule above.')).toBeVisible();
  const release = api.hold('POST', '/api/admin/runs/clear');
  await page.getByRole('button', { name: 'Clear my run today' }).click();
  for (const name of ['Schedule', 'Re-pin stale days', 'Clear my run today']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  release();
  await expect(page.getByRole('button', { name: 'Schedule', exact: true })).toBeEnabled();
});

test('the schedule failing to load', async ({ page }) => {
  const api = await fakeAdmin(page);
  api.fail('GET', '/api/admin/schedule', { status: 500, error: 'db-error' });
  await signIn(page);
  await openTab(page, '/admin/schedule');
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(TODAY) })).toHaveCount(0);
});
