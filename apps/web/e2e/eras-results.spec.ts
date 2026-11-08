// An Eras race from its intro to its results on a 390 px phone (build plan 8.7), on the real
// HTTP Eras client with the Worker mocked: the attempt, its pinned race file, the submit (which
// answers with stars, a new star, a rewrite and a rank) and the community stat.
import { expect, test } from '@playwright/test';
import { loadRace } from './mock.js';

const model = loadRace('abu-dhabi-2021');
const shots = process.env.E2E_SHOTS;
const ALL = { result: true, strategist: true, mastery: true };

test('plays an Eras race and shows its stars, rewrite and the way on', async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  let attempts = 0;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const post = route.request().method() === 'POST';
    if (url.pathname === '/api/eras/attempts' && post) {
      attempts += 1;
      return route.fulfill({
        status: 201,
        json: {
          attemptId: `11111111-1111-4111-8111-00000000000${attempts}`,
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
    if (url.pathname.startsWith('/api/eras/attempts/') && post) {
      submitted = route.request().postDataJSON();
      return route.fulfill({
        json: {
          attemptId: url.pathname.split('/').pop(),
          raceId: 'abu-dhabi-2021',
          legend: false,
          untimed: false,
          accuracy: 91.2,
          stars: ALL,
          masteryObjective: true,
          cleanCalls: true,
          hidden: false,
          rewrite: true,
          decisionAccuracies: [],
          finishPosition: 1,
          disqualified: false,
          result: {
            order: [model.userSide, model.rival],
            finishers: [model.userSide, model.rival],
            disqualified: [],
            gaps: { [model.rival]: 0.6 },
          },
          calls: [],
          newStars: { result: true, strategist: false, mastery: true },
          historyEntry: true,
          progress: { stars: ALL, hiddenDone: false, bestAccuracy: 91.2 },
          rank: 4,
          total: 57,
        },
      });
    }
    if (url.pathname === '/api/eras/races/abu-dhabi-2021/stats') {
      return route.fulfill({ json: { rewriteShare: 0.09 } });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });

  await page.goto('/eras/9/abu-dhabi-2021');
  await page.getByRole('button', { name: 'Start the race' }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await expect(plans).not.toContainText('…', { timeout: 60_000 });
  await plans.getByRole('button', { name: /^A · No stop/ }).click();
  await plans.getByRole('button', { name: /Go with plan A/ }).click();
  await page.getByRole('button', { name: '2×' }).click();

  const answers: Record<string, string[]> = {
    '36': ['Box', 'Hards'],
    '44': ['Stay out'],
    '49': ['Push now'],
    '53': ['Box', 'Softs'],
    '57': ['Attack'],
  };
  // The race: each decision answered as above; in Eras a quick or battle call holds the race,
  // so each is answered too (its last option).
  const done = page.getByRole('button', { name: 'See how you did' });
  const card = page.locator('section.decision');
  const calls = page.locator('section[aria-label="Quick call"], section[aria-label="Battle call"]');
  const answered = new Set<string>();
  const deadline = Date.now() + 240_000;
  while (!(await done.isVisible())) {
    expect(Date.now()).toBeLessThan(deadline);
    if (await card.isVisible()) {
      const lap = (await card.textContent())?.match(/Lap (\d+)/)?.[1] ?? '';
      if (lap in answers && !answered.has(lap)) {
        answered.add(lap);
        for (const name of answers[lap] as string[]) {
          await card.getByRole('button', { name, exact: true }).click();
        }
        continue;
      }
    }
    const call = calls.first();
    if (await call.isVisible()) {
      await call
        .getByRole('button')
        .last()
        .click({ timeout: 2_000 })
        .catch(() => {});
      continue;
    }
    await page.waitForTimeout(300);
  }
  expect([...answered].sort()).toEqual(Object.keys(answers).sort());

  await done.click();
  const stars = page.getByRole('region', { name: 'Stars' });
  await expect(stars).toBeVisible({ timeout: 60_000 });
  expect(submitted).toMatchObject({ untimed: false, modelHash: 'x' });
  expect(JSON.stringify(submitted)).toContain('"momentId":"plan"');
  await expect(stars.getByText('New star')).toHaveCount(2);
  await expect(stars).toContainText('91.2%');
  await expect(stars).toContainText('4/57');
  await expect(stars).toContainText('History rewritten');
  // The race file has no authored headline yet: the neutral line, nothing invented.
  await expect(stars).toContainText('You rewrote this race’s history.');
  await expect(stars).toContainText('Only 9% of strategists rewrote this race.');
  await expect(page.getByText(/LastStint Eras: Abu Dhabi 2021 ★★★ 91%/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to era' })).toHaveAttribute('href', '/eras/9');

  // Nothing wider than the phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(page.viewportSize()?.width).toBe(390);
  if (shots) {
    await page.waitForTimeout(1500); // the new stars' animation
    await page.screenshot({ path: `${shots}/eras-results.png`, fullPage: true });
  }

  // A new attempt starts a fresh one on the server, back at the race intro.
  await page.getByRole('button', { name: 'New attempt' }).click();
  await expect(page.getByRole('button', { name: 'Start the race' })).toBeVisible({
    timeout: 30_000,
  });
  expect(attempts).toBe(2);
});
