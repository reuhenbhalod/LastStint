// Screenshots of the key screens only (docs/test-suite-spec.md D6), on the phone and the
// desktop project: the Daily's card, its race plan at the takeover and a result; the Gauntlet's
// lobby with its leaderboard; the Eras map in production, a race's intro and its results with
// the stars; and the admin Today tab with an announcement. Each state is set up as the screen
// specs set it up (the same mocks), with a fixed clock where the race doesn't have to run.
// Nothing moves when the shot is taken: animations off, the caret hidden, the 3D view (a canvas)
// masked, fonts loaded and the network idle.
//
// The baselines are made on Linux (the Playwright Docker image, as CI's ubuntu-latest renders),
// so the spec runs only there; docs/test-suite-report.md "Screenshots (D6)" has the command to
// update them on purpose.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import {
  finishRace,
  loadEraRace,
  mockEras,
  shortRace,
  startRace as startEraRace,
} from '../eras.js';
import type { ErasProduction } from '../erasProduction.js';
import { TODAY, fakeAdmin, openTab, signIn } from './adminApi.js';
import { loadRace, openDaily, planCard } from './daily.js';
import { mockGauntlet } from './gauntlet.js';

test.skip(process.platform !== 'linux', 'screenshot baselines are Linux (CI); see docs');

/** A fixed day for the screens that don't run a race (12:00 UTC). */
const NOW = Date.parse('2026-11-11T12:00:00.000Z');

/** Nothing live left: fonts in, the network quiet, then the shot (the 3D view masked). */
async function shoot(page: Page, name: string, mask: Locator[] = []) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.locator('canvas'), ...mask],
    maxDiffPixelRatio: 0.01,
  });
}

test.describe('Daily', () => {
  const model = loadRace('spain-2025');

  test('the card, the walkthrough closed', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await openDaily(page, model);
    await expect(page.getByText('Daily race · lap 51 of 66')).toBeVisible();
    await expect(page.getByRole('region', { name: 'The situation' })).toContainText('ALO');
    await shoot(page, 'daily-card.png');
  });

  test('the race plan at the takeover', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await openDaily(page, model);
    await page.getByRole('button', { name: 'Take the Alpine pit wall' }).click();
    const plans = planCard(page);
    await expect(plans).toContainText('Race plan · lap 52 of 66');
    // Every plan graded: no "…" left.
    await expect(plans).not.toContainText('…', { timeout: 60_000 });
    await shoot(page, 'daily-plan.png');
  });

  test('a result (today’s run already played)', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await openDaily(page, model, {
      walkthrough: true,
      streak: { current: 4, best: 9, days: 12 },
      played: (date) => ({
        runId: 'r0',
        date,
        number: 1,
        raceId: model.race.id,
        score: 85,
        meanProbability: 0.7,
        finishPosition: 1,
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
      }),
    });
    await expect(page.getByText('You’ve already played today’s race.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Score' })).toContainText('72%');
    await shoot(page, 'daily-result.png');
  });
});

test('Gauntlet: the lobby with the leaderboard', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await mockGauntlet(page, {
    leaderboard: {
      json: {
        week: [
          { rank: 1, name: 'Quick Pilot', rounds: 4, meanScore: 72.4, live: true, date: '' },
          { rank: 2, name: 'Slow Pilot', rounds: 2, meanScore: 55, live: false, date: '' },
        ],
        allTime: [{ rank: 1, name: 'Old Legend', rounds: 9, meanScore: 88, live: false, date: '' }],
      },
    },
  });
  await page.goto('/gauntlet');
  await expect(page.getByRole('heading', { name: 'Gauntlet', level: 1 })).toBeVisible();
  const board = page.getByRole('region', { name: 'Gauntlet leaderboard' });
  await expect(board.getByRole('listitem')).toHaveCount(2);
  await shoot(page, 'gauntlet-lobby.png');
});

test.describe('Eras', () => {
  test('the map in production: open, Mastered, locked and coming soon', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    const RELEASED = '2026-01-01T00:00:00.000Z';
    const production: ErasProduction = {
      releasedAt: { 10: RELEASED, 9: RELEASED, 8: RELEASED },
    };
    // Era 10 Mastered (30/30), Era 9 open at 5 stars, Era 8 locked, the rest coming soon.
    await mockEras(page, [loadEraRace('turkey-2021')], { production, stars: { 10: 30, 9: 5 } });
    await page.goto('/eras');
    await expect(
      page.getByRole('link', { name: /^Era 9, .*Unlocked\. 5\/30 stars\.$/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /^Era 8, .*Locked\./ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Era 1, .*Coming soon\./ })).toBeVisible();
    await expect(page.getByText('Test mode', { exact: true })).toHaveCount(0);
    await shoot(page, 'eras-map.png');
  });

  test('a race’s intro', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await mockEras(page, [loadEraRace('hungary-1992')]);
    await page.goto('/eras/2/hungary-1992');
    await expect(page.getByRole('button', { name: 'Start the race', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Hungary 1992' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Objectives' }).getByRole('listitem'),
    ).toHaveCount(3);
    await shoot(page, 'eras-intro.png');
  });

  test('the results with the stars', async ({ page }) => {
    // The race runs to its flag here (cut to its last two laps), so the clock is the page's own.
    const ALL = { result: true, strategist: true, mastery: true };
    await mockEras(page, [shortRace(loadEraRace('hungary-1992'))], {
      lapScale: 0.05,
      evaluated: (res) => ({
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
      }),
    });
    await page.goto('/eras/2/hungary-1992');
    await startEraRace(page, { graded: false });
    await finishRace(page);
    const stars = page.getByRole('region', { name: 'Stars' });
    await expect(stars.getByText('New star')).toHaveCount(3);
    await expect(stars).toContainText('93.4%');
    await expect(stars).toContainText('Only 30% of strategists rewrote this race.');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot(page, 'eras-results.png');
  });
});

test('Admin: Today with an announcement', async ({ page }) => {
  // fakeAdmin fixes the clock at 2026-11-11 12:00 UTC.
  await fakeAdmin(page, (s) => {
    s.announcement = {
      id: 3,
      text: 'Servers move tonight.',
      tone: 'warning',
      endsAt: '2026-11-12T06:00:00.000Z',
      createdAt: `${TODAY}T08:00:00.000Z`,
    };
  });
  await signIn(page);
  await openTab(page, '/admin');
  await expect(page.getByText(`Today (${TODAY})`)).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Showing now' })).toContainText(
    'Servers move tonight. (warning, until 2026-11-12 06:00 UTC)',
  );
  await shoot(page, 'admin-today.png');
});
