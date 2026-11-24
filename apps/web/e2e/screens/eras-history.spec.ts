// The history book (/eras/history), every control in every state (docs/test-suite-spec.md S3,
// D7): completion and collectibles, each era's chapter link, each rewrite's leaderboard link
// (Normal or Legend), an empty book, the load error with its retry, the way back and the site
// links. Also a rewrite earned in play landing in the book. The Worker is mocked.
import type { Page } from '@playwright/test';
import { ERAS } from '../../src/eras/catalog.js';
import { expect, test } from '../coverage.js';
import {
  finishRace,
  loadEraRace,
  mockEras,
  pressLink,
  shortRace,
  siteLinks,
  startRace,
} from '../eras.js';

const t = (have: number, total: number) => ({ have, total });

/** A book: Era 10 well on, Era 9 started, a rewrite in each (one at Legend). */
function book(empty = false) {
  return {
    completion: empty
      ? { collected: 0, total: 830, percent: 0 }
      : { collected: 60, total: 830, percent: (60 / 830) * 100 },
    collectibles: {
      stars: t(empty ? 0 : 44, 300),
      legendStars: t(empty ? 0 : 6, 300),
      rewrites: t(empty ? 0 : 2, 100),
      hidden: t(empty ? 0 : 3, 100),
      badges: t(empty ? 0 : 2, 30),
    },
    eras: ERAS.map((e) => ({
      eraId: e.id,
      name: e.name,
      years: e.years,
      playOrder: e.playOrder,
      races: 10,
      stars: t(!empty && e.id === 10 ? 30 : 0, 30),
      legendStars: t(0, 30),
      rewrites: t(!empty && e.id >= 9 ? 1 : 0, 10),
      hidden: t(0, 10),
      badges: { cleared: !empty && e.id === 10, mastered: !empty && e.id === 10, legend: false },
      percent: !empty && e.id === 10 ? (31 / 83) * 100 : 0,
    })),
    entries: empty
      ? []
      : [
          {
            raceId: 'turkey-2021',
            eraId: 9,
            position: 7,
            attemptId: 'a1',
            achievedAt: '2026-11-01T10:00:00.000Z',
            legend: false,
            accuracy: 91.2,
            stars: { result: true, strategist: true, mastery: false },
            headline: null,
            real: null,
            community: { players: 1200, rewrites: 108, share: 0.09 },
          },
          {
            raceId: 'great-britain-2023',
            eraId: 10,
            position: 2,
            attemptId: 'a2',
            achievedAt: '2026-11-05T10:00:00.000Z',
            legend: true,
            accuracy: 88.75,
            stars: { result: true, strategist: false, mastery: true },
            headline: null,
            real: null,
            community: { players: 300, rewrites: 180, share: 0.6 },
          },
        ],
  };
}

async function serve(page: Page, of: (n: number) => unknown | null) {
  let n = 0;
  await page.route(
    (url) => url.pathname === '/api/history',
    (route) => {
      n += 1;
      const b = of(n);
      return b
        ? route.fulfill({ json: b })
        : route.fulfill({ status: 500, json: { error: 'down' } });
    },
  );
  return () => n;
}

test('the book: completion, every chapter and every rewrite’s leaderboard', async ({ page }) => {
  await serve(page, () => book());
  await page.goto('/eras/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History book' })).toBeVisible();
  await expect(page.getByTestId('completion')).toHaveText('7%');
  await expect(page.getByText('60 of 830 collected')).toBeVisible();
  // A chapter per era, in play order, each going to its era.
  const chapters = page.getByRole('region', { name: 'Chapters' });
  for (const era of ERAS) {
    expect(await pressLink(page, chapters.getByRole('link', { name: era.name, exact: true }))).toBe(
      `/eras/${era.id}`,
    );
  }
  // The rewrites, newest first, each with its board (the Legend one at Legend).
  const rewrites = page.getByRole('region', { name: 'History rewritten' });
  await expect(rewrites.getByRole('heading', { level: 3 })).toHaveText([
    'Great Britain 2023',
    'Turkey 2021',
  ]);
  await expect(rewrites).toContainText('Only 9% of strategists rewrote this race.');
  await expect(rewrites).toContainText('60% of strategists rewrote this race.');
  expect(
    await pressLink(
      page,
      rewrites.getByRole('link', { name: 'Legend leaderboard for Great Britain 2023' }),
    ),
  ).toBe('/eras/10/great-britain-2023/leaderboard/legend');
  expect(
    await pressLink(page, rewrites.getByRole('link', { name: 'Leaderboard for Turkey 2021' })),
  ).toBe('/eras/9/turkey-2021/leaderboard');
  expect(await pressLink(page, page.getByRole('link', { name: 'data credits' }))).toBe('/credits');
  await siteLinks(page);

  await chapters.getByRole('link', { name: ERAS[0]?.name ?? '', exact: true }).click();
  await expect(page).toHaveURL(/\/eras\/10$/);
});

test('an empty book says how it fills', async ({ page }) => {
  await serve(page, () => book(true));
  await page.goto('/eras/history');
  await expect(page.getByTestId('completion')).toHaveText('0%');
  await expect(page.getByText(/^Nothing collected yet\./)).toBeVisible();
  await expect(page.getByText(/^No rewrites yet\./)).toBeVisible();
  await page.getByRole('link', { name: 'All eras' }).click();
  await expect(page).toHaveURL(/\/eras$/);
});

test('loading, a load error and Try again', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  let n = 0;
  await page.route(
    (url) => url.pathname === '/api/history',
    async (route) => {
      n += 1;
      if (n === 1) {
        await held;
        return route.fulfill({ status: 500, json: { error: 'down' } });
      }
      return route.fulfill({ json: book() });
    },
  );
  await page.goto('/eras/history');
  await expect(page.getByText('Loading your history book…')).toBeVisible();
  release();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Couldn’t load your history book');
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('completion')).toHaveText('7%');
  expect(n).toBe(2);
});

test('a rewrite earned in play is written in the book', async ({ page }) => {
  await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], { lapScale: 0.05 });
  await page.goto('/eras/2/hungary-1992');
  await startRace(page, { graded: false });
  await finishRace(page);
  await expect(page.getByRole('region', { name: 'Stars' })).toContainText('History rewritten');
  await page.getByRole('link', { name: 'History book' }).click();
  await expect(page).toHaveURL(/\/eras\/history$/);
  const rewrites = page.getByRole('region', { name: 'History rewritten' });
  await expect(rewrites.getByRole('heading', { name: 'Hungary 1992' })).toBeVisible();
  await expect(rewrites).toContainText('Era 2 · Race 7');
});
