// The Daily's result screen (docs/test-suite-spec.md S3), after Spain 2025 run to the flag on
// plan B: the chequered flag, the submit and its grading, the score, rank and beat, your calls
// (the race plan first), the stewards' penalties at the flag, the streak, the share line and
// its copy (and the fallback when the clipboard is blocked), the classification, the day's
// leaderboard and stats, the Gauntlet link, the brand home and back, and a failed submit with
// its retry. The Worker is mocked (e2e/mock.ts, screens/daily.ts).
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { type DailyOptions, loadRace, openDaily, runTo, startRace } from './daily.js';

const model = loadRace('spain-2025');
const STREAK = { current: 4, best: 9, days: 12 };

/** Spain 2025 on plan B to the flag (every big call its first option), then the submit. */
async function finish(page: Page, opts: DailyOptions = {}) {
  const daily = await openDaily(page, model, { streak: STREAK, ...opts });
  await startRace(page, 'B');
  await runTo(page, 66);
  // The field runs to the line, the chequered flag, then the results.
  await expect(
    page.getByRole('status').filter({ hasText: 'Chequered flag · Gasly P' }),
  ).toBeVisible({
    timeout: 60_000,
  });
  const see = page.getByRole('button', { name: 'See how you did' });
  await see.click({ timeout: 60_000 });
  return daily;
}

test('the result: score, rank, calls, penalties, streak, leaderboard and stats', async ({
  page,
}) => {
  const { submitted, seen } = await finish(page);
  await expect(page.getByText('Your calls')).toBeVisible({ timeout: 60_000 });
  // What was sent: the calls (the plan among them) and the game's grades.
  const body = submitted() as { decisions: Array<{ kind: string; id?: string }> };
  expect(body.decisions).toContainEqual(expect.objectContaining({ kind: 'plan', id: 'b' }));
  // The server's score, rank and percentile.
  const score = page.getByRole('region', { name: 'Score' });
  await expect(score).toContainText('Rank today');
  await expect(score).toContainText('2/3');
  await expect(score).toContainText('50%');
  // The hero: the mock's classification has Gasly winning, ahead of the real P8.
  await expect(page.getByText('You beat Alpine!')).toBeVisible();
  // Your calls: the race plan (lap 52), then the restart and the tyres.
  const mine = page.getByRole('region', { name: 'Your calls' });
  const rows = mine.getByRole('listitem');
  await expect(rows.first()).toContainText('race plan');
  await expect(rows.first()).toContainText('Plan B: one stop, softs on lap 52');
  await expect(mine).toContainText('L60');
  await expect(mine).toContainText('L63');
  await expect(rows.first()).toContainText(/Best call|Close|Costly|Big miss/);
  // The stewards' penalties after the flag, as in the real race.
  await expect(
    page.getByText(
      'Stewards after the flag, as in the real race: Verstappen +10s (causing a collision), Bearman +10s (leaving the track and gaining an advantage).',
    ),
  ).toBeVisible();
  // The streak is fetched again after the submit.
  await expect(page.getByText('4-day streak')).toBeVisible();
  await expect(page.getByText('Best 9 · 12 races played')).toBeVisible();
  expect(seen.player).toBeGreaterThanOrEqual(2);
  // The day's leaderboard and stats.
  await expect(page.getByText('Quick Pilot 706')).toBeVisible();
  await expect(page.getByText('3 runs · avg 80')).toBeVisible();
});

test('share: the spoiler-free line, copied with the site’s address', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await finish(page);
  const share = page.getByText(/^LastStint #1 WIN [🟩🟨🟧🟥]+ P50$/);
  await expect(share).toBeVisible({ timeout: 60_000 });
  const line = (await share.textContent()) as string;
  // One square per graded call, the plan first.
  expect([...line.matchAll(/[🟩🟨🟧🟥]/gu)]).toHaveLength(1 + model.decisionMoments.length);
  await page.getByRole('button', { name: 'Share result' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${line}\n${new URL(page.url()).origin}`);
});

test('share with the clipboard blocked: the line in a prompt to copy', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('blocked')) },
    });
  });
  await finish(page);
  // The prompt holds the page until it's answered: read it, then dismiss it.
  const asked: Array<{ type: string; message: string; value: string }> = [];
  page.once('dialog', (d) => {
    asked.push({ type: d.type(), message: d.message(), value: d.defaultValue() });
    void d.dismiss();
  });
  await page.getByRole('button', { name: 'Share result' }).click({ timeout: 60_000 });
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]?.type).toBe('prompt');
  expect(asked[0]?.message).toBe('Copy your result:');
  expect(asked[0]?.value).toMatch(/^LastStint #1 WIN .* P50\nhttp/);
  await expect(page.getByRole('button', { name: 'Copied!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share result' })).toBeVisible();
});

test('the classification, the Gauntlet link, and the brand home and back', async ({ page }) => {
  await finish(page);
  // A <details> group; its summary (Classification · Show) opens and closes it.
  const summary = page.getByRole('group').filter({ hasText: 'Classification' }).locator('summary');
  await summary.click({ timeout: 60_000 });
  const list = page.locator('details[open] ol');
  await expect(list).toBeVisible();
  await expect(list.getByRole('listitem').first()).toContainText('GAS');
  await expect(list.getByRole('listitem').first()).toContainText('Winner');
  await expect(list).toContainText('+0.6');
  await summary.click();
  await expect(page.locator('details[open]')).toHaveCount(0);

  // Home and back: the card's start says the result is waiting.
  await page.getByRole('button', { name: 'LastStint', exact: true }).click();
  await page.getByRole('button', { name: 'See your result' }).click();
  await expect(page.getByText('Your calls')).toBeVisible();

  await page.getByRole('link', { name: /^Keep racing: Gauntlet/ }).click();
  await expect(page).toHaveURL(/\/gauntlet$/);
});

test('a failed submit: the grades stay, and Retry sends it again', async ({ page }) => {
  const { seen } = await finish(page, {
    submitError: { status: 400, error: 'bad-run', times: 1 },
  });
  await expect(page.getByText('Not submitted (bad-run). Your grades are below.')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('region', { name: 'Score' })).toContainText('-');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText(/Not submitted/)).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'Score' })).toContainText('2/3');
  expect(seen.posts).toBe(2);
});
