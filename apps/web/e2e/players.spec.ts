// The admin Players tab (/admin/players) against a mocked players API: the summary, the table,
// search and sort, and the page staying within a phone's width. SHOTS=<dir> also saves desktop
// and phone screenshots.
import type { Page } from '@playwright/test';
import { expect, test } from './coverage.js';
import { token } from './screens/adminApi.js';

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function player(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name: '',
    email: `${id}@example.com`,
    displayName: '',
    favouriteTeam: '',
    provider: 'google',
    createdAt: day(30),
    devices: 1,
    dailyRuns: 0,
    gauntletRuns: 0,
    lastPlayed: null,
    ...over,
  };
}

async function mockPlayers(page: Page) {
  const players = [
    player('new', { name: 'New Player', createdAt: day(1), provider: 'email' }),
    player('fan', {
      name: 'Fan Person',
      displayName: 'Undercut',
      favouriteTeam: 'McLaren',
      createdAt: day(10),
      devices: 2,
      dailyRuns: 12,
      gauntletRuns: 3,
      lastPlayed: day(0),
    }),
    player('old', { name: 'Old Timer', createdAt: day(40), dailyRuns: 1, lastPlayed: day(20) }),
  ];
  await page.addInitScript((v) => sessionStorage.setItem('pitwall:admin-token', v), token());
  await page.route('**/api/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/admin/me') return route.fulfill({ json: { email: 'admin@example.com' } });
    if (path === '/api/admin/players') {
      return route.fulfill({ json: { total: players.length, players } });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
}

const shots = process.env.SHOTS;
const rowNames = (page: Page) =>
  page
    .locator('tbody tr')
    .evaluateAll((rows) => rows.map((r) => r.querySelector('td')?.textContent));

test('lists the accounts with a summary, search and sort', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockPlayers(page);
  await page.goto('/admin/players');

  await expect(page.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page');
  const stat = (label: string) => page.locator('dl > div', { hasText: label }).locator('dd');
  await expect(stat('Accounts')).toHaveText('3');
  await expect(stat('New in the last 7 days')).toHaveText('1');
  await expect(stat('Leaderboard name set')).toHaveText('1');
  await expect(stat('Have played')).toHaveText('2');

  await expect(page.locator('tbody tr')).toHaveCount(3);
  expect((await rowNames(page))[0]).toContain('New Player');
  const fan = page.locator('tbody tr', { hasText: 'Undercut' });
  await expect(fan).toContainText('Fan Person · fan@example.com');
  await expect(fan).toContainText('McLaren');
  await expect(page.locator('tbody tr', { hasText: 'New Player' })).toContainText('Email');
  if (shots) await page.screenshot({ path: `${shots}/players-desktop.png`, fullPage: true });

  await page.getByLabel('Sort').selectOption('most-played');
  expect((await rowNames(page))[0]).toContain('Undercut');

  await page.getByLabel('Search players').fill('timer');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Old Timer');
  await page.getByLabel('Search players').fill('nobody');
  await expect(page.getByText('No players match the search.')).toBeVisible();

  // Each row's name opens that player's panel, and Close shuts it. (This mock has no player
  // API; admin-players.spec.ts checks the panel's contents.)
  await page.getByLabel('Search players').fill('');
  for (const name of ['New Player', 'Undercut', 'Old Timer']) {
    await page.getByRole('button', { name, exact: true }).click();
    const panel = page.getByRole('region', { name: 'Player' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(panel).toHaveCount(0);
  }
});

test('fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mockPlayers(page);
  await page.goto('/admin/players');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  if (shots) await page.screenshot({ path: `${shots}/players-phone.png`, fullPage: true });
});
