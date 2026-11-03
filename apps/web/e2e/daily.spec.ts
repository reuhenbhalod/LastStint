// Start → six calls (with the radio alert, and a driver card from the map) → results → share,
// on a 390 px phone screen. The Worker is mocked: the
// daily serves the real race file, and POST /api/runs answers from the claimed grades the game
// sent (the real verification of those grades is unit-tested: src/state/session.test.ts and
// packages/sim/tests/verify.test.ts). Playwright loads only plain JSON here, not the sim's TS.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface Moment {
  id: string;
  lap: number;
  options: Array<{ id: string }>;
  realOptionId: string | null;
}
const model = JSON.parse(
  readFileSync(new URL('../../../data/races/abu-dhabi-2021.json', import.meta.url), 'utf8'),
) as { race: { id: string; seed: number }; decisionMoments: Moment[] };

const band = (behind: number) =>
  behind <= 0.5 ? 'green' : behind <= 5 ? 'yellow' : behind <= 15 ? 'orange' : 'red';
const POINTS: Record<string, number> = { green: 100, yellow: 70, orange: 40, red: 0 };

/** A run response in the Worker's shape, from the game's calls and claimed grades. */
function respond(
  body: {
    decisions: Array<{ kind: string; momentId?: string; optionId?: string }>;
    grades: Array<{ momentId: string; probabilities: number[]; real?: number }>;
  },
  date: string,
) {
  const calls = model.decisionMoments.map((m) => {
    const g = body.grades.find((x) => x.momentId === m.id) as {
      probabilities: number[];
      real?: number;
    };
    const best = Math.max(...g.probabilities);
    const options = m.options.map((o, i) => {
      const p = g.probabilities[i] as number;
      return {
        id: o.id,
        probability: p,
        behindBest: (best - p) * 100,
        band: band((best - p) * 100),
      };
    });
    const chosen = body.decisions.find((d) => d.kind === 'radio' && d.momentId === m.id)
      ?.optionId as string;
    const mine = options.find((o) => o.id === chosen) as (typeof options)[number];
    const real = options.find((o) => o.id === m.realOptionId);
    const realP = real?.probability ?? g.real ?? 0;
    return {
      momentId: m.id,
      lap: m.lap,
      chosen,
      band: mine.band,
      points: POINTS[mine.band],
      probability: mine.probability,
      best: (options.find((o) => o.probability === best) as { id: string }).id,
      options,
      real: { optionId: m.realOptionId, probability: realP, band: band((best - realP) * 100) },
      matchedReal: chosen === m.realOptionId,
    };
  });
  const score = calls.reduce((s, c) => s + (c.points ?? 0), 0) / calls.length;
  return {
    runId: 'r1',
    date,
    number: 1,
    raceId: model.race.id,
    score,
    meanProbability: 0.5,
    finishPosition: 1,
    disqualified: false,
    result: {
      order: ['HAM', 'VER'],
      finishers: ['HAM', 'VER'],
      disqualified: [],
      gaps: { VER: 0.6 },
    },
    calls,
    percentile: 50,
    rank: 2,
    total: 3,
  };
}
const shots = process.env.E2E_SHOTS;

test('plays the Abu Dhabi daily end to end', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const date = await page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const daily = { date, number: 1, raceId: model.race.id, seed: model.race.seed, side: 'HAM' };
  let submitted: unknown = null;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/daily') {
      return route.fulfill({
        json: { ...daily, modelUrl: `${url.origin}/api/races/x`, modelHash: 'x' },
      });
    }
    if (url.pathname === '/api/races/x') return route.fulfill({ json: model });
    if (url.pathname === '/api/runs' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      submitted = body;
      return route.fulfill({ status: 201, json: respond(body, date) });
    }
    if (url.pathname.endsWith('/leaderboard')) {
      return route.fulfill({
        json: { entries: [{ rank: 1, name: 'Quick Pilot 706', score: 100 }] },
      });
    }
    if (url.pathname.endsWith('/stats'))
      return route.fulfill({ json: { runs: 3, meanScore: 80, moments: [] } });
    return route.fulfill({ status: 404, json: { error: 'no-run' } });
  });

  await page.goto('/');
  // First visit: the how-to-play walkthrough opens by itself.
  await expect(page.getByRole('dialog')).toContainText('team manager');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Daily Race #1')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/1-intro.png`, fullPage: true });
  await page.getByRole('button', { name: /pit wall/ }).click();
  await page.getByRole('button', { name: '2×' }).click();

  // Tap the rival on the map: the driver card opens. (The dot never stops moving, so the click
  // is dispatched rather than waiting for it to be still.)
  await page.getByRole('button', { name: 'VER: details' }).dispatchEvent('click');
  await expect(page.getByLabel('Max Verstappen details')).toContainText('Red Bull Racing');
  await page.getByRole('button', { name: 'Close driver details' }).click();

  // Each moment: the top-level option, then (after Box) the tyre. Lap 55's stop call isn't
  // asked: the car stopped on lap 53, so the wall stays out by itself.
  const answers: Record<string, string[]> = {
    '36': ['Box', 'Hards'],
    '44': ['Stay out'],
    '49': ['Push now'],
    '53': ['Box', 'Softs'],
    '57': ['Attack'],
  };
  for (const lap of ['36', '44', '49', '53', '57']) {
    const card = page.locator('section.decision');
    await expect(card).toContainText(`Lap ${lap}`, { timeout: 90_000 });
    await expect(page.getByRole('alert')).toContainText(`Lap ${lap}`);
    if (shots && lap === '53')
      await page.screenshot({ path: `${shots}/3-decision-53.png`, fullPage: true });
    if (shots && lap === '49')
      await page.screenshot({ path: `${shots}/2-race.png`, fullPage: true });
    for (const name of answers[lap] as string[]) {
      await card.getByRole('button', { name, exact: true }).click();
    }
  }

  await page.getByRole('button', { name: 'See how you did' }).click({ timeout: 90_000 });
  await expect(page.getByText('Your calls')).toBeVisible({ timeout: 60_000 });
  expect(submitted).not.toBeNull();
  await expect(page.getByText('2/3')).toBeVisible(); // the server's rank
  await expect(page.getByText(/Pit Wall #1 .*P50/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/4-results.png`, fullPage: true });
  await page.getByRole('button', { name: 'Share result' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
});
