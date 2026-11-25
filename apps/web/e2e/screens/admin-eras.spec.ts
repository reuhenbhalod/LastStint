// The admin Eras tab (/admin/eras, docs/test-suite-spec.md S3): publish and unpublish races,
// release an era now or on a date, move a released era (asks first), clear a release (asks
// first), and the refusals: an era short of published races, a released or scheduled era's
// published races locked, and the server refusing a change the page allowed.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { fakeAdmin, nextDialog, openTab, signIn } from './adminApi.js';

const eraCard = (page: Page, id: number) => page.getByRole('article', { name: `Era ${id}` });

async function open(page: Page) {
  await openTab(page, '/admin/eras');
  await expect(eraCard(page, 10)).toBeVisible();
}

test('each era: status, counts, races and what can be pressed', async ({ page }) => {
  await fakeAdmin(page, (s) => {
    const r = s.eras.eras[0]?.races[3];
    if (r) r.file = false;
  });
  await signIn(page);
  await open(page);
  await expect(page.getByRole('article')).toHaveCount(4);

  const e10 = eraCard(page, 10);
  await expect(e10.getByRole('heading')).toHaveText('Era 10: Ground-effect era 2022–2025');
  await expect(e10).toContainText('Coming soon');
  await expect(e10).toContainText('10 of 10 published');
  await expect(e10).toContainText('E10 Race 4 · no race file');
  await expect(e10.getByRole('button', { name: 'Release now' })).toBeEnabled();
  await expect(e10.getByRole('button', { name: 'Set date' })).toBeDisabled();
  await expect(e10.getByRole('button', { name: 'Clear release' })).toHaveCount(0);
  await expect(e10.getByRole('textbox', { name: 'Release date for era 10' })).toHaveValue('');
  const r1 = e10.getByRole('button', { name: 'E10 Race 1: Published' });
  await expect(r1).toHaveAttribute('aria-pressed', 'true');
  await expect(r1).toBeEnabled();

  // Short of published races: no release, and the reason.
  const e9 = eraCard(page, 9);
  await expect(e9).toContainText('9 of 10 published');
  await expect(e9).toContainText('Needs 10 published races to release (9 now).');
  await expect(e9.getByRole('button', { name: 'Release now' })).toBeDisabled();
  await e9.getByRole('textbox', { name: 'Release date for era 9' }).fill('2027-03-01');
  await expect(e9.getByRole('button', { name: 'Set date' })).toBeDisabled();
  await expect(e9.getByRole('button', { name: 'E9 Race 10: Draft' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // Released: published races locked, Release now off, Clear release on.
  const e8 = eraCard(page, 8);
  await expect(e8).toContainText('Released');
  await expect(e8).toContainText('Published races are locked while the era has a release date.');
  await expect(e8.getByRole('button', { name: 'Release now' })).toBeDisabled();
  await expect(e8.getByRole('button', { name: 'Clear release' })).toBeEnabled();
  const locked = e8.getByRole('button', { name: 'E8 Race 1: Published' });
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveAttribute('title', 'Clear the era’s release first');
  await expect(e8.getByRole('textbox', { name: 'Release date for era 8' })).toHaveValue(
    '2026-10-22',
  );

  // Scheduled: the date it releases, and its races locked too.
  const e7 = eraCard(page, 7);
  await expect(e7).toContainText('Releases on 1 Jan 2027');
  await expect(e7.getByRole('button', { name: 'Release now' })).toBeEnabled();
  await expect(e7.getByRole('button', { name: 'E7 Race 5: Published' })).toBeDisabled();
  await expect(e7.getByRole('textbox', { name: 'Release date for era 7' })).toHaveValue(
    '2027-01-01',
  );
});

test('publish and unpublish races; ten published unblocks the release', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const e9 = eraCard(page, 9);
  await e9.getByRole('button', { name: 'E9 Race 10: Draft' }).click();
  await expect(page.getByText('E9 Race 10 is published.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/race'))
    .toEqual({
      raceId: 'e9-race-10',
      published: true,
    });
  await expect(e9.getByRole('button', { name: 'E9 Race 10: Published' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(e9).toContainText('10 of 10 published');
  await expect(e9.getByRole('button', { name: 'Release now' })).toBeEnabled();
  await expect(e9).not.toContainText('Needs 10 published races');

  await e9.getByRole('button', { name: 'E9 Race 3: Published' }).click();
  await expect(page.getByText('E9 Race 3 is back to Draft.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/race'))
    .toEqual({
      raceId: 'e9-race-3',
      published: false,
    });
  await expect(e9).toContainText('9 of 10 published');
  await expect(e9.getByRole('button', { name: 'Release now' })).toBeDisabled();
});

test('release an era now, or set a date', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const e10 = eraCard(page, 10);
  const date = e10.getByRole('textbox', { name: 'Release date for era 10' });
  await date.fill('2027-02-01');
  await e10.getByRole('button', { name: 'Set date' }).click();
  await expect(page.getByText('Era 10 releases on 2027-02-01.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/release'))
    .toEqual({ eraId: 10, at: '2027-02-01' });
  await expect(e10).toContainText('Releases on 1 Feb 2027');
  // Scheduled now, so its races lock.
  await expect(e10.getByRole('button', { name: 'E10 Race 1: Published' })).toBeDisabled();

  await e10.getByRole('button', { name: 'Release now' }).click();
  await expect(page.getByText('Era 10 is released.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/release'))
    .toEqual({ eraId: 10, at: 'now' });
  await expect(e10.getByText('Released', { exact: true })).toBeVisible();
  await expect(e10.getByRole('button', { name: 'Release now' })).toBeDisabled();
  await expect(date).toHaveValue('2026-11-11');
});

test('a released era: moving it later asks first, earlier does not', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const e8 = eraCard(page, 8);
  const date = e8.getByRole('textbox', { name: 'Release date for era 8' });
  const setDate = e8.getByRole('button', { name: 'Set date' });

  await date.fill('2027-02-01');
  let asked = nextDialog(page, false);
  await setDate.click();
  expect(await asked).toBe(
    'Era 8 is out now. Move it to 2027-02-01? Players lose access until then.',
  );
  expect(api.calls('POST', '/api/admin/eras/release')).toEqual([]);
  await expect(e8.getByText('Released', { exact: true })).toBeVisible();

  asked = nextDialog(page, true);
  await setDate.click();
  await asked;
  await expect(page.getByText('Era 8 releases on 2027-02-01.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/release'))
    .toEqual({
      eraId: 8,
      at: '2027-02-01',
      confirm: true,
    });
  await expect(e8).toContainText('Releases on 1 Feb 2027');

  // A scheduled era moved earlier (to a past day): no question, no confirm flag.
  let dialogs = 0;
  page.on('dialog', () => {
    dialogs += 1;
  });
  await date.fill('2026-11-01');
  await setDate.click();
  await expect(page.getByText('Era 8 releases on 2026-11-01.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/release'))
    .toEqual({ eraId: 8, at: '2026-11-01' });
  expect(dialogs).toBe(0);
});

test('clear a release asks first, then unlocks the races', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const e8 = eraCard(page, 8);
  let asked = nextDialog(page, false);
  await e8.getByRole('button', { name: 'Clear release' }).click();
  expect(await asked).toBe('Put era 8 back to Coming soon? Players lose access to it.');
  expect(api.calls('POST', '/api/admin/eras/release')).toEqual([]);

  asked = nextDialog(page, true);
  await e8.getByRole('button', { name: 'Clear release' }).click();
  await asked;
  await expect(page.getByText('Era 8 is back to Coming soon.')).toBeVisible();
  await expect
    .poll(() => api.last('POST', '/api/admin/eras/release'))
    .toEqual({
      eraId: 8,
      at: null,
      confirm: true,
    });
  await expect(e8).toContainText('Coming soon');
  await expect(e8.getByRole('button', { name: 'Clear release' })).toHaveCount(0);
  await expect(e8.getByRole('button', { name: 'E8 Race 1: Published' })).toBeEnabled();
  await expect(e8).not.toContainText('Published races are locked');
  await expect(e8.getByRole('textbox', { name: 'Release date for era 8' })).toHaveValue('');
});

test('the server refusing a change the page allowed', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const e10 = eraCard(page, 10);
  // Another admin scheduled the era meanwhile: unpublishing is refused.
  api.fail('POST', '/api/admin/eras/race', {
    status: 409,
    error: 'era-released',
    detail: 'this era is released or scheduled; clear its release date first',
  });
  await e10.getByRole('button', { name: 'E10 Race 2: Published' }).click();
  await expect(
    page.getByText('this era is released or scheduled; clear its release date first (409)'),
  ).toBeVisible();
  await expect(e10.getByRole('button', { name: 'E10 Race 2: Published' })).toBeVisible();

  // Another admin unpublished a race meanwhile: the release is refused.
  const first = api.state.eras.eras[0];
  if (first) first.published = 9;
  await e10.getByRole('button', { name: 'Release now' }).click();
  await expect(
    page.getByText('an era needs 10 published races to be released (this one has 9) (409)'),
  ).toBeVisible();
  await expect(page.getByText('Era 10 is released.')).toHaveCount(0);
  await expect(e10).toContainText('Coming soon');
});

test('while a change runs every button waits; no eras; a load error', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const release = api.hold('POST', '/api/admin/eras/race');
  const e10 = eraCard(page, 10);
  await e10.getByRole('button', { name: 'E10 Race 2: Published' }).click();
  await expect(e10.getByRole('button', { name: 'Release now' })).toBeDisabled();
  await expect(eraCard(page, 9).getByRole('button', { name: 'E9 Race 10: Draft' })).toBeDisabled();
  await expect(eraCard(page, 8).getByRole('button', { name: 'Clear release' })).toBeDisabled();
  release();
  await expect(page.getByText('E10 Race 2 is back to Draft.')).toBeVisible();

  api.state.eras.eras = [];
  await page.reload();
  await expect(page.getByText('No eras in the database.')).toBeVisible();

  api.fail('GET', '/api/admin/eras', { status: 500, error: 'db-error' });
  await page.reload();
  await expect(page.getByText('The server said db-error (500).')).toBeVisible();
  await expect(page.getByText('Loading eras…')).toHaveCount(0);
});
