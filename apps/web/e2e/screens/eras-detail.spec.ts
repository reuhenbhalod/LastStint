// An era's detail (/eras/:n), every control in every state (docs/test-suite-spec.md S3, D7): the
// way back, each race card's play and leaderboard links, the Legend toggle (closed until the era
// is Cleared, then on and off), the cards' stars and badges, a locked and a coming-soon era, a
// race this build doesn't know, and the load error with its retry. The Worker is mocked
// (e2e/eras.ts).
import type { Page } from '@playwright/test';
import { ERAS, raceName, racesOfEra } from '../../src/eras/catalog.js';
import { expect, test } from '../coverage.js';
import { loadEraRace, mockEras, noSidewaysScroll, pressLink, siteLinks } from '../eras.js';

const ERA = 2;
const races = racesOfEra(ERA);
const models = [loadEraRace('hungary-1992')];
const RELEASED = '2026-01-01T00:00:00.000Z';

/** A race's card: the article under its heading. */
const card = (page: Page, raceId: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: raceName(raceId) }) });
const play = (page: Page, raceId: string, legend = false) =>
  page.getByRole('link', {
    name: new RegExp(
      `^${raceName(raceId)}\\s*${legend ? ', play at Legend difficulty' : ', play'}$`,
    ),
  });
const board = (page: Page, raceId: string, legend = false) =>
  page.getByRole('link', {
    name: `${legend ? 'Legend leaderboard' : 'Leaderboard'} for ${raceName(raceId)}`,
  });

test('the era: its way back, each race to play and each leaderboard', async ({ page }) => {
  await mockEras(page, models);
  await page.goto(`/eras/${ERA}`);
  const era = ERAS.find((e) => e.id === ERA);
  await expect(page.getByRole('heading', { level: 1, name: era?.name })).toBeVisible();
  await expect(page.getByText(`Era ${ERA} · ${era?.years}`)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Briefing' })).toContainText(era?.briefing ?? '');
  await expect(page.getByRole('heading', { name: 'Races', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(10);
  for (const r of races) {
    expect(await pressLink(page, play(page, r.raceId))).toBe(`/eras/${ERA}/${r.raceId}`);
    expect(await pressLink(page, board(page, r.raceId))).toBe(
      `/eras/${ERA}/${r.raceId}/leaderboard`,
    );
    await expect(card(page, r.raceId)).toContainText(`Race ${r.position}`);
    await expect(card(page, r.raceId)).toContainText(r.dilemma);
  }
  // Every Era 2 race is rebuilt from reports.
  await expect(
    card(page, 'hungary-1992').getByText('Reconstructed', { exact: true }),
  ).toBeVisible();
  // Test mode: a race the server has no authored file for is a Draft, and the key says so.
  await expect(card(page, 'monaco-1992').getByText('Draft', { exact: true })).toBeVisible();
  await expect(card(page, 'hungary-1992').getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(/Draft: not published yet, so playable on test only\./),
  ).toBeVisible();
  await noSidewaysScroll(page);
  expect(await pressLink(page, page.getByRole('link', { name: 'data credits' }))).toBe('/credits');
  await siteLinks(page);

  // A card goes to its race's intro; a leaderboard link to its board; All eras to the map.
  await play(page, 'hungary-1992').click();
  await expect(page).toHaveURL(new RegExp(`/eras/${ERA}/hungary-1992$`));
  await expect(page.getByRole('button', { name: 'Start the race' })).toBeVisible();
  await page.goto(`/eras/${ERA}`);
  await board(page, 'hungary-1992').click();
  await expect(page).toHaveURL(new RegExp(`/eras/${ERA}/hungary-1992/leaderboard$`));
  await page.goto(`/eras/${ERA}`);
  await page.getByRole('link', { name: 'All eras' }).click();
  await expect(page).toHaveURL(/\/eras$/);
});

test('Legend stays shut until the era is Cleared', async ({ page }) => {
  await mockEras(page, models, {
    progress: {
      'hungary-1992': {
        stars: { result: true, strategist: true, mastery: false },
        accuracy: 81.25,
      },
    },
  });
  await page.goto(`/eras/${ERA}`);
  await expect(
    page.getByText('Unlocks once the era is Cleared: a star on every race (1 of 10 so far).'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Legend (on|off)$/ })).toHaveCount(0);
  await expect(page.getByText('1 of 10 races with a star')).toBeVisible();
  // The card's own stars and best accuracy, read out as earned or not.
  const c = card(page, 'hungary-1992');
  await expect(c.getByText('Star 1, ')).toHaveCount(1);
  await expect(c).toContainText('Star 1, ★1Result: earned');
  await expect(c).toContainText('Star 2, ★2Strategist: earned');
  await expect(c).toContainText('Star 3, ★3Mastery: not earned');
  await expect(c).toContainText('Best accuracy 81.3%');
  await expect(card(page, 'monaco-1992')).toContainText('Best accuracy not played yet');
});

test('Legend on and off once Cleared: the cards play and rank at Legend', async ({ page }) => {
  await mockEras(page, models, { cleared: [ERA] });
  await page.goto(`/eras/${ERA}`);
  await expect(page.getByText('10 of 10 races with a star')).toBeVisible();
  await expect(page.getByText(/^Era Cleared\. Legend has its own stars/)).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Legend off' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  const on = page.getByRole('button', { name: 'Legend on' });
  await expect(on).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Races · Legend difficulty' })).toBeVisible();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(0);
  for (const r of races) {
    expect(await pressLink(page, play(page, r.raceId, true))).toBe(
      `/eras/${ERA}/${r.raceId}/legend`,
    );
    expect(await pressLink(page, board(page, r.raceId, true))).toBe(
      `/eras/${ERA}/${r.raceId}/leaderboard/legend`,
    );
  }
  // Legend's stars are their own: none yet, though every race has a normal one.
  await expect(card(page, 'hungary-1992')).toContainText('Star 1, ★1Result: not earned');
  await on.click();
  await expect(page.getByRole('button', { name: 'Legend off' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Races', exact: true })).toBeVisible();
  await expect(play(page, 'hungary-1992')).toBeVisible();
  await expect(card(page, 'hungary-1992')).toContainText('Star 1, ★1Result: earned');

  await page.getByRole('button', { name: 'Legend off' }).click();
  await play(page, 'hungary-1992', true).click();
  await expect(page).toHaveURL(new RegExp(`/eras/${ERA}/hungary-1992/legend$`));
  await expect(page.getByRole('button', { name: 'Start the race · Legend' })).toBeVisible();
});

test('production: a locked era shows its races and leaderboards but plays none', async ({
  page,
}) => {
  await mockEras(page, [loadEraRace('turkey-2021')], {
    production: { releasedAt: { 10: RELEASED, 9: RELEASED } },
    stars: { 10: 3 },
  });
  await page.goto('/eras/9');
  await expect(page.getByText('Locked', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('21 stars in Era 10 to unlock (18 to go)')).toBeVisible();
  await expect(
    page.getByText('You can look at its races, but not play them until it unlocks.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(0);
  await expect(page.getByText('Unlock this era to play its races.')).toHaveCount(10);
  // No Draft in production, and no test-mode banner.
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Test mode', { exact: true })).toHaveCount(0);
  // The leaderboards stay open.
  const first = racesOfEra(9)[0]?.raceId ?? '';
  expect(await pressLink(page, board(page, first))).toBe(`/eras/9/${first}/leaderboard`);
});

test('production: a coming-soon era says when, and nothing more', async ({ page }) => {
  await mockEras(page, models, { production: { releasedAt: { 10: RELEASED } } });
  await page.goto(`/eras/${ERA}`);
  await expect(page.getByText('Coming soon')).toBeVisible();
  await expect(page.getByText('1989–1993 arrives in a later release.')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Legend/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'All eras' }).click();
  await expect(page).toHaveURL(/\/eras$/);
});

test('a race this build doesn’t know is listed but not playable', async ({ page }) => {
  await mockEras(page, models);
  // The server lists a race the app's catalog has no entry for, in Monaco 1992's place.
  await page.route(
    (url) => url.pathname === `/api/eras/${ERA}`,
    async (route) => {
      const detail = {
        eraId: ERA,
        name: ERAS.find((e) => e.id === ERA)?.name,
        years: ERAS.find((e) => e.id === ERA)?.years,
        playOrder: ERAS.find((e) => e.id === ERA)?.playOrder,
        released: true,
        unlocked: true,
        stars: 0,
        maxStars: 30,
        races: races.map((r) => ({
          raceId: r.raceId === 'monaco-1992' ? 'atlantis-1991' : r.raceId,
          position: r.position,
          stars: { result: false, strategist: false, mastery: false },
          hiddenDone: false,
          bestAccuracy: null,
          reconstructed: false,
          draft: false,
        })),
      };
      return route.fulfill({ json: detail });
    },
  );
  await page.goto(`/eras/${ERA}`);
  const unknown = page.getByRole('article').filter({ hasText: 'Race 5' });
  await expect(unknown).toContainText(
    'Not playable yet: this version of the app doesn’t have this race.',
  );
  await expect(unknown).toContainText('Dilemma to come.');
  await expect(unknown.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(9);
});

test('loading, then a load error with Try again', async ({ page }) => {
  await mockEras(page, models);
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route(
    (url) => url.pathname === `/api/eras/${ERA}`,
    async (route) => {
      calls += 1;
      if (calls > 1) return route.fallback();
      await held;
      return route.fulfill({ status: 503, json: { error: 'down' } });
    },
  );
  await page.goto(`/eras/${ERA}`);
  await expect(page.getByText('Loading the era…')).toBeVisible();
  release();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Couldn’t load this era');
  await expect(page.getByRole('article')).toHaveCount(0);
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(10);
  expect(calls).toBe(2);
});
