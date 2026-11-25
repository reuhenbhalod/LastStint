// The admin Runs tab (/admin/runs, docs/test-suite-spec.md S3): the day's runs, the search
// (date, player, mode; no date with a player), a run's calls and rounds, Re-verify one run or
// every run on the day (asks first), Delete a daily run (asks first), Close; with the empty,
// loading and error states.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { TODAY, fakeAdmin, nextDialog, openTab, signIn } from './adminApi.js';

const rows = (page: Page) => page.locator('section > div > table > tbody > tr');

async function open(page: Page) {
  await openTab(page, '/admin/runs');
  await expect(page.getByRole('button', { name: 'Open Daily run by Fast Ann' })).toBeVisible();
}

test('the day’s runs, and the search', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await expect
    .poll(() => api.calls('GET', '/api/admin/runs').map((c) => c.query))
    .toEqual([`date=${TODAY}`]);
  await expect(page.getByLabel('Date (UTC)')).toHaveValue(TODAY);
  await expect(page.getByRole('combobox', { name: 'Mode' })).toHaveValue('');
  await expect(rows(page)).toHaveCount(3);
  const gauntlet = rows(page).filter({ hasText: 'Undercut' });
  await expect(gauntlet).toContainText('Gauntlet');
  await expect(gauntlet).toContainText('72.5');
  await expect(gauntlet.getByRole('cell').nth(3)).toHaveText('—');
  await expect(gauntlet.getByRole('button')).toHaveText('Corrected');
  const eras = rows(page).filter({ hasText: 'Guest 4821' });
  await expect(eras).toContainText('not signed in');
  await expect(eras.getByRole('cell').nth(4)).toHaveText('—');
  await expect(eras.getByRole('button')).toHaveText('Verified');
  await expect(rows(page).first().getByRole('button')).toHaveText('Not checked yet');
  await expect(page.getByText('Newest first, 200 at most.', { exact: false })).toBeVisible();

  // A player and a mode.
  await page.getByRole('searchbox', { name: 'Player' }).fill('  bo ');
  await page.getByRole('combobox', { name: 'Mode' }).selectOption('Gauntlet');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect
    .poll(() => api.calls('GET', '/api/admin/runs').at(-1)?.query)
    .toBe(`date=${TODAY}&player=bo&mode=gauntlet`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: `Re-verify every Gauntlet run on ${TODAY}` }).click();
  await expect(
    page.getByText(`Marked 1 Gauntlet runs on ${TODAY} for the nightly check.`),
  ).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/runs/reverify'))
    .toEqual({ date: TODAY, mode: 'gauntlet' });

  // No date: every day, for the player; the day's re-verify goes.
  await page.getByLabel('Date (UTC)').fill('');
  await page.getByRole('combobox', { name: 'Mode' }).selectOption('All modes');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect
    .poll(() => api.calls('GET', '/api/admin/runs').at(-1)?.query)
    .toBe('date=&player=bo');
  await expect(page.getByRole('button', { name: /^Re-verify every/ })).toHaveCount(0);

  // A day with nothing.
  await page.getByLabel('Date (UTC)').fill('2026-01-01');
  await page.getByRole('searchbox', { name: 'Player' }).fill('');
  await page.getByRole('combobox', { name: 'Mode' }).selectOption('Eras');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('No runs.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Re-verify every Eras run on 2026-01-01' }),
  ).toBeVisible();
});

test('re-verify every run on the day asks first', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const day = page.getByRole('button', { name: `Re-verify every run on ${TODAY}` });
  let asked = nextDialog(page, false);
  await day.click();
  expect(await asked).toBe(`Mark every run on ${TODAY} for the nightly check?`);
  expect(api.calls('POST', '/api/admin/runs/reverify')).toEqual([]);

  asked = nextDialog(page, true);
  await day.click();
  await asked;
  await expect(page.getByText(`Marked 3 runs on ${TODAY} for the nightly check.`)).toBeVisible();
  await expect.poll(() => api.last('POST', '/api/admin/runs/reverify')).toEqual({ date: TODAY });

  // In one mode.
  await page.getByRole('combobox', { name: 'Mode' }).selectOption('Daily');
  await page.getByRole('button', { name: 'Search' }).click();
  asked = nextDialog(page, true);
  await page.getByRole('button', { name: `Re-verify every Daily run on ${TODAY}` }).click();
  expect(await asked).toBe(`Mark every Daily run on ${TODAY} for the nightly check?`);
  await expect(
    page.getByText(`Marked 1 Daily runs on ${TODAY} for the nightly check.`),
  ).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/runs/reverify'))
    .toEqual({ date: TODAY, mode: 'daily' });

  // Refused.
  api.fail('POST', '/api/admin/runs/reverify', { status: 429, error: 'rate-limited' });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: `Re-verify every Daily run on ${TODAY}` }).click();
  await expect(page.getByText('The server said rate-limited (429).')).toBeVisible();
});

test('a daily run: its calls, re-verify, delete (asks first)', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await page.getByRole('button', { name: 'Open Daily run by Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Run' });
  await expect(panel.getByRole('heading', { name: 'Daily: Abu Dhabi 2021' })).toBeVisible();
  await expect(panel).toContainText(`Fast Ann · ${TODAY} 10:00 UTC · Not checked yet`);
  const calls = panel.locator('tbody tr');
  await expect(calls).toHaveCount(2);
  await expect(calls.nth(0).getByRole('cell')).toHaveText([
    '53',
    'SC stop',
    'Box: hards',
    'green',
    'Box: hards',
    'Box: hards (matched)',
  ]);
  await expect(calls.nth(1).getByRole('cell')).toHaveText([
    '53',
    'VSC',
    'Stay out',
    'red',
    'Box',
    'Box',
  ]);

  await panel.getByRole('button', { name: 'Re-verify' }).click();
  await expect(panel.getByText('Marked 1 for the nightly check.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/runs/reverify'))
    .toEqual({ mode: 'daily', id: 'r1' });

  let asked = nextDialog(page, false);
  await panel.getByRole('button', { name: 'Delete run' }).click();
  expect(await asked).toBe(`Delete this daily run by Fast Ann on ${TODAY}? It can’t be undone.`);
  expect(api.calls('POST', '/api/admin/runs/delete')).toEqual([]);

  asked = nextDialog(page, true);
  await panel.getByRole('button', { name: 'Delete run' }).click();
  await asked;
  await expect(panel.getByText('Run deleted.')).toBeVisible();
  await expect(panel.getByText('This run was deleted.')).toBeVisible();
  await expect.poll(() => api.last('POST', '/api/admin/runs/delete')).toEqual({ id: 'r1' });
  await expect(rows(page)).toHaveCount(2);
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toHaveCount(0);
});

test('a Gauntlet run’s rounds and an Eras run: no delete', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await page.getByRole('button', { name: 'Open Gauntlet run by Undercut' }).click();
  const panel = page.getByRole('region', { name: 'Run' });
  await expect(panel.getByRole('heading', { name: 'Gauntlet: abu-dhabi-2021' })).toBeVisible();
  await expect(panel.getByText('Round 1: Spain 2020 · won · 85 · corrected')).toBeVisible();
  await expect(panel.getByText('Round 2: Canada 2022 · not finished')).toBeVisible();
  await expect(panel.getByText('No calls.')).toBeVisible();
  await expect(panel.locator('tbody tr').first()).toContainText('Cliff');
  await expect(panel.getByRole('button', { name: 'Delete run' })).toHaveCount(0);

  // Opening another run swaps the panel.
  await page.getByRole('button', { name: 'Open Eras run by Guest 4821' }).click();
  await expect(panel.getByRole('heading', { name: 'Eras: Monaco 1984' })).toBeVisible();
  await expect(panel.getByText('No calls.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Delete run' })).toHaveCount(0);

  // A new search closes it.
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(panel).toHaveCount(0);
});

test('loading, a run that is gone, and the search failing', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  const release = api.hold('GET', '/api/admin/runs');
  await openTab(page, '/admin/runs');
  await expect(page.getByText('Loading runs…')).toBeVisible();
  release();
  await expect(rows(page)).toHaveCount(3);

  api.fail('GET', '/api/admin/runs/daily/r1', { status: 404, error: 'no-run' });
  await page.getByRole('button', { name: 'Open Daily run by Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Run' });
  await expect(panel.getByText('The server said no-run (404).')).toBeVisible();
  await expect(panel.getByText('Loading the run…')).toHaveCount(0);

  api.fail('GET', '/api/admin/runs', { status: 0, abort: true });
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Couldn’t reach the server. Check your connection.')).toBeVisible();
});
