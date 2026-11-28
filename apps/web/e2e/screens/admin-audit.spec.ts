// Edits and their audit (docs/test-suite-spec.md, rule cases: admin): one edit of every kind
// the admin page makes, from each tab in turn, then the Log tab lists each of them, newest
// first, as the Worker logs it (the fake writes the Worker's detail shapes, adminLog.ts), with
// who made it and a line saying what it did. The Log reads the server fresh when it opens.
import { expect, test } from '../coverage.js';
import { EMAIL, TODAY, fakeAdmin, nextDialog, openTab, signIn } from './adminApi.js';

const ABU = 'Abu Dhabi 2021: Hamilton vs Verstappen';

test('every kind of edit shows in the Log', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin');
  const nav = page.getByRole('navigation', { name: 'Admin' });

  // Today: set and clear the announcement, re-pin stale days.
  await page.getByRole('textbox', { name: 'New announcement' }).fill('Back soon.');
  await page.getByRole('button', { name: 'Set announcement' }).click();
  await expect(page.getByText('Announcement set.')).toBeVisible();
  await page
    .locator('.card', { hasText: 'Showing now' })
    .getByRole('button', { name: 'Clear' })
    .click();
  await expect(page.getByText('Announcement cleared.')).toBeVisible();
  await page.getByRole('button', { name: 'Re-pin stale days' }).click();
  await expect(page.getByText('Re-pinned 1 day(s)', { exact: false })).toBeVisible();

  // Schedule: add days, set a day's race, clear my run.
  await nav.getByRole('link', { name: 'Schedule' }).click();
  await page.getByRole('textbox', { name: 'Days to schedule' }).fill('2');
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(page.getByText('Scheduled 2 new days', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Race on 2026-11-13' }).selectOption({ label: ABU });
  await expect(page.getByText(`2026-11-13 is now ${ABU}.`)).toBeVisible();
  await page.getByRole('button', { name: 'Clear my run today' }).click();
  await expect(page.getByText(`Cleared your run for ${TODAY}`, { exact: false })).toBeVisible();

  // Eras: publish a race, release an era.
  await nav.getByRole('link', { name: 'Eras' }).click();
  await page
    .getByRole('article', { name: 'Era 9' })
    .getByRole('button', { name: 'E9 Race 10: Draft' })
    .click();
  await expect(page.getByText('E9 Race 10 is published.')).toBeVisible();
  await page
    .getByRole('article', { name: 'Era 10' })
    .getByRole('button', { name: 'Release now' })
    .click();
  await expect(page.getByText('Era 10 is released.')).toBeVisible();

  // Runs: re-verify a run, delete it.
  await nav.getByRole('link', { name: 'Runs' }).click();
  await page.getByRole('button', { name: 'Open Daily run by Fast Ann' }).click();
  const run = page.getByRole('region', { name: 'Run' });
  await run.getByRole('button', { name: 'Re-verify' }).click();
  await expect(run.getByText('Marked 1 for the nightly check.')).toBeVisible();
  const asked = nextDialog(page, true);
  await run.getByRole('button', { name: 'Delete run' }).click();
  await asked;
  await expect(run.getByText('Run deleted.')).toBeVisible();

  // Players: rename, hide.
  await nav.getByRole('link', { name: 'Players' }).click();
  await page.getByRole('button', { name: 'Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Player' });
  await panel.getByRole('textbox', { name: 'Display name' }).fill('Quick Ann');
  await panel.getByRole('button', { name: 'Save name' }).click();
  await expect(panel.getByText('Display name set to Quick Ann.')).toBeVisible();
  await panel.getByRole('button', { name: 'Hide from leaderboards' }).click();
  await expect(panel.getByText('Hidden from every leaderboard.', { exact: false })).toBeVisible();
  // The list marks them hidden under the new name; it opens the same player.
  await page.getByRole('button', { name: /^Quick Ann\s*Hidden$/ }).click();
  await expect(panel).toContainText('ID p1');

  // Tickets: add one, mark one done, delete one.
  await nav.getByRole('link', { name: 'Tickets' }).click();
  await page.getByRole('button', { name: 'New ticket' }).click();
  const dialog = page.getByRole('dialog', { name: 'New ticket' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Night mode');
  await dialog.getByRole('button', { name: 'Add ticket' }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .locator('li', { hasText: 'Add a favicon' })
    .getByRole('button', { name: 'Done', exact: true })
    .click();
  await expect(page.locator('li', { hasText: 'Add a favicon' })).toHaveCount(0);
  const taken = page.locator('li', { hasText: 'Taken already' });
  await taken.getByRole('button', { name: /^Taken already/ }).click();
  await taken.getByRole('button', { name: 'Delete' }).click();
  await taken.getByRole('button', { name: 'Delete' }).click();
  await expect(taken).toHaveCount(0);

  // The Log: every change, newest first, by this admin.
  const before = api.calls('GET', '/api/admin/log').length;
  await nav.getByRole('link', { name: 'Log' }).click();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(18);
  await expect.poll(() => api.calls('GET', '/api/admin/log')).toHaveLength(before + 1);
  const logged = await rows.evaluateAll((trs) =>
    trs.slice(0, 15).map((tr) => {
      const td = tr.querySelectorAll('td');
      return [td[2]?.textContent?.trim(), td[3]?.textContent?.trim()];
    }),
  );
  expect(logged).toEqual(
    [
      ['Announcement', 'Set: Back soon.'],
      ['Announcement', 'Cleared'],
      ['Re-pin', '1 days re-pinned'],
      ['Schedule', `2 days added from ${TODAY}`],
      ['Set a day', '2026-11-13 set to abu-dhabi-2021'],
      ['Clear own run', `1 own runs cleared on ${TODAY}`],
      ['Publish race', 'e9-race-10 published'],
      ['Release era', `Era 10 releases ${TODAY}T12:00:00.000Z`],
      ['Re-verify', '1 marked for the nightly check (daily r1)'],
      ['Delete run', `Daily run r1 on ${TODAY} deleted`],
      ['Player name', 'p1 renamed to Quick Ann'],
      ['Hide player', 'p1 hidden from leaderboards'],
      ['New ticket', '#6 Night mode'],
      ['Ticket status', '#3 in_progress to done'],
      ['Delete ticket', '#4 deleted'],
    ].reverse(),
  );
  for (let i = 0; i < 15; i += 1) {
    await expect(rows.nth(i)).toContainText(`${TODAY} 12:00:00`);
    await expect(rows.nth(i)).toContainText(EMAIL);
  }

  // The filter finds one kind.
  await page.getByRole('combobox', { name: 'Action' }).selectOption('Ticket status');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('#3 in_progress to done');
});

test('a refused edit is not logged', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await openTab(page, '/admin/players');
  await page.getByRole('button', { name: 'Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Player' });
  await panel.getByRole('textbox', { name: 'Display name' }).fill('A!');
  await panel.getByRole('button', { name: 'Save name' }).click();
  await expect(panel.getByText('(400)', { exact: false })).toBeVisible();
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Log' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(api.state.log.entries.length);
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody')).not.toContainText('Player name');
});
