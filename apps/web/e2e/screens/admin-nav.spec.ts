// The admin page's tab bar and header (docs/test-suite-spec.md S3): from every tab, every tab
// link opens its tab (marked as the open one, with its own content), and the header's two links
// go back to the game. One test per tab, so they run side by side.
import { expect, test } from '../coverage.js';
import { STUB_PAGE, fakeAdmin, openTab, signIn } from './adminApi.js';

const TABS = [
  { label: 'Today', href: '/admin', heading: 'Today' },
  { label: 'Schedule', href: '/admin/schedule', heading: 'Daily schedule' },
  { label: 'Eras', href: '/admin/eras', heading: 'Eras' },
  { label: 'Runs', href: '/admin/runs', heading: 'Runs' },
  { label: 'Players', href: '/admin/players', heading: 'Players' },
  { label: 'Versus', href: '/admin/versus', heading: 'Versus' },
  { label: 'Stats', href: '/admin/stats', heading: 'Stats' },
  { label: 'Tickets', href: '/admin/tickets', heading: 'Tickets' },
  { label: 'Log', href: '/admin/log', heading: 'Log' },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

for (const from of TABS) {
  test(`from ${from.label}, every link opens its page`, async ({ page }) => {
    await fakeAdmin(page);
    await signIn(page);
    for (const to of TABS) {
      await openTab(page, from.href);
      const nav = page.getByRole('navigation', { name: 'Admin' });
      await expect(nav.getByRole('link', { name: from.label })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await nav.getByRole('link', { name: to.label }).click();
      await expect(page).toHaveURL(new RegExp(`${escapeRe(to.href)}$`));
      await expect(nav.getByRole('link', { name: to.label })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(
        page.getByRole('heading', { name: to.heading, exact: true }).first(),
      ).toBeVisible();
    }
    for (const name of ['Back to the game', 'LastStint']) {
      await openTab(page, from.href);
      await page.getByRole('link', { name, exact: true }).click();
      await expect(page.getByText(STUB_PAGE)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/');
    }
    // Sign out from this tab.
    await openTab(page, from.href);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
  });
}

test('an unknown admin path opens Today', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/nope');
  await expect(
    page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Today' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
});
