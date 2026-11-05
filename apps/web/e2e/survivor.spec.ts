// Survivor mode end to end (docs/survivor-spec.md): the lobby, a run's first race played to the
// flag, the server's verdict (mocked: won), and the next race dealt. Abu Dhabi 2021 stands in
// for a survivor race (the shortest race: 24 laps to run).
import { expect, test } from '@playwright/test';
import { loadRace } from './mock.js';

const model = loadRace('abu-dhabi-2021');

test('survivor: start a run, win round 1, get round 2', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = (rounds: number, round: number) => ({
    runId: 'run-1',
    status: 'live',
    rounds,
    meanScore: rounds ? 80 : 0,
    current: { round, raceId: model.race.id, seed: model.race.seed },
    history: rounds
      ? [{ round: 1, raceId: model.race.id, won: true, score: 80, finishPosition: 1 }]
      : [],
  });
  let submitted: { round?: number; decisions?: unknown[] } | null = null;
  await page.route('**/api/survivor/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/survivor/leaderboard')
      return route.fulfill({ json: { allTime: [], week: [] } });
    if (path === '/api/survivor/start') return route.fulfill({ status: 201, json: state(0, 1) });
    if (path === '/api/survivor/run-1/round') {
      submitted = req.postDataJSON();
      return route.fulfill({
        json: {
          won: true,
          result: { result: { order: [model.userSide, model.rival] }, disqualified: false },
          state: state(1, 2),
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });

  await page.goto('/gauntlet');
  await expect(page.getByRole('heading', { name: 'Gauntlet' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();
  await page.getByRole('button', { name: /Start a run/ }).click();
  await expect(page.getByText(/Gauntlet · round 1/)).toBeVisible();
  await page.getByRole('button', { name: /Start round 1/ }).click();
  await page.getByRole('button', { name: /Go with plan/ }).click();

  // Answer every big call with its first choice until the race is over.
  const card = page.locator('section.decision');
  const survived = page.getByText('Round 1 survived');
  let answered = 0;
  while (!(await survived.isVisible())) {
    if (await card.isVisible()) {
      await card.getByRole('button').first().click();
      answered++;
      if (answered === 1) await page.getByRole('button', { name: '2×' }).click();
    } else {
      await page.waitForTimeout(300);
    }
  }
  const sent = submitted as { round?: number; decisions?: unknown[] } | null;
  expect(sent?.round).toBe(1);
  expect(sent?.decisions?.length).toBeGreaterThan(0);
  await expect(page.getByText(`${model.userSide} P1, ${model.rival} P2`)).toBeVisible();
  await page.getByRole('button', { name: /Next race/ }).click();
  await expect(page.getByRole('button', { name: /Start round 2/ })).toBeVisible();
});
