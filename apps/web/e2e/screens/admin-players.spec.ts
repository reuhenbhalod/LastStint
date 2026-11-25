// The admin Players tab (/admin/players, docs/test-suite-spec.md S3): the summary and list,
// search, sort, Refresh, a capped list, and a player's page: save or clear the display name
// (and a name the server refuses), hide and show on the leaderboards, their runs (open one,
// re-verify it), Close; with the empty, loading and error states. players.spec.ts covers the
// table's look and the phone width.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { fakeAdmin, openTab, signIn } from './adminApi.js';

const stat = (page: Page, label: string) =>
  page.locator('dl > div', { has: page.getByText(label, { exact: true }) }).locator('dd');
const firstCells = (page: Page) =>
  page
    .locator('tbody tr')
    .evaluateAll((rows) => rows.map((r) => r.querySelector('td button')?.textContent?.trim()));

test('summary, search, every sort and Refresh', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/players');
  await expect(stat(page, 'Accounts')).toHaveText('3');
  await expect(stat(page, 'New in the last 7 days')).toHaveText('1');
  await expect(stat(page, 'Leaderboard name set')).toHaveText('1');
  await expect(stat(page, 'Have played')).toHaveText('2');
  const nameless = page.locator('tbody tr').nth(2);
  await expect(nameless).toContainText('No name');
  await expect(nameless).toContainText('no email');
  await expect(page.locator('tbody tr', { hasText: 'bo@example.com' })).toContainText('Email');

  const sort = page.getByRole('combobox', { name: 'Sort' });
  await expect(sort).toHaveValue('newest');
  expect(await firstCells(page)).toEqual(['Fast Ann', 'Bo', 'No name']);
  await sort.selectOption('Last played');
  expect(await firstCells(page)).toEqual(['Fast Ann', 'No name', 'Bo']);
  await sort.selectOption('Most played');
  expect(await firstCells(page)).toEqual(['Fast Ann', 'Bo', 'No name']);
  await sort.selectOption('Newest');

  const search = page.getByRole('searchbox', { name: 'Search players' });
  await search.fill('mclaren');
  expect(await firstCells(page)).toEqual(['Fast Ann']);
  await search.fill('BO EXAMPLE');
  expect(await firstCells(page)).toEqual(['Bo']);
  await search.fill('nobody');
  await expect(page.getByText('No players match the search.')).toBeVisible();
  await search.fill('');
  await expect(page.locator('tbody tr')).toHaveCount(3);

  // Refresh: loading, then the server's list again.
  api.state.players.players.push({
    ...api.state.players.players[1],
    id: 'p4',
    name: 'Cy',
  } as never);
  api.state.players.total = 4;
  const release = api.hold('GET', '/api/admin/players');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  release();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  await expect(stat(page, 'Accounts')).toHaveText('4');
  await expect.poll(() => api.calls('GET', '/api/admin/players')).toHaveLength(2);
});

test('a capped list, no accounts and a load error', async ({ page }) => {
  const api = await fakeAdmin(page, (s) => {
    s.players.total = 950;
  });
  await signIn(page);
  await openTab(page, '/admin/players');
  await expect(page.getByText('Showing the newest 3 of 950 accounts.')).toBeVisible();

  api.state.players = { total: 0, players: [] };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('No accounts yet.')).toBeVisible();

  api.fail('GET', '/api/admin/players', { status: 401, error: 'bad-credential' });
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(
    page.getByText('Your sign-in has expired. Sign out and sign in again.'),
  ).toBeVisible();
});

test('a player: rename, clear the name, a refused name', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/players');
  await page.getByRole('button', { name: 'Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Player' });
  await expect(panel.getByRole('heading', { name: 'Fast Ann' })).toBeVisible();
  await expect(panel).toContainText('Ann · ann@example.com · joined 9 Nov 2026 · ID p1');
  await expect(stat(page, 'Current streak')).toHaveText('3');
  await expect(stat(page, 'Best streak')).toHaveText('5');
  await expect(stat(page, 'Days played')).toHaveText('9');
  await expect(stat(page, 'Browsers linked')).toHaveText('2');
  await expect(panel).toContainText('2026-11-11, 2026-11-10');
  await expect(panel).toContainText('p1-phone · linked 1 Nov 2026');

  const name = panel.getByRole('textbox', { name: 'Display name' });
  const save = panel.getByRole('button', { name: 'Save name' });
  await expect(name).toHaveValue('Fast Ann');
  await expect(save).toBeDisabled();
  await name.fill('Fast Ann ');
  await expect(save).toBeDisabled();
  await name.fill('x'.repeat(30));
  await expect(name).toHaveValue('x'.repeat(20));

  await name.fill('Quick Ann');
  await save.click();
  await expect(panel.getByText('Display name set to Quick Ann.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/players/p1/name'))
    .toEqual({ displayName: 'Quick Ann' });
  await expect(panel.getByRole('heading', { name: 'Quick Ann' })).toBeVisible();
  // The list reloads behind the panel.
  await page.getByRole('button', { name: 'Quick Ann' }).click();
  await expect(panel.getByRole('textbox', { name: 'Display name' })).toHaveValue('Quick Ann');

  // A name the server refuses.
  await name.fill('A!');
  await save.click();
  await expect(
    panel.getByText('a display name is 3-20 letters, digits or spaces (400)'),
  ).toBeVisible();

  await panel.getByRole('button', { name: 'Clear name' }).click();
  await expect(panel.getByText('Display name cleared.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/players/p1/name'))
    .toEqual({ displayName: '' });
  await expect(panel.getByRole('heading', { name: 'Ann' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Clear name' })).toBeDisabled();
  await expect(name).toHaveValue('');
  // The list shows the account name now; it opens the same player.
  await page.getByRole('button', { name: 'Ann', exact: true }).click();
  await expect(panel).toContainText('ID p1');
});

test('a player: hide and show, their runs, Close', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/players');
  await page.getByRole('button', { name: 'Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Player' });

  await panel.getByRole('button', { name: 'Hide from leaderboards' }).click();
  await expect(
    panel.getByText('Hidden from every leaderboard. They can still play.'),
  ).toBeVisible();
  await expect.poll(() => api.last('POST', '/api/admin/players/p1/hide')).toEqual({ hidden: true });
  await expect(panel.getByRole('heading', { name: /^Fast Ann\s*Hidden$/ })).toBeVisible();
  // The list marks them too; opening them from it keeps the panel on them.
  await page.getByRole('button', { name: /^Fast Ann\s*Hidden$/ }).click();
  await expect(panel.getByRole('button', { name: 'Show on leaderboards' })).toBeVisible();
  await panel.getByRole('button', { name: 'Show on leaderboards' }).click();
  await expect(panel.getByText('Shown on the leaderboards again.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/players/p1/hide'))
    .toEqual({ hidden: false });
  await expect(page.getByRole('button', { name: 'Fast Ann', exact: true })).toBeVisible();

  // Their runs, without the player column; open one and re-verify it.
  await expect(panel.locator('thead th')).toHaveText([
    'When',
    'Mode',
    'Race',
    'Score',
    'Result',
    'Check',
  ]);
  await panel.getByRole('button', { name: 'Open Daily run by Fast Ann' }).click();
  const run = panel.getByRole('region', { name: 'Run' });
  await expect(run).toContainText('Daily: Abu Dhabi 2021');
  await run.getByRole('button', { name: 'Re-verify' }).click();
  await expect(run.getByText('Marked 1 for the nightly check.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/runs/reverify'))
    .toEqual({ mode: 'daily', id: 'r1' });
  // Delete asks first; dismissed, nothing is sent.
  page.once('dialog', (d) => d.dismiss());
  await run.getByRole('button', { name: 'Delete run' }).click();
  await expect(run.getByRole('button', { name: 'Delete run' })).toBeVisible();
  expect(api.calls('POST', '/api/admin/runs/delete')).toEqual([]);
  await run.getByRole('button', { name: 'Close' }).click();
  await expect(run).toHaveCount(0);

  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toHaveCount(0);
});

test('a player with no runs, and one that is gone', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/players');
  await page.getByRole('button', { name: 'No name' }).click();
  const panel = page.getByRole('region', { name: 'Player' });
  await expect(panel.getByRole('heading', { name: 'No name' })).toBeVisible();
  await expect(panel).toContainText('None yet.');
  await expect(panel.getByText('No runs.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Clear name' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Close' }).click();

  api.fail('GET', '/api/admin/players/p2', { status: 404, error: 'no-player' });
  const release = api.hold('GET', '/api/admin/players/p2');
  await page.getByRole('button', { name: 'Bo' }).click();
  await expect(panel.getByText('Loading the player…')).toBeVisible();
  release();
  await expect(panel.getByText('The server said no-player (404).')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Save name' })).toHaveCount(0);
});
