// The era unlock flow in production mode (spec §5; ERA_UNLOCK_SHARE 0.7 = 21 of 30): Era 9 stays
// locked at 20 Era 10 stars and shows what unlocks it, opens at 21, and an unreleased Era 9
// ("Coming soon") opens as soon as it's released. The Worker is mocked (e2e/eras.ts with
// `production`), since test mode opens every era. Nodes are found by their era name and state,
// not by the map's layout.
import { type Page, expect, test } from '@playwright/test';
import { loadEraRace, mockEras } from './eras.js';
import type { ErasProduction } from './erasProduction.js';

const ERA_10 = 'Ground-effect era';
const ERA_9 = 'The 2021 title fight';
const ERA_8 = 'Mercedes vs Ferrari';
const RELEASED = '2026-01-01T00:00:00.000Z';
// An authored Era 9 race with a race file, to start an attempt on once Era 9 opens.
const RACE = 'turkey-2021';
const models = [loadEraRace(RACE)];

/** Era 10 and 9 released together, as the owner plans; the rest not yet. */
const production = (released9 = true): ErasProduction => ({
  releasedAt: { 10: RELEASED, 9: released9 ? RELEASED : null },
});

/** An era's node on the map: a link once it opens (named by its name and state). */
const openNode = (page: Page, name: string) =>
  page.getByRole('link', { name: new RegExp(`${name}[\\s\\S]*Unlocked`) });
/** An era's node whatever its state. */
const node = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name });

async function map(page: Page) {
  await page.goto('/eras');
  await expect(openNode(page, ERA_10)).toBeVisible();
  // Production: no test-mode banner, no "open on test".
  await expect(page.getByText('Test mode')).toHaveCount(0);
  await expect(page.getByText('open on test')).toHaveCount(0);
}

async function expectOpens(page: Page) {
  await openNode(page, ERA_9).click();
  await expect(page).toHaveURL(/\/eras\/9$/);
  await page.getByRole('link', { name: /^Turkey 2021\s*, play$/ }).click();
  await expect(page.getByRole('button', { name: /^Start the race/ })).toBeVisible({
    timeout: 30_000,
  });
}

test('20 Era 10 stars: Era 9 is released but locked, and says what unlocks it', async ({
  page,
}) => {
  const seen = await mockEras(page, models, { production: production(), stars: { 10: 20 } });
  await map(page);
  const era9 = node(page, ERA_9);
  await expect(era9).toContainText('Locked');
  await expect(era9).toContainText('21 stars in Era 10 to unlock (1 to go)');
  await expect(era9).not.toContainText('Coming soon');
  await expect(era9.getByRole('link')).toHaveCount(0);
  await expect(openNode(page, ERA_9)).toHaveCount(0);

  // Its page lists its races but won't start one.
  await page.goto('/eras/9');
  await expect(page.getByText('Unlock this era to play its races.').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /, play$/ })).toHaveCount(0);
  expect(seen.starts).toEqual([]);
});

test('21 Era 10 stars: Era 9 is unlocked and opens', async ({ page }) => {
  // Era 8 released too here, so its lock line shows (an unreleased era shows Coming soon).
  const prod = production();
  prod.releasedAt[8] = RELEASED;
  const seen = await mockEras(page, models, { production: prod, stars: { 10: 21 } });
  await map(page);
  await expect(openNode(page, ERA_9)).toBeVisible();
  await expect(node(page, ERA_9)).not.toContainText('Locked');
  // The next era waits on Era 9's own stars.
  await expect(node(page, ERA_8)).toContainText('21 stars in Era 9 to unlock (21 to go)');
  await expect(openNode(page, ERA_8)).toHaveCount(0);
  await expectOpens(page);
  expect(seen.starts).toEqual([{ raceId: RACE, legend: false }]);
});

test('Era 9 is Coming soon with 21+ Era 10 stars, and opens once released', async ({ page }) => {
  const prod = production(false);
  const seen = await mockEras(page, models, { production: prod, stars: { 10: 24 } });
  await map(page);
  const era9 = node(page, ERA_9);
  await expect(era9).toContainText('Coming soon');
  await expect(era9).not.toContainText('Locked');
  await expect(openNode(page, ERA_9)).toHaveCount(0);
  await page.goto('/eras/9');
  await expect(page.getByText('2021 arrives in a later release.')).toBeVisible();

  // The release: released_at set, then a reload.
  prod.releasedAt[9] = RELEASED;
  await page.goto('/eras');
  await page.reload();
  await expect(openNode(page, ERA_9)).toBeVisible();
  await expect(node(page, ERA_9)).not.toContainText('Coming soon');
  await expectOpens(page);
  expect(seen.starts).toEqual([{ raceId: RACE, legend: false }]);
});
