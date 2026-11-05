// The Worker, mocked for the browser playthroughs: the daily serves a real race file, and
// POST /api/runs answers from the claimed grades the game sent (the real verification of
// those grades is unit-tested: src/state/session.test.ts and packages/sim/tests/verify.test.ts).
// Playwright loads only plain JSON here, not the sim's TS.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export interface Moment {
  id: string;
  lap: number;
  options: Array<{ id: string }>;
  realOptionId: string | null;
}
export interface Model {
  race: { id: string; seed: number };
  userSide: string;
  rival: string;
  decisionMoments: Moment[];
}

export const loadRace = (id: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../data/races/${id}.json`, import.meta.url), 'utf8'),
  ) as Model;

const band = (behind: number) =>
  behind <= 0.5 ? 'green' : behind <= 5 ? 'yellow' : behind <= 15 ? 'orange' : 'red';
const POINTS: Record<string, number> = { green: 100, yellow: 70, orange: 40, red: 0 };

/** A run response in the Worker's shape, from the game's calls and claimed grades. */
function respond(
  model: Model,
  body: {
    decisions: Array<{ kind: string; momentId?: string; optionId?: string; id?: string }>;
    grades: Array<{ momentId: string; probabilities: number[]; real?: number }>;
  },
  date: string,
) {
  const calls = model.decisionMoments.map((m) => {
    const g = body.grades.find((x) => x.momentId === m.id) as {
      probabilities: number[];
      real?: number;
    };
    const best = Math.max(...g.probabilities);
    const options = m.options.map((o, i) => {
      const p = g.probabilities[i] as number;
      return {
        id: o.id,
        probability: p,
        behindBest: (best - p) * 100,
        band: band((best - p) * 100),
      };
    });
    const chosen = body.decisions.find((d) => d.kind === 'radio' && d.momentId === m.id)
      ?.optionId as string;
    const mine = options.find((o) => o.id === chosen) as (typeof options)[number];
    const real = options.find((o) => o.id === m.realOptionId);
    const realP = real?.probability ?? g.real ?? 0;
    return {
      momentId: m.id,
      lap: m.lap,
      chosen,
      band: mine.band,
      points: POINTS[mine.band],
      probability: mine.probability,
      best: (options.find((o) => o.probability === best) as { id: string }).id,
      options,
      real: { optionId: m.realOptionId, probability: realP, band: band((best - realP) * 100) },
      matchedReal: chosen === m.realOptionId,
    };
  });
  // The race plan's claim (strategy planner): plans a, b, c (then the player's own).
  const planCall = body.decisions.find((d) => d.kind === 'plan');
  const pg = body.grades.find((x) => x.momentId === 'plan');
  const plan =
    planCall && pg
      ? (() => {
          const ids = ['a', 'b', 'c'].slice(
            0,
            pg.probabilities.length - (planCall.id === 'own' ? 1 : 0),
          );
          if (planCall.id === 'own') ids.push('own');
          const best = Math.max(...pg.probabilities);
          const options = ids.map((id, i) => {
            const p = pg.probabilities[i] as number;
            return {
              id,
              probability: p,
              behindBest: (best - p) * 100,
              band: band((best - p) * 100),
            };
          });
          const mine = options.find((o) => o.id === planCall.id) as (typeof options)[number];
          return {
            chosen: mine.id,
            band: mine.band,
            points: POINTS[mine.band],
            probability: mine.probability,
            best: (options.find((o) => o.probability === best) as { id: string }).id,
            options,
          };
        })()
      : undefined;
  const all = [...calls, ...(plan ? [plan] : [])];
  const score = all.reduce((s, c) => s + (c.points ?? 0), 0) / all.length;
  return {
    runId: 'r1',
    date,
    number: 1,
    raceId: model.race.id,
    score,
    meanProbability: 0.5,
    finishPosition: 1,
    disqualified: false,
    result: {
      order: [model.userSide, model.rival],
      finishers: [model.userSide, model.rival],
      disqualified: [],
      gaps: { [model.rival]: 0.6 },
    },
    calls,
    ...(plan ? { plan } : {}),
    percentile: 50,
    rank: 2,
    total: 3,
  };
}

/** Serves `model` as today's daily; returns a getter for the submitted run. */
export async function mockApi(page: Page, model: Model) {
  const date = await page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const daily = {
    date,
    number: 1,
    raceId: model.race.id,
    seed: model.race.seed,
    side: model.userSide,
  };
  let submitted: unknown = null;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/daily') {
      return route.fulfill({
        json: { ...daily, modelUrl: `${url.origin}/api/races/x`, modelHash: 'x' },
      });
    }
    if (url.pathname === '/api/races/x') return route.fulfill({ json: model });
    if (url.pathname === '/api/runs' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      submitted = body;
      return route.fulfill({ status: 201, json: respond(model, body, date) });
    }
    if (url.pathname.endsWith('/leaderboard')) {
      return route.fulfill({
        json: { entries: [{ rank: 1, name: 'Quick Pilot 706', score: 100 }] },
      });
    }
    if (url.pathname.endsWith('/stats'))
      return route.fulfill({ json: { runs: 3, meanScore: 80, moments: [] } });
    return route.fulfill({ status: 404, json: { error: 'no-run' } });
  });
  return () => submitted;
}
