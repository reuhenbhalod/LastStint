// The account (docs/test-suite-spec.md S3; docs/auth0-spec.md): the top bar's streak and account
// menu signed out and signed in, the profile sheet (every field and button, the favourite team's
// colour), signing out, and the announcement banner (dismissed for good in this browser).
//
// Signed in or not is the server's answer to GET /api/players/:id (`account`), mocked here, as
// players.spec.ts mocks the admin API. The test build has no Auth0 or Google client configured
// (no VITE_AUTH0_* / VITE_GOOGLE_CLIENT_ID), so there's no "Sign in" button and no sign-in token:
// Save on the profile can only say the sign-in has expired (a token's save is unit-tested).
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';

const ME = 'player-1';
const ID_KEY = 'pitwall:anonId';

interface Account {
  playerId: string;
  name: string;
  email: string;
  displayName?: string;
  favouriteTeam?: string;
  admin?: boolean;
}

const account = (over: Partial<Account> = {}): Account => ({
  playerId: ME,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  displayName: 'Undercut',
  favouriteTeam: 'McLaren',
  ...over,
});

interface Mock {
  /** The account for player ME (signed in); none: signed out. */
  account?: Account | null;
  streak?: { current: number; best: number; days: number };
  /** The players API fails. */
  fail?: boolean;
  announcement?: Record<string, unknown> | null;
}

/** Mocks the API for the Gauntlet's lobby (where the top bar loads its own account). */
async function mock(page: Page, m: Mock = {}) {
  const asked: string[] = [];
  const posted: string[] = [];
  await page.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(k as string, v as string);
      }
    },
    [ID_KEY, ME],
  );
  // Signing out reaches for Google's script (to stop its auto sign-in): not from a test.
  await page.context().route(/accounts\.google\.com/, (r) => r.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'POST') posted.push(url.pathname);
    const who = url.pathname.match(/^\/api\/players\/([^/]+)$/);
    if (who) {
      asked.push(who[1] as string);
      if (m.fail) return route.fulfill({ status: 500, json: { error: 'boom' } });
      return route.fulfill({
        json: {
          account: who[1] === ME ? (m.account ?? null) : null,
          streak:
            who[1] === ME
              ? (m.streak ?? { current: 0, best: 0, days: 0 })
              : { current: 0, best: 0, days: 0 },
        },
      });
    }
    if (url.pathname === '/api/announcement')
      return route.fulfill({ json: { announcement: m.announcement ?? null } });
    if (url.pathname === '/api/survivor/leaderboard')
      return route.fulfill({ json: { allTime: [], week: [] } });
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  return { asked, posted };
}

const streak = (page: Page) => page.getByRole('banner').locator('span[title^="Daily streak"]');
const menuButton = (page: Page) => page.getByRole('button', { name: /^Account: / });
const wide = () => test.info().project.name === 'desktop';

test.describe('signed out', () => {
  test('a new player: a zero streak and no account menu', async ({ page }) => {
    const { asked } = await mock(page);
    await page.goto('/gauntlet');
    await expect(streak(page)).toHaveAttribute('title', 'Daily streak: play every day to build it');
    await expect(streak(page)).toContainText('0');
    await expect(menuButton(page)).toHaveCount(0);
    // No sign-in is configured in this build, so no Sign in button either.
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
    expect(asked).toContain(ME);
  });

  test('a streak: today’s count, the best and the races played', async ({ page }) => {
    await mock(page, { streak: { current: 4, best: 9, days: 20 } });
    await page.goto('/gauntlet');
    await expect(streak(page)).toHaveAttribute('title', 'Daily streak · best 9 · 20 races played');
    await expect(streak(page)).toContainText('4');
    // The words show on a wide screen; a phone has the count alone.
    if (wide()) await expect(streak(page)).toContainText('4day streak');
    else await expect(streak(page).getByText('day streak')).toBeHidden();
  });

  test('one race played is “race”, not “races”', async ({ page }) => {
    await mock(page, { streak: { current: 1, best: 1, days: 1 } });
    await page.goto('/eras');
    await expect(streak(page)).toHaveAttribute('title', 'Daily streak · best 1 · 1 race played');
  });

  test('the players API down: the bar still shows a zero streak', async ({ page }) => {
    await mock(page, { fail: true });
    await page.goto('/gauntlet');
    await expect(streak(page)).toHaveAttribute('title', 'Daily streak: play every day to build it');
    await expect(menuButton(page)).toHaveCount(0);
  });
});

test.describe('signed in', () => {
  test('the account menu: open, its items, and the ways it shuts', async ({ page }) => {
    await mock(page, { account: account(), streak: { current: 3, best: 5, days: 8 } });
    await page.goto('/gauntlet');
    const button = menuButton(page);
    await expect(button).toHaveAccessibleName('Account: Undercut');
    await expect(button).toContainText('U');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(streak(page)).toContainText('3');
    const menu = page.getByRole('menu');
    await expect(menu).toHaveCount(0);

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toContainText('Undercut');
    await expect(menu.getByRole('menuitem')).toHaveText(['Edit profile', 'Sign out']);
    // Not an admin: no Admin item.
    await expect(menu.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(menu).toBeVisible();
    // A press outside it shuts it.
    await page.getByRole('heading', { name: 'Gauntlet', level: 1 }).click();
    await expect(menu).toHaveCount(0);
    // And the button toggles it.
    await button.click();
    await button.click();
    await expect(menu).toHaveCount(0);
  });

  test('the name falls back to the account name, then the email', async ({ page }) => {
    await mock(page, { account: account({ displayName: '', name: '' }) });
    await page.goto('/gauntlet');
    await expect(menuButton(page)).toHaveAccessibleName('Account: ada@example.com');
    await expect(menuButton(page)).toContainText('A');
    await page.unrouteAll();
    await mock(page, { account: account({ displayName: '' }) });
    await page.reload();
    await expect(menuButton(page)).toHaveAccessibleName('Account: Ada Lovelace');
  });

  test('an admin gets the Admin item, which opens the admin page', async ({ page }) => {
    await mock(page, { account: account({ admin: true }) });
    await page.goto('/gauntlet');
    await menuButton(page).click();
    const admin = page.getByRole('menuitem', { name: 'Admin' });
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([
      'Edit profile',
      'Admin',
      'Sign out',
    ]);
    await admin.click();
    await expect(page).toHaveURL('/admin');
  });

  test('the favourite team’s colour themes the bar, none without one', async ({ page }) => {
    await mock(page, { account: account({ favouriteTeam: 'McLaren' }) });
    await page.goto('/gauntlet');
    await expect(menuButton(page)).toBeVisible();
    const fav = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--fav'));
    await expect.poll(fav).toBe('#ff8000');
    // The account's initial takes it.
    const initial = menuButton(page).locator('span').first();
    await expect(initial).toHaveCSS('background-color', 'rgb(255, 128, 0)');

    await page.unrouteAll();
    await mock(page, { account: account({ favouriteTeam: '' }) });
    await page.reload();
    await expect(menuButton(page)).toBeVisible();
    expect(await fav()).toBe('');
  });

  test('sign out: a fresh anonymous player, signed out', async ({ page }) => {
    const { asked } = await mock(page, {
      account: account(),
      streak: { current: 3, best: 5, days: 8 },
    });
    await page.goto('/gauntlet');
    await menuButton(page).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(menuButton(page)).toHaveCount(0);
    await expect(streak(page)).toHaveAttribute('title', 'Daily streak: play every day to build it');
    const id = await page.evaluate((k) => localStorage.getItem(k), ID_KEY);
    expect(id).not.toBe(ME);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(asked.at(-1)).toBe(id);
    // A reload stays signed out.
    await page.reload();
    await expect(streak(page)).toBeVisible();
    await expect(menuButton(page)).toHaveCount(0);
  });
});

test.describe('profile sheet', () => {
  const sheet = (page: Page) => page.getByRole('dialog', { name: /your profile/ });
  const team = (page: Page, name: string) => sheet(page).getByRole('button', { name, exact: true });

  test('edit: every field and button', async ({ page }) => {
    const { posted } = await mock(page, { account: account() });
    await page.goto('/gauntlet');
    await menuButton(page).click();
    await page.getByRole('menuitem', { name: 'Edit profile' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);

    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole('heading', { name: 'Edit your profile' })).toBeVisible();
    await expect(sheet(page).getByText('Your profile', { exact: true })).toBeVisible();
    const input = sheet(page).getByRole('textbox', { name: 'Display name' });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Undercut');
    await expect(input).toHaveAttribute('maxlength', '20');

    // The ten teams, the account's one pressed; another takes over; pressing it again clears it.
    const group = sheet(page).getByRole('group', { name: 'Favourite team' });
    await expect(group.getByRole('button')).toHaveCount(10);
    await expect(team(page, 'McLaren')).toHaveAttribute('aria-pressed', 'true');
    for (const t of [
      'Ferrari',
      'Red Bull Racing',
      'Mercedes',
      'Aston Martin',
      'Alpine',
      'Williams',
      'Racing Bulls',
      'Kick Sauber',
      'Haas F1 Team',
      'McLaren',
    ]) {
      await team(page, t).click();
      await expect(team(page, t)).toHaveAttribute('aria-pressed', 'true');
      await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
    }
    await team(page, 'McLaren').click();
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(0);

    // Save needs a name of 3 or more.
    const save = sheet(page).getByRole('button', { name: 'Save' });
    await input.fill('ab');
    await expect(save).toBeDisabled();
    await input.fill('   ab ');
    await expect(save).toBeDisabled();
    await input.fill('Box Box Box');
    await expect(save).toBeEnabled();
    await input.fill('x'.repeat(25));
    await expect(input).toHaveValue('x'.repeat(20));
    await input.fill('Box Box Box');
    // No sign-in token in this build: the sheet says so and stays open, and nothing is sent.
    await save.click();
    await expect(
      sheet(page).getByText('Your sign-in has expired. Sign in again to save.'),
    ).toBeVisible();
    await expect(sheet(page)).toBeVisible();
    expect(posted).not.toContain('/api/profile');
    // Enter in the name submits too.
    await input.press('Enter');
    await expect(sheet(page).getByText(/sign-in has expired/)).toBeVisible();

    await sheet(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet(page)).toHaveCount(0);
    // Reopened, it starts from the account again.
    await menuButton(page).click();
    await page.getByRole('menuitem', { name: 'Edit profile' }).click();
    await expect(sheet(page).getByRole('textbox', { name: 'Display name' })).toHaveValue(
      'Undercut',
    );
    await expect(team(page, 'McLaren')).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet(page).getByText(/sign-in has expired/)).toHaveCount(0);
  });

  test('a first profile: set up, with Later', async ({ page }) => {
    await mock(page, { account: account({ displayName: '', favouriteTeam: '' }) });
    await page.goto('/gauntlet');
    await menuButton(page).click();
    await page.getByRole('menuitem', { name: 'Edit profile' }).click();
    await expect(sheet(page).getByRole('heading', { name: 'Set up your profile' })).toBeVisible();
    await expect(sheet(page).getByText('Welcome to the pit wall')).toBeVisible();
    await expect(sheet(page).getByRole('textbox', { name: 'Display name' })).toHaveValue('');
    await expect(sheet(page).getByRole('textbox', { name: 'Display name' })).toHaveAttribute(
      'placeholder',
      'e.g. Box Box Box',
    );
    await expect(sheet(page).getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(sheet(page).locator('[aria-pressed="true"]')).toHaveCount(0);
    await sheet(page).getByRole('button', { name: 'Later' }).click();
    await expect(sheet(page)).toHaveCount(0);
  });
});

test.describe('announcement banner', () => {
  const note = { id: 7, text: 'Servers move tonight.', tone: 'info', endsAt: null };

  test('shows under the top bar; dismissed, it stays gone, until a new one', async ({ page }) => {
    await mock(page, { announcement: note });
    await page.goto('/gauntlet');
    const banner = page.getByRole('status').filter({ hasText: 'Servers move tonight.' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Dismiss announcement' }).click();
    await expect(banner).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem('laststint:announcements-dismissed')),
    ).toBe('[7]');
    // Gone for good in this browser, on every page.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Gauntlet', level: 1 })).toBeVisible();
    await expect(page.getByText('Servers move tonight.')).toHaveCount(0);
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
    await expect(page.getByText('Servers move tonight.')).toHaveCount(0);

    // A new announcement shows again.
    await page.unrouteAll();
    await mock(page, { announcement: { ...note, id: 8, text: 'Back up.' } });
    await page.goto('/privacy');
    await expect(page.getByRole('status').filter({ hasText: 'Back up.' })).toBeVisible();
  });

  test('a warning is an alert; an ended one doesn’t show', async ({ page }) => {
    await mock(page, { announcement: { ...note, tone: 'warning', text: 'Maintenance now.' } });
    await page.goto('/terms');
    await expect(page.getByRole('alert').filter({ hasText: 'Maintenance now.' })).toBeVisible();
    await page.unrouteAll();
    await mock(page, {
      announcement: { ...note, id: 9, text: 'Old news.', endsAt: '2020-01-01T00:00:00Z' },
    });
    await page.goto('/credits');
    await expect(page.getByRole('heading', { name: 'Credits', level: 1 })).toBeVisible();
    await expect(page.getByText('Old news.')).toHaveCount(0);
  });
});
