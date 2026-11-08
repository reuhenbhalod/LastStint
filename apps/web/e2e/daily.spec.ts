// Start → six calls (with the radio alert, and a driver card from the map) → results → share,
// on a 390 px phone screen, with the Worker mocked (e2e/mock.ts).
import { expect, test } from '@playwright/test';
import { loadRace, mockApi } from './mock.js';

const model = loadRace('abu-dhabi-2021');

const shots = process.env.E2E_SHOTS;

test('plays the Abu Dhabi daily end to end', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const submitted = await mockApi(page, model);

  await page.goto('/');
  // The how-to-play walkthrough opens with the daily card.
  await expect(page.getByRole('dialog')).toContainText('race engineer');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Daily Race #1')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/1-intro.png`, fullPage: true });
  await page.getByRole('button', { name: /pit wall/ }).click();
  // The race plan comes first (the strategy planner): the engineer's plans, each with its
  // chance. Plan A here is no stop, so the calls below are the race's own.
  const plans = page.getByRole('region', { name: 'Race plan' });
  await expect(plans).toContainText('No stop', { timeout: 30_000 });
  await expect(plans).not.toContainText('…', { timeout: 30_000 }); // every plan graded
  await plans.getByRole('button', { name: /^A · No stop/ }).click();
  await plans.getByRole('button', { name: /Go with plan A/ }).click();
  await page.getByRole('button', { name: '2×' }).click();

  // Tap the rival on the map: the driver card opens. (The dot never stops moving, so the click
  // is dispatched rather than waiting for it to be still.)
  await page.getByRole('button', { name: 'VER: details' }).dispatchEvent('click');
  await expect(page.getByLabel('Max Verstappen details')).toContainText('Red Bull Racing');
  await page.getByRole('button', { name: 'Close driver details' }).click();

  // Each moment: the top-level option, then (after Box) the tyre. Two calls aren't asked: the
  // lap-44 tyre call (fresh hards from lap 36) and lap 55's stop call (stopped on lap 53): the
  // wall stays out by itself (sim autoStay.ts).
  const answers: Record<string, string[]> = {
    '36': ['Box', 'Hards'],
    '49': ['Push now'],
    '53': ['Box', 'Softs'],
    '57': ['Attack'],
  };
  for (const lap of ['36', '49', '53', '57']) {
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
  // The plan picked at takeover is graded with the calls.
  await expect(page.getByText(/race plan/).first()).toBeVisible();
  expect(JSON.stringify(submitted())).toContain('"momentId":"plan"');
  expect(submitted()).not.toBeNull();
  await expect(page.getByText('2/3')).toBeVisible(); // the server's rank
  await expect(page.getByText(/LastStint #1 .*P50/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/4-results.png`, fullPage: true });
  await page.getByRole('button', { name: 'Share result' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();

  // The Pit Wall brand goes home; from there, back to the result.
  await page.getByRole('button', { name: 'LastStint', exact: true }).click();
  await page.getByRole('button', { name: /See your result/ }).click();
  await expect(page.getByText('Your calls')).toBeVisible();
});
