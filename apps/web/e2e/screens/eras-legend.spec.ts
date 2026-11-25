// An Eras race at Legend difficulty (/eras/:n/:race/legend), every control (docs/test-suite-spec.md
// S3, D7): the Legend intro and its start, the race screen's controls on the Legend route, and the
// Legend results (Legend stars, the Legend leaderboard, the share line, a new Legend attempt).
// The era is Cleared (a star on every race), so Legend is open. The Worker is mocked.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  LEGEND,
  closeTeamRadio,
  finishRace,
  isPhone,
  loadEraRace,
  mockEras,
  pressLink,
  shortRace,
  siteLinks,
  startRace,
  teamRadio,
} from '../eras.js';

const RACE = 'monaco-1992';
const URL = `/eras/2/${RACE}/legend`;
const controls = (page: Page) => page.getByRole('navigation', { name: 'Controls' });

test('the Legend intro: its difficulty, the way back and the start', async ({ page }) => {
  const eras = await mockEras(page, [loadEraRace(RACE)], { cleared: [2], lapScale: 100 });
  await page.goto(URL);
  const start = page.getByRole('button', { name: 'Start the race · Legend' });
  await expect(start).toBeVisible();
  await expect(page.getByText('Legend', { exact: true }).first()).toBeVisible();
  const difficulty = page.getByRole('region', { name: 'Difficulty · Legend' });
  await expect(difficulty).toContainText(`${LEGEND.decisionTimerSeconds} s per call`);
  await expect(page.getByRole('region', { name: 'Objectives' })).toContainText(
    `${LEGEND.accuracyThreshold}`,
  );
  expect(await pressLink(page, page.getByRole('link', { name: 'Back to the era' }))).toBe(
    '/eras/2',
  );
  expect(
    await pressLink(page, page.getByRole('link', { name: '© OpenStreetMap contributors' })),
  ).toBe('https://www.openstreetmap.org/copyright');
  await siteLinks(page);
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(start).toHaveCount(0);
  await page.getByRole('button', { name: 'Close How it works' }).click();
  await start.click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await expect(plans).toBeVisible();
  expect(eras.starts).toEqual([{ raceId: RACE, legend: true }]);
  // The Legend race's plans: each picks, and your own.
  const go = plans.getByRole('button', { name: /^Go with/ });
  for (const id of ['B', 'C', 'A']) {
    const card = plans.getByRole('button', { name: new RegExp(`^${id} · `) });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(go).toHaveText(`Go with plan ${id}`);
  }
  await plans.getByRole('button', { name: 'Build your own' }).click();
  await expect(go).toHaveText('Go with your plan');
});

test('the race screen at Legend: the bar, the views, the radio and a car', async ({ page }) => {
  await mockEras(page, [loadEraRace(RACE)], { cleared: [2], lapScale: 100 });
  await page.goto(URL);
  await startRace(page, { graded: false });
  // Speed and the timer.
  await page.getByRole('button', { name: '1×' }).click();
  await expect(page.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '2×' }).click();
  await page.getByRole('button', { name: 'Timer on' }).click();
  await page.getByRole('button', { name: 'Timer off' }).click();
  await expect(page.getByRole('button', { name: 'Timer on' })).toBeVisible();
  // The views.
  const pill = (name: string | RegExp) =>
    controls(page).getByRole('button', { name, exact: typeof name === 'string' });
  if (isPhone(page)) {
    for (const name of ['Standings', 'Car', 'Calls', 'Radio']) {
      await pill(name).click();
      await expect(pill(name)).toHaveAttribute('aria-pressed', 'true');
    }
    await pill('Radio').click();
  } else {
    await pill('Show stats').click();
    await expect(page.getByRole('region', { name: 'Standings' })).toBeVisible();
    await page.getByRole('region', { name: 'Standings' }).getByRole('button').first().click();
    await expect(page.getByRole('region', { name: / details$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Close driver details' }).click();
    await pill('Focus view').click();
    const sound = page.getByRole('button', { name: /^Radio sound/ });
    const was = await sound.getAttribute('aria-pressed');
    await sound.click();
    await expect(sound).not.toHaveAttribute('aria-pressed', was ?? '');
    await sound.click();
  }
  await pill('Follow car').click();
  await expect(pill('Follow car')).toHaveAttribute('aria-pressed', 'true');
  await pill('Follow car').click();
  // A car on the map, and a leaders row.
  const dot = page.getByRole('button', { name: 'SENA: details', exact: true });
  await dot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Ayrton Senna details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close driver details' }).click();
  if (!isPhone(page)) {
    await page.getByRole('region', { name: 'Leaders' }).getByRole('button').first().click();
    await expect(page.getByRole('region', { name: / details$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Close driver details' }).click();
  }
  // The plan and the team radio.
  const plan = pill(/^Plan · /);
  await plan.click();
  await expect(page.getByRole('region', { name: 'Race plan' })).toBeVisible();
  await plan.click();
  const radio = await teamRadio(page);
  // The headset at Legend: one call of a kind a lap, each booked.
  for (const [group, value] of [
    ['Pace', 'push'],
    ['Battle', 'attack'],
    ['Fuel', 'Lift & coast'],
  ] as const) {
    const b = radio
      .getByRole('group', { name: group })
      .getByRole('button', { name: value, exact: true });
    await b.click();
    await expect(b).toHaveAttribute('aria-pressed', 'true');
  }
  await closeTeamRadio(page);
  if (!isPhone(page)) {
    await page.getByRole('button', { name: /^LastStint.*race engineer/ }).click();
    await expect(page).toHaveURL(/\/eras\/2$/);
  }
});

test('the Legend results: Legend stars, its leaderboard, the share line and a new attempt', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const eras = await mockEras(page, [shortRace(loadEraRace(RACE))], {
    cleared: [2],
    lapScale: 0.05,
  });
  await page.goto(URL);
  await startRace(page, { graded: false });
  await finishRace(page);
  const stars = page.getByRole('region', { name: 'Stars' });
  await expect(stars).toContainText('Legend stars · Era 2');
  await expect(stars).toContainText(`★2 needs ${LEGEND.accuracyThreshold}`);
  await expect(page.getByText(/^Eras · Era 2 · Legend · /)).toBeVisible();
  await page.getByRole('button', { name: 'Share result' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^LastStint Eras: Monaco 1992 \(Legend\) /,
  );
  expect(await pressLink(page, page.getByRole('link', { name: 'History book' }))).toBe(
    '/eras/history',
  );
  expect(await pressLink(page, page.getByRole('link', { name: 'Back to era' }))).toBe('/eras/2');
  await page.getByRole('button', { name: 'New attempt' }).click();
  await expect(page.getByRole('button', { name: 'Start the race · Legend' })).toBeVisible();
  expect(eras.starts).toEqual([
    { raceId: RACE, legend: true },
    { raceId: RACE, legend: true },
  ]);
  await startRace(page, { graded: false });
  await finishRace(page);
  // The classification opens from its summary, and closes.
  const classification = page.locator('summary').filter({ hasText: 'Classification' });
  await classification.click();
  await expect(page.locator('details[open]')).toContainText('SEN');
  await classification.click();
  await expect(page.locator('details[open]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Legend leaderboard' }).click();
  await expect(page).toHaveURL(new RegExp(`/eras/2/${RACE}/leaderboard/legend$`));
  await expect(page.getByRole('tab', { name: 'Legend' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('me-line')).toContainText('Your rank:');
  expect(await pressLink(page, page.getByRole('link', { name: 'data credits' }))).toBe('/credits');
  await siteLinks(page);
});

test('the Legend results: home from the brand is the era', async ({ page }) => {
  await mockEras(page, [shortRace(loadEraRace(RACE))], { cleared: [2], lapScale: 0.05 });
  await page.goto(URL);
  await startRace(page, { graded: false });
  await finishRace(page);
  await page
    .getByRole('banner')
    .getByRole('button', { name: /^LastStint/ })
    .click();
  await expect(page).toHaveURL(/\/eras\/2$/);
});
