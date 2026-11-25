// The Daily's card at `/` (docs/test-suite-spec.md S3): the how-to-play walkthrough, How it
// works, the streak, every link on the card, a Daily already played, and the start. The
// Worker is mocked (e2e/mock.ts, screens/daily.ts).
import { expect, test } from '../coverage.js';
import { loadRace, openDaily, planCard } from './daily.js';

const model = loadRace('spain-2025');
const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog');

test('the walkthrough opens on a fresh visit and steps back and forth', async ({ page }) => {
  await openDaily(page, model, { walkthrough: true });
  const d = dialog(page);
  await expect(d).toContainText('How to play · 1 of 6');
  await expect(d).toContainText('Gasly’s race engineer');
  const back = d.getByRole('button', { name: 'Back' });
  const next = d.getByRole('button', { name: 'Next' });
  await expect(back).toBeDisabled();
  await next.click();
  await expect(d).toContainText('2 of 6');
  await expect(d).toContainText('Watch the race');
  await back.click();
  await expect(d).toContainText('1 of 6');
  for (let i = 2; i <= 6; i++) {
    await next.click();
    await expect(d).toContainText(`${i} of 6`);
  }
  // The last step offers the tutorial and ends with Got it.
  await expect(d.getByRole('link', { name: 'Play the tutorial race (5 min)' })).toHaveAttribute(
    'href',
    '/tutorial',
  );
  await expect(next).toHaveCount(0);
  await d.getByRole('button', { name: 'Got it' }).click();
  await expect(d).toHaveCount(0);

  // How to play opens it again from the start; Escape and Skip close it.
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(d).toContainText('1 of 6');
  await page.keyboard.press('Escape');
  await expect(d).toHaveCount(0);
  await page.getByRole('button', { name: 'How to play' }).click();
  await d.getByRole('button', { name: 'Skip' }).click();
  await expect(d).toHaveCount(0);
});

test('the walkthrough’s tutorial link goes to the tutorial', async ({ page }) => {
  await openDaily(page, model, { walkthrough: true });
  for (let i = 0; i < 5; i++) await dialog(page).getByRole('button', { name: 'Next' }).click();
  await dialog(page)
    .getByRole('link', { name: /Play the tutorial race/ })
    .click();
  await expect(page).toHaveURL(/\/tutorial$/);
});

test('the daily card: the race, the duel, How it works and the start', async ({ page }) => {
  await openDaily(page, model);
  await expect(page.getByText('Daily race · lap 51 of 66')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The goal names the rival; the real result is the bar to beat.
  await expect(page.getByText(/Alonso/).first()).toBeVisible();
  await expect(page.getByText(/The real .* pit wall: P\d+\./)).toBeVisible();
  const duel = page.getByRole('region', { name: 'The situation' });
  await expect(duel).toContainText('GAS');
  await expect(duel).toContainText('ALO');
  await expect(duel).toContainText(/\d+\.\ds/);
  await expect(page.getByText('Laps to run')).toBeVisible();

  // How it works takes the page, and closes back to the card.
  await page.getByRole('button', { name: 'How it works' }).click();
  const close = page.getByRole('button', { name: 'Back: close How it works' });
  await expect(close).toBeVisible();
  await expect(page.getByText('Daily race · lap 51 of 66')).toHaveCount(0);
  await close.click();
  await expect(page.getByText('Daily race · lap 51 of 66')).toBeVisible();
  // The card shows again, and with it the walkthrough (it opens every time the card shows).
  await expect(dialog(page)).toContainText('1 of 6');
  await dialog(page).getByRole('button', { name: 'Skip' }).click();

  // Start: the engineer's race plan.
  await page.getByRole('button', { name: 'Take the Alpine pit wall' }).click();
  await expect(planCard(page)).toBeVisible();
  await expect(planCard(page)).toContainText('Race plan · lap 52 of 66');
});

// Each link on the card goes where it says (external links are checked by their address only:
// a test never leaves the site).
const LINKS: Array<[string | RegExp, RegExp]> = [
  [/^New here\? Play the tutorial race/, /\/tutorial$/],
  ['Gauntlet', /\/gauntlet$/],
  ['Eras', /\/eras$/],
  ['Privacy', /\/privacy$/],
  ['Terms', /\/terms$/],
  ['Credits', /\/credits$/],
];
for (const [name, url] of LINKS) {
  test(`the card’s ${String(name)} link`, async ({ page }) => {
    await openDaily(page, model);
    await page
      .getByRole('link', { name, exact: typeof name === 'string' })
      .first()
      .click();
    await expect(page).toHaveURL(url);
  });
}

test('the home and Daily links stay on the daily; the map credit links out', async ({ page }) => {
  await openDaily(page, model);
  await page.getByRole('link', { name: 'Daily', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('link', { name: 'LastStint home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toBeVisible(); // a fresh visit: the walkthrough again
  await page.getByRole('button', { name: 'Skip' }).click();
  for (const credit of await page.getByRole('link', { name: /OpenStreetMap contributors/ }).all())
    await expect(credit).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
});

test('the streak shows on the card', async ({ page }, info) => {
  await openDaily(page, model, { streak: { current: 4, best: 9, days: 12 } });
  const chip = page.getByTitle('Daily streak · best 9 · 12 races played');
  await expect(chip).toContainText('4');
  // On a phone the words go; a laptop says "day streak".
  if (info.project.name === 'desktop') await expect(chip).toContainText('4day streak');
});

test('no streak yet: the chip says to play every day', async ({ page }) => {
  await openDaily(page, model, { streak: { current: 0, best: 0, days: 0 } });
  await expect(page.getByTitle('Daily streak: play every day to build it')).toContainText('0');
});

/** Today's run as the Worker has it, already submitted from another visit. */
const playedRun = (date: string) => ({
  runId: 'r0',
  date,
  number: 1,
  raceId: model.race.id,
  score: 85,
  meanProbability: 0.7,
  finishPosition: 3,
  disqualified: false,
  result: {
    order: [model.userSide, model.rival],
    finishers: [model.userSide, model.rival],
    disqualified: [],
    gaps: { [model.userSide]: 10, [model.rival]: 11.4 },
  },
  calls: [],
  percentile: 72,
  rank: 3,
  total: 10,
});

test('a Daily already played opens on its result, and Start goes back to it', async ({ page }) => {
  const { seen } = await openDaily(page, model, { played: playedRun, walkthrough: true });
  await expect(page.getByText('You’ve already played today’s race.')).toBeVisible();
  expect(seen.runs).toBe(1);
  await expect(page.getByRole('region', { name: 'Score' })).toContainText('85');
  await expect(page.getByRole('region', { name: 'Score' })).toContainText('3/10');
  await expect(page.getByRole('region', { name: 'Score' })).toContainText('72%');
  // No replay: the card's start goes back to the result.
  await page.getByRole('button', { name: 'LastStint', exact: true }).click();
  await page.getByRole('button', { name: 'See your result' }).click();
  await expect(page.getByText('You’ve already played today’s race.')).toBeVisible();
});
