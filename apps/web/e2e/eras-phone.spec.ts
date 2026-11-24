// The Eras history book, a race leaderboard and the race screen's top bar on a 390 px phone
// (build plan 8.8), with the Worker mocked: nothing wider than the screen, and the top bar's
// duel (your driver, the gap, the rival) not clipped, in Eras (with its timer toggle) and in
// the daily.
import type { Page } from '@playwright/test';
import { expect, test } from './coverage.js';
import { loadRace, mockApi } from './mock.js';

const model = loadRace('abu-dhabi-2021');
const shots = process.env.E2E_SHOTS;
const ERAS = [
  [10, 'Ground-effect era', '2022–2025'],
  [9, 'The 2021 title fight', '2021'],
  [8, 'Mercedes vs Ferrari', '2017–2020'],
  [7, 'Hybrid turbo', '2014–2016'],
  [6, 'Fast-wearing tyres', '2010–2013'],
  [5, 'Alonso, Räikkönen, Hamilton', '2005–2009'],
  [4, 'Ferrari dynasty', '2000–2004'],
  [3, 'Refuelling returns', '1994–1999'],
  [2, 'Senna vs Prost', '1989–1993'],
  [1, 'Turbo era', '1983–1988'],
] as const;

const t = (have: number, total: number) => ({ have, total });

/** A history book with Era 10 mostly done, Era 9 started, and two rewrites. */
function book() {
  const eras = ERAS.map(([eraId, name, years], i) => {
    const done = eraId === 10;
    return {
      eraId,
      name,
      years,
      playOrder: i + 1,
      races: 10,
      stars: t(done ? 30 : eraId === 9 ? 14 : 0, 30),
      legendStars: t(done ? 6 : 0, 30),
      rewrites: t(done ? 4 : eraId === 9 ? 1 : 0, 10),
      hidden: t(done ? 3 : 0, 10),
      badges: { cleared: done, mastered: done, legend: false },
      percent: done ? (45 / 83) * 100 : eraId === 9 ? (15 / 83) * 100 : 0,
    };
  });
  return {
    completion: { collected: 60, total: 830, percent: (60 / 830) * 100 },
    collectibles: {
      stars: t(44, 300),
      legendStars: t(6, 300),
      rewrites: t(5, 100),
      hidden: t(3, 100),
      badges: t(2, 30),
    },
    eras,
    entries: [
      {
        raceId: 'abu-dhabi-2021',
        eraId: 9,
        position: 10,
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

function board(legend: boolean) {
  const total = legend ? 0 : 1534;
  const entries = Array.from({ length: Math.min(total, 100) }, (_, i) => ({
    rank: i + 1,
    name: i === 3 ? 'A strategist with a very long display name indeed' : `Strategist ${i + 1}`,
    accuracy: 99.9 - i * 0.3,
  }));
  return {
    raceId: 'abu-dhabi-2021',
    legend,
    size: 100,
    total,
    entries,
    me: legend ? null : { rank: 1203, accuracy: 61.4 },
  };
}

async function noSidewaysScroll(page: Page) {
  expect(page.viewportSize()?.width).toBe(390);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The race screen's top bar: each part within its box (nothing clipped), and the bar on screen. */
async function topBarFits(page: Page) {
  const bar = page.locator('main > header');
  await expect(bar).toBeVisible({ timeout: 60_000 });
  const parts = await bar.evaluate((h) =>
    [...h.children].map((c) => ({
      over: (c as HTMLElement).scrollWidth - (c as HTMLElement).clientWidth,
      right: c.getBoundingClientRect().right,
    })),
  );
  for (const p of parts) {
    expect(p.over).toBeLessThanOrEqual(0);
    expect(p.right).toBeLessThanOrEqual(390);
  }
}

test('the history book fits a phone', async ({ page }) => {
  await page.route('**/api/history**', (route) => route.fulfill({ json: book() }));
  await page.goto('/eras/history');
  await expect(page.getByRole('heading', { name: 'History book' })).toBeVisible();
  await expect(page.getByTestId('completion')).toHaveText('7%');
  await expect(page.getByText('60 of 830 collected')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Great Britain 2023' })).toBeVisible();
  await expect(page.getByText('Only 9% of strategists rewrote this race.')).toBeVisible();
  await noSidewaysScroll(page);
  if (shots) await page.screenshot({ path: `${shots}/eras-history.png`, fullPage: true });
});

test('a race leaderboard fits a phone, both tabs', async ({ page }) => {
  await page.route('**/api/eras/races/abu-dhabi-2021/leaderboard**', (route) => {
    const legend = new URL(route.request().url()).searchParams.get('legend') === 'true';
    return route.fulfill({ json: board(legend) });
  });
  await page.goto('/eras/9/abu-dhabi-2021/leaderboard');
  await expect(page.getByRole('tab', { name: 'Normal' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('me-line')).toHaveText(
    'Your rank: 1203 of 1534, best accuracy 61.4%.',
  );
  await expect(
    page.getByRole('list', { name: 'Top strategists' }).getByRole('listitem'),
  ).toHaveCount(100);
  await noSidewaysScroll(page);
  if (shots) await page.screenshot({ path: `${shots}/eras-leaderboard.png`, fullPage: true });

  await page.getByRole('tab', { name: 'Legend' }).click();
  await expect(page.getByRole('tab', { name: 'Legend' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('No one is on this board yet.')).toBeVisible();
  await expect(page).toHaveURL(/\/eras\/9\/abu-dhabi-2021\/leaderboard\/legend$/);
  await noSidewaysScroll(page);
});

test('an Eras race’s top bar fits a phone, timer toggle and all', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/eras/attempts' && route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          attemptId: '11111111-1111-4111-8111-000000000001',
          seed: model.race.seed,
          modelUrl: `${url.origin}/api/eras/races/abu-dhabi-2021/model?h=x`,
          modelHash: 'x',
          difficulty: {
            accuracyThreshold: 72,
            information: 'full',
            rivalPolicy: 'standard',
            decisionTimerSeconds: 45,
          },
        },
      });
    }
    if (url.pathname === '/api/eras/races/abu-dhabi-2021/model')
      return route.fulfill({ json: model });
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  await page.goto('/eras/9/abu-dhabi-2021');
  await page.getByRole('button', { name: 'Start the race' }).click();
  await expect(page.getByRole('button', { name: 'Timer on' })).toBeVisible({ timeout: 60_000 });
  await topBarFits(page);
  await noSidewaysScroll(page);
  if (shots) await page.screenshot({ path: `${shots}/eras-race-bar.png` });
});

test('the daily race’s top bar fits a phone', async ({ page }) => {
  await mockApi(page, model);
  await page.goto('/');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: /pit wall/ }).click();
  await topBarFits(page);
  await noSidewaysScroll(page);
});
