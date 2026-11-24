// The admin page's read-only tabs (docs/test-suite-spec.md S3): Stats (every section, the
// empty tables, Refresh, an error), Log (the entries, the Action filter, Load older, empty, an
// error) and Versus (the live rooms and recent matches, read only: Refresh, empty, an error).
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { EMAIL, TODAY, fakeAdmin, openTab, signIn } from './adminApi.js';

const tile = (page: Page, label: string) =>
  page.locator('dl > div', { has: page.getByText(label, { exact: true }) }).locator('dd');
/** Each body row of the n-th table, as its cells' text. */
const table = (page: Page, n: number) =>
  page
    .getByRole('table')
    .nth(n)
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent?.trim())),
    );

test('Stats: every section, Refresh, empty tables and an error', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/stats');
  await expect(
    page.getByText(`2026-10-13 to ${TODAY} (UTC), from stored runs only.`),
  ).toBeVisible();
  // Newest day first.
  expect(await table(page, 0)).toEqual([
    [TODAY, '12', '90%', '71.5'],
    ['2026-11-10', '9', '75%', '64.2'],
  ]);
  expect(await table(page, 1)).toEqual([
    [TODAY, 'Abu Dhabi 2021', '53', 'Stay out', '5', '42%'],
    ['2026-11-10', 'Spain 2020', '—', 'Box: hards', '2', '20%'],
  ]);
  await expect(tile(page, 'Runs started')).toHaveText('30');
  await expect(tile(page, 'Started in 30 days')).toHaveText('12');
  await expect(tile(page, 'Best run')).toHaveText('6 rounds, Fast Ann');
  expect(await table(page, 2)).toEqual([
    ['1', '14'],
    ['2', '8'],
  ]);
  await expect(
    page.getByText('2 players have at least one normal star.', { exact: false }),
  ).toBeVisible();
  expect(await table(page, 3)).toEqual([['10: Ground-effect era', '4', '5', '2']]);
  await expect(page.getByText('4 matches stored.')).toBeVisible();
  expect(await table(page, 4)).toEqual([
    [TODAY, '3'],
    ['2026-11-10', '1'],
  ]);
  await expect(tile(page, 'Accounts')).toHaveText('20');
  await expect(tile(page, 'Daily players in 30 days')).toHaveText('40');
  await expect(tile(page, 'Of them signed in')).toHaveText('25%');
  expect(await table(page, 5)).toEqual([
    [TODAY, '2'],
    ['2026-11-10', '1'],
  ]);

  // Refresh: nothing stored yet.
  const s = api.state.stats;
  s.daily = { days: [], missed: [] };
  s.gauntlet = { started: 0, startedRecent: 0, rounds: [], best: null };
  s.eras = { eras: [], playersWithStar: 0 };
  s.versus = { days: [], total: 0 };
  s.accounts = { total: 0, days: [], signedInShare: 0, recentPlayers: 0 };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('None yet.', { exact: true })).toHaveCount(6);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(tile(page, 'Best run')).toHaveText('None yet');
  await expect(tile(page, 'Of them signed in')).toHaveText('0%');
  expect(api.calls('GET', '/api/admin/stats')).toHaveLength(2);

  api.fail('GET', '/api/admin/stats', { status: 500, error: 'db-error' });
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
});

test('Stats loading', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  const release = api.hold('GET', '/api/admin/stats');
  await openTab(page, '/admin/stats');
  await expect(page.getByText('Loading…')).toBeVisible();
  release();
  await expect(tile(page, 'Runs started')).toHaveText('30');
  await expect(page.getByText('Loading…')).toHaveCount(0);
});

test('Log: the entries, the Action filter, empty and an error', async ({ page, isMobile }) => {
  const api = await fakeAdmin(page, (s) => {
    s.log.entries.push({
      id: 0,
      at: `${TODAY}T04:00:00.000Z`,
      email: EMAIL,
      action: 'mystery',
      detail: { a: 1 },
    });
  });
  await signIn(page);
  await openTab(page, '/admin/log');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText(`${TODAY} 07:00:00`);
  await expect(rows.nth(0).locator('td').nth(2)).toHaveText('Publish race');
  await expect(rows.nth(0).locator('td').nth(3)).toHaveText('race-1 published');
  await expect(rows.nth(1).locator('td').nth(3)).toHaveText('Era 10 back to Coming soon');
  await expect(rows.nth(2).locator('td').nth(3)).toHaveText('Set: Servers move tonight.');
  // An action the page doesn't know reads as its id and its detail.
  await expect(rows.nth(3).locator('td').nth(2)).toHaveText('mystery');
  await expect(rows.nth(3).locator('td').nth(3)).toHaveText('{"a":1}');
  // Who: its own column on a wide screen, under the time on a phone.
  await expect(page.locator('thead th', { hasText: 'Who' })).toBeVisible({ visible: !isMobile });
  await expect(page.getByRole('button', { name: 'Load older' })).toHaveCount(0);

  const action = page.getByRole('combobox', { name: 'Action' });
  await expect(action).toHaveValue('');
  await action.selectOption('Release era');
  await expect(rows).toHaveCount(1);
  expect(api.calls('GET', '/api/admin/log').at(-1)?.query).toBe('action=release');
  await action.selectOption('Delete ticket');
  await expect(page.getByText('No changes logged yet.')).toBeVisible();
  await action.selectOption('All');
  await expect(rows).toHaveCount(4);
  expect(api.calls('GET', '/api/admin/log').at(-1)?.query).toBe('');

  api.fail('GET', '/api/admin/log', { status: 500, error: 'db-error' });
  await action.selectOption('Schedule');
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
});

test('Log: Load older pages back 200 at a time', async ({ page }) => {
  const api = await fakeAdmin(page, (s) => {
    s.log.entries = Array.from({ length: 205 }, (_, i) => ({
      id: 205 - i,
      at: `${TODAY}T07:00:00.000Z`,
      email: EMAIL,
      action: 'hide',
      detail: { id: `p${205 - i}`, hidden: true },
    }));
  });
  await signIn(page);
  await openTab(page, '/admin/log');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(200);
  await expect(rows.last()).toContainText('p6 hidden from leaderboards');
  await page.getByRole('button', { name: 'Load older' }).click();
  await expect(rows).toHaveCount(205);
  expect(api.calls('GET', '/api/admin/log').at(-1)?.query).toBe('before=6');
  await expect(rows.last()).toContainText('p1 hidden from leaderboards');
  await expect(page.getByRole('button', { name: 'Load older' })).toHaveCount(0);
});

test('Versus: live rooms and recent matches, read only', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/versus');
  await expect(page.getByRole('heading', { name: 'Live rooms (2)' })).toBeVisible();
  expect(await table(page, 0)).toEqual([
    ['QWER', 'Monza', 'Racing', 'Alex, Sam', '4', `${TODAY} 09:00`],
    ['ZXCV', 'not-a-track', 'Waiting for a player', '—', '0', `${TODAY} 09:30`],
  ]);
  expect(await table(page, 1)).toEqual([
    [
      `${TODAY} 08:03`,
      'ABCD',
      'Bahrain',
      'Alex (Bullet, soft) vs Sam (Glider, medium)',
      'Alex won by 1.4 s',
      '2',
    ],
    [`${TODAY} 07:01`, 'EFGH', 'Monza', 'Kim vs', 'Player 2 won (Kim left)', '0'],
    [`${TODAY} 06:04`, 'IJKL', 'Monza', 'Lee vs Max', 'No result', '1'],
  ]);
  // Nothing on the tab changes anything.
  await expect(page.getByRole('main').getByRole('button')).toHaveText(['Refresh']);

  api.state.versus = { rooms: [], matches: [] };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('No rooms open now.')).toBeVisible();
  await expect(page.getByText('No finished matches yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live rooms (0)' })).toBeVisible();
  expect(api.sent.filter((s) => s.method !== 'GET')).toEqual([]);

  api.fail('GET', '/api/admin/versus', { status: 500, error: 'db-error' });
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
});

test('Versus loading', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  const release = api.hold('GET', '/api/admin/versus');
  await openTab(page, '/admin/versus');
  await expect(page.getByText('Loading…')).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: 'Live rooms (2)' })).toBeVisible();
});
