// A defend race end to end on a laptop screen (Spain 2020: VER holds P2 from BOT): the goal
// reads as a defend, every call the race asks is answered (generically, so the test follows
// the race file's calls), and the results come back. The Worker is mocked (e2e/mock.ts).
import { expect, test } from '@playwright/test';
import { loadRace, mockApi } from './mock.js';

const model = loadRace('spain-2020');

test('plays a defend race end to end on a laptop screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const submitted = await mockApi(page, model);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  // The goal names the rival (Bottas), as the game says drivers' names.
  await expect(page.getByText(/^Hold P2 from Bottas/).first()).toBeVisible();
  await page.getByRole('button', { name: /pit wall/ }).click();
  // The engineer's pick of the race plans.
  await page.getByRole('button', { name: /Go with plan/ }).click();

  // Answer each call with its first choice (and, after Box, the first tyre) until the flag.
  const card = page.locator('section.decision');
  const done = page.getByRole('button', { name: 'See how you did' });
  let answered = 0;
  while (!(await done.isVisible())) {
    if (await card.isVisible()) {
      await card.getByRole('button').first().click();
      answered++;
      if (answered === 1) await page.getByRole('button', { name: '2×' }).click();
    } else {
      await page.waitForTimeout(300);
    }
  }
  expect(answered).toBeGreaterThanOrEqual(model.decisionMoments.length - 1);

  await done.click();
  await expect(page.getByText('Your calls')).toBeVisible({ timeout: 60_000 });
  expect(submitted()).not.toBeNull();
});
