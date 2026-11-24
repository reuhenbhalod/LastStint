// An Eras attempt's results (the review after the flag, /eras/:n/:race), every control in every
// state (docs/test-suite-spec.md S3, D7): "See how you did" and its grading wait, a failed
// submit and its Retry, the stars (new or not), ★2 reached or short, the rewrite (with its
// history book entry, none, or a race with no rewrite to earn), the community line, the hidden
// objective (a new challenge, done on this attempt, done before), a held or refused score, and
// the way on: share, the classification, New attempt, Back to era, the leaderboard, the history
// book and home.
//
// Every number on this screen is the server's, so the race is cut to its last two laps
// (`shortRace`) and the mocked Worker's evaluation is set per test (`evaluated`, `submitReply`).
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  type Evaluated,
  finishRace,
  loadEraRace,
  mockEras,
  pressLink,
  shortRace,
  startRace,
} from '../eras.js';

const ALL = { result: true, strategist: true, mastery: true };
const NONE = { result: false, strategist: false, mastery: false };
const FAST = { lapScale: 0.05 };
const stars = (page: Page) => page.getByRole('region', { name: 'Stars' });

/** Hungary 1992 (Era 2, a rewrite to earn) from its intro to the flag, then the review. */
async function toFlag(page: Page, raceId = 'hungary-1992', era = 2) {
  await page.goto(`/eras/${era}/${raceId}`);
  await startRace(page, { graded: false });
}

/** Every star new, the rewrite with its history book entry, the hidden objective unlocked. */
const perfect = (res: Evaluated): Evaluated => ({
  ...res,
  accuracy: 93.4,
  stars: ALL,
  newStars: ALL,
  rewrite: true,
  historyEntry: true,
  hidden: false,
  progress: { stars: ALL, hiddenDone: false, bestAccuracy: 93.4 },
  rank: 2,
  total: 4,
});

test('grading, a failed submit and Retry, then every star new and the rewrite', async ({
  page,
}) => {
  const eras = await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], {
    ...FAST,
    // The first submit fails twice (the app sends it once more on its own): a server error.
    submitReply: (n) => (n <= 2 ? { status: 503, json: { error: 'busy' } } : undefined),
    evaluated: perfect,
  });
  // Hold the first submit, to see the wait.
  let release: () => void = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  let first = true;
  await page.route(
    (url) => /^\/api\/eras\/attempts\/[0-9a-f-]+$/.test(url.pathname),
    async (route) => {
      if (first) {
        first = false;
        await held;
      }
      return route.fallback();
    },
  );
  await toFlag(page);
  const see = page.getByRole('button', { name: 'See how you did' });
  await expect(see).toBeVisible({ timeout: 60_000 });
  await see.click();
  const grading = page.getByRole('button', { name: 'Grading your calls…' });
  await expect(grading).toBeVisible();
  await expect(grading).toBeDisabled();
  release();

  const panel = stars(page);
  await expect(panel).toContainText('Stars · Era 2');
  const alert = panel.getByRole('alert');
  await expect(alert).toContainText(
    'No stars yet. The server had a problem (busy). Retry in a moment.',
  );
  expect(eras.submissions).toHaveLength(2);
  await alert.getByRole('button', { name: 'Retry' }).click();

  const list = panel.getByRole('list', { name: 'Stars this attempt' });
  await expect(list).toBeVisible();
  for (const [n, name] of [
    [1, 'Result'],
    [2, 'Strategist'],
    [3, 'Mastery'],
  ] as const) {
    await expect(list.getByRole('listitem').nth(n - 1)).toContainText(`★${n} ${name}`);
    await expect(list.getByRole('listitem').nth(n - 1)).toContainText(`Star ${n}: earned, new`);
  }
  await expect(panel.getByText('New star')).toHaveCount(3);
  await expect(panel).toContainText('93.4%');
  await expect(panel).toContainText('★2 needs 88: reached');
  await expect(panel).toContainText('2/4');
  await expect(panel).toContainText('History rewritten');
  await expect(panel).toContainText('Berger keeps the Williams behind him at the Hungaroring');
  await expect(panel).toContainText('Added to your history book.');
  await expect(panel).toContainText('Only 30% of strategists rewrote this race.');
  await expect(panel).toContainText('Hidden objective');
  await expect(panel).toContainText('Finish second');
  await expect(panel).toContainText('A new challenge: all three stars unlocked it.');
  await expect(panel.getByText('Untimed', { exact: true })).toHaveCount(0);
  expect(eras.submissions).toHaveLength(3);
});

test('the way on: share, the classification, the links, home and a new attempt', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const eras = await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], {
    ...FAST,
    evaluated: perfect,
  });
  await toFlag(page);
  await finishRace(page);
  await expect(page.getByText('Eras · Era 2 · Hungary', { exact: false })).toBeVisible();

  // Share: the spoiler-free line, copied.
  const share = page.getByRole('button', { name: 'Share result' });
  await share.click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^LastStint Eras: Hungary 1992 ★★★ 93%/);
  expect(copied).toContain(new URL(page.url()).origin);

  // The classification opens from its summary.
  // (A <summary>: a button to the recorder, though Chromium gives it no button role.)
  const classification = page.locator('summary').filter({ hasText: 'Classification' });
  await classification.click();
  await expect(page.locator('details[open]')).toContainText('BER');
  await classification.click();
  await expect(page.locator('details[open]')).toHaveCount(0);

  expect(await pressLink(page, page.getByRole('link', { name: 'Leaderboard', exact: true }))).toBe(
    '/eras/2/hungary-1992/leaderboard',
  );
  expect(await pressLink(page, page.getByRole('link', { name: 'History book' }))).toBe(
    '/eras/history',
  );
  expect(await pressLink(page, page.getByRole('link', { name: 'Back to era' }))).toBe('/eras/2');
  await expect(page.getByRole('button', { name: 'Play again' })).toHaveCount(0);

  // A new attempt: a fresh one from the server, back at the intro.
  await page.getByRole('button', { name: 'New attempt' }).click();
  await expect(page.getByRole('button', { name: 'Start the race' })).toBeVisible();
  expect(eras.starts).toHaveLength(2);

  // Home, from the results' brand: the era.
  await startRace(page, { graded: false });
  await finishRace(page);
  await page
    .getByRole('banner')
    .getByRole('button', { name: /^LastStint/ })
    .click();
  await expect(page).toHaveURL(/\/eras\/2$/);
});

test('a race with no rewrite to earn: ★2 short, no new star, the hidden objective done before', async ({
  page,
}) => {
  // Monaco 1992: Senna really won, so there's nothing to rewrite (and no rewrite stat).
  await mockEras(page, [shortRace(loadEraRace('monaco-1992'))], {
    ...FAST,
    evaluated: (res) => ({
      ...res,
      accuracy: 80.5,
      stars: { result: true, strategist: false, mastery: false },
      newStars: NONE,
      rewrite: null,
      historyEntry: false,
      hidden: false,
      progress: { stars: ALL, hiddenDone: true, bestAccuracy: 95 },
      rank: 7,
      total: 9,
    }),
  });
  await toFlag(page, 'monaco-1992');
  await finishRace(page);
  const panel = stars(page);
  const list = panel.getByRole('list', { name: 'Stars this attempt' });
  await expect(list.getByRole('listitem').nth(0)).toContainText('Star 1: earned');
  await expect(list.getByRole('listitem').nth(1)).toContainText('Star 2: not earned');
  await expect(list.getByRole('listitem').nth(2)).toContainText('Star 3: not earned');
  await expect(panel.getByText('New star')).toHaveCount(0);
  await expect(panel).toContainText('★2 needs 88: 7.5% short');
  await expect(panel).toContainText('7/9');
  await expect(panel).not.toContainText('History rewritten');
  await expect(panel).not.toContainText('rewrote this race');
  // All three stars on the race from before: the hidden objective shows, already done.
  await expect(panel).toContainText('Win by more than 2 seconds');
  await expect(panel).toContainText('Done.');
});

test('history not rewritten, the hidden objective done on this attempt', async ({ page }) => {
  await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], {
    ...FAST,
    evaluated: (res) => ({
      ...res,
      stars: ALL,
      newStars: { result: false, strategist: false, mastery: true },
      rewrite: false,
      historyEntry: false,
      hidden: true,
      progress: { stars: ALL, hiddenDone: true, bestAccuracy: res.accuracy },
    }),
  });
  await toFlag(page);
  await finishRace(page);
  const panel = stars(page);
  await expect(panel.getByText('New star')).toHaveCount(1);
  await expect(panel).not.toContainText('History rewritten');
  // A race with a rewrite to earn shows how many did.
  await expect(panel).toContainText('Only 30% of strategists rewrote this race.');
  await expect(panel).toContainText('Done on this attempt: added to your history book.');
});

test('a score the server holds, and one it refuses for good', async ({ page }) => {
  await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], {
    ...FAST,
    submitReply: (n) =>
      n === 1
        ? { status: 409, json: { error: 'rival-unavailable' } }
        : { status: 409, json: { error: 'model-changed' } },
  });
  await toFlag(page);
  await finishRace(page);
  const panel = stars(page);
  await expect(panel).toContainText(
    'Your calls are saved, but the server can’t check this rival yet. Your stars are awarded once it can.',
  );
  await expect(panel.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(panel.getByRole('list', { name: 'Stars this attempt' })).toHaveCount(0);

  // A new attempt whose race changed under it: no Retry, a new attempt is the way.
  await page.getByRole('button', { name: 'New attempt' }).click();
  await startRace(page, { graded: false });
  await finishRace(page);
  await expect(stars(page).getByRole('alert')).toContainText(
    'This race was updated after your attempt started, so it can’t be scored. Start a new attempt to play it again.',
  );
  await expect(stars(page).getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('no community stat served: no line, the rest as scored', async ({ page }) => {
  await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], {
    ...FAST,
    stats: () => null,
    evaluated: perfect,
  });
  await toFlag(page);
  await finishRace(page);
  await expect(stars(page)).toContainText('History rewritten');
  await expect(stars(page)).not.toContainText('rewrote this race.');
});
