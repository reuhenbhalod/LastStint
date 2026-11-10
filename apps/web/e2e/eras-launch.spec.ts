// Eras at launch, in production mode (`testMode: false`), on a phone and a desktop: Eras 10
// and 9 released together, every other era Coming soon with its years, Era 9 locked until 21
// stars in Era 10, only published races listed (never a Draft badge), and a direct link to a
// race production won't serve refused on screen rather than crashing.
//
// The Worker's production rules are in e2e/launch.ts (unit-tested in
// src/eras/launchMock.test.ts). Here they sit in front of the test-mode mock (e2e/eras.ts):
// the era map, the era detail, attempt refusals and race models answer as production does, and
// an attempt production would start falls through to the test-mode mock to play.
// Map nodes are found by role and text (era name and state), not layout.
import { type Page, expect, test } from '@playwright/test';
import { ERAS, eraRace, raceName, racesOfEra } from '../src/eras/catalog.js';
import { loadEraRace, mockEras } from './eras.js';
import {
  LAUNCH,
  type LaunchSeed,
  launchEraDetail,
  launchEras,
  launchModelServed,
  launchRefusal,
} from './launch.js';

const STAR = { result: true, strategist: true, mastery: true };

/** Serve the Eras API as production does for `seed`; returns the page's uncaught errors. */
async function mockLaunch(page: Page, seed: LaunchSeed): Promise<Error[]> {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  await mockEras(page, [loadEraRace('hungary-2022')]);
  // Registered after mockEras, so it answers first; `fallback` hands a request back to it.
  await page.route(
    (url) => url.pathname.startsWith('/api/eras'),
    async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const post = req.method() === 'POST';
      if (path === '/api/eras' && !post) return route.fulfill({ json: launchEras(seed) });
      const era = path.match(/^\/api\/eras\/(\d+)$/);
      if (era && !post) {
        const detail = launchEraDetail(seed, Number(era[1]));
        return detail
          ? route.fulfill({ json: detail })
          : route.fulfill({ status: 404, json: { error: 'no-era' } });
      }
      if (path === '/api/eras/attempts' && post) {
        const { raceId, legend } = req.postDataJSON() as { raceId: string; legend: boolean };
        const refused = launchRefusal(seed, raceId, legend);
        if (refused)
          return route.fulfill({ status: refused.status, json: { error: refused.error } });
        return route.fallback();
      }
      const model = path.match(/^\/api\/eras\/races\/([a-z0-9-]+)\/model$/);
      if (model && !launchModelServed(seed, model[1] as string))
        return route.fulfill({ status: 404, json: { error: 'no-race' } });
      return route.fallback();
    },
  );
  return errors;
}

/** An era's node on the map: the list item holding its name. */
function node(page: Page, eraId: number) {
  const era = ERAS.find((e) => e.id === eraId);
  if (!era) throw new Error(`no era ${eraId}`);
  return page
    .getByRole('list', { name: /^Eras, in play order/ })
    .getByRole('listitem')
    .filter({ hasText: era.name });
}

/** A race card's play link (its name, then ", play" for screen readers). */
const playLink = (page: Page, raceId: string) =>
  page.getByRole('link', { name: new RegExp(`^${raceName(raceId)}\\s*, play$`) });

const linkTo = (page: Page, eraId: number) => page.locator(`a[href="/eras/${eraId}"]`);

/** No Draft badge and no test-mode banner anywhere on the page. */
async function noDraftOrTestMode(page: Page) {
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Test mode', { exact: true })).toHaveCount(0);
}

test('the map at launch: Eras 10 and 9 released, Era 9 locked, the rest coming soon', async ({
  page,
}) => {
  const errors = await mockLaunch(page, LAUNCH);
  await page.goto('/eras');

  const era10 = node(page, 10);
  await expect(era10).toContainText('Unlocked');
  await expect(era10.locator('a[href]')).toHaveCount(1);
  await expect(linkTo(page, 10)).toBeVisible();

  const era9 = node(page, 9);
  await expect(era9).toContainText('Locked');
  await expect(era9).toContainText('21 stars in Era 10 to unlock (21 to go)');
  await expect(era9).not.toContainText('Coming soon');
  await expect(era9).not.toContainText('open on test');
  await expect(era9.locator('a[href]')).toHaveCount(0);
  await expect(linkTo(page, 9)).toHaveCount(0);

  for (const era of ERAS.filter((e) => e.id <= 8)) {
    const n = node(page, era.id);
    await expect(n).toContainText('Coming soon');
    await expect(n).toContainText(era.years);
    await expect(n.locator('a[href]')).toHaveCount(0);
    await expect(linkTo(page, era.id)).toHaveCount(0);
  }
  await noDraftOrTestMode(page);
  expect(errors).toEqual([]);
});

test('Era 9 opens at 21 stars in Era 10', async ({ page }) => {
  // Seven whole races of Era 10: 21 stars.
  const stars = Object.fromEntries(
    racesOfEra(10)
      .slice(0, 7)
      .map((r) => [r.raceId, STAR]),
  );
  await mockLaunch(page, { ...LAUNCH, stars });
  await page.goto('/eras');
  await expect(node(page, 10)).toContainText('21/30');
  await expect(node(page, 9)).toContainText('Unlocked');
  await linkTo(page, 9).click();
  await expect(page).toHaveURL(/\/eras\/9$/);
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(10);
  await noDraftOrTestMode(page);
});

test('a direct link to a locked or coming-soon era offers nothing to play', async ({ page }) => {
  const errors = await mockLaunch(page, LAUNCH);
  await page.goto('/eras/9');
  await expect(page.getByText('Unlock this era to play its races.').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(0);

  await page.goto('/eras/8');
  await expect(page.getByText('Coming soon')).toBeVisible();
  await expect(page.getByText(`${ERAS.find((e) => e.id === 8)?.years} arrives`)).toBeVisible();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(0);
  await noDraftOrTestMode(page);
  expect(errors).toEqual([]);
});

test('Era 10 lists its published races, and one plays with no Draft badge', async ({ page }) => {
  const errors = await mockLaunch(page, LAUNCH);
  await page.goto('/eras');
  await linkTo(page, 10).click();
  await expect(page).toHaveURL(/\/eras\/10$/);
  const play = page.getByRole('link', { name: /, play$/ });
  await expect(play).toHaveCount(10);
  for (const r of racesOfEra(10)) {
    await expect(playLink(page, r.raceId)).toBeVisible();
  }
  await noDraftOrTestMode(page);

  await playLink(page, 'hungary-2022').click();
  await expect(page.getByRole('button', { name: /^Start the race/ })).toBeVisible({
    timeout: 30_000,
  });
  await noDraftOrTestMode(page);
  expect(errors).toEqual([]);
});

// Production lists only published races, keeping their real positions (3 and 8 here) and
// `maxStars` for every race of the era (30). The era detail takes the gaps and keeps the order.
test('a released era with unpublished races lists only the published ones', async ({ page }) => {
  const published = ['hungary-2022', 'belgium-2023', ...racesOfEra(9).map((r) => r.raceId)];
  const errors = await mockLaunch(page, { ...LAUNCH, published });
  await page.goto('/eras/10');
  const play = page.getByRole('link', { name: /, play$/ });
  await expect(play).toHaveCount(2, { timeout: 10_000 });
  await expect(playLink(page, 'hungary-2022')).toBeVisible();
  await expect(playLink(page, 'belgium-2023')).toBeVisible();
  await expect(page.getByText(raceName('bahrain-2023'))).toHaveCount(0);
  await noDraftOrTestMode(page);
  expect(errors).toEqual([]);
});

/** A race link production refuses: the start error, with the way back, and no crash. */
async function refused(page: Page, raceId: string, errors: Error[]) {
  const race = eraRace(raceId);
  const era = race && ERAS.find((e) => e.id === race.eraId);
  if (!race || !era) throw new Error(`${raceId} is in no era`);
  await page.goto(`/eras/${race.eraId}/${raceId}`);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(`Couldn’t start ${raceName(raceId)}.`);
  await expect(page.getByRole('link', { name: `Back to ${era.name}` })).toHaveAttribute(
    'href',
    `/eras/${race.eraId}`,
  );
  await expect(page.getByRole('button', { name: /^Start the race/ })).toHaveCount(0);
  await noDraftOrTestMode(page);
  expect(errors).toEqual([]);
  return alert;
}

test('a direct link to an unpublished race is refused, not a crash', async ({ page }) => {
  const published = LAUNCH.published.filter((id) => id !== 'bahrain-2023');
  const errors = await mockLaunch(page, { ...LAUNCH, published });
  const alert = await refused(page, 'bahrain-2023', errors);
  await expect(alert).toContainText('This race isn’t available yet.');
  await expect(alert).not.toContainText('race-unpublished');
});

test('a direct link to a race of a coming-soon era is refused, not a crash', async ({ page }) => {
  const errors = await mockLaunch(page, LAUNCH);
  const alert = await refused(page, 'monaco-1984', errors);
  await expect(alert).toContainText('era-unreleased');
});

test('a direct link to a race of the locked Era 9 is refused, not a crash', async ({ page }) => {
  const errors = await mockLaunch(page, LAUNCH);
  const alert = await refused(page, racesOfEra(9)[0]?.raceId ?? '', errors);
  await expect(alert).toContainText('era-locked');
});
