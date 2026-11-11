// Admin page v2 (docs/admin-v2-spec.md): every tab opens against a mocked admin API, signed in
// with a stand-in token (as in admin.spec.ts), and shows its own content. The announcement
// set on Today shows under the top bar of the game's pages, and dismissing it sticks.
import { type Page, expect, test } from '@playwright/test';

const today = '2026-11-11';
const email = 'admin@example.com';

const token = () => {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;
};

const day = (date: string, number: number, current = true) => ({
  date,
  number,
  raceId: 'abu-dhabi-2021',
  name: 'Abu Dhabi 2021',
  runs: 2,
  current,
});

const run = {
  mode: 'daily',
  id: 'r1',
  date: today,
  at: `${today}T10:00:00.000Z`,
  raceId: 'abu-dhabi-2021',
  raceName: 'Abu Dhabi 2021',
  playerKey: 'p1',
  player: { id: 'p1', name: 'Ann', email: 'ann@example.com' },
  name: 'Fast Ann',
  score: 80,
  result: 'P1',
  verified: false,
  corrected: false,
  disqualified: false,
};

const player = {
  id: 'p1',
  name: 'Ann',
  email: 'ann@example.com',
  displayName: 'Fast Ann',
  favouriteTeam: '',
  provider: 'google',
  createdAt: '2026-10-01T00:00:00.000Z',
  devices: 1,
  dailyRuns: 1,
  gauntletRuns: 0,
  lastPlayed: `${today}T10:00:00.000Z`,
  hidden: false,
};

const eraRaces = Array.from({ length: 10 }, (_, i) => ({
  raceId: `race-${i + 1}`,
  name: `Race ${i + 1}`,
  position: i + 1,
  published: i < 9,
  file: true,
  attempts: 3,
  players: 2,
}));

const API: Record<string, unknown> = {
  '/api/admin/me': { email },
  '/api/admin/today': {
    today,
    days: { today: day(today, 40), tomorrow: day('2026-11-12', 41, false) },
    queue: { days: 3, low: true, warnUnder: 7 },
    stale: [day('2026-11-12', 41, false)],
    runs: { total: 12, verified: 10, corrected: 1, unverified: 2 },
  },
  '/api/admin/eras': {
    needed: 10,
    eras: [
      {
        id: 10,
        name: 'Ground-effect era',
        years: '2022–2025',
        playOrder: 1,
        releasedAt: null,
        status: 'coming-soon',
        published: 9,
        races: eraRaces,
      },
    ],
  },
  '/api/admin/runs': { runs: [run], limit: 200 },
  '/api/admin/runs/daily/r1': {
    run,
    calls: [
      {
        momentId: 'sc-stop',
        lap: 53,
        chosen: 'box',
        band: 'green',
        points: 100,
        best: 'box',
        real: 'box',
        matchedReal: true,
      },
    ],
  },
  '/api/admin/players': { total: 1, players: [player] },
  '/api/admin/players/p1': {
    player,
    browsers: [{ anonId: 'p1', linkedAt: '2026-10-01T00:00:00.000Z' }],
    streak: { current: 3, best: 5, days: 9 },
    days: [today],
    runs: [run],
  },
  '/api/admin/versus': {
    rooms: [
      {
        code: 'QWER',
        track: 'monza',
        phase: 'race',
        players: ['Alex', 'Sam'],
        lap: 4,
        openedAt: `${today}T09:00:00.000Z`,
        updatedAt: `${today}T09:05:00.000Z`,
      },
    ],
    matches: [
      {
        id: 1,
        code: 'ABCD',
        track: 'bahrain',
        players: ['Alex', 'Sam'],
        cars: [
          { car: 'bullet', startTyre: 'SOFT' },
          { car: 'glider', startTyre: 'MEDIUM' },
        ],
        winner: 0,
        gap: 1.4,
        forfeit: null,
        battles: 2,
        startedAt: `${today}T08:00:00.000Z`,
        finishedAt: `${today}T08:03:00.000Z`,
      },
    ],
  },
  '/api/admin/stats': {
    from: '2026-10-13',
    to: today,
    daily: {
      days: [{ date: today, players: 12, finished: 0.9, meanScore: 71.5 }],
      missed: [
        {
          date: today,
          raceId: 'abu-dhabi-2021',
          raceName: 'Abu Dhabi 2021',
          momentId: 'sc-stop',
          lap: 53,
          optionId: 'stay',
          option: 'Stay out',
          runs: 5,
          share: 0.42,
        },
      ],
    },
    gauntlet: {
      started: 30,
      startedRecent: 12,
      rounds: [{ rounds: 2, runs: 8 }],
      best: { name: 'Fast Ann', rounds: 6, meanScore: 82, date: today },
    },
    eras: {
      eras: [{ id: 10, name: 'Ground-effect era', attempts: 4, stars: 5, players: 2 }],
      playersWithStar: 2,
    },
    versus: { days: [{ date: today, matches: 3 }], total: 3 },
    accounts: {
      total: 20,
      days: [{ date: today, signups: 2 }],
      signedInShare: 0.25,
      recentPlayers: 40,
    },
  },
  '/api/admin/tickets': { tickets: [], admins: [email], me: email },
  '/api/admin/log': {
    actions: ['publish'],
    entries: [
      {
        id: 1,
        at: `${today}T07:00:00.000Z`,
        email,
        action: 'publish',
        detail: { raceId: 'race-1', published: true },
      },
    ],
  },
  '/api/admin/schedule': { today, days: [day(today, 40)] },
};

async function mock(page: Page) {
  const posted: Array<{ path: string; body: unknown }> = [];
  let announcement: Record<string, unknown> | null = null;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/announcement') return route.fulfill({ json: { announcement } });
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      posted.push({ path, body });
      if (path === '/api/admin/announcement') {
        announcement = { id: 5, endsAt: null, createdAt: today, tone: 'info', ...body };
        return route.fulfill({ json: { announcement } });
      }
      return route.fulfill({ json: { ok: true } });
    }
    const json = API[path];
    if (json) return route.fulfill({ json });
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  return posted;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('every admin tab opens and shows its content', async ({ page }) => {
  await page.addInitScript((t) => sessionStorage.setItem('pitwall:admin-token', t), token());
  const posted = await mock(page);

  // Today: the schedule, the low queue, stale days and today's runs.
  await page.goto('/admin');
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link')).toHaveText([
    'Today',
    'Schedule',
    'Eras',
    'Runs',
    'Players',
    'Versus',
    'Stats',
    'Tickets',
    'Log',
  ]);
  await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('#40 · 2026-11-11 · 2 runs')).toBeVisible();
  await expect(page.getByText('The queue is low.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-pin stale days' })).toBeEnabled();
  await expect(page.getByText('No announcement.')).toBeVisible();
  await expect(page.getByText('Not verified yet')).toBeVisible();

  // Set the announcement.
  await page.getByLabel('New announcement').fill('Servers move tonight.');
  await page.getByRole('button', { name: 'Set announcement' }).click();
  await expect(page.getByText('Announcement set.')).toBeVisible();
  expect(posted.at(-1)).toEqual({
    path: '/api/admin/announcement',
    body: { text: 'Servers move tonight.', tone: 'info', endsAt: null },
  });

  // Schedule.
  await nav.getByRole('link', { name: 'Schedule' }).click();
  await expect(page).toHaveURL(/\/admin\/schedule$/);
  await expect(page.getByRole('heading', { name: 'Daily schedule' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Play any race' })).toBeVisible();

  // Eras: 9 of 10 published, so the release is blocked.
  await nav.getByRole('link', { name: 'Eras' }).click();
  const era = page.getByRole('article', { name: 'Era 10' });
  await expect(era).toContainText('Coming soon');
  await expect(era).toContainText('Needs 10 published races to release (9 now).');
  await expect(era.getByRole('button', { name: 'Release now' })).toBeDisabled();
  await era.getByRole('button', { name: 'Race 10: Draft' }).click();
  expect(posted.at(-1)).toEqual({
    path: '/api/admin/eras/race',
    body: { raceId: 'race-10', published: true },
  });

  // Runs: a run opens with its calls.
  await nav.getByRole('link', { name: 'Runs' }).click();
  await expect(page.getByRole('cell', { name: 'Fast Ann ann@example.com' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Daily run by Fast Ann' }).click();
  const runPanel = page.getByRole('region', { name: 'Run' });
  await expect(runPanel).toContainText('sc-stop');
  await runPanel.getByRole('button', { name: 'Re-verify', exact: true }).click();
  expect(posted.at(-1)).toEqual({
    path: '/api/admin/runs/reverify',
    body: { mode: 'daily', id: 'r1' },
  });
  // The day's re-verify uses the search on screen, not a date typed since.
  await page.getByLabel('Date (UTC)').fill('2026-11-01');
  page.once('dialog', (d) => d.accept());
  const searched = new Date().toISOString().slice(0, 10);
  await page.getByRole('button', { name: `Re-verify every run on ${searched}` }).click();
  expect(posted.at(-1)).toEqual({ path: '/api/admin/runs/reverify', body: { date: searched } });
  await runPanel.getByRole('button', { name: 'Close' }).click();
  await expect(runPanel).toHaveCount(0);

  // Players: a player's page with the streak and the actions.
  await nav.getByRole('link', { name: 'Players' }).click();
  await page.getByRole('button', { name: 'Fast Ann' }).click();
  const panel = page.getByRole('region', { name: 'Player' });
  await expect(panel).toContainText('Current streak');
  await panel.getByRole('button', { name: 'Hide from leaderboards' }).click();
  expect(posted.at(-1)).toEqual({ path: '/api/admin/players/p1/hide', body: { hidden: true } });

  // Versus.
  await nav.getByRole('link', { name: 'Versus' }).click();
  await expect(page.getByRole('cell', { name: 'QWER' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Racing' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Monza' }).first()).toBeVisible();
  await expect(page.getByText('Alex won by 1.4 s')).toBeVisible();

  // Stats.
  await nav.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Stay out' })).toBeVisible();
  await expect(page.getByText('6 rounds, Fast Ann')).toBeVisible();

  // Tickets.
  await nav.getByRole('link', { name: 'Tickets' }).click();
  await expect(page).toHaveURL(/\/admin\/tickets$/);
  await expect(page.getByRole('heading', { name: 'Tickets' }).first()).toBeVisible();

  // Log.
  await nav.getByRole('link', { name: 'Log' }).click();
  await expect(page.getByRole('cell', { name: 'race-1 published' })).toBeVisible();

  // The banner shows under the game's top bar, and stays dismissed.
  await page.goto('/versus');
  const banner = page.getByRole('status').filter({ hasText: 'Servers move tonight.' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Dismiss announcement' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Ways to play' })).toBeVisible();
  await expect(page.getByText('Servers move tonight.')).toHaveCount(0);
});
