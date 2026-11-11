// Test fixtures: `GET /api/eras`, `GET /api/eras/:eraId`, `POST /api/eras/attempts/:id`,
// `GET /api/history` and `GET /api/eras/races/:raceId/leaderboard` responses for the Eras
// screens' tests.

import type {
  AttemptResult,
  EraDetail,
  EraLeaderboard,
  EraRaceSummary,
  EraSummary,
  ErasResponse,
  HistoryBook,
  HistoryEntry,
  HistoryEra,
} from './api.js';
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

const tally = (have: number, total: number) => ({ have, total });

/**
 * A `GET /api/history` response: all ten eras, nothing collected, unless `eras` changes some
 * (by era id) or `entries` adds rewrites. Totals and percentages are worked out as the Worker
 * does (apps/worker/src/erasHistory.ts), so the counts always add up.
 */
export function historyBook({
  eras: edit = {},
  entries = [],
}: {
  eras?: Record<number, Partial<HistoryEra>>;
  entries?: HistoryEntry[];
} = {}): HistoryBook {
  const eras = ERAS.map((e): HistoryEra => {
    const era: HistoryEra = {
      eraId: e.id,
      name: e.name,
      years: e.years,
      playOrder: e.playOrder,
      races: 10,
      stars: tally(0, 30),
      legendStars: tally(0, 30),
      rewrites: tally(0, 10),
      hidden: tally(0, 10),
      badges: { cleared: false, mastered: false, legend: false },
      percent: 0,
      ...edit[e.id],
    };
    const badges = Object.values(era.badges).filter(Boolean).length;
    const collected =
      era.stars.have + era.legendStars.have + era.rewrites.have + era.hidden.have + badges;
    const total =
      era.stars.total + era.legendStars.total + era.rewrites.total + era.hidden.total + 3;
    return { ...era, percent: (collected / total) * 100 };
  });
  const sum = (pick: (e: HistoryEra) => { have: number; total: number }) =>
    eras.reduce((t, e) => tally(t.have + pick(e).have, t.total + pick(e).total), tally(0, 0));
  const collectibles = {
    stars: sum((e) => e.stars),
    legendStars: sum((e) => e.legendStars),
    rewrites: sum((e) => e.rewrites),
    hidden: sum((e) => e.hidden),
    badges: tally(
      eras.reduce((t, e) => t + Object.values(e.badges).filter(Boolean).length, 0),
      3 * eras.length,
    ),
  };
  const parts = Object.values(collectibles);
  const collected = parts.reduce((t, p) => t + p.have, 0);
  const total = parts.reduce((t, p) => t + p.total, 0);
  return {
    completion: { collected, total, percent: (collected / total) * 100 },
    collectibles,
    eras,
    entries,
  };
}

/** A history book entry: Abu Dhabi 2021 rewritten, with no authored headline unless given. */
export function historyEntry(edit: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    raceId: 'abu-dhabi-2021',
    eraId: 9,
    position: 10,
    attemptId: 'att-1',
    achievedAt: '2026-11-07T12:00:00.000Z',
    legend: false,
    accuracy: 91.2,
    stars: { result: true, strategist: true, mastery: false },
    headline: null,
    real: null,
    community: { players: 100, rewrites: 9, share: 0.09 },
    ...edit,
  };
}

/** A leaderboard of `count` strategists (rank n at 100 - n / 5 accuracy), the player's at `me`. */
export function leaderboard(
  count: number,
  me: number | null,
  edit: Partial<EraLeaderboard> = {},
): EraLeaderboard {
  const shown = Math.min(count, 100);
  const accuracy = (rank: number) => 100 - rank / 5;
  return {
    raceId: 'abu-dhabi-2021',
    legend: false,
    size: 100,
    total: count,
    entries: Array.from({ length: shown }, (_, i) => ({
      rank: i + 1,
      name: `Strategist ${i + 1}`,
      accuracy: accuracy(i + 1),
    })),
    me: me === null ? null : { rank: me, accuracy: accuracy(me) },
    ...edit,
  };
}
