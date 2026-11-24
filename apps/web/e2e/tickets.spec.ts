// The admin Tickets tab (/admin/tickets) against a mocked ticket API: pick up an unassigned
// ticket (it becomes yours and in progress), hand one to the other admin, unassign it, and
// filter by owner. SHOTS=<dir> also saves desktop and phone screenshots.
import type { Page } from '@playwright/test';
import { expect, test } from './coverage.js';

const me = 'reuhenbhalod@gmail.com';
const other = 'purohit.abhiram@gmail.com';

const token = () => {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;
};

function ticket(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    title: `Ticket ${id}`,
    description: 'What to change.',
    category: 'bug',
    status: 'open',
    notes: '',
    source: 'Game changes.pdf p1',
    createdBy: '',
    assignee: '',
    createdAt: id * 1000,
    updatedAt: id * 1000,
    completedAt: null,
    ...over,
  };
}

async function mockTickets(page: Page) {
  const tickets = [
    ticket(1, { title: 'Make hard tyres last a realistic number of laps' }),
    ticket(2, {
      title: 'Add weather and wet tyres',
      category: 'feature',
      assignee: other,
      status: 'in_progress',
    }),
    ticket(3, { title: 'Add a favicon / main page icon', category: 'ui' }),
    ticket(4, { title: 'Slow the race down', category: 'ui', status: 'done', completedAt: 4000 }),
  ];
  const patches: unknown[] = [];
  await page.addInitScript((v) => sessionStorage.setItem('pitwall:admin-token', v), token());
  await page.route('**/api/admin/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/me') return route.fulfill({ json: { email: me } });
    if (path === '/api/admin/tickets') {
      return route.fulfill({ json: { tickets, admins: [me, other], me } });
    }
    const id = Number(/\/api\/admin\/tickets\/(\d+)$/.exec(path)?.[1]);
    const t = tickets.find((x) => x.id === id);
    if (t && req.method() === 'PATCH') {
      const body = req.postDataJSON();
      patches.push({ id, ...body });
      Object.assign(t, body);
      return route.fulfill({ json: { ticket: t } });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  return patches;
}

const shots = process.env.SHOTS;

test('pick up, reassign, unassign and filter by owner', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const patches = await mockTickets(page);
  await page.goto('/admin/tickets');

  const hard = page.locator('li', { hasText: 'Make hard tyres' });
  await expect(hard.getByLabel('Assignee for #1')).toHaveValue('');
  await expect(page.getByRole('button', { name: /Unassigned/ })).toContainText('2');
  if (shots) await page.screenshot({ path: `${shots}/tickets-desktop.png`, fullPage: true });

  // Pick up: mine, and in progress.
  await hard.getByRole('button', { name: 'Pick up #1 and mark it in progress' }).click();
  await expect(hard.getByLabel('Assignee for #1')).toHaveValue(me);
  await expect(hard.getByRole('button', { name: 'In progress' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(hard.getByRole('button', { name: /Pick up/ })).toHaveCount(0);
  expect(patches[0]).toEqual({ id: 1, assignee: me, status: 'in_progress' });

  // Mine shows only it; Unassigned shows the icon ticket.
  await page.getByRole('button', { name: /Assigned to me|Mine/ }).click();
  await expect(page.locator('li', { hasText: 'Make hard tyres' })).toBeVisible();
  await expect(page.locator('li', { hasText: 'favicon' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Unassigned/ }).click();
  await expect(page.locator('li', { hasText: 'favicon' })).toBeVisible();
  await expect(page.locator('li', { hasText: 'Make hard tyres' })).toHaveCount(0);
  await page.getByRole('button', { name: /Everyone/ }).click();

  // Hand it to the other admin, then unassign it (status is left alone).
  await hard.getByLabel('Assignee for #1').selectOption(other);
  await expect(hard.getByLabel('Assignee for #1')).toHaveValue(other);
  await hard.getByLabel('Assignee for #1').selectOption('');
  await expect(hard.getByLabel('Assignee for #1')).toHaveValue('');
  expect(patches.slice(1)).toEqual([
    { id: 1, assignee: other },
    { id: 1, assignee: '' },
  ]);
  await expect(hard.getByRole('button', { name: 'Pick up #1' })).toBeVisible();
});

test('phone layout', async ({ page }) => {
  await mockTickets(page);
  await page.goto('/admin/tickets');
  await expect(page.getByLabel('Assignee for #1')).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  if (shots) await page.screenshot({ path: `${shots}/tickets-phone.png`, fullPage: true });
});
