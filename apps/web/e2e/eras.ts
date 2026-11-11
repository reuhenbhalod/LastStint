// Eras end to end (build plan 10.1): the Worker's Eras API mocked in the browser, and a driver
// that plays a race from its intro to the flag. The mock is stateful for one page: the era map
// and detail (on test, every era open), attempts on the real race files (data/races), the
// submit (evaluated here from the game's own claimed grades, as e2e/mock.ts does for the
// daily; the real evaluation is unit-tested in the worker), the community stats, the race
// leaderboards and the history book, all from this page's attempts.
//
// The app's test hook (src/game/useGame.ts): `window.__laststintE2E` shortens every lap tick
// (`lapScale`) so a whole race fits CI time, and exposes the race session so a test can read
// what the race model noted (a car fault, a storyline retirement) that the screen doesn't say.
import { readFileSync } from 'node:fs';
import { type Locator, type Page, expect } from '@playwright/test';
import { ERAS, eraRace, raceName, racesOfEra } from '../src/eras/catalog.js';
import {
  type ErasProduction,
  attemptRefusal,
  releasedForReal,
  seededStars,
  unlockedEras,
} from './erasProduction.js';

/** A lap at 2× takes 5 s × this: 0.2 is one second a lap. */
export const LAP_SCALE = 0.2;

export interface Option {
  id: string;
  label: string;
  decisions: Array<Record<string, unknown>>;
}
export interface Moment {
  id: string;
  lap: number;
  options: Option[];
  realOptionId: string | null;
}
export interface RaceEvent {
  lap: number;
  type: string;
  driver?: string;
  fault?: string;
}
export interface EraModel {
  race: { id: string; name: string; laps: number; takeoverLap: number; seed: number };
  userSide: string;
  rival: string;
  decisionMoments: Moment[];
  events: RaceEvent[];
  rules?: { drs?: boolean; refuelling?: boolean; tyreChanges?: boolean };
  provenance?: { kind?: string };
  eras?: {
    eraId: number;
    target?: { type: string };
    storyline?: { rewriteCondition?: unknown };
    storylineRetirements?: Array<{ driver: string; condition: Record<string, unknown> }>;
  };
}

export const loadEraRace = (id: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../data/races/${id}.json`, import.meta.url), 'utf8'),
  ) as EraModel;

export interface Difficulty {
  accuracyThreshold: number;
  information: string;
  rivalPolicy: string;
  decisionTimerSeconds: number;
}

const CONFIG = JSON.parse(
  readFileSync(new URL('../../../packages/sim/src/eras/eras-config.json', import.meta.url), 'utf8'),
) as {
  difficulty: Array<Difficulty & { era: number; playOrder: number }>;
  legend: Difficulty;
  unlockShare: number;
};

const settings = ({
  accuracyThreshold,
  information,
  rivalPolicy,
  decisionTimerSeconds,
}: Difficulty): Difficulty => ({
  accuracyThreshold,
  information,
  rivalPolicy,
  decisionTimerSeconds,
});

/** The era's difficulty row, as the Worker sends it (sim eras/config.ts). */
export function eraDifficulty(eraId: number): Difficulty {
  const row = CONFIG.difficulty.find((d) => d.era === eraId);
  if (!row) throw new Error(`no difficulty for era ${eraId}`);
  return settings(row);
}
export const LEGEND = settings(CONFIG.legend);

type Stars = { result: boolean; strategist: boolean; mastery: boolean };
const NO_STARS: Stars = { result: false, strategist: false, mastery: false };
const count = (s: Stars) => Number(s.result) + Number(s.strategist) + Number(s.mastery);

export interface Submitted {
  attemptId: string;
  raceId: string;
  legend: boolean;
  body: {
    decisions: Array<Record<string, unknown> & { kind: string; lap: number }>;
    grades: Array<{ momentId: string; probabilities: number[]; real?: number }>;
    untimed: boolean;
    modelHash?: string;
  };
}

export interface ErasMockOptions {
  /** Change the difficulty an attempt is served with (the decision timer test). */
  difficulty?: (eraId: number, legend: boolean) => Difficulty;
  /** Eras whose races each already have a star (the era is Cleared: Legend is open). */
  cleared?: number[];
  /** The ★1 result the server finds (default: the user's car finished the race). */
  result?: (raceId: string, submitted: Submitted) => boolean;
  /** Progress the player already has, by race (at the era's difficulty, not Legend). */
  progress?: Record<string, { stars: Stars; hiddenDone?: boolean; accuracy: number }>;
  /** Normal stars the player already has, per era (3 a race, in race order). */
  stars?: Record<number, number>;
  /** Serve as production (ERAS_TEST_MODE off; e2e/erasProduction.ts). Default: test mode. */
  production?: ErasProduction;
}

/** What the mocked Worker saw. */
export interface ErasMock {
  starts: Array<{ raceId: string; legend: boolean }>;
  submissions: Submitted[];
}

const band = (behind: number) =>
  behind <= 0.5 ? 'green' : behind <= 5 ? 'yellow' : behind <= 15 ? 'orange' : 'red';
const POINTS: Record<string, number> = { green: 100, yellow: 70, orange: 40, red: 0 };

function graded(ids: string[], probabilities: number[], chosen: string) {
  const best = Math.max(...probabilities);
  const options = ids.map((id, i) => {
    const p = probabilities[i] ?? 0;
    return { id, probability: p, behindBest: (best - p) * 100, band: band((best - p) * 100) };
  });
  const mine = options.find((o) => o.id === chosen) ?? options[0];
  if (!mine) throw new Error(`no options to grade for ${chosen}`);
  return {
    chosen: mine.id,
    band: mine.band,
    points: POINTS[mine.band] ?? 0,
    probability: mine.probability,
    best: (options.find((o) => o.probability === best) ?? mine).id,
    options,
  };
}

/** The attempt evaluated from the game's claims (the Worker replays them; here we trust them). */
function evaluate(
  model: EraModel,
  sub: Submitted,
  difficulty: Difficulty,
  result: boolean,
  before: Stars,
) {
  const { decisions, grades } = sub.body;
  const calls = model.decisionMoments.flatMap((m) => {
    const d = decisions.find((x) => x.kind === 'radio' && x.momentId === m.id);
    const g = grades.find((x) => x.momentId === m.id);
    if (!d || !g) return [];
    const c = graded(
      m.options.map((o) => o.id),
      g.probabilities,
      String(d.optionId),
    );
    const real = c.options.find((o) => o.id === m.realOptionId);
    const realP = real?.probability ?? g.real ?? 0;
    const best = Math.max(...g.probabilities);
    return [
      {
        momentId: m.id,
        lap: m.lap,
        ...c,
        real: { optionId: m.realOptionId, probability: realP, band: band((best - realP) * 100) },
        matchedReal: c.chosen === m.realOptionId,
      },
    ];
  });
  const planCall = decisions.find((d) => d.kind === 'plan');
  const pg = grades.find((g) => g.momentId === 'plan');
  const plan =
    planCall && pg
      ? graded(
          [
            ...['a', 'b', 'c'].slice(0, pg.probabilities.length - (planCall.id === 'own' ? 1 : 0)),
          ].concat(planCall.id === 'own' ? ['own'] : []),
          pg.probabilities,
          String(planCall.id),
        )
      : undefined;
  const all = [...calls, ...(plan ? [plan] : [])];
  const accuracies = all.map((c) =>
    Math.max(0, 100 - 2.5 * (c.options.find((o) => o.id === c.chosen)?.behindBest ?? 0)),
  );
  const accuracy = accuracies.length
    ? Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 10) / 10
    : 0;
  const stars: Stars = {
    result,
    strategist: accuracy >= difficulty.accuracyThreshold,
    mastery: false,
  };
  const newStars: Stars = {
    result: stars.result && !before.result,
    strategist: stars.strategist && !before.strategist,
    mastery: false,
  };
  const rewritable = model.eras?.storyline?.rewriteCondition !== undefined;
  const best: Stars = {
    result: stars.result || before.result,
    strategist: stars.strategist || before.strategist,
    mastery: before.mastery,
  };
  return {
    attemptId: sub.attemptId,
    raceId: model.race.id,
    legend: sub.legend,
    untimed: sub.body.untimed,
    accuracy,
    stars,
    masteryObjective: false,
    cleanCalls: all.every((c) => c.band === 'green' || c.band === 'yellow'),
    hidden: false,
    rewrite: rewritable ? result : null,
    decisionAccuracies: accuracies,
    finishPosition: result ? 1 : 2,
    disqualified: false,
    result: {
      order: [model.userSide, model.rival],
      finishers: [model.userSide, model.rival],
      disqualified: [],
      gaps: { [model.rival]: 1.2 },
    },
    calls,
    ...(plan ? { plan } : {}),
    newStars,
    historyEntry: rewritable && result,
    progress: { stars: best, hiddenDone: false, bestAccuracy: accuracy },
    rank: 1,
    total: 1,
  };
}

/** Serve the Eras API to `page` from `models` (race files by id). */
export async function mockEras(
  page: Page,
  models: EraModel[],
  opts: ErasMockOptions = {},
): Promise<ErasMock> {
  const byId = new Map(models.map((m) => [m.race.id, m]));
  const seen: ErasMock = { starts: [], submissions: [] };
  const attempts = new Map<string, { raceId: string; legend: boolean; difficulty: Difficulty }>();
  // Best per race and mode, from this page's attempts.
  const progress = new Map<string, { stars: Stars; hiddenDone?: boolean; accuracy: number }>(
    Object.entries(opts.progress ?? {}).map(([raceId, p]) => [`${raceId}:false`, p]),
  );
  const entries: Array<Record<string, unknown>> = [];
  const key = (raceId: string, legend: boolean) => `${raceId}:${legend}`;
  const seeded = new Map(
    Object.entries(opts.stars ?? {}).flatMap(([eraId, n]) => [
      ...seededStars(
        racesOfEra(Number(eraId)).map((r) => r.raceId),
        n,
      ),
    ]),
  );
  const starsOf = (raceId: string, legend: boolean, eraId: number): Stars =>
    progress.get(key(raceId, legend))?.stars ??
    (legend ? undefined : seeded.get(raceId)) ??
    (!legend && opts.cleared?.includes(eraId)
      ? { result: true, strategist: false, mastery: false }
      : NO_STARS);
  const eraStars = (eraId: number, legend = false) =>
    racesOfEra(eraId).reduce((n, r) => n + count(starsOf(r.raceId, legend, eraId)), 0);
  // Production mode: what the Worker's `campaign` works out, on every request.
  const prod = opts.production;
  const testMode = !prod;
  const released = (eraId: number) =>
    !prod || releasedForReal(prod.releasedAt[eraId], new Date().toISOString());
  const published = (raceId: string) => !prod || (prod.published?.(raceId) ?? true);
  const unlocked = () =>
    unlockedEras(
      ERAS.map((e) => ({ eraId: e.id, stars: eraStars(e.id), races: racesOfEra(e.id).length })),
      CONFIG.unlockShare,
    );

  await page.addInitScript((lapScale) => {
    const w = window as unknown as { __laststintE2E: object; __seen: { redFlag: boolean } };
    w.__laststintE2E = { lapScale };
    // The map's flag chip, sampled often: a red flag can be up for a lap or two (a second).
    w.__seen = { redFlag: false };
    setInterval(() => {
      if (!w.__seen.redFlag && document.querySelector('main')?.textContent?.includes('Red flag'))
        w.__seen.redFlag = true;
    }, 100);
  }, LAP_SCALE);

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const post = req.method() === 'POST';

    if (path === '/api/eras' && !post) {
      return route.fulfill({
        json: {
          testMode,
          eras: ERAS.map((e) => ({
            eraId: e.id,
            name: e.name,
            years: e.years,
            playOrder: e.playOrder,
            released: released(e.id),
            unlocked: unlocked().get(e.id) ?? false,
            stars: eraStars(e.id),
            maxStars: 30,
          })),
        },
      });
    }
    const era = path.match(/^\/api\/eras\/(\d+)$/);
    if (era && !post) {
      const eraId = Number(era[1]);
      const info = ERAS.find((e) => e.id === eraId);
      if (!info) return route.fulfill({ status: 404, json: { error: 'not-found' } });
      return route.fulfill({
        json: {
          eraId,
          name: info.name,
          years: info.years,
          playOrder: info.playOrder,
          released: released(eraId),
          unlocked: unlocked().get(eraId) ?? false,
          stars: eraStars(eraId),
          maxStars: 30,
          // Production lists published races of released eras only.
          races: (released(eraId) ? racesOfEra(eraId) : [])
            .filter((r) => published(r.raceId))
            .map((r) => {
              const m = byId.get(r.raceId);
              const legend = progress.get(key(r.raceId, true));
              return {
                raceId: r.raceId,
                position: r.position,
                stars: starsOf(r.raceId, false, eraId),
                hiddenDone: progress.get(key(r.raceId, false))?.hiddenDone ?? false,
                bestAccuracy: progress.get(key(r.raceId, false))?.accuracy ?? null,
                reconstructed: m?.provenance?.kind === 'reconstructed',
                // On test an unauthored race (no ★1 target yet) plays as a Draft.
                draft: testMode && !m?.eras?.target,
                ...(legend
                  ? { legend: { stars: legend.stars, bestAccuracy: legend.accuracy } }
                  : {}),
              };
            }),
        },
      });
    }
    if (path === '/api/eras/attempts' && post) {
      const { raceId, legend } = req.postDataJSON() as { raceId: string; legend: boolean };
      const m = byId.get(raceId);
      const race = eraRace(raceId);
      if (!m || !race) return route.fulfill({ status: 404, json: { error: 'race-not-found' } });
      const refused =
        prod &&
        attemptRefusal({
          released: released(race.eraId),
          unlocked: unlocked().get(race.eraId) ?? false,
          published: published(raceId),
        });
      if (refused) return route.fulfill({ status: 403, json: { error: refused } });
      seen.starts.push({ raceId, legend });
      const attemptId = `11111111-1111-4111-8111-${String(seen.starts.length).padStart(12, '0')}`;
      const difficulty =
        opts.difficulty?.(race.eraId, legend) ?? (legend ? LEGEND : eraDifficulty(race.eraId));
      attempts.set(attemptId, { raceId, legend, difficulty });
      return route.fulfill({
        status: 201,
        json: {
          attemptId,
          seed: m.race.seed,
          modelUrl: `${url.origin}/api/eras/races/${raceId}/model?h=e2e`,
          modelHash: `e2e-${raceId}`,
          difficulty,
          draft: testMode && !m.eras?.target,
        },
      });
    }
    const model = path.match(/^\/api\/eras\/races\/([a-z0-9-]+)\/model$/);
    if (model) {
      const m = byId.get(model[1] as string);
      return m ? route.fulfill({ json: m }) : route.fulfill({ status: 404, json: {} });
    }
    const submit = path.match(/^\/api\/eras\/attempts\/([0-9a-f-]+)$/);
    if (submit && post) {
      const attemptId = submit[1] as string;
      const a = attempts.get(attemptId);
      const m = a && byId.get(a.raceId);
      if (!a || !m) return route.fulfill({ status: 404, json: { error: 'attempt-not-found' } });
      const sub: Submitted = {
        attemptId,
        raceId: a.raceId,
        legend: a.legend,
        body: req.postDataJSON(),
      };
      seen.submissions.push(sub);
      const eraId = eraRace(a.raceId)?.eraId ?? 0;
      const before = starsOf(a.raceId, a.legend, eraId);
      const res = evaluate(m, sub, a.difficulty, opts.result?.(a.raceId, sub) ?? true, before);
      const prev = progress.get(key(a.raceId, a.legend));
      progress.set(key(a.raceId, a.legend), {
        stars: res.progress.stars,
        hiddenDone: prev?.hiddenDone ?? false,
        accuracy: Math.max(prev?.accuracy ?? 0, res.accuracy),
      });
      if (res.historyEntry && !entries.some((e) => e.raceId === a.raceId)) {
        entries.push({
          raceId: a.raceId,
          eraId,
          position: eraRace(a.raceId)?.position ?? 1,
          attemptId,
          achievedAt: '2026-11-08T12:00:00.000Z',
          legend: a.legend,
          accuracy: res.accuracy,
          stars: res.stars,
          headline: null,
          real: null,
          community: { players: 1, rewrites: 1, share: 1 },
        });
      }
      return route.fulfill({ json: res });
    }
    const stats = path.match(/^\/api\/eras\/races\/([a-z0-9-]+)\/stats$/);
    if (stats) {
      const rates = { players: 10, result: 0.5, strategist: 0.3, mastery: 0.1, hidden: 0.1 };
      return route.fulfill({
        json: {
          raceId: stats[1],
          rewrite: { players: 10, rewrites: 3, share: 0.3 },
          stars: rates,
          legendStars: rates,
        },
      });
    }
    const board = path.match(/^\/api\/eras\/races\/([a-z0-9-]+)\/leaderboard$/);
    if (board) {
      const raceId = board[1] as string;
      const legend = url.searchParams.get('legend') === 'true';
      const mine = progress.get(key(raceId, legend));
      const others = [99.5, 97.25, 90].map((accuracy, i) => ({
        name: `Strategist ${i + 1}`,
        accuracy,
      }));
      const all = [...others, ...(mine ? [{ name: 'You', accuracy: mine.accuracy }] : [])]
        .sort((x, y) => y.accuracy - x.accuracy)
        .map((e, i) => ({ rank: i + 1, ...e }));
      const me = all.find((e) => e.name === 'You');
      return route.fulfill({
        json: {
          raceId,
          legend,
          size: 100,
          total: all.length,
          entries: all,
          me: me ? { rank: me.rank, accuracy: me.accuracy } : null,
        },
      });
    }
    if (path === '/api/history') {
      const t = (have: number, total: number) => ({ have, total });
      const eras = ERAS.map((e) => {
        const stars = eraStars(e.id);
        const legendStars = eraStars(e.id, true);
        const rewrites = entries.filter((x) => x.eraId === e.id).length;
        return {
          eraId: e.id,
          name: e.name,
          years: e.years,
          playOrder: e.playOrder,
          races: 10,
          stars: t(stars, 30),
          legendStars: t(legendStars, 30),
          rewrites: t(rewrites, 10),
          hidden: t(0, 10),
          badges: { cleared: false, mastered: false, legend: false },
          percent: ((stars + legendStars + rewrites) / 83) * 100,
        };
      });
      const sum = (f: (e: (typeof eras)[number]) => number) => eras.reduce((n, e) => n + f(e), 0);
      const collected = sum((e) => e.stars.have + e.legendStars.have + e.rewrites.have);
      return route.fulfill({
        json: {
          completion: { collected, total: 830, percent: (collected / 830) * 100 },
          collectibles: {
            stars: t(
              sum((e) => e.stars.have),
              300,
            ),
            legendStars: t(
              sum((e) => e.legendStars.have),
              300,
            ),
            rewrites: t(entries.length, 100),
            hidden: t(0, 100),
            badges: t(0, 30),
          },
          eras,
          entries,
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  return seen;
}

/** From the era map to the race's intro: the era's node, then the race's card. */
export async function openRace(page: Page, raceId: string, legend = false) {
  const race = eraRace(raceId);
  if (!race) throw new Error(`${raceId} is in no era`);
  await page.goto('/eras');
  await page.locator(`main a[href="/eras/${race.eraId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/eras/${race.eraId}$`));
  if (legend) {
    await page.getByRole('button', { name: 'Legend off' }).click();
    await expect(page.getByRole('button', { name: 'Legend on' })).toBeVisible();
  }
  // The card's link: the race's name, then (for screen readers) ", play" in its own span.
  const play = legend ? ', play at Legend difficulty' : ', play';
  await page.getByRole('link', { name: new RegExp(`^${raceName(raceId)}\\s*${play}$`) }).click();
  await expect(page.getByRole('button', { name: /^Start the race/ })).toBeVisible({
    timeout: 30_000,
  });
}

/** What a played race showed: each call seen (its tag and text), and the moments answered. */
export interface Played {
  /** Decision moments answered, by lap: the card's tag line (e.g. "Pit board · … · Lap 40"). */
  moments: Map<number, string>;
  /** Every quick and battle call seen: its whole text. */
  calls: string[];
  /** The red flag chip was seen on the race screen. */
  redFlag: boolean;
}

export interface PlayOptions {
  /** The buttons to press, in order, on the decision at `lap` (default: the first, and after
   * a Box its first tyre). */
  answer?: (lap: number) => string[] | undefined;
  /** Called once per turn while the race runs (to look at the screen or make a radio call). */
  each?: (lap: number) => Promise<void>;
  /** The option to press on a quick call, from its text (default: its last option). */
  quick?: (text: string) => string | undefined;
  /** Skip answering decisions (the decision timer test lets them run out). */
  leave?: (lap: number) => boolean;
}

/** The lap the race screen's top bar shows. */
export async function shownLap(page: Page): Promise<number> {
  // Not waited for: at the flag the race screen can go before a play loop's `each` reads it.
  const text = await page
    .locator('main > header')
    .innerText({ timeout: 1_000 })
    .catch(() => '');
  return Number(text.match(/(\d+)\s*\/\s*\d+/)?.[1] ?? 0);
}

async function tryClick(target: Locator) {
  await target.click({ timeout: 2_000 }).catch(() => {});
}

/** From the race intro to the race: start, go with the engineer's plan (or `plan`), at 2×. */
export async function startRace(
  page: Page,
  { graded = true, plan }: { graded?: boolean; plan?: string } = {},
) {
  await page.getByRole('button', { name: /^Start the race/ }).click();
  const plans = page.getByRole('region', { name: 'Race plan' });
  await expect(plans).toBeVisible({ timeout: 30_000 });
  // Every plan graded first (`graded: false` skips the wait).
  if (graded) await expect(plans).not.toContainText('…', { timeout: 90_000 });
  if (plan) await plans.getByRole('button', { name: new RegExp(`^${plan} ·`) }).click();
  await plans.getByRole('button', { name: /Go with plan/ }).click();
  await page.getByRole('button', { name: '2×' }).click();
}

/**
 * The race to the results' stars: every call answered until the flag (a decision as
 * `opts.answer` says, or its first option, and after a Box its first tyre; a quick or battle
 * call, which holds an Eras race, its last option, after a fuel fill if it asks for one; a
 * planned stop boxed as planned; a new plan turned down), then "See how you did".
 */
export async function finishRace(page: Page, opts: PlayOptions = {}): Promise<Played> {
  const played: Played = { moments: new Map(), calls: [], redFlag: false };
  const done = page.getByRole('button', { name: 'See how you did' });
  const card = page.locator('section.decision');
  const calls = page.locator('section[aria-label="Quick call"], section[aria-label="Battle call"]');
  const planned = page.getByRole('region', { name: 'Planned stop' });
  const replan = page.getByRole('region', { name: 'New plan' });
  const pressed = new Map<number, number>();
  const deadline = Date.now() + 360_000;
  while (!(await done.isVisible())) {
    expect(Date.now(), 'the race reaches the flag').toBeLessThan(deadline);
    if (opts.each) await opts.each(await shownLap(page));
    if (await card.isVisible()) {
      const tag =
        (await card
          .getByRole('alert')
          .textContent()
          .catch(() => '')) ?? '';
      const lap = Number(tag.match(/Lap (\d+)/)?.[1] ?? 0);
      if (lap && !played.moments.has(lap)) played.moments.set(lap, tag);
      if (opts.leave?.(lap)) {
        await page.waitForTimeout(250);
        continue;
      }
      const names = opts.answer?.(lap);
      const n = pressed.get(lap) ?? 0;
      if (names && n < names.length) {
        pressed.set(lap, n + 1);
        // An authored answer must be on the card: fail loudly rather than fall back.
        await card.getByRole('button', { name: names[n], exact: true }).click({ timeout: 5_000 });
      } else {
        await tryClick(card.getByRole('button').first());
      }
      continue;
    }
    const call = calls.first();
    if (await call.isVisible()) {
      const text = (await call.textContent().catch(() => '')) ?? '';
      if (text && played.calls.at(-1) !== text) played.calls.push(text);
      const fill = call.getByRole('group', { name: 'Fuel fill' });
      if (await fill.isVisible()) await tryClick(fill.getByRole('button').first());
      const pick = opts.quick?.(text);
      await tryClick(
        pick
          ? call.getByRole('button', { name: new RegExp(`^${pick}`) })
          : call.getByRole('button').last(),
      );
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
  played.redFlag = await page.evaluate(() => !!(window as unknown as Watch).__seen?.redFlag);
  await done.click();
  await expect(page.getByRole('region', { name: 'Stars' })).toBeVisible({ timeout: 90_000 });
  return played;
}

/** The whole race, intro to stars. */
export async function playRace(page: Page, opts: PlayOptions = {}): Promise<Played> {
  await startRace(page);
  return finishRace(page, opts);
}

/** The team radio, opened from the control bar (the race must be running, not paused). */
export async function teamRadio(page: Page): Promise<Locator> {
  const radio = page.getByRole('region', { name: 'Team radio' });
  if (!(await radio.isVisible())) {
    await page
      .getByRole('navigation', { name: 'Controls' })
      .getByRole('button', { name: 'Team radio' })
      .click();
  }
  await expect(radio).toBeVisible();
  return radio;
}

/** Close the team radio's dock again. */
export async function closeTeamRadio(page: Page) {
  const pill = page
    .getByRole('navigation', { name: 'Controls' })
    .getByRole('button', { name: 'Team radio' });
  if ((await pill.getAttribute('aria-pressed')) === 'true') await pill.click();
}

/** What the page saw between turns of the play loop (a red flag lasts a lap or two). */
interface Watch {
  __seen?: { redFlag: boolean };
}

/** The race model's notes so far (through the test hook): faults, storyline retirements… */
export function raceNotes(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __laststintE2E?: {
            session?: {
              notes: Array<{ lap: number; kind: string; driver: string; detail?: string }>;
            };
          };
        }
      ).__laststintE2E?.session?.notes ?? [],
  );
}

/** The calls the game has logged so far (through the test hook), as a submit would send them. */
export function gameDecisions(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __laststintE2E?: {
            session?: {
              state: { decisions: Array<Record<string, unknown> & { kind: string; lap: number }> };
            };
          };
        }
      ).__laststintE2E?.session?.state.decisions ?? [],
  );
}

/** The race's radio lines so far (through the test hook). */
export function radioLines(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __laststintE2E?: {
            session?: { state: { radio: Array<{ lap: number; from: string; text: string }> } };
          };
        }
      ).__laststintE2E?.session?.state.radio ?? [],
  );
}

/**
 * Every radio line of a race. The session keeps only the last 12 lines, so `read` (pass it as
 * a play loop's `each`) collects them on every turn; `lines` reads once more and gives them all.
 */
export function radioLog(page: Page) {
  const heard = new Map<string, { lap: number; from: string; text: string }>();
  const read = async () => {
    for (const { lap, from, text } of await radioLines(page))
      heard.set(`${lap}|${from}|${text}`, { lap, from, text });
  };
  return {
    read,
    lines: async () => {
      await read();
      return [...heard.values()];
    },
  };
}

/** Nothing on the page wider than the screen. */
export async function noSidewaysScroll(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(0);
}

/** The phone project (390 px wide). */
export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) <= 390;

/**
 * The radio log where the player reads it: the stats view's Radio panel on a desktop, the
 * Radio tab of the control bar on a phone (closed while a decision pauses the race, so it is
 * opened again each turn).
 */
async function openRadioLog(page: Page) {
  const controls = page.getByRole('navigation', { name: 'Controls' });
  const button = isPhone(page)
    ? controls.getByRole('button', { name: 'Radio', exact: true })
    : controls.getByRole('button', { name: 'Show stats' });
  // The race may reach the flag (and the bar go) at any point: nothing here waits.
  const pressed = await button.getAttribute('aria-pressed', { timeout: 1_000 }).catch(() => null);
  if (pressed !== 'false' || !(await button.isEnabled().catch(() => false))) return;
  await tryClick(button);
}

/**
 * Watch the radio log for `lines` (each a line's text as the player reads it). `each` goes in
 * a play loop's `each`; `seen` has every watched line seen on screen, with its whole entry
 * ("L37 · Rosberg“…”": the lap, who says it and the line).
 */
export function watchRadio(page: Page, lines: string[]) {
  const seen = new Map<string, string>();
  return {
    seen,
    each: async () => {
      await openRadioLog(page);
      for (const line of lines) {
        if (seen.has(line)) continue;
        const entry = page.getByRole('listitem').filter({ hasText: line }).first();
        if (await entry.isVisible()) seen.set(line, (await entry.textContent()) ?? '');
      }
    },
  };
}
