// A fake admin API for the admin screen specs (docs/test-suite-spec.md S3, L2): every
// /api/admin/* route the admin page calls, plus /api/announcement, answered from state held in the
// test, so a change (publish a race, set a day, edit a ticket) shows on the next load the way the
// Worker would show it. Every request is logged (method, path, query, body, Authorization) so a
// test checks what a control sent. `fail` makes the next matching call answer with an error the
// Worker's way ({ error, detail }); `hold` keeps a call waiting, for loading and busy states.
// Nothing leaves the machine: requests to any other origin are aborted, and the game's own
// pages ('/', '/?race=...') are answered with a stub page so a link out of the admin page can be
// followed without loading the game.
//
// The clock is fixed (2026-11-11 12:00 UTC) so "today", "the last 7 days" and the Runs tab's
// default date are the same on every run. The shapes copy src/admin/v2.ts, players.ts and
// tickets.ts (type-only imports, erased at run time).

import type { Page } from '@playwright/test';
import type { AdminPlayer } from '../../src/admin/players.js';
import type { Ticket } from '../../src/admin/tickets.js';
import type {
  AdminEra,
  AdminRun,
  AdminStats,
  AdminToday,
  Announcement,
  LiveRoom,
  LogEntry,
  RunDetail,
  TodayDay,
  VersusMatch,
} from '../../src/admin/v2.js';
import { expect } from '../coverage.js';

export const TODAY = '2026-11-11';
export const NOW = Date.parse(`${TODAY}T12:00:00.000Z`);
export const EMAIL = 'admin@example.com';
export const OTHER = 'purohit.abhiram@gmail.com';
const TOKEN_KEY = 'pitwall:admin-token';

/** A stand-in Google ID token: the page reads only its expiry (`exp`, seconds). */
export function token(exp = Date.UTC(2100, 0, 1)): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ exp: Math.floor(exp / 1000) })}.x`;
}

/** Start the page signed in (the token in sessionStorage, as the Google callback leaves it). */
export async function signIn(page: Page, value = token()) {
  await page.addInitScript(
    ([key, v]) => {
      // Only on the first load: a test that signs out and reloads stays signed out.
      if (!sessionStorage.getItem('e2e:seeded')) {
        sessionStorage.setItem(key as string, v as string);
        sessionStorage.setItem('e2e:seeded', '1');
      }
    },
    [TOKEN_KEY, value],
  );
}

export const storedToken = (page: Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), TOKEN_KEY);

// ---- Fixtures ------------------------------------------------------------------------------

export const iso = (daysAgo: number, time = '10:00:00') =>
  new Date(Date.parse(`${TODAY}T${time}.000Z`) - daysAgo * 86_400_000).toISOString();

export function day(date: string, number: number, over: Partial<TodayDay> = {}): TodayDay {
  return {
    date,
    number,
    raceId: 'abu-dhabi-2021',
    name: 'Abu Dhabi 2021: Hamilton vs Verstappen',
    runs: 0,
    current: true,
    ...over,
  };
}

export function run(id: string, over: Partial<AdminRun> = {}): AdminRun {
  return {
    mode: 'daily',
    id,
    date: TODAY,
    at: `${TODAY}T10:00:00.000Z`,
    raceId: 'abu-dhabi-2021',
    raceName: 'Abu Dhabi 2021',
    playerKey: 'p1',
    player: { id: 'p1', name: 'Ann', email: 'ann@example.com' },
    name: 'Fast Ann',
    score: 80,
    result: 'P1',
    verified: true,
    corrected: false,
    disqualified: false,
    ...over,
  };
}

export function player(id: string, over: Partial<AdminPlayer> = {}): AdminPlayer {
  return {
    id,
    name: '',
    email: `${id}@example.com`,
    displayName: '',
    favouriteTeam: '',
    provider: 'google',
    createdAt: iso(30),
    devices: 1,
    dailyRuns: 0,
    gauntletRuns: 0,
    lastPlayed: null,
    hidden: false,
    ...over,
  };
}

export function ticket(id: number, over: Partial<Ticket> = {}): Ticket {
  return {
    id,
    title: `Ticket ${id}`,
    description: 'What to change.',
    category: 'bug',
    status: 'open',
    notes: '',
    source: '',
    createdBy: '',
    assignee: '',
    createdAt: NOW - (10 - id) * 86_400_000,
    updatedAt: NOW - (10 - id) * 86_400_000,
    completedAt: null,
    ...over,
  };
}

/** An era of `n` races, the first `published` of them published. */
export function era(
  id: number,
  over: Partial<Omit<AdminEra, 'races' | 'published'>> & { published?: number } = {},
): AdminEra {
  const published = over.published ?? 10;
  const races = Array.from({ length: 10 }, (_, i) => ({
    raceId: `e${id}-race-${i + 1}`,
    name: `E${id} Race ${i + 1}`,
    position: i + 1,
    published: i < published,
    file: true,
    attempts: i,
    players: Math.floor(i / 2),
  }));
  return {
    id,
    name: `Era ${id} name`,
    years: '2022–2025',
    playOrder: 11 - id,
    releasedAt: null,
    status: 'coming-soon',
    ...over,
    published,
    races,
  };
}

export const STATS: AdminStats = {
  from: '2026-10-13',
  to: TODAY,
  daily: {
    days: [
      { date: '2026-11-10', players: 9, finished: 0.75, meanScore: 64.2 },
      { date: TODAY, players: 12, finished: 0.9, meanScore: 71.5 },
    ],
    missed: [
      {
        date: TODAY,
        raceId: 'abu-dhabi-2021',
        raceName: 'Abu Dhabi 2021',
        momentId: 'sc-stop',
        lap: 53,
        optionId: 'stay',
        option: 'Stay out',
        runs: 5,
        share: 0.42,
      },
      {
        date: '2026-11-10',
        raceId: 'spain-2020',
        raceName: 'Spain 2020',
        momentId: 'cliff',
        lap: null,
        optionId: 'box-HARD',
        option: 'Box: hards',
        runs: 2,
        share: 0.2,
      },
    ],
  },
  gauntlet: {
    started: 30,
    startedRecent: 12,
    rounds: [
      { rounds: 1, runs: 14 },
      { rounds: 2, runs: 8 },
    ],
    best: { name: 'Fast Ann', rounds: 6, meanScore: 82, date: TODAY },
  },
  eras: {
    eras: [{ id: 10, name: 'Ground-effect era', attempts: 4, stars: 5, players: 2 }],
    playersWithStar: 2,
  },
  versus: {
    days: [
      { date: '2026-11-10', matches: 1 },
      { date: TODAY, matches: 3 },
    ],
    total: 4,
  },
  accounts: {
    total: 20,
    days: [
      { date: '2026-11-10', signups: 1 },
      { date: TODAY, signups: 2 },
    ],
    signedInShare: 0.25,
    recentPlayers: 40,
  },
};

export interface State {
  email: string;
  announcement: Announcement | null;
  today: AdminToday;
  schedule: { today: string; days: TodayDay[] };
  /** Whether the signed-in admin has a run on today's daily (Clear my run today). */
  ownRun: boolean;
  eras: { eras: AdminEra[]; needed: number };
  runs: AdminRun[];
  details: Record<string, RunDetail>;
  players: { total: number; players: AdminPlayer[] };
  versus: { rooms: LiveRoom[]; matches: VersusMatch[] };
  stats: AdminStats;
  tickets: { tickets: Ticket[]; admins: string[]; me: string };
  log: { entries: LogEntry[]; actions: string[] };
}

export function defaultState(): State {
  const runs = [
    run('r1', { verified: false }),
    run('r2', {
      mode: 'gauntlet',
      name: 'Undercut',
      playerKey: 'p2',
      player: { id: 'p2', name: 'Bo', email: 'bo@example.com' },
      raceName: '',
      score: 72.46,
      result: '3 rounds',
      corrected: true,
    }),
    run('r3', {
      mode: 'eras',
      name: 'Guest 4821',
      playerKey: 'anon-1',
      player: null,
      raceName: 'Monaco 1984',
      score: null,
      result: 'DNF',
    }),
  ];
  const call = (momentId: string, chosen: string, band: string, best: string) => ({
    momentId,
    lap: 53,
    chosen,
    band,
    points: band === 'green' ? 100 : 40,
    best,
    real: best,
    matchedReal: chosen === best,
  });
  return {
    email: EMAIL,
    announcement: null,
    today: {
      today: TODAY,
      days: {
        today: day(TODAY, 40, { runs: 2 }),
        tomorrow: day('2026-11-12', 41, { current: false, name: 'Spain 2020' }),
      },
      queue: { days: 3, low: true, warnUnder: 7 },
      stale: [
        day('2026-11-12', 41, { current: false, name: 'Spain 2020' }),
        day('2026-11-13', 42, { current: false, name: 'Canada 2022', runs: 1 }),
      ],
      runs: { total: 12, verified: 10, corrected: 1, unverified: 2 },
    },
    schedule: {
      today: TODAY,
      days: [
        day('2026-11-10', 39, { runs: 0 }),
        day(TODAY, 40, { runs: 3 }),
        day('2026-11-12', 41, { raceId: 'canada-2022', current: false }),
        day('2026-11-13', 42, { raceId: 'spain-2020' }),
      ],
    },
    ownRun: true,
    eras: {
      needed: 10,
      eras: [
        era(10, { name: 'Ground-effect era' }),
        era(9, { published: 9, name: 'Hybrid era', years: '2014–2021' }),
        era(8, { status: 'released', releasedAt: iso(20, '00:00:00'), name: 'V8 era' }),
        era(7, { status: 'scheduled', releasedAt: '2027-01-01T00:00:00.000Z', name: 'Refuel era' }),
      ],
    },
    runs,
    details: {
      'daily/r1': {
        run: runs[0] as AdminRun,
        calls: [
          call('sc-stop', 'box-HARD', 'green', 'box-HARD'),
          call('vsc', 'stay', 'red', 'box'),
        ],
      },
      'gauntlet/r2': {
        run: runs[1] as AdminRun,
        calls: [],
        rounds: [
          {
            round: 1,
            raceId: 'spain-2020',
            raceName: 'Spain 2020',
            score: 85,
            won: true,
            verified: true,
            corrected: true,
            calls: [call('cliff', 'stay', 'yellow', 'box-MEDIUM')],
          },
          {
            round: 2,
            raceId: 'canada-2022',
            raceName: 'Canada 2022',
            score: null,
            won: null,
            verified: false,
            corrected: false,
            calls: [],
          },
        ],
      },
      'eras/r3': { run: runs[2] as AdminRun, calls: [] },
    },
    players: {
      total: 3,
      players: [
        player('p1', {
          name: 'Ann',
          email: 'ann@example.com',
          displayName: 'Fast Ann',
          favouriteTeam: 'McLaren',
          createdAt: iso(2),
          devices: 2,
          dailyRuns: 12,
          gauntletRuns: 3,
          lastPlayed: iso(0),
        }),
        player('p2', { name: 'Bo', email: 'bo@example.com', provider: 'email', dailyRuns: 1 }),
        player('p3', { name: '', email: '', createdAt: iso(60), lastPlayed: iso(9) }),
      ],
    },
    versus: {
      rooms: [
        {
          code: 'QWER',
          track: 'monza',
          phase: 'race',
          players: ['Alex', 'Sam'],
          lap: 4,
          openedAt: `${TODAY}T09:00:00.000Z`,
          updatedAt: `${TODAY}T09:05:00.000Z`,
        },
        {
          code: 'ZXCV',
          track: 'not-a-track',
          phase: 'lobby',
          players: [],
          lap: 0,
          openedAt: `${TODAY}T09:30:00.000Z`,
          updatedAt: `${TODAY}T09:30:00.000Z`,
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
          startedAt: `${TODAY}T08:00:00.000Z`,
          finishedAt: `${TODAY}T08:03:00.000Z`,
        },
        {
          id: 2,
          code: 'EFGH',
          track: 'monza',
          players: ['Kim', ''],
          cars: [],
          winner: 1,
          gap: null,
          forfeit: 0,
          battles: 0,
          startedAt: `${TODAY}T07:00:00.000Z`,
          finishedAt: `${TODAY}T07:01:00.000Z`,
        },
        {
          id: 3,
          code: 'IJKL',
          track: 'monza',
          players: ['Lee', 'Max'],
          cars: [],
          winner: null,
          gap: null,
          forfeit: null,
          battles: 1,
          startedAt: `${TODAY}T06:00:00.000Z`,
          finishedAt: `${TODAY}T06:04:00.000Z`,
        },
      ],
    },
    stats: structuredClone(STATS),
    tickets: {
      admins: [EMAIL, OTHER],
      me: EMAIL,
      tickets: [
        ticket(1, {
          title: 'Make hard tyres last longer',
          description: 'Hards fall off too early.',
          notes: 'Check the 2021 data.',
          source: 'Game changes.pdf p1',
          createdBy: OTHER,
        }),
        ticket(2, {
          title: 'Add wet tyres',
          category: 'feature',
          status: 'in_progress',
          assignee: OTHER,
        }),
        ticket(3, { title: 'Add a favicon', category: 'ui', status: 'in_progress' }),
        ticket(4, { title: 'Taken already', category: 'ui', assignee: EMAIL, description: '' }),
        ticket(5, {
          title: 'Slow the race down',
          category: 'ui',
          status: 'done',
          completedAt: NOW - 86_400_000,
        }),
      ],
    },
    log: {
      actions: ['publish', 'release', 'announcement'],
      entries: [
        {
          id: 3,
          at: `${TODAY}T07:00:00.000Z`,
          email: EMAIL,
          action: 'publish',
          detail: { raceId: 'race-1', published: true },
        },
        {
          id: 2,
          at: `${TODAY}T06:00:00.000Z`,
          email: OTHER,
          action: 'release',
          detail: { eraId: 10, to: null },
        },
        {
          id: 1,
          at: `${TODAY}T05:00:00.000Z`,
          email: EMAIL,
          action: 'announcement',
          detail: { set: { text: 'Servers move tonight.' } },
        },
      ],
    },
  };
}

// ---- The fake ------------------------------------------------------------------------------

export interface Sent {
  method: string;
  path: string;
  /** The query string, without '?' ('' when none). */
  query: string;
  body: unknown;
  auth: string | null;
}

export interface Failure {
  status: number;
  error?: string;
  detail?: string;
  /** Abort the request instead (a network failure). */
  abort?: boolean;
}

type Rule = { method: string; path: string | RegExp; times: number; failure: Failure };
type Hold = { method: string; path: string | RegExp; release: Promise<void> };

const matches = (p: string | RegExp, path: string) =>
  typeof p === 'string' ? p === path : p.test(path);

class Refused extends Error {
  status: number;
  error: string;
  detail?: string;
  constructor(status: number, error: string, detail?: string) {
    super(error);
    this.status = status;
    this.error = error;
    this.detail = detail;
  }
}

export interface FakeAdmin {
  state: State;
  sent: Sent[];
  /** Requests sent with this method and path (the query left off). */
  calls(method: string, path: string | RegExp): Sent[];
  /** The body of the last request with this method and path. */
  last(method: string, path: string | RegExp): unknown;
  /** Answer the next `times` matching requests with an error (or a network failure). */
  fail(method: string, path: string | RegExp, failure: Failure, times?: number): void;
  /** Hold matching requests until the returned function is called. */
  hold(method: string, path: string | RegExp): () => void;
}

/** The game's pages answer with this stub, so links out of the admin page stay offline. */
export const STUB_PAGE = 'Stub: the game';

/**
 * Install the fake on the page (before the first goto). `edit` changes the starting state.
 * The clock is fixed at NOW.
 */
export async function fakeAdmin(page: Page, edit?: (s: State) => void): Promise<FakeAdmin> {
  const state = defaultState();
  edit?.(state);
  const sent: Sent[] = [];
  const rules: Rule[] = [];
  const holds: Hold[] = [];
  await page.clock.setFixedTime(NOW);

  // Anything off this machine: aborted (map tiles, fonts, Google's sign-in script).
  await page.route(
    (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort(),
  );
  // The game's pages: a stub, so following a link out of the admin page loads nothing.
  await page.route(
    (url) => url.pathname === '/',
    (route) =>
      route.request().isNavigationRequest()
        ? route.fulfill({ contentType: 'text/html', body: `<p>${STUB_PAGE}</p>` })
        : route.fallback(),
  );

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    let body: unknown = null;
    try {
      body = req.postData() ? req.postDataJSON() : null;
    } catch {
      body = req.postData();
    }
    sent.push({
      method,
      path,
      query: url.search.replace(/^\?/, ''),
      body,
      auth: req.headers().authorization ?? null,
    });
    const hold = holds.find((h) => h.method === method && matches(h.path, path));
    if (hold) await hold.release;
    const rule = rules.find((r) => r.times > 0 && r.method === method && matches(r.path, path));
    if (rule) {
      rule.times -= 1;
      if (rule.failure.abort) return route.abort();
      return route.fulfill({
        status: rule.failure.status,
        json: { error: rule.failure.error ?? 'http-error', detail: rule.failure.detail },
      });
    }
    try {
      const json = answer(state, method, path, url.searchParams, body as Record<string, unknown>);
      if (json === undefined) return route.fulfill({ status: 404, json: { error: 'not-found' } });
      return route.fulfill({ json });
    } catch (e) {
      if (e instanceof Refused) {
        return route.fulfill({ status: e.status, json: { error: e.error, detail: e.detail } });
      }
      throw e;
    }
  });

  return {
    state,
    sent,
    calls: (method, path) => sent.filter((s) => s.method === method && matches(path, s.path)),
    last: (method, path) =>
      sent.filter((s) => s.method === method && matches(path, s.path)).at(-1)?.body,
    fail: (method, path, failure, times = 1) => {
      rules.push({ method, path, failure, times });
    },
    hold: (method, path) => {
      let release = () => {};
      const h: Hold = {
        method,
        path,
        release: new Promise<void>((r) => {
          release = r;
        }),
      };
      holds.push(h);
      return () => {
        holds.splice(holds.indexOf(h), 1);
        release();
      };
    },
  };
}

/** The Worker's answers, from (and changing) the state. undefined: no such route (404). */
function answer(
  s: State,
  method: string,
  path: string,
  q: URLSearchParams,
  b: Record<string, unknown>,
): unknown {
  const get = method === 'GET';
  if (path === '/api/announcement' && get) return { announcement: s.announcement };
  if (path === '/api/admin/me' && get) return { email: s.email };
  if (path === '/api/admin/today' && get) return s.today;

  if (path === '/api/admin/announcement' && method === 'POST') {
    s.announcement = {
      id: (s.announcement?.id ?? 0) + 1,
      text: String(b.text),
      tone: b.tone === 'warning' ? 'warning' : 'info',
      endsAt: (b.endsAt as string | null) ?? null,
      createdAt: new Date(NOW).toISOString(),
    };
    return { announcement: s.announcement };
  }
  if (path === '/api/admin/announcement/clear' && method === 'POST') {
    s.announcement = null;
    return { announcement: null };
  }

  if (path === '/api/admin/repin' && method === 'POST') {
    const repinned = s.today.stale.filter((d) => d.runs === 0).map((d) => d.date);
    const skipped = s.today.stale.filter((d) => d.runs > 0).map((d) => d.date);
    s.today.stale = s.today.stale.filter((d) => d.runs > 0);
    for (const d of s.schedule.days) if (repinned.includes(d.date)) d.current = true;
    return { repinned, skipped };
  }
  if (path === '/api/admin/schedule' && get) return s.schedule;
  if (path === '/api/admin/schedule' && method === 'POST') {
    const days = Number(b.days);
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      throw new Refused(400, 'bad-request', 'from must be YYYY-MM-DD and days 1-366');
    }
    const last = s.schedule.days.at(-1) as TodayDay;
    const added = Array.from({ length: days }, (_, i) => {
      const date = new Date(Date.parse(`${last.date}T00:00:00Z`) + (i + 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return day(date, last.number + i + 1, { raceId: (b.raceId as string) ?? 'abu-dhabi-2021' });
    });
    s.schedule.days.push(...added);
    return { added: added.map(({ date, number, raceId }) => ({ date, number, raceId })) };
  }
  if (path === '/api/admin/day' && method === 'POST') {
    const d = s.schedule.days.find((x) => x.date === b.date);
    if (!d) throw new Refused(404, 'no-day');
    if (d.runs > 0) throw new Refused(409, 'day-has-runs', `${d.date} has runs`);
    d.raceId = String(b.raceId);
    return { date: d.date, raceId: d.raceId };
  }
  if (path === '/api/admin/runs/clear' && method === 'POST') {
    const cleared = s.ownRun ? 1 : 0;
    s.ownRun = false;
    return { cleared };
  }

  if (path === '/api/admin/eras' && get) return s.eras;
  if (path === '/api/admin/eras/race' && method === 'POST') {
    const e = s.eras.eras.find((x) => x.races.some((r) => r.raceId === b.raceId));
    const r = e?.races.find((x) => x.raceId === b.raceId);
    if (!e || !r) throw new Refused(404, 'no-race', `${String(b.raceId)} is not an Eras race`);
    if (!b.published && e.releasedAt) {
      throw new Refused(
        409,
        'era-released',
        'this era is released or scheduled; clear its release date first',
      );
    }
    r.published = !!b.published;
    e.published = e.races.filter((x) => x.published).length;
    return { raceId: r.raceId, published: r.published };
  }
  if (path === '/api/admin/eras/release' && method === 'POST') {
    const e = s.eras.eras.find((x) => x.id === b.eraId);
    if (!e) throw new Refused(404, 'no-era', `no era ${String(b.eraId)}`);
    if (b.at !== null && e.published < s.eras.needed) {
      throw new Refused(
        409,
        'too-few-races',
        `an era needs ${s.eras.needed} published races to be released (this one has ${e.published})`,
      );
    }
    if (b.at === null && e.releasedAt && !b.confirm) {
      throw new Refused(409, 'confirm-needed', 'clearing a release needs confirmation');
    }
    const at =
      b.at === null
        ? null
        : b.at === 'now'
          ? new Date(NOW).toISOString()
          : `${String(b.at)}T00:00:00.000Z`;
    const live = !!e.releasedAt && Date.parse(e.releasedAt) <= NOW;
    if (at && live && Date.parse(at) > NOW && !b.confirm) {
      throw new Refused(409, 'confirm-needed', 'moving a released era later needs confirmation');
    }
    e.releasedAt = at;
    e.status = !at ? 'coming-soon' : Date.parse(at) <= NOW ? 'released' : 'scheduled';
    return { eraId: e.id, releasedAt: at };
  }

  if (path === '/api/admin/runs' && get) {
    const date = q.get('date') ?? '';
    const who = (q.get('player') ?? '').toLowerCase();
    const mode = q.get('mode');
    const runs = s.runs.filter(
      (r) =>
        (!date || r.date === date) &&
        (!mode || r.mode === mode) &&
        (!who ||
          [r.name, r.player?.email ?? '', r.player?.name ?? '', r.playerKey].some((x) =>
            x.toLowerCase().includes(who),
          )),
    );
    return { runs, limit: 200 };
  }
  const detail = /^\/api\/admin\/runs\/(daily|gauntlet|eras)\/(.+)$/.exec(path);
  if (detail && get) {
    const d = s.details[`${detail[1]}/${decodeURIComponent(detail[2] as string)}`];
    if (!d) throw new Refused(404, 'no-run');
    return d;
  }
  if (path === '/api/admin/runs/reverify' && method === 'POST') {
    if (b.id) return { marked: 1 };
    return {
      marked: s.runs.filter((r) => r.date === b.date && (!b.mode || r.mode === b.mode)).length,
    };
  }
  if (path === '/api/admin/runs/delete' && method === 'POST') {
    s.runs = s.runs.filter((r) => !(r.mode === 'daily' && r.id === b.id));
    delete s.details[`daily/${String(b.id)}`];
    return { ok: true };
  }

  if (path === '/api/admin/players' && get) return s.players;
  const pl = /^\/api\/admin\/players\/([^/]+)(\/name|\/hide)?$/.exec(path);
  if (pl) {
    const p = s.players.players.find((x) => x.id === decodeURIComponent(pl[1] as string));
    if (!p) throw new Refused(404, 'no-player');
    if (!pl[2] && get) {
      return {
        player: p,
        browsers: [
          { anonId: `${p.id}-phone`, linkedAt: iso(10) },
          { anonId: `${p.id}-laptop`, linkedAt: iso(5) },
        ],
        streak: { current: 3, best: 5, days: 9 },
        days: p.dailyRuns ? [TODAY, '2026-11-10'] : [],
        runs: s.runs.filter((r) => r.playerKey === p.id),
      };
    }
    if (pl[2] === '/name' && method === 'POST') {
      const name = String(b.displayName ?? '').trim();
      if (name && !/^[A-Za-z0-9 ]{3,20}$/.test(name)) {
        throw new Refused(400, 'bad-name', 'a display name is 3-20 letters, digits or spaces');
      }
      p.displayName = name;
      return { id: p.id, displayName: name };
    }
    if (pl[2] === '/hide' && method === 'POST') {
      p.hidden = !!b.hidden;
      return { id: p.id, hidden: p.hidden };
    }
  }

  if (path === '/api/admin/versus' && get) return s.versus;
  if (path === '/api/admin/stats' && get) return s.stats;

  if (path === '/api/admin/tickets' && get) return s.tickets;
  if (path === '/api/admin/tickets' && method === 'POST') {
    const t = ticket(Math.max(0, ...s.tickets.tickets.map((x) => x.id)) + 1, {
      ...(b as Partial<Ticket>),
      createdBy: s.email,
      createdAt: NOW,
      updatedAt: NOW,
    });
    s.tickets.tickets.push(t);
    return { ticket: t };
  }
  const tk = /^\/api\/admin\/tickets\/(\d+)$/.exec(path);
  if (tk) {
    const t = s.tickets.tickets.find((x) => x.id === Number(tk[1]));
    if (!t) throw new Refused(404, 'not-found', `no ticket ${tk[1]}`);
    if (method === 'PATCH') {
      Object.assign(t, b, { updatedAt: NOW });
      if (b.status) t.completedAt = b.status === 'done' ? NOW : null;
      return { ticket: t };
    }
    if (method === 'DELETE') {
      s.tickets.tickets = s.tickets.tickets.filter((x) => x !== t);
      return { ok: true };
    }
  }

  if (path === '/api/admin/log' && get) {
    const action = q.get('action');
    const before = Number(q.get('before') ?? Number.POSITIVE_INFINITY);
    const entries = s.log.entries
      .filter((e) => (!action || e.action === action) && e.id < before)
      .slice(0, 200);
    return { entries, actions: s.log.actions };
  }
  return undefined;
}

// ---- Page helpers --------------------------------------------------------------------------

/** Open an admin tab signed in, and wait for the server to confirm the admin. */
export async function openTab(page: Page, href: string) {
  await page.goto(href);
  await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
}

/** Accept (or dismiss) the next confirm() and return its message. */
export function nextDialog(page: Page, accept: boolean): Promise<string> {
  return new Promise((resolve) => {
    page.once('dialog', async (d) => {
      const text = d.message();
      if (accept) await d.accept();
      else await d.dismiss();
      resolve(text);
    });
  });
}
