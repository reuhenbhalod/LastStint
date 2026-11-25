// The admin Today tab (/admin, docs/test-suite-spec.md S3): the health check (today's and
// tomorrow's race, the queue, the runs, stale days) with Refresh and Re-pin, and the
// announcement: set it (text, tone, end time), see it showing, clear it, and the errors.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { TODAY, fakeAdmin, openTab, signIn } from './adminApi.js';

const tile = (page: Page, label: string) =>
  page.locator('dl > div', { has: page.getByText(label, { exact: true }) }).locator('dd');

test('the health check, Refresh and Re-pin stale days', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin');

  await expect(page.getByText(`Today (${TODAY})`)).toBeVisible();
  await expect(page.getByText(`#40 · ${TODAY} · 2 runs`, { exact: true })).toBeVisible();
  await expect(page.getByText('#41 · 2026-11-12 · 0 runs · stale')).toBeVisible();
  await expect(tile(page, 'Days queued (warn under 7)')).toHaveText('3');
  await expect(tile(page, 'Runs today')).toHaveText('12');
  await expect(tile(page, 'Verified')).toHaveText('10');
  await expect(tile(page, 'Corrected')).toHaveText('1');
  await expect(tile(page, 'Not verified yet')).toHaveText('2');
  await expect(
    page.getByText('The queue is low. Schedule more days on the Schedule tab.'),
  ).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText([
    '2026-11-12 · Spain 2020',
    '2026-11-13 · Canada 2022 · 1 runs (kept as it is)',
  ]);

  // Refresh reads the server again.
  api.state.today.runs.total = 13;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(tile(page, 'Runs today')).toHaveText('13');
  await expect.poll(() => api.calls('GET', '/api/admin/today')).toHaveLength(2);

  // Re-pin: the day without runs is re-pinned, the one with runs left; the list reloads.
  await page.getByRole('button', { name: 'Re-pin stale days' }).click();
  await expect(page.getByText('Re-pinned 1 day(s); 1 with runs left as they were.')).toBeVisible();
  await expect.poll(() => api.calls('POST', '/api/admin/repin').map((c) => c.body)).toEqual([{}]);
  await expect(page.getByRole('listitem')).toHaveText([
    '2026-11-13 · Canada 2022 · 1 runs (kept as it is)',
  ]);
  await expect.poll(() => api.calls('GET', '/api/admin/today')).toHaveLength(3);

  // A failed re-pin says why.
  api.fail('POST', '/api/admin/repin', { status: 500, error: 'db-error' });
  await page.getByRole('button', { name: 'Re-pin stale days' }).click();
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
});

test('nothing scheduled, a full queue and no stale days', async ({ page }) => {
  await fakeAdmin(page, (s) => {
    s.today.days = { today: null, tomorrow: null };
    s.today.queue = { days: 20, low: false, warnUnder: 7 };
    s.today.stale = [];
    s.today.runs = { total: 0, verified: 0, corrected: 0, unverified: 0 };
  });
  await signIn(page);
  await openTab(page, '/admin');
  await expect(page.getByText('Not scheduled')).toHaveCount(2);
  await expect(tile(page, 'Days queued (warn under 7)')).toHaveText('20');
  await expect(page.getByText('The queue is low.', { exact: false })).toHaveCount(0);
  await expect(
    page.getByText('Every scheduled day pins its race file’s current version.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-pin stale days' })).toBeDisabled();
});

test('the health check failing to load', async ({ page }) => {
  const api = await fakeAdmin(page);
  api.fail('GET', '/api/admin/today', { status: 500, error: 'db-error' });
  await signIn(page);
  await openTab(page, '/admin');
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Stale days' })).toHaveCount(0);
  // Refresh tries again.
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Stale days' })).toBeVisible();
});

test('set an announcement with a tone and an end time, then clear it', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  const release = api.hold('GET', '/api/announcement');
  await openTab(page, '/admin');
  const showing = page.locator('.card', { hasText: 'Showing now' });
  await expect(showing).toContainText('Loading…');
  release();
  await expect(showing).toContainText('No announcement.');

  const text = page.getByRole('textbox', { name: 'New announcement' });
  const tone = page.getByRole('combobox', { name: 'Tone' });
  const ends = page.getByLabel('Ends (UTC, optional)');
  const set = page.getByRole('button', { name: 'Set announcement' });
  await expect(set).toBeDisabled();
  await text.fill('   ');
  await expect(set).toBeDisabled();
  // At most 280 characters.
  await text.fill('x'.repeat(300));
  await expect(text).toHaveValue('x'.repeat(280));

  await text.fill('Servers move tonight.');
  await expect(tone).toHaveValue('info');
  await tone.selectOption('Warning');
  await ends.fill('2026-11-12T06:00');
  await set.click();
  await expect(page.getByText('Announcement set.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/announcement'))
    .toEqual({
      text: 'Servers move tonight.',
      tone: 'warning',
      endsAt: '2026-11-12T06:00:00.000Z',
    });
  await expect(showing).toContainText(
    'Servers move tonight. (warning, until 2026-11-12 06:00 UTC)',
  );
  // The form empties (the tone stays as picked).
  await expect(text).toHaveValue('');
  await expect(ends).toHaveValue('');
  await expect(tone).toHaveValue('warning');

  // Clear.
  await showing.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Announcement cleared.')).toBeVisible();
  await expect
    .poll(() => api.calls('POST', '/api/admin/announcement/clear').map((c) => c.body))
    .toEqual([{}]);
  await expect(showing).toContainText('No announcement.');
  await expect(showing.getByRole('button', { name: 'Clear' })).toHaveCount(0);
});

test('an info announcement with no end, and a refused one', async ({ page }) => {
  const api = await fakeAdmin(page, (s) => {
    s.announcement = {
      id: 3,
      text: 'New races this week.',
      tone: 'info',
      endsAt: null,
      createdAt: `${TODAY}T08:00:00.000Z`,
    };
  });
  await signIn(page);
  await openTab(page, '/admin');
  const showing = page.locator('.card', { hasText: 'Showing now' });
  await expect(showing).toContainText('New races this week. (info)');

  api.fail('POST', '/api/admin/announcement', {
    status: 400,
    error: 'bad-request',
    detail: 'endsAt must be in the future',
  });
  await page.getByRole('textbox', { name: 'New announcement' }).fill('Back soon.');
  await page.getByLabel('Ends (UTC, optional)').fill('2026-11-01T06:00');
  await page.getByRole('button', { name: 'Set announcement' }).click();
  await expect(page.getByText('endsAt must be in the future (400)')).toBeVisible();
  // Nothing changed, and the form keeps what was typed.
  await expect(showing).toContainText('New races this week. (info)');
  await expect(page.getByRole('textbox', { name: 'New announcement' })).toHaveValue('Back soon.');

  // While a change runs, the buttons wait.
  const release = api.hold('POST', '/api/admin/announcement/clear');
  await showing.getByRole('button', { name: 'Clear' }).click();
  await expect(showing.getByRole('button', { name: 'Clear' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Set announcement' })).toBeDisabled();
  release();
  await expect(page.getByText('Announcement cleared.')).toBeVisible();
});
