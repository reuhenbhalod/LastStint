// Test fixtures: `GET /api/eras`, `GET /api/eras/:eraId` and `POST /api/eras/attempts/:id`
// responses for the Eras screens' tests.

import type { AttemptResult, EraDetail, EraRaceSummary, EraSummary, ErasResponse } from './api.js';
import { ERAS, eraById, racesOfEra } from './catalog.js';

/** All ten eras, released, no stars; `edit` changes eras by id. */
export function erasResponse(
  testMode: boolean,
  edit: Record<number, Partial<EraSummary>> = {},
): ErasResponse {
  return {
    testMode,
    eras: ERAS.map((e) => ({
      eraId: e.id,
      name: e.name,
      years: e.years,
      playOrder: e.playOrder,
      released: true,
      unlocked: e.playOrder === 1,
      stars: 0,
      maxStars: 30,
      ...edit[e.id],
    })),
  };
}

const NONE = { result: false, strategist: false, mastery: false };

/**
 * A `GET /api/eras/:eraId` response: the era's ten races from the catalog, released, no stars,
 * published (not Draft) unless `draft`; `races` changes races by position (1..10).
 */
export function eraDetail(
  eraId: number,
  {
    draft = false,
    races: edit = {},
    ...rest
  }: {
    draft?: boolean;
    races?: Record<number, Partial<EraRaceSummary>>;
  } & Partial<EraSummary> = {},
): EraDetail {
  const era = eraById(eraId);
  if (!era) throw new Error(`no era ${eraId}`);
  const races = racesOfEra(eraId).map(
    (r): EraRaceSummary => ({
      raceId: r.raceId,
      position: r.position,
      stars: NONE,
      hiddenDone: false,
      bestAccuracy: null,
      reconstructed: false,
      draft,
      ...edit[r.position],
    }),
  );
  const stars = races.reduce(
    (n, r) => n + Number(r.stars.result) + Number(r.stars.strategist) + Number(r.stars.mastery),
    0,
  );
  return {
    eraId: era.id,
    name: era.name,
    years: era.years,
    playOrder: era.playOrder,
    released: true,
    unlocked: era.playOrder === 1,
    stars,
    maxStars: 30,
    races,
    ...rest,
  };
}

/** One star (★1 Result) on each of the first `n` races, by position. */
export function starredRaces(n: number): Record<number, Partial<EraRaceSummary>> {
  return Object.fromEntries(
    Array.from({ length: n }, (_, i) => [i + 1, { stars: { ...NONE, result: true } }]),
  );
}

/** An evaluated attempt on Abu Dhabi 2021 (HAM P2, no calls): `edit` changes any field. */
export function attemptResult(edit: Partial<AttemptResult> = {}): AttemptResult {
  return {
    attemptId: 'att-1',
    raceId: 'abu-dhabi-2021',
    legend: false,
    untimed: false,
    accuracy: 82.4,
    stars: { result: true, strategist: true, mastery: false },
    masteryObjective: false,
    cleanCalls: true,
    hidden: null,
    rewrite: false,
    decisionAccuracies: [],
    finishPosition: 2,
    disqualified: false,
    result: { order: ['VER', 'HAM'], finishers: ['VER', 'HAM'], disqualified: [], gaps: {} },
    calls: [],
    newStars: { ...NONE, strategist: true },
    historyEntry: false,
    progress: {
      stars: { result: true, strategist: true, mastery: false },
      hiddenDone: false,
      bestAccuracy: 82.4,
    },
    rank: 3,
    total: 41,
    ...edit,
  };
}
