// The admin Tickets tab (/admin/tickets, docs/test-suite-spec.md S3): create a ticket (and the
// form's defaults, Cancel, Escape, saving, a refusal), open and edit one, switch its status,
// pick it up, delete it (asks in the card), the search, category and owner filters with their
// empty messages, the Completed section, a failed change's banner and a failed load.
// tickets.spec.ts covers pick-up, reassign and the owner filter's first look.
import type { Page } from '@playwright/test';
import { expect, test } from '../coverage.js';
import { EMAIL, OTHER, fakeAdmin, openTab, signIn } from './adminApi.js';

const card = (page: Page, title: string) => page.locator('li', { hasText: title });
const titles = (page: Page) =>
  page.locator('main ul > li button[aria-expanded] > span:first-child').allTextContents();

async function open(page: Page) {
  await openTab(page, '/admin/tickets');
  await expect(card(page, 'Make hard tyres last longer')).toBeVisible();
}

test('the list: groups, counts and the Completed section', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await open(page);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Bug (1)',
    'Feature (1)',
    'UI (2)',
  ]);
  // In progress before open, within a group.
  expect(await titles(page)).toEqual([
    'Make hard tyres last longer',
    'Add wet tyres',
    'Add a favicon',
    'Taken already',
  ]);
  await expect(page.getByRole('button', { name: /^Everyone/ })).toHaveText(/4$/);
  await expect(page.getByRole('button', { name: /^(Mine|Assigned to me) ?\d/ })).toHaveText(/1$/);
  await expect(page.getByRole('button', { name: /^Unassigned/ })).toHaveText(/2$/);
  await expect(card(page, 'Add wet tyres').getByLabel('Assignee for #2')).toHaveValue(OTHER);
  // Every card opens and closes.
  for (const t of await titles(page)) {
    const toggle = card(page, t).getByRole('button', { name: new RegExp(`^${t}`) });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(card(page, t).getByRole('button', { name: 'Edit' })).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }

  const completed = page.getByRole('button', { name: /^Completed \(1\)/ });
  await expect(completed).toHaveAttribute('aria-expanded', 'false');
  await expect(card(page, 'Slow the race down')).toHaveCount(0);
  await completed.click();
  await expect(completed).toHaveAttribute('aria-expanded', 'true');
  const done = card(page, 'Slow the race down');
  await expect(done).toContainText('#5 · UI · done');
  await expect(done.getByRole('button', { name: 'Done', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(done.getByRole('button', { name: /^Pick up/ })).toHaveCount(0);
  const doneToggle = done.getByRole('button', { name: /^Slow the race down/ });
  await doneToggle.click();
  await expect(doneToggle).toHaveAttribute('aria-expanded', 'true');
  await completed.click();
  await expect(done).toHaveCount(0);
});

test('open a ticket, edit it, and mark it done', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const hard = card(page, 'Make hard tyres last longer');
  const toggle = hard.getByRole('button', { name: /^Make hard tyres last longer/ });
  await expect(toggle).toContainText('#1 · Game changes.pdf p1 · added');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(hard).toContainText('Hards fall off too early.');
  await expect(hard).toContainText('NotesCheck the 2021 data.');
  await expect(hard).toContainText(`Added by ${OTHER}`);

  await hard.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit #1' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Make hard tyres last longer',
  );
  await expect(dialog.getByRole('textbox', { name: 'Title' })).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: 'Category' })).toHaveValue('bug');
  await expect(dialog.getByText('Source: Game changes.pdf p1')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Hard tyres: 40 laps');
  await dialog.getByRole('combobox', { name: 'Category' }).selectOption('Content');
  await dialog.getByRole('combobox', { name: 'Status' }).selectOption('Done');
  await dialog.getByRole('combobox', { name: 'Assignee' }).selectOption('You');
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Hards last 40 laps.');
  await dialog.getByRole('textbox', { name: 'Notes' }).fill('');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.calls('PATCH', '/api/admin/tickets/1').map((c) => c.body)).toEqual([
    {
      title: 'Hard tyres: 40 laps',
      description: 'Hards last 40 laps.',
      category: 'content',
      status: 'done',
      notes: '',
      assignee: EMAIL,
    },
  ]);
  // Done now: out of the open groups, into Completed.
  await expect(card(page, 'Hard tyres: 40 laps')).toHaveCount(0);
  await page.getByRole('button', { name: /^Completed \(2\)/ }).click();
  await expect(card(page, 'Hard tyres: 40 laps')).toContainText('#1 · Content');
});

test('create a ticket: defaults, Cancel, Escape, saving and a refusal', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  // Cancel and Escape close the form without saving.
  await page.getByRole('button', { name: 'New ticket' }).click();
  const dialog = page.getByRole('dialog', { name: 'New ticket' });
  await expect(dialog.getByRole('combobox', { name: 'Category' })).toHaveValue('bug');
  await expect(dialog.getByRole('combobox', { name: 'Status' })).toHaveValue('open');
  await expect(dialog.getByRole('combobox', { name: 'Assignee' })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Add ticket' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'New ticket' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // The category filter sets the new ticket's category.
  await page.getByRole('button', { name: 'Feature', exact: true }).click();
  await page.getByRole('button', { name: 'New ticket' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Category' })).toHaveValue('feature');
  await dialog.getByRole('textbox', { name: 'Title' }).fill('   ');
  await expect(dialog.getByRole('button', { name: 'Add ticket' })).toBeDisabled();

  // Refused: the form stays with the reason.
  api.fail('POST', '/api/admin/tickets', {
    status: 400,
    error: 'invalid',
    detail: 'title must not be empty',
  });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('  Night mode  ');
  await dialog.getByRole('button', { name: 'Add ticket' }).click();
  await expect(dialog.getByText('title must not be empty (400)')).toBeVisible();

  // Saving, then added.
  const release = api.hold('POST', '/api/admin/tickets');
  await dialog.getByRole('combobox', { name: 'Assignee' }).selectOption('Purohit Abhiram');
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Darker map.');
  await dialog.getByRole('textbox', { name: 'Notes' }).fill('Ask players.');
  await dialog.getByRole('button', { name: 'Add ticket' }).click();
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  release();
  await expect(dialog).toHaveCount(0);
  expect(api.last('POST', '/api/admin/tickets')).toEqual({
    title: 'Night mode',
    description: 'Darker map.',
    category: 'feature',
    status: 'open',
    notes: 'Ask players.',
    assignee: OTHER,
  });
  await expect(page.getByRole('heading', { name: 'Feature (2)' })).toBeVisible();
  expect(await titles(page)).toEqual(['Add wet tyres', 'Night mode']);
});

test('switch status, pick up an in-progress ticket, delete one', async ({ page }) => {
  const api = await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const fav = card(page, 'Add a favicon');
  await expect(fav.getByRole('button', { name: 'In progress', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The status it has already sends nothing.
  await fav.getByRole('button', { name: 'In progress', exact: true }).click();
  await fav.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(fav.getByRole('button', { name: 'Open', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(api.calls('PATCH', '/api/admin/tickets/3').map((c) => c.body)).toEqual([
    { status: 'open' },
  ]);
  await fav.getByRole('button', { name: 'In progress', exact: true }).click();
  await expect(fav.getByRole('button', { name: 'In progress', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Picking up an in-progress ticket only assigns it.
  await fav.getByRole('button', { name: 'Pick up #3', exact: true }).click();
  await expect(fav.getByLabel('Assignee for #3')).toHaveValue(EMAIL);
  expect(api.last('PATCH', '/api/admin/tickets/3')).toEqual({ assignee: EMAIL });

  // Unassign my own ticket.
  await card(page, 'Taken already').getByLabel('Assignee for #4').selectOption('');
  expect(api.last('PATCH', '/api/admin/tickets/4')).toEqual({ assignee: '' });
  await expect(
    card(page, 'Taken already').getByRole('button', { name: 'Pick up #4 and mark it in progress' }),
  ).toBeVisible();

  // Done moves it to Completed.
  await fav.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(card(page, 'Add a favicon')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Completed \(2\)/ })).toBeVisible();

  // Delete asks in the card; Cancel keeps it.
  const mine = card(page, 'Taken already');
  await mine.getByRole('button', { name: /^Taken already/ }).click();
  await expect(mine).toContainText('No description.');
  await mine.getByRole('button', { name: 'Delete' }).click();
  await expect(mine).toContainText('Delete this ticket? This can’t be undone.');
  await mine.getByRole('button', { name: 'Cancel' }).click();
  await expect(mine.getByRole('button', { name: 'Edit' })).toBeVisible();
  await mine.getByRole('button', { name: 'Delete' }).click();
  await mine.getByRole('button', { name: 'Delete' }).click();
  await expect(card(page, 'Taken already')).toHaveCount(0);
  expect(api.calls('DELETE', '/api/admin/tickets/4')).toHaveLength(1);
  await expect(page.getByRole('heading', { name: 'UI (1)' })).toHaveCount(0);
});

test('search, category and owner filters, and their empty messages', async ({ page }) => {
  await fakeAdmin(page);
  await signIn(page);
  await open(page);
  const search = page.getByRole('searchbox', { name: 'Search tickets' });
  await search.fill('#2');
  expect(await titles(page)).toEqual(['Add wet tyres']);
  await search.fill('purohit');
  expect(await titles(page)).toEqual(['Add wet tyres']);
  await search.fill('2021 DATA');
  expect(await titles(page)).toEqual(['Make hard tyres last longer']);
  await search.fill('zzz');
  await expect(page.getByText('No open tickets match.')).toBeVisible();
  await page.getByRole('button', { name: /^Completed/ }).click();
  await expect(page.getByText('Nothing completed yet.')).toBeVisible();
  await search.fill('');

  const chips = ['All', 'Bug', 'Feature', 'UI', 'Content', 'Question', 'Other'];
  const shown: Record<string, string[]> = {
    All: ['Make hard tyres last longer', 'Add wet tyres', 'Add a favicon', 'Taken already'],
    Bug: ['Make hard tyres last longer'],
    Feature: ['Add wet tyres'],
    UI: ['Add a favicon', 'Taken already'],
  };
  for (const c of chips) {
    const chip = page.getByRole('button', { name: c, exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    if (shown[c]) {
      // Done tickets in the Completed list (open) count too.
      expect((await titles(page)).filter((t) => t !== 'Slow the race down')).toEqual(shown[c]);
    } else await expect(page.getByText('No open tickets match.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();

  const mine = page.getByRole('button', { name: /^(Mine|Assigned to me) ?\d/ });
  await mine.click();
  await expect(mine).toHaveAttribute('aria-pressed', 'true');
  expect((await titles(page)).filter((t) => t !== 'Slow the race down')).toEqual(['Taken already']);
  await page.getByRole('button', { name: /^Unassigned/ }).click();
  expect((await titles(page)).filter((t) => t !== 'Slow the race down')).toEqual([
    'Make hard tyres last longer',
    'Add a favicon',
  ]);
  await page.getByRole('button', { name: /^Everyone/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
});

test('nothing assigned to me, no tickets, a failed change and a failed load', async ({ page }) => {
  const api = await fakeAdmin(page, (s) => {
    s.tickets.tickets = s.tickets.tickets.filter((t) => t.assignee !== EMAIL);
  });
  await signIn(page);
  await open(page);
  await page.getByRole('button', { name: /^(Mine|Assigned to me) ?\d/ }).click();
  await expect(
    page.getByText('Nothing assigned to you. Pick up a ticket from Unassigned.'),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Everyone/ }).click();

  // A change refused: the banner, and Dismiss.
  api.fail('PATCH', '/api/admin/tickets/2', {
    status: 409,
    error: 'conflict',
    detail: 'ticket 2 changed elsewhere',
  });
  await card(page, 'Add wet tyres').getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('ticket 2 changed elsewhere (409)')).toBeVisible();
  await expect(
    card(page, 'Add wet tyres').getByRole('button', { name: 'In progress', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('ticket 2 changed elsewhere (409)')).toHaveCount(0);

  // A ticket deleted elsewhere.
  api.state.tickets.tickets = api.state.tickets.tickets.filter((t) => t.id !== 3);
  await card(page, 'Add a favicon').getByLabel('Assignee for #3').selectOption('You');
  await expect(
    page.getByText('That ticket is gone (deleted elsewhere?).', { exact: false }),
  ).toBeVisible();

  // No tickets at all.
  api.state.tickets.tickets = [];
  await page.reload();
  await expect(page.getByText('No open tickets.', { exact: true })).toBeVisible();

  // Failing to load, then Try again.
  api.fail('GET', '/api/admin/tickets', { status: 500, error: 'db-error' });
  const release = api.hold('GET', '/api/admin/tickets');
  await page.reload();
  await expect(page.getByText('Loading tickets…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New ticket' })).toBeDisabled();
  release();
  await expect(
    page.getByText('Couldn’t load the tickets: The server said db-error (500).'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No open tickets.', { exact: true })).toBeVisible();
});
