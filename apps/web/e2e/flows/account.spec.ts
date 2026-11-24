// L3: sign-in against the real local Worker and D1 (docs/test-suite-spec.md S4), as far as it
// runs locally. The flows' web build uses the Google sign-in path (VITE_GOOGLE_CLIENT_ID, no
// Auth0), and Google's script is the one stand-in (helpers.ts fakeGoogle): its button hands
// the game an ID token signed with the flows' key, which the local Worker trusts in place of
// Google's (GOOGLE_JWKS). From there it is all real: POST /api/auth verifies the token and
// links the browser to the account, the profile is saved by POST /api/profile, the player ID
// is adopted, and a second browser finds the same account.
//
// Not covered here (can't run locally): Auth0's hosted login page and its redirect back
// (completeLogin), Google's own popup and One Tap, and fetching the real issuers' keys (JWKS).
// The Worker's Auth0 token path is covered by apps/worker/test/auth.test.ts.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { FIXED_DATE } from './env.js';
import { anonIdOf, closeHowTo, idToken, preparePage, useCredential, workerApi } from './helpers.js';

const PLAYER = { sub: 'flows-player', email: 'player@flows.test', name: 'Flows Player' };

const isPost = (path: string) => (r: import('@playwright/test').Response) =>
  r.url().endsWith(path) && r.request().method() === 'POST';

async function signInWithGoogle(page: Page, token: string) {
  await useCredential(page, token);
  const res = page.waitForResponse(isPost('/api/auth'));
  await page.getByRole('button', { name: 'Sign in with Google' }).first().click();
  return res;
}

test('sign in, set the profile, stay signed in, sign out, another browser', async ({
  page,
  browser,
}) => {
  await preparePage(page);
  await page.goto('/');
  await closeHowTo(page);
  const anonBefore = await anonIdOf(page);
  const token = idToken(PLAYER);

  await test.step('a bad token: the Worker refuses it, the game says so', async () => {
    const res = await signInWithGoogle(page, 'not.a.token');
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: 'bad-credential' });
    // Still signed out. (The compact top bar on the daily card doesn't show the failure
    // message, only the result screen's account bar does: docs/test-suite-report.md S4.)
    await expect(page.getByRole('button', { name: 'Sign in with Google' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    expect(await anonIdOf(page)).toBe(anonBefore);
  });

  let playerId = '';
  await test.step('sign in: a new account, asked for its profile', async () => {
    const res = await signInWithGoogle(page, token);
    expect(res.status()).toBe(200);
    const account = await res.json();
    expect(account).toMatchObject({ created: true, needsProfile: true, admin: false });
    playerId = account.playerId;
    // The browser now plays as the account.
    await expect.poll(() => anonIdOf(page)).toBe(playerId);
    const sheet = page.getByRole('dialog', { name: 'Set up your profile' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Display name' }).fill('Flows Racer');
    await sheet.getByRole('button', { name: 'Ferrari' }).click();
    const saved = page.waitForResponse(isPost('/api/profile'));
    await sheet.getByRole('button', { name: 'Save' }).click();
    expect((await saved).status()).toBe(200);
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Flows Racer' }).first()).toBeVisible();
    // No Admin link for a player.
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  await test.step('the Worker has the account; a reload stays signed in', async () => {
    const api = await workerApi();
    const p = await (await api.get(`/api/players/${playerId}?today=${FIXED_DATE}`)).json();
    expect(p.account).toMatchObject({
      displayName: 'Flows Racer',
      favouriteTeam: 'Ferrari',
      email: PLAYER.email,
      admin: false,
    });
    // The browser's old anonymous ID is linked to the account too.
    const old = await (await api.get(`/api/players/${anonBefore}?today=${FIXED_DATE}`)).json();
    expect(old.account).toMatchObject({ displayName: 'Flows Racer' });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Flows Racer' }).first()).toBeVisible();
  });

  await test.step('sign out: a fresh anonymous player', async () => {
    // The account menu in the top bar: its name, then Sign out.
    await page.getByRole('button', { name: 'Flows Racer' }).first().click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with Google' }).first()).toBeVisible();
    const fresh = await anonIdOf(page);
    expect(fresh).not.toBe(playerId);
    const api = await workerApi();
    const p = await (await api.get(`/api/players/${fresh}?today=${FIXED_DATE}`)).json();
    expect(p.account).toBeNull();
  });

  await test.step('another browser signs in to the same account, no profile prompt', async () => {
    const other = await browser.newPage();
    await preparePage(other);
    await other.goto('/');
    await closeHowTo(other);
    const res = await signInWithGoogle(other, token);
    expect(await res.json()).toMatchObject({
      playerId,
      created: false,
      needsProfile: false,
      displayName: 'Flows Racer',
    });
    await expect.poll(() => anonIdOf(other)).toBe(playerId);
    await expect(other.getByRole('button', { name: 'Flows Racer' }).first()).toBeVisible();
    await expect(other.getByRole('dialog', { name: /profile/ })).toHaveCount(0);
    await other.close();
  });

  await test.step('an admin account gets the Admin link', async () => {
    const other = await browser.newPage();
    await preparePage(other);
    await other.goto('/');
    await closeHowTo(other);
    const res = await signInWithGoogle(other, idToken({ sub: 'flows-admin-home' }));
    expect(await res.json()).toMatchObject({ admin: true, needsProfile: true });
    await other
      .getByRole('dialog', { name: 'Set up your profile' })
      .getByRole('button', { name: 'Later' })
      .click();
    // A new account sees how to play once.
    await closeHowTo(other, false);
    await other.getByRole('button', { name: 'Flows Admin' }).first().click();
    await expect(other.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    await other.close();
  });
});
