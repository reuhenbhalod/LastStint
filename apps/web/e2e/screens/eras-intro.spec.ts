// An Eras race's intro (/eras/:n/:race, before the start), every control in every state
// (docs/test-suite-spec.md S3, D7): the way back to the era, How it works and its close, the
// race and map credits, the start; the difficulty with the timer on and turned off; a Draft
// race with its objectives not written; the start loading, failing and its Try again. The
// Worker is mocked (e2e/eras.ts).
import { expect, test } from '../coverage.js';
import { type EraModel, loadEraRace, mockEras, pressLink, siteLinks } from '../eras.js';

const RACE = 'hungary-1992';
const URL = `/eras/2/${RACE}`;
const start = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Start the race', exact: true });

test('the intro: dilemma, objectives, difficulty, and each control', async ({ page }) => {
  await mockEras(page, [loadEraRace(RACE)]);
  await page.goto(URL);
  await expect(start(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Hungary 1992' })).toBeVisible();
  await expect(page.getByText('Era 2 · Senna vs Prost · Race 7')).toBeVisible();
  await expect(page.getByText('Reconstructed', { exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  const objectives = page.getByRole('region', { name: 'Objectives' });
  await expect(objectives.getByRole('listitem')).toHaveCount(3);
  await expect(objectives).toContainText('Answer the Williams: make exactly one tyre stop');
  const difficulty = page.getByRole('region', { name: 'Difficulty' });
  await expect(difficulty).toContainText('Decision timer');
  await expect(difficulty).not.toContainText('Turned off in your settings');
  await expect(
    page.getByText(/You’re Berger’s race engineer at McLaren from lap 58 of 77/),
  ).toBeVisible();

  // The race's data credit and the map's.
  expect(await pressLink(page, page.getByRole('main').getByRole('link', { name: 'Credits' }))).toBe(
    '/credits',
  );
  expect(
    await pressLink(page, page.getByRole('link', { name: '© OpenStreetMap contributors' })),
  ).toBe('https://www.openstreetmap.org/copyright');
  await siteLinks(page);

  // How it works opens over the intro, and closes back to it.
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(start(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close How it works' }).click();
  await expect(start(page)).toBeVisible();

  // Back to the era.
  await page.getByRole('link', { name: 'Back to the era' }).click();
  await expect(page).toHaveURL(/\/eras\/2$/);
});

test('Start the race opens the race plan', async ({ page }) => {
  const eras = await mockEras(page, [loadEraRace(RACE)]);
  await page.goto(URL);
  await start(page).click();
  await expect(page.getByRole('region', { name: 'Race plan' })).toBeVisible();
  expect(eras.starts).toEqual([{ raceId: RACE, legend: false }]);
});

test('the timer turned off in settings: the intro says the stars will be untimed', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('pitwall.decisionTimer', 'off'));
  await mockEras(page, [loadEraRace(RACE)]);
  await page.goto(URL);
  await expect(page.getByRole('region', { name: 'Difficulty' })).toContainText(
    'Turned off in your settings: this attempt’s stars are marked untimed.',
  );
});

test('a Draft race: badged, its unwritten objectives marked', async ({ page }) => {
  // A race file with no Eras target yet (test mode plays it as a Draft).
  const model = loadEraRace(RACE) as EraModel & { eras: Record<string, unknown> };
  model.eras = { ...model.eras, target: undefined, mastery: undefined };
  await mockEras(page, [model]);
  await page.goto(URL);
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  // ★1 and ★3 aren't written yet: marked, never invented; ★2 is the era's threshold.
  const objectives = page.getByRole('region', { name: 'Objectives' });
  await expect(objectives.getByText('Not written yet.')).toHaveCount(2);
  await expect(objectives).toContainText('Strategist');
  await expect(start(page)).toBeEnabled();
});

test('starting: the wait, a refused start, Try again and the way back', async ({ page }) => {
  await mockEras(page, [loadEraRace(RACE)]);
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route(
    (url) => url.pathname === '/api/eras/attempts',
    async (route) => {
      calls += 1;
      if (calls > 1) return route.fallback();
      await held;
      return route.fulfill({ status: 503, json: { error: 'busy' } });
    },
  );
  await page.goto(URL);
  await expect(page.getByText('Starting Hungary 1992…')).toBeVisible();
  release();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Couldn’t start Hungary 1992.');
  await expect(start(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to Senna vs Prost' })).toHaveAttribute(
    'href',
    '/eras/2',
  );
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(start(page)).toBeVisible();
  expect(calls).toBe(2);

  // The way back from a refused start.
  await page.goto('/eras/2/monaco-1992');
  await page.getByRole('link', { name: 'Back to Senna vs Prost' }).click();
  await expect(page).toHaveURL(/\/eras\/2$/);
});
