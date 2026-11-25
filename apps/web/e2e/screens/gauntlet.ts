// The Gauntlet's API (docs/survivor-spec.md), mocked for the screen specs (gauntlet.spec.ts):
// the leaderboard, a run's start, its state and each round's verdict, configurable per test.
// The race itself runs in the page on the real race file (the round's raceId and seed).
import { readFileSync } from 'node:fs';
import type { Page, Request } from '@playwright/test';
import { type Model, loadRace } from '../mock.js';

/** The Gauntlet's pool (data/pools.json `survivor`): race id -> the seeds a run deals from. */
const POOL = (
  JSON.parse(readFileSync(new URL('../../../../data/pools.json', import.meta.url), 'utf8')) as {
    survivor: Record<string, number[]>;
  }
).survivor;

/** Abu Dhabi 2021 (a Daily race; the screen plays whatever race the server deals). */
export const ABU = loadRace('abu-dhabi-2021');
/** Spain 2020, a Gauntlet race since the long Daily races moved over (#57). */
export const SPAIN = loadRace('spain-2020');
// The rounds here deal Spain on its race file's seed: it has to be one of its pool seeds.
if (!POOL[SPAIN.race.id]?.includes(SPAIN.race.seed))
  throw new Error(`${SPAIN.race.id} seed ${SPAIN.race.seed} isn't in the Gauntlet pool`);

export interface Entry {
  rank: number;
  name: string;
  rounds: number;
  meanScore: number;
  live: boolean;
  date: string;
}

export interface History {
  round: number;
  raceId: string;
  won: boolean;
  score: number;
  finishPosition: number;
}

/** A run as the server has it. */
export function runState(o: {
  rounds: number;
  /** The round being raced (null once over). */
  round: number | null;
  race?: Model;
  status?: 'live' | 'over';
  meanScore?: number;
  history?: History[];
  rank?: number;
  total?: number;
  runId?: string;
}) {
  const race = o.race ?? ABU;
  return {
    runId: o.runId ?? 'run-1',
    status: o.status ?? 'live',
    rounds: o.rounds,
    meanScore: o.meanScore ?? 0,
    current:
      o.round === null ? null : { round: o.round, raceId: race.race.id, seed: race.race.seed },
    history: o.history ?? [],
    ...(o.rank ? { rank: o.rank, total: o.total } : {}),
  };
}

type Reply = { status?: number; json: unknown; delay?: number } | 'abort';

export interface GauntletMock {
  leaderboard?: Reply;
  /** POST /api/survivor/start, in order (the last repeats). */
  start?: Reply[];
  /** GET /api/survivor/:runId (resuming a run, or after `wrong-round`). */
  state?: Reply;
  /** POST /api/survivor/:runId/round, in order (the last repeats). */
  rounds?: Reply[];
  /** GET /api/players/... (the top bar's streak); none by default. */
  player?: Reply;
}

export interface Calls {
  starts: number;
  rounds: Array<{ round?: number; decisions?: unknown[]; anonId?: string }>;
  states: string[];
}

const BOARD = { allTime: [], week: [] };

/** Routes the API for one test; returns what the page sent. */
export async function mockGauntlet(page: Page, m: GauntletMock = {}): Promise<Calls> {
  const calls: Calls = { starts: 0, rounds: [], states: [] };
  const send = async (route: Parameters<Parameters<Page['route']>[1]>[0], r: Reply) => {
    if (r === 'abort') return route.abort();
    if (r.delay) await new Promise((ok) => setTimeout(ok, r.delay));
    return route.fulfill({ status: r.status ?? 200, json: r.json });
  };
  const pick = (list: Reply[] | undefined, i: number, fallback: Reply) =>
    list?.length ? (list[Math.min(i, list.length - 1)] as Reply) : fallback;
  await page.route('**/api/**', async (route) => {
    const req: Request = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/survivor/leaderboard') return send(route, m.leaderboard ?? { json: BOARD });
    if (path === '/api/survivor/start' && req.method() === 'POST') {
      const r = pick(m.start, calls.starts, {
        status: 201,
        json: runState({ rounds: 0, round: 1 }),
      });
      calls.starts++;
      return send(route, r);
    }
    const round = path.match(/^\/api\/survivor\/([^/]+)\/round$/);
    if (round && req.method() === 'POST') {
      const r = pick(m.rounds, calls.rounds.length, {
        json: {
          won: true,
          result: { result: { order: [ABU.userSide, ABU.rival] }, disqualified: false },
          state: runState({ rounds: 1, round: 2 }),
        },
      });
      calls.rounds.push(req.postDataJSON());
      return send(route, r);
    }
    const state = path.match(/^\/api\/survivor\/([^/]+)$/);
    if (state && req.method() === 'GET') {
      calls.states.push(state[1] as string);
      return send(route, m.state ?? { status: 404, json: { error: 'no-run' } });
    }
    if (path.startsWith('/api/players/') && m.player) return send(route, m.player);
    if (path === '/api/announcement') return route.fulfill({ json: { announcement: null } });
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  return calls;
}

/** A won round's verdict: the order at the flag and the run after it. */
export function won(state: unknown, order = [ABU.userSide, ABU.rival], disqualified = false) {
  return { json: { won: true, result: { result: { order }, disqualified }, state } };
}

/** A lost round's verdict. */
export function lost(state: unknown, order = [ABU.rival, ABU.userSide], disqualified = false) {
  return { json: { won: false, result: { result: { order }, disqualified }, state } };
}

/**
 * Shorter lap ticks (the app's e2e hook, src/game/useGame.ts) so a whole race fits test time,
 * and, with `failStart`, the race's first start throws once (the start-once fallback).
 */
export async function fastLaps(page: Page, lapScale = 0.05, failStart = false) {
  await page.addInitScript(
    ({ lapScale, failStart }) => {
      const hook: Record<string, unknown> = { lapScale };
      let session: { start: () => void } | undefined;
      let failed = false;
      Object.defineProperty(hook, 'session', {
        get: () => session,
        set: (s: { start: () => void }) => {
          session = s;
          if (failStart && !failed) {
            const real = s.start.bind(s);
            s.start = () => {
              if (!failed) {
                failed = true;
                throw new Error('engine stalled');
              }
              real();
            };
          }
        },
      });
      (window as unknown as { __laststintE2E: unknown }).__laststintE2E = hook;
    },
    { lapScale, failStart },
  );
}

/** The race's current lap (the e2e hook's session). */
export const lapOf = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __laststintE2E?: { session?: { state: { race: { lap: number } } } } })
        .__laststintE2E?.session?.state.race.lap ?? 0,
  );

/** The race's phase (the e2e hook's session). */
export const phaseOf = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __laststintE2E?: { session?: { state: { phase: string } } } })
        .__laststintE2E?.session?.state.phase ?? '',
  );

const CALLS = ['Your call', 'Quick call', 'Battle call', 'Planned stop', 'New plan'] as const;
export type CallKind = (typeof CALLS)[number];

export type Choose = (kind: CallKind, names: string[], n: number) => string | undefined;
export interface Answered {
  kind: CallKind;
  names: string[];
  chose: string;
}

/**
 * Answers the call that's up, if one is: `choose` picks the button (by its accessible name) from
 * the enabled ones, or the first; `seen` gets what was answered. True if it answered one.
 */
export async function answerCall(page: Page, seen: Answered[], choose: Choose = () => undefined) {
  const call = page.locator(CALLS.map((c) => `section[aria-label="${c}"]`).join(', ')).first();
  if (!(await call.isVisible().catch(() => false))) return false;
  const kind = (await call.getAttribute('aria-label').catch(() => null)) as CallKind | null;
  const buttons = call.getByRole('button');
  const all = await buttons
    .evaluateAll((bs) =>
      bs.map((b) => ({
        name: (b.getAttribute('aria-label') ?? b.textContent ?? '').replace(/\s+/g, ' ').trim(),
        on: !(b as HTMLButtonElement).disabled,
      })),
    )
    .catch(() => []);
  const names = all.filter((b) => b.on).map((b) => b.name);
  if (!kind || !names.length) return false;
  const want = choose(kind, names, seen.filter((s) => s.kind === kind).length) ?? names[0];
  const at = all.findIndex((b) => b.on && b.name === want);
  const ok = await buttons
    .nth(at < 0 ? 0 : at)
    .click({ timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (ok) seen.push({ kind, names, chose: want as string });
  return ok;
}

/**
 * Answers every call the race asks until `done` shows (see answerCall). Returns the calls seen,
 * in order.
 */
export async function raceToFlag(
  page: Page,
  done: ReturnType<Page['getByText']>,
  choose: Choose = () => undefined,
  seen: Answered[] = [],
) {
  const deadline = Date.now() + 240_000;
  while (!(await done.isVisible())) {
    if (Date.now() > deadline)
      throw new Error(`race never finished; calls: ${JSON.stringify(seen)}`);
    if (!(await answerCall(page, seen, choose))) await page.waitForTimeout(100);
  }
  return seen;
}
