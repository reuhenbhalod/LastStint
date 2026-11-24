// The admin page's sign-in states (docs/test-suite-spec.md S3): signed out (no Google client in
// a test build, so the card says sign-in isn't set up), an expired token, checking the token,
// signed in, signing out, an account off the admin list refused, a token the server rejects,
// an older server without the admin API, the server out of reach, and the header's links.
import { expect, test } from '../coverage.js';
import {
  EMAIL,
  NOW,
  STUB_PAGE,
  fakeAdmin,
  openTab,
  signIn,
  storedToken,
  token,
} from './adminApi.js';

const card = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: 'Admin sign-in' });

test('signed out: only the sign-in card, and no admin call', async ({ page }) => {
  const api = await fakeAdmin(page);
  for (const href of ['/admin', '/admin/schedule', '/admin/tickets']) {
    await page.goto(href);
    await expect(card(page)).toBeVisible();
    await expect(page.getByText('Sign-in isn’t set up.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    // A deployed build has no sign-in-free race list.
    await expect(page.getByRole('heading', { name: 'Play any race' })).toHaveCount(0);
  }
  expect(api.sent.filter((s) => s.path.startsWith('/api/admin'))).toEqual([]);
});

test('an expired token counts as signed out', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page, token(NOW - 60_000));
  await page.goto('/admin');
  await expect(card(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  expect(api.calls('GET', '/api/admin/me')).toEqual([]);
});

test('signed in: checks the token, then shows the tabs', async ({ page }) => {
  const api = await fakeAdmin(page);
  const t = token();
  await signIn(page, t);
  const release = api.hold('GET', '/api/admin/me');
  await page.goto('/admin');
  await expect(page.getByText('Checking your sign-in…')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
  await expect(card(page)).toHaveCount(0);
  release();
  await expect(page.getByText(EMAIL)).toBeVisible();
  await expect(page.getByText('Checking your sign-in…')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  // Every admin call carries the token.
  expect(api.calls('GET', '/api/admin/me')[0]?.auth).toBe(`Bearer ${t}`);
  expect(api.calls('GET', '/api/admin/today')[0]?.auth).toBe(`Bearer ${t}`);
});

test('sign out drops the token and stays signed out after a reload', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/players');
  await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(card(page)).toBeVisible();
  await expect(page.getByText(EMAIL)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Players' })).toHaveCount(0);
  expect(await storedToken(page)).toBeNull();
  await page.reload();
  await expect(card(page)).toBeVisible();
});

test('an account off the admin list is refused', async ({ page }) => {
  const api = await fakeAdmin(page);
  api.fail('GET', '/api/admin/me', { status: 403, error: 'not-admin' });
  await signIn(page);
  await page.goto('/admin');
  await expect(page.getByText('This account isn’t an admin.', { exact: false })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Today' })).toHaveCount(0);
  expect(api.calls('GET', '/api/admin/today')).toEqual([]);
  // The token stays (it's a real sign-in), so Sign out is how to try another account.
  expect(await storedToken(page)).not.toBeNull();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(card(page)).toBeVisible();
});

test('a token the server rejects is dropped', async ({ page }) => {
  const api = await fakeAdmin(page);
  api.fail('GET', '/api/admin/me', { status: 401, error: 'bad-credential' });
  await signIn(page);
  await page.goto('/admin');
  await expect(card(page)).toBeVisible();
  await expect(page.getByText('The server said bad-credential (401).')).toBeVisible();
  expect(await storedToken(page)).toBeNull();
});

test('a server without the admin API, and no server at all', async ({ page }) => {
  const api = await fakeAdmin(page);
  api.fail('GET', '/api/admin/me', { status: 404, error: 'not-found' });
  await signIn(page);
  await page.goto('/admin');
  await expect(
    page.getByText('The admin API isn’t on this server yet', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);

  api.fail('GET', '/api/admin/me', { status: 0, abort: true });
  await page.reload();
  await expect(page.getByText('Couldn’t reach the server. Check your connection.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
});

test('the header links go back to the game', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  for (const name of ['Back to the game', 'LastStint']) {
    await openTab(page, '/admin');
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(STUB_PAGE)).toBeVisible();
  }
});
