// The Daily's screen specs' helpers (docs/test-suite-spec.md S3): today's race served by the
// mocked Worker (e2e/mock.ts) with the player's streak and an already-played run when a test
// asks, and a fast-forward that runs the race lap by lap through the app's test hook
// (src/game/useGame.ts `__laststintE2E.session`) so a test reaches the lap it's about without
// waiting minutes of laps at 2×. The race is deterministic from its seed and calls, so every
// state the specs look at shows on the same lap every run.
import type { Locator, Page } from '@playwright/test';
import { expect } from '../coverage.js';
import { type Model, loadRace, mockApi } from '../mock.js';

export { loadRace };
export type { Model };

/** A race file as the daily, with an edit (a fixture copy: data/ is never touched). */
export function raceWith(id: string, edit: (m: Model & Record<string, unknown>) => void): Model {
  const m = loadRace(id) as Model & Record<string, unknown>;
  edit(m);
  return m;
}

export interface Streak {
  current: number;
  best: number;
  days: number;
}

export interface DailyOptions {
  /** The player's streak (GET /api/players/:id); none: the API has no player (no streak). */
  streak?: Streak;
  /** Today's run was already submitted (GET /api/runs/:date/:id answers with this run). */
  played?: (date: string) => unknown;
  /** POST /api/runs fails with this status and error code (the first `times` posts; all). */
  submitError?: { status: number; error: string; times?: number };
  /** Leave the how-to-play walkthrough to open (it opens on a fresh visit). */
  walkthrough?: boolean;
  /** Signed in: the first player asked for has this account (a new id after Sign out has none). */
  account?: Record<string, unknown>;
}

/** Today's daily is `model`; returns the submitted run's getter and the player calls seen. */
export async function openDaily(page: Page, model: Model, opts: DailyOptions = {}) {
  await page.addInitScript(() => {
    (window as unknown as { __laststintE2E: object }).__laststintE2E = {};
  });
  const submitted = await mockApi(page, model);
  const seen = { player: 0, runs: 0, posts: 0 };
  // Routes added later are tried first; the rest fall back to mockApi's.
  let owner: string | undefined;
  await page.route('**/api/players/**', (route) => {
    seen.player++;
    const id = new URL(route.request().url()).pathname.split('/').pop();
    owner ??= id;
    const account = opts.account && id === owner ? opts.account : null;
    return opts.streak || account
      ? route.fulfill({
          json: { account, streak: opts.streak ?? { current: 0, best: 0, days: 0 } },
        })
      : route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  await page.route(/\/api\/runs(\/|$)/, (route) => {
    const req = route.request();
    const parts = new URL(req.url()).pathname.split('/');
    if (req.method() === 'GET' && parts.length === 5 && opts.played) {
      seen.runs++;
      return route.fulfill({ json: opts.played(parts[3] as string) });
    }
    if (req.method() === 'POST') seen.posts++;
    if (
      req.method() === 'POST' &&
      opts.submitError &&
      seen.posts <= (opts.submitError.times ?? 1e9)
    )
      return route.fulfill({
        status: opts.submitError.status,
        json: { error: opts.submitError.error },
      });
    return route.fallback();
  });
  await page.goto('/');
  if (!opts.walkthrough) {
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  return { submitted, seen };
}

/** The race plan region at takeover. */
export const planCard = (page: Page) => page.getByRole('region', { name: 'Race plan' });

/** From the daily card to racing: take the pit wall, every plan graded, go with `plan`. */
export async function startRace(page: Page, plan?: 'A' | 'B' | 'C') {
  await page.getByRole('button', { name: /pit wall$/ }).click();
  const plans = planCard(page);
  await expect(plans).toBeVisible({ timeout: 30_000 });
  await expect(plans).not.toContainText('…', { timeout: 60_000 });
  if (plan) await plans.getByRole('button', { name: new RegExp(`^${plan} ·`) }).click();
  await plans.getByRole('button', { name: /^Go with plan/ }).click();
  await expect(plans).toHaveCount(0);
}

interface Hooked {
  __laststintE2E?: {
    session?: {
      state: {
        phase: string;
        race: {
          lap: number;
          flag: string;
          nextFlag?: string;
          cars: Record<
            string,
            { retired?: boolean; compound: string; tyreAge: number; modes: Record<string, string> }
          >;
        };
        decisions: Array<Record<string, unknown> & { kind: string; lap: number }>;
        radio: Array<{ lap: number; from: string; text: string; refused?: boolean }>;
        currentMoment: { id: string; lap: number } | null;
      };
      notes: Array<{ lap: number; kind: string; driver: string; detail?: string }>;
      tick: () => void;
      onChange: () => void;
    };
  };
}

/** The live session's state, through the test hook. */
export function session(page: Page) {
  return page.evaluate(() => {
    const s = (window as unknown as Hooked).__laststintE2E?.session;
    if (!s) throw new Error('no session');
    return {
      phase: s.state.phase,
      lap: s.state.race.lap,
      flag: s.state.race.flag,
      nextFlag: s.state.race.nextFlag,
      cars: s.state.race.cars,
      decisions: s.state.decisions,
      radio: s.state.radio,
      moment: s.state.currentMoment?.id ?? null,
      notes: s.notes,
    };
  });
}

/**
 * Run the race on, a lap at a time, until the lap shown is `lap` (or the race stops for a big
 * call, or the flag). Each lap is rendered before the next one runs, so the race engineer's
 * radio (which asks after every lap) sees every lap as it would at 2×; a call it brings up on
 * the way is left unanswered and goes when the next lap runs (no answer is made for it).
 */
export async function fastForward(page: Page, lap: number) {
  await page.evaluate(async (to) => {
    const s = (window as unknown as Hooked).__laststintE2E?.session;
    if (!s) throw new Error('no session');
    const frame = () => new Promise((r) => setTimeout(r, 40));
    while (s.state.phase === 'racing' && s.state.race.lap < to) {
      s.tick();
      s.onChange();
      await frame();
    }
  }, lap);
  await expect.poll(() => shownLap(page)).toBeGreaterThanOrEqual(Math.min(lap, 1));
}

/** The lap on the race screen's scoreboard. */
export async function shownLap(page: Page): Promise<number> {
  const text = await page
    .locator('main > header')
    .innerText({ timeout: 1_000 })
    .catch(() => '');
  return Number(text.match(/(\d+)\s*\/\s*\d+/)?.[1] ?? 0);
}

/** The big call card. */
export const decision = (page: Page) => page.getByRole('region', { name: 'Your call' });
export const quickCall = (page: Page) => page.getByRole('region', { name: 'Quick call' });
export const battleCall = (page: Page) => page.getByRole('region', { name: 'Battle call' });
export const controls = (page: Page) => page.getByRole('navigation', { name: 'Controls' });

/** Open a control-bar panel (Team radio, Plan, Standings, Car, Calls, Radio). */
export async function openPanel(page: Page, name: string | RegExp): Promise<Locator> {
  const pill = controls(page).getByRole('button', { name, exact: typeof name === 'string' });
  if ((await pill.getAttribute('aria-pressed')) !== 'true') await pill.click();
  await expect(pill).toHaveAttribute('aria-pressed', 'true');
  return pill;
}

/**
 * Run the race to lap `lap` as the screen specs' race maps were drawn (lap by lap, every big
 * call answered with its first option, and after a Box its first tyre; `answers` names the
 * buttons for a call by its lap instead). The quick calls on the way go unanswered.
 */
export async function runTo(page: Page, lap: number, answers: Record<number, string[]> = {}) {
  const guards = 120;
  for (let guard = 0; guard < guards; guard++) {
    const s = await session(page);
    if (s.lap >= lap) return;
    if (s.phase === 'decision') {
      const card = decision(page);
      const tag = await card.getByRole('alert').innerText();
      const at = Number(tag.match(/Lap (\d+)/)?.[1] ?? 0);
      const names = answers[at];
      if (names) {
        for (const name of names) await card.getByRole('button', { name, exact: true }).click();
      } else {
        await card.getByRole('button').first().click();
        if (await card.isVisible()) await card.getByRole('button').first().click();
      }
      await expect.poll(async () => (await session(page)).phase).not.toBe('decision');
      continue;
    }
    if (s.phase !== 'racing')
      throw new Error(`runTo(${lap}): the race stopped at lap ${s.lap} in phase '${s.phase}'`);
    await fastForward(page, s.lap + 1);
  }
  const s = await session(page);
  throw new Error(
    `runTo(${lap}): not there after ${guards} steps (lap ${s.lap}, phase '${s.phase}')`,
  );
}

/** The calls the game has made so far of a kind (through the test hook). */
export async function calls(page: Page, kind: string) {
  return (await session(page)).decisions.filter((d) => d.kind === kind);
}

/** The radio lines so far. */
export async function radio(page: Page) {
  return (await session(page)).radio.map((r) => `${r.from}: ${r.text}`);
}

/**
 * To lap `lap` lap by lap, then on at 2× on the race's own clock: a battle the engineer brings
 * up after lap `lap` is drawn at a corner the car reaches on the clock (lap-by-lap running
 * skips it), and comes up as the car nears it. The race file and the calls fix the corner and
 * the moves, so it's the same battle every run.
 */
export async function runToOnClock(page: Page, lap: number) {
  await runTo(page, lap);
  await page.getByRole('button', { name: '2×' }).click();
  await expect(page.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'true');
}
