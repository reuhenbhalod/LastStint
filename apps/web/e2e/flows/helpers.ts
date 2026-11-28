// Shared pieces of the L3 flows (playwright.flows.config.ts): the fixed clock on both sides,
// direct calls to the local Worker, signed test ID tokens, the Google sign-in script stand-in,
// and a driver that plays a race to the flag through the real game screens.

import { createPrivateKey, sign } from 'node:crypto';
import {
  type APIRequestContext,
  type Locator,
  type Page,
  type TestInfo,
  request,
} from '@playwright/test';
import { expect } from '../coverage.js';
import { ADMIN_EMAIL, CLIENT_ID, FIXED_NOW, PROJECTS, type ProjectName, flowsEnv } from './env.js';

export const env = flowsEnv();
export const API = `http://127.0.0.1:${env.FLOWS_API_PORT}`;

/** A lap at 2× takes 5 s × this (the app's e2e hook, src/game/useGame.ts). */
export const LAP_SCALE = 0.2;

const DAY_MS = 24 * 3600 * 1000;
/** The fixed time `days` days after FIXED_NOW, as ISO. */
export const dayAt = (days: number) =>
  new Date(Date.parse(FIXED_NOW) + days * DAY_MS).toISOString();
export const dateAt = (days: number) => dayAt(days).slice(0, 10);

/**
 * This project's days and players (env.ts PROJECTS): `day(n)` and `date(n)` are n days after
 * its first day, `tag` keeps its names apart from the other project's.
 */
export function flowOf(info: TestInfo) {
  const name = info.project.name as ProjectName;
  const { base, erasPlayer } = PROJECTS[name];
  return {
    name,
    base,
    tag: name === 'phone' ? 'P' : 'D',
    erasPlayer,
    now: dayAt(base),
    date: dateAt(base),
    day: (n: number) => dayAt(base + n),
    dateOf: (n: number) => dateAt(base + n),
  };
}

/**
 * Put the page (and every request it sends to the Worker) at `iso`: the browser's clock is
 * installed there and runs on in real time; the Worker reads the same time from the
 * x-flows-now header (its FLOWS_TEST clock).
 */
export async function setTime(page: Page, iso: string, first = true) {
  if (first) await page.clock.install({ time: new Date(iso) });
  else await page.clock.setSystemTime(new Date(iso));
  await page.context().setExtraHTTPHeaders({ 'x-flows-now': iso });
}

/** A page that plays races quickly (lapScale), at time `at`, as player `anonId` if set. */
export async function preparePage(page: Page, { at, anonId }: { at: string; anonId?: string }) {
  await setTime(page, at);
  await page.addInitScript(
    ([lapScale, id]) => {
      (window as unknown as { __laststintE2E: object }).__laststintE2E = { lapScale };
      if (id && !localStorage.getItem('pitwall:anonId')) localStorage.setItem('pitwall:anonId', id);
    },
    [LAP_SCALE, anonId ?? ''] as const,
  );
  await fakeGoogle(page);
}

/** Calls to the local Worker, at `iso` (its FLOWS_TEST clock). */
export async function workerApi(iso: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API, extraHTTPHeaders: { 'x-flows-now': iso } });
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * A Google ID token signed with the flows' key, which the local Worker trusts (GOOGLE_JWKS):
 * the admin unless `claims` say otherwise. It expires an hour after `iso` (the flow's time).
 */
export function idToken(iso: string, claims: Record<string, unknown> = {}): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'flows-key', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub: 'flows-admin',
      email: ADMIN_EMAIL,
      email_verified: true,
      name: 'Flows Admin',
      exp: Math.floor(Date.parse(iso) / 1000) + 3600,
      ...claims,
    }),
  );
  const key = createPrivateKey({ key: JSON.parse(env.FLOWS_PRIVATE_JWK), format: 'jwk' });
  const sig = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key);
  return `${head}.${body}.${b64url(sig)}`;
}

/**
 * Google Identity Services, stood in for (the one thing the flows can't reach locally): its
 * button hands the game `window.__flowsCredential`, a token signed by idToken(). Everything
 * after (POST /api/auth, the account, the admin check) is the real Worker.
 */
export async function fakeGoogle(page: Page) {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: { id: {
        initialize(o) { window.__gsiCallback = o.callback; },
        renderButton(el) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = 'Sign in with Google';
          b.onclick = () => window.__gsiCallback({ credential: window.__flowsCredential });
          el.replaceChildren(b);
        },
        disableAutoSelect() {},
      } } };`,
    }),
  );
}

/** The next press of the Google button signs in with this token. */
export async function useCredential(page: Page, token: string) {
  await page.evaluate((t) => {
    (window as unknown as { __flowsCredential: string }).__flowsCredential = t;
  }, token);
}

/** The player ID the browser plays as (localStorage, src/data/player.ts). */
export const anonIdOf = (page: Page) =>
  page.evaluate(() => localStorage.getItem('pitwall:anonId') as string);

/** Past the how-to-play walkthrough, which opens with a new daily card (`required`: it must). */
export async function closeHowTo(page: Page, required = true) {
  const dialog = page.getByRole('dialog');
  const open = expect(dialog).toContainText('race engineer', {
    timeout: required ? 30_000 : 5_000,
  });
  if (required) await open;
  else if (!(await open.then(() => true).catch(() => false))) return;
  for (let i = 0; i < 8; i++) {
    const next = dialog.getByRole('button', { name: 'Next' });
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function tryClick(target: Locator) {
  await target.click({ timeout: 2_000 }).catch(() => {});
}

/** Plan A from the engineer's plans (every plan graded first), then 2×. */
export async function goWithPlan(page: Page) {
  const plans = page.getByRole('region', { name: 'Race plan' });
  await expect(plans).toBeVisible({ timeout: 60_000 });
  await expect(plans).not.toContainText('…', { timeout: 90_000 });
  await plans.getByRole('button', { name: /Go with plan/ }).click();
  await page.getByRole('button', { name: '2×' }).click();
}

export interface PlayOptions {
  /** The buttons to press on the decision at `lap` (default: its first, then the first tyre). */
  answer?: (lap: number) => string[] | undefined;
  /** The race is over when this shows (default: the "See how you did" button). */
  done?: Locator;
}

/**
 * Every call answered until the flag: a decision as `answer` says (or its first option), a
 * quick or battle call its last option, a planned stop boxed as planned, a new plan turned
 * down. Returns the decisions answered, by lap.
 */
export async function raceToFlag(page: Page, opts: PlayOptions = {}): Promise<number[]> {
  const done = opts.done ?? page.getByRole('button', { name: 'See how you did' });
  const card = page.locator('section.decision');
  const calls = page.locator('section[aria-label="Quick call"], section[aria-label="Battle call"]');
  const planned = page.getByRole('region', { name: 'Planned stop' });
  const replan = page.getByRole('region', { name: 'New plan' });
  const pressed = new Map<number, number>();
  const laps: number[] = [];
  const deadline = Date.now() + 240_000;
  while (!(await done.isVisible())) {
    expect(Date.now(), 'the race reaches the flag').toBeLessThan(deadline);
    if (await card.isVisible()) {
      const tag =
        (await card
          .getByRole('alert')
          .textContent()
          .catch(() => '')) ?? '';
      const lap = Number(tag.match(/Lap (\d+)/)?.[1] ?? 0);
      if (lap && !laps.includes(lap)) laps.push(lap);
      const names = opts.answer?.(lap);
      const n = pressed.get(lap) ?? 0;
      if (names && n < names.length) {
        pressed.set(lap, n + 1);
        await card.getByRole('button', { name: names[n], exact: true }).click({ timeout: 5_000 });
      } else {
        await tryClick(card.getByRole('button').first());
      }
      continue;
    }
    const call = calls.first();
    if (await call.isVisible()) {
      await tryClick(call.getByRole('button').last());
      continue;
    }
    if (await planned.isVisible()) {
      await tryClick(planned.getByRole('button', { name: 'Box as planned' }));
      continue;
    }
    if (await replan.isVisible()) {
      await tryClick(replan.getByRole('button', { name: 'Keep ours' }));
      continue;
    }
    await page.waitForTimeout(200);
  }
  return laps;
}

/** Wait for the game's POST to `path` (a regexp on the URL) and return its status and body. */
export async function responseOf(page: Page, path: RegExp, act: () => Promise<unknown>) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => path.test(r.url()) && r.request().method() === 'POST', {
      timeout: 120_000,
    }),
    act(),
  ]);
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}
