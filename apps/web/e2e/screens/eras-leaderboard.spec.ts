// A race's leaderboards (/eras/:n/:race/leaderboard, …/leaderboard/legend), every control in every
// state (docs/test-suite-spec.md S3, D7): the Normal and Legend tabs (by press and by keyboard,
// the address following the tab), your line (on the board, below it, not on it), an empty board,
// the load error with its retry, the way back and the site links. The Worker is mocked.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { loadEraRace, mockEras, pressLink, siteLinks } from '../eras.js';

const RACE = 'hungary-1992';
const BASE = `/eras/2/${RACE}/leaderboard`;

type Board = {
  total: number;
  entries: Array<{ rank: number; name: string; accuracy: number }>;
  me: { rank: number; accuracy: number } | null;
};

/** Serve each tab's board (`legend` true or false); null answers an error. */
async function boards(page: Page, of: (legend: boolean, n: number) => Board | null) {
  await mockEras(page, [loadEraRace(RACE)]);
  const asked: boolean[] = [];
  await page.route(
    (url) => url.pathname === `/api/eras/races/${RACE}/leaderboard`,
    (route) => {
      const legend = new URL(route.request().url()).searchParams.get('legend') === 'true';
      asked.push(legend);
      const b = of(legend, asked.length);
      return b
        ? route.fulfill({ json: { raceId: RACE, legend, size: 100, ...b } })
        : route.fulfill({ status: 500, json: { error: 'down' } });
    },
  );
  return asked;
}

const rows = (n: number, from = 1) =>
  Array.from({ length: n }, (_, i) => ({
    rank: from + i,
    name: `Strategist ${from + i}`,
    accuracy: 99 - i,
  }));
const tab = (page: Page, name: 'Normal' | 'Legend') => page.getByRole('tab', { name });
const me = (page: Page) => page.getByTestId('me-line');

test('the Normal board: you on it, the Legend tab, and back', async ({ page }) => {
  const asked = await boards(page, (legend) =>
    legend
      ? { total: 0, entries: [], me: null }
      : { total: 3, entries: rows(3), me: { rank: 2, accuracy: 98 } },
  );
  await page.goto(BASE);
  await expect(page.getByText('Era 2 · Race 7 · Leaderboard')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Hungary 1992' })).toBeVisible();
  await expect(tab(page, 'Normal')).toHaveAttribute('aria-selected', 'true');
  await expect(me(page)).toHaveText('Your rank: 2 of 3, best accuracy 98%.');
  const list = page.getByRole('list', { name: 'Top strategists' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  // Your row is marked on the board.
  await expect(list.locator('[data-me]')).toContainText('Strategist 2');
  await expect(list.locator('[data-me]')).toContainText('You');
  await expect(
    page.getByText(/3 strategists on this board\. Leaderboards never reset\./),
  ).toBeVisible();

  await tab(page, 'Legend').click();
  await expect(tab(page, 'Legend')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Normal')).toHaveAttribute('aria-selected', 'false');
  await expect(page).toHaveURL(new RegExp(`${BASE}/legend$`));
  await expect(page.getByText('No one is on this board yet.')).toBeVisible();
  await expect(me(page)).toHaveText(
    'You’re not on the Legend board yet: finish a Legend attempt to get a rank.',
  );
  await tab(page, 'Normal').click();
  await expect(page).toHaveURL(new RegExp(`${BASE}$`));
  await expect(me(page)).toHaveText('Your rank: 2 of 3, best accuracy 98%.');
  expect(asked).toEqual([false, true, false]);

  // A reload keeps the tab (the address follows it).
  await tab(page, 'Legend').click();
  await page.reload();
  await expect(tab(page, 'Legend')).toHaveAttribute('aria-selected', 'true');
});

test('the tabs from the keyboard: arrows, Home and End', async ({ page }) => {
  await boards(page, () => ({ total: 1, entries: rows(1), me: null }));
  await page.goto(BASE);
  await tab(page, 'Normal').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Legend')).toBeFocused();
  await expect(tab(page, 'Legend')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Normal')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tab(page, 'Legend')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tab(page, 'Normal')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Normal')).toBeFocused();
  await expect(me(page)).toHaveText(
    'You’re not on this board yet: finish an attempt to get a rank.',
  );
});

test('the Legend board first, you below its top 100', async ({ page }) => {
  await boards(page, (legend) =>
    legend
      ? { total: 1534, entries: rows(100), me: { rank: 1203, accuracy: 61.44 } }
      : { total: 0, entries: [], me: null },
  );
  await page.goto(`${BASE}/legend`);
  await expect(tab(page, 'Legend')).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('list', { name: 'Top strategists' }).getByRole('listitem'),
  ).toHaveCount(100);
  await expect(me(page)).toHaveText('Your rank: 1203 of 1534, best accuracy 61.4%.');
  // Your own row, under the top 100.
  await expect(page.locator('p[data-me]')).toContainText('1203');
  await expect(page.locator('p[data-me]')).toContainText('Your rank,');
});

test('a load error, Try again, and the way back', async ({ page }) => {
  const asked = await boards(page, (_legend, n) =>
    n === 1 ? null : { total: 1, entries: rows(1), me: null },
  );
  await page.goto(BASE);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Couldn’t load the leaderboard');
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('list', { name: 'Top strategists' })).toBeVisible();
  expect(asked).toHaveLength(2);

  expect(await pressLink(page, page.getByRole('link', { name: 'data credits' }))).toBe('/credits');
  await siteLinks(page);
  await page.getByRole('link', { name: 'Back to era 2' }).click();
  await expect(page).toHaveURL(/\/eras\/2$/);
});

test('the Legend board’s load error names it', async ({ page }) => {
  await boards(page, (legend) => (legend ? null : { total: 0, entries: [], me: null }));
  await page.goto(`${BASE}/legend`);
  await expect(page.getByRole('alert')).toContainText('Couldn’t load the Legend leaderboard');
  await page.getByRole('link', { name: 'Back to era 2' }).click();
  await expect(page).toHaveURL(/\/eras\/2$/);
});
