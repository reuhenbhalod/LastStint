// The admin page's Schedule tab (/admin/schedule) against a mocked admin API: signed out it
// only offers sign-in; signed in (a stand-in Google token in sessionStorage) it lists every
// playable race with a Play link and a preview, and runs the daily schedule; an account off
// the admin list is told so. admin-tabs.spec.ts opens every other tab.
import type { Page } from '@playwright/test';
import { expect, test } from './coverage.js';
import { token } from './screens/adminApi.js';

const today = '2026-11-03';
const email = 'admin@example.com';

async function signIn(page: Page) {
  const t = token();
  await page.addInitScript((value) => sessionStorage.setItem('pitwall:admin-token', value), t);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('signed out: only the sign-in card', async ({ page }) => {
  await page.goto('/admin/schedule');
  await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Play any race' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Daily schedule' })).toHaveCount(0);
});

test('signed in: plays any race and runs the schedule', async ({ page }) => {
  await signIn(page);
  const posted: Array<{ path: string; body: unknown; auth: string | null }> = [];
  let days = [
    { date: today, number: 1, raceId: 'abu-dhabi-2021', runs: 3, current: true },
    { date: '2026-11-04', number: 2, raceId: 'canada-2022', runs: 0, current: false },
  ];
  await page.route('**/api/admin/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'POST') {
      posted.push({ path, body: req.postDataJSON(), auth: req.headers().authorization ?? null });
    }
    if (path === '/api/admin/me') return route.fulfill({ json: { email } });
    if (path === '/api/admin/schedule' && req.method() === 'GET') {
      return route.fulfill({ json: { today, days } });
    }
    if (path === '/api/admin/schedule') {
      const added = [{ date: '2026-11-05', number: 3, raceId: 'spain-2020' }];
      days = [...days, { ...(added[0] as (typeof added)[number]), runs: 0, current: true }];
      return route.fulfill({ json: { added } });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });

  await page.goto('/admin/schedule');
  await expect(page.getByText(email)).toBeVisible();

  // Every playable race, with its goal and a Play link carrying the seed.
  const spain = page.locator('article', { hasText: 'Spain 2020: Verstappen vs Bottas' });
  await expect(spain).toContainText('Defend');
  await spain.getByRole('textbox').fill('1234');
  await expect(spain.getByRole('link', { name: 'Play' })).toHaveAttribute(
    'href',
    '/?race=spain-2020&seed=1234',
  );
  await expect(page.locator('article', { hasText: 'Abu Dhabi 2021' })).toContainText('Beat');

  // The preview opens beside the list without starting a race.
  await spain.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('complementary', { name: 'Race preview' });
  await expect(preview).toContainText('Spain 2020');
  await expect(preview).toContainText('Pools');
  await expect(preview).toContainText(/Moments \(\d+\)/);
  await expect(page).toHaveURL(/\/admin\/schedule$/);
  await preview.getByRole('button', { name: 'Close' }).click();
  await expect(preview).toHaveCount(0);

  // The schedule: today highlighted, a stale day flagged, then schedule more.
  await expect(page.getByRole('row', { name: new RegExp(`${today} · today`) })).toBeVisible();
  await expect(page.getByRole('row', { name: /2026-11-04/ })).toContainText('Stale: re-pin');
  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('Scheduled 1 new day')).toBeVisible();
  await expect(page.getByRole('row', { name: /2026-11-05/ })).toBeVisible();
  expect(posted).toEqual([
    {
      path: '/api/admin/schedule',
      body: { from: today, days: 14 },
      auth: expect.stringMatching(/^Bearer /),
    },
  ]);

  // Signing out drops the token and the admin sections.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily schedule' })).toHaveCount(0);
});

test('an account off the admin list is told so', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/admin/**', (route) =>
    route.fulfill({ status: 403, json: { error: 'not-admin' } }),
  );
  await page.goto('/admin');
  await expect(page.getByText('isn’t an admin')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily schedule' })).toHaveCount(0);
});
