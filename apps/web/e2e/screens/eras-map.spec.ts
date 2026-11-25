// The era map (/eras), every control in every state (docs/test-suite-spec.md S3, D7): the era
// nodes (open, locked, coming soon, Mastered), the history book link, the data credit, the top
// bar and footer, the load error with its retry, an unknown era, and the 70% unlock (21 of 30
// stars) on the node's own name. The Worker is mocked (e2e/eras.ts); production mode where
// locks matter (test mode opens every era).
import type { Page } from '@playwright/test';
import { ERAS } from '../../src/eras/catalog.js';
import { expect, test } from '../coverage.js';
import {
  finishRace,
  loadEraRace,
  mockEras,
  noSidewaysScroll,
  pressLink,
  shortRace,
  siteLinks,
  startRace,
} from '../eras.js';
import type { ErasProduction } from '../erasProduction.js';

const RELEASED = '2026-01-01T00:00:00.000Z';
const models = [loadEraRace('turkey-2021')];
/** Eras 10, 9 and 8 released; the rest not yet. */
const production = (): ErasProduction => ({
  releasedAt: { 10: RELEASED, 9: RELEASED, 8: RELEASED },
});

const eraName = (id: number) => ERAS.find((e) => e.id === id)?.name ?? '';
/** An era's node: one tab stop named by its era, state and stars (a link either way). */
const node = (page: Page, id: number) =>
  page
    .getByRole('list', { name: /^Eras, in play order/ })
    .getByRole('link', { name: new RegExp(`^Era ${id}, `) });

test('test mode: every era is open, each node goes to its era', async ({ page }) => {
  await mockEras(page, models);
  await page.goto('/eras');
  await expect(page.getByText('Test mode', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Earn 70% of an era’s stars to unlock the one before it.'),
  ).toBeVisible();
  for (const era of ERAS) {
    const n = node(page, era.id);
    await expect(n).toHaveAttribute('href', `/eras/${era.id}`);
    // Locks show as in production, with "open on test".
    if (era.id === 10) await expect(n).toHaveAccessibleName(/Unlocked\. 0\/30 stars\.$/);
    else
      await expect(n).toHaveAccessibleName(
        /Locked, open on test\. 21 stars in Era \d+ to unlock \(21 to go\)\./,
      );
  }
  // Era 10 is the one to play next.
  await expect(node(page, 10)).toHaveAttribute('aria-current', 'step');
  await noSidewaysScroll(page);
  // Each node goes to its era (all but the last pressed without leaving).
  for (const era of ERAS.slice(1)) {
    expect(await pressLink(page, node(page, era.id))).toBe(`/eras/${era.id}`);
  }
  await node(page, 10).click();
  await expect(page).toHaveURL(/\/eras\/10$/);
  await expect(page.getByRole('heading', { level: 1, name: eraName(10) })).toBeVisible();
});

test('the history book link, the data credit and the site links', async ({ page }) => {
  await mockEras(page, models);
  await page.goto('/eras');
  await expect(node(page, 10)).toBeVisible();
  expect(await pressLink(page, page.getByRole('link', { name: 'data credits' }))).toBe('/credits');
  await siteLinks(page);
  await page.getByRole('link', { name: 'Your history book' }).click();
  await expect(page).toHaveURL(/\/eras\/history$/);
  await expect(page.getByRole('heading', { name: 'History book' })).toBeVisible();
});

test('production: open, Mastered, locked and coming-soon nodes', async ({ page }) => {
  // Era 10 complete (30/30: Mastered), Era 9 at 5 stars, so Era 8 stays locked.
  await mockEras(page, models, { production: production(), stars: { 10: 30, 9: 5 } });
  await page.goto('/eras');
  await expect(page.getByText('Test mode', { exact: true })).toHaveCount(0);

  await expect(node(page, 10)).toHaveAccessibleName(
    `Era 10, ${eraName(10)}, 2022–2025. Unlocked. 30/30 stars. Mastered.`,
  );
  await expect(node(page, 9)).toHaveAccessibleName(/Unlocked\. 5\/30 stars\.$/);
  // The furthest open era is the one to play next.
  await expect(node(page, 9)).toHaveAttribute('aria-current', 'step');
  await expect(node(page, 10)).not.toHaveAttribute('aria-current', 'step');

  // Locked: a disabled link (focusable, read out), going nowhere when pressed.
  const locked = node(page, 8);
  await expect(locked).toHaveAccessibleName(
    /^Era 8, .*\. Locked\. 21 stars in Era 9 to unlock \(16 to go\)\. 0\/30 stars\.$/,
  );
  await expect(locked).toHaveAttribute('aria-disabled', 'true');
  await expect(locked).not.toHaveAttribute('href');
  expect(await pressLink(page, locked, { force: true })).toBeNull();
  await locked.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/eras$/);

  // Coming soon: unreleased eras, also going nowhere.
  for (const id of [7, 1]) {
    const soon = node(page, id);
    await expect(soon).toHaveAccessibleName(/Coming soon\. 0\/30 stars\.$/);
    await expect(soon).toHaveAttribute('aria-disabled', 'true');
    expect(await pressLink(page, soon, { force: true })).toBeNull();
  }
  await expect(page).toHaveURL(/\/eras$/);

  // The open one goes in.
  await node(page, 9).click();
  await expect(page).toHaveURL(/\/eras\/9$/);
});

test('the unlock at 70%: Era 9 locked at 20 of 30 Era 10 stars, the 21st opens it', async ({
  page,
}) => {
  // 20 stars: six whole races and ★1-★2 on the seventh. The eighth, Belgium 2023, played to its
  // ★1 alone (no ★2 here) makes 21. The race is cut to its last laps (shortRace): what counts
  // is the star the server gives.
  const seen = await mockEras(page, [shortRace(loadEraRace('belgium-2023'))], {
    production: production(),
    stars: { 10: 20 },
    lapScale: 0.05,
    evaluated: (res) => ({
      ...res,
      stars: { ...res.stars, strategist: false },
      newStars: { result: true, strategist: false, mastery: false },
      progress: { ...res.progress, stars: { result: true, strategist: false, mastery: false } },
    }),
  });
  await page.goto('/eras');
  await expect(node(page, 10)).toHaveAccessibleName(/Unlocked\. 20\/30 stars\.$/);
  await expect(node(page, 9)).toHaveAccessibleName(
    /Locked\. 21 stars in Era 10 to unlock \(1 to go\)\./,
  );
  expect(await pressLink(page, node(page, 9), { force: true })).toBeNull();

  await node(page, 10).click();
  await page.getByRole('link', { name: /^Belgium 2023\s*, play$/ }).click();
  await startRace(page);
  await finishRace(page);
  expect(seen.submissions).toHaveLength(1);

  await page.goto('/eras');
  await expect(node(page, 10)).toHaveAccessibleName(/Unlocked\. 21\/30 stars\.$/);
  await expect(node(page, 9)).toHaveAccessibleName(/Unlocked\. 0\/30 stars\.$/);
  await expect(node(page, 9)).toHaveAttribute('aria-current', 'step');
  await node(page, 9).click();
  await expect(page).toHaveURL(/\/eras\/9$/);
  await expect(page.getByRole('link', { name: /, play$/ }).first()).toBeVisible();
});

test('loading, then a load error with Try again', async ({ page }) => {
  await mockEras(page, models);
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route(
    (url) => url.pathname === '/api/eras',
    async (route) => {
      calls += 1;
      if (calls === 1) {
        await held;
        return route.fulfill({ status: 500, json: { error: 'boom' } });
      }
      return route.fallback();
    },
  );
  await page.goto('/eras');
  await expect(page.getByText('Loading the eras…')).toBeVisible();
  release();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Couldn’t load the eras');
  await expect(node(page, 10)).toHaveCount(0);
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(node(page, 10)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBe(2);
});

test('an unknown era: what it says and the way back', async ({ page }) => {
  await mockEras(page, models);
  await page.goto('/eras/42');
  await expect(page.getByRole('heading', { name: 'No such era' })).toBeVisible();
  await expect(page.getByText('There’s no era or race “42”.')).toBeVisible();
  await page.goto('/eras/9/monaco-1984');
  await expect(page.getByText('There’s no era or race “9/monaco-1984”.')).toBeVisible();
  await page.getByRole('link', { name: 'See all eras' }).click();
  await expect(page).toHaveURL(/\/eras$/);
  await expect(node(page, 10)).toBeVisible();
});
