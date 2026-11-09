import { type DifficultySettings, difficultyForEra, legendDifficulty } from '@laststint/sim';
// MOCK Eras API, for building the Eras screens before the Worker endpoints exist (build-plan
// step 7.2). Not the real thing: no gating, and progress only for this page's attempts (the
// history book and leaderboards read it, with this one player on every board). Every era lists its ten race
// cards (from the catalog, spec §4), all Draft as on test; an attempt can only start on a race
// that has a race file in this build (data/races/), and is refused on any other. It reports
// test mode (`testMode: true`), as the staging server will. Remove once the endpoints are up.

import type { RaceModel } from '@laststint/sim';
import { ApiError } from '../api.js';
import type {
  AttemptRequest,
  AttemptResponse,
  AttemptResult,
  EraBadges,
  EraDetail,
  EraLeaderboard,
  EraRaceSummary,
  EraSummary,
  ErasApi,
  ErasBookApi,
  HistoryBook,
  HistoryEntry,
  HistoryEra,
  Stars,
  Tally,
} from './api.js';
import { ERAS, eraById, eraRace, racesOfEra } from './catalog.js';
import { mockEvaluate } from './mockEvaluate.js';

// The race files bundled with the app, loaded on demand (as data/provider.ts does).
const RACE_FILES = import.meta.glob<{ default: RaceModel }>('../../../../data/races/*.json');
const raceFile = (raceId: string) => RACE_FILES[`../../../../data/races/${raceId}.json`];
const MODEL_URL = /^mock:\/\/races\/([a-z0-9-]+)$/;

// The authored Eras blocks (data/eras overlays), for which races have a rewrite to collect.
// Whole files, not `import: 'eras'`: some overlays carry only rules and no eras block, and a
// named import of a missing key fails the production build.
const ERAS_OVERLAYS = import.meta.glob<{ eras?: RaceModel['eras'] }>(
  '../../../../data/eras/*.json',
  { eager: true, import: 'default' },
);

/** As the Worker's hasRewrite: a storyline without a rewrite condition has none to collect. */
function hasRewrite(raceId: string): boolean {
  const storyline = ERAS_OVERLAYS[`../../../../data/eras/${raceId}.json`]?.eras?.storyline;
  return !storyline || storyline.rewriteCondition !== undefined;
}

/** Whether the mock can start an attempt on a race: an Eras race with a bundled race file. */
export function mockCanStart(raceId: string): boolean {
  return eraRace(raceId) !== undefined && raceFile(raceId) !== undefined;
}

/** Just the settings of a difficulty row (no era fields), as the server sends them. */
function settings({
  accuracyThreshold,
  information,
  rivalPolicy,
  decisionTimerSeconds,
}: DifficultySettings): DifficultySettings {
  return { accuracyThreshold, information, rivalPolicy, decisionTimerSeconds };
}

function summary(eraId: number): EraSummary {
  const era = eraById(eraId);
  if (!era) throw new Error(`no era ${eraId}`);
  return {
    eraId: era.id,
    name: era.name,
    years: era.years,
    playOrder: era.playOrder,
    released: true,
    // As on test (spec §13): everything is open; only Era 10 is unlocked by progress.
    unlocked: era.playOrder === 1,
    stars: 0,
    maxStars: 30,
  };
}

/**
 * Whether a race is rebuilt by full reconstruction. The spec's data table (§4, "Data
 * availability by era") has the laps of 1983–1995 races reconstructed; a stand-in for the race
 * file's `eras.reconstructed` flag, which the server will send.
 */
function reconstructed(raceId: string): boolean {
  const year = Number(raceId.slice(-4));
  return Number.isInteger(year) && year <= 1995;
}

let attempts = 0;

/** The mock's attempts and the player's best per race (this page only). */
const started = new Map<
  string,
  { raceId: string; legend: boolean; seed: number; difficulty: DifficultySettings; done: boolean }
>();
const best = new Map<string, AttemptResult['progress']>();
/** The player's rewrites (history book entries), by race, in the order they were written. */
const rewrites = new Map<string, HistoryEntry>();
const NO_STARS: Stars = { result: false, strategist: false, mastery: false };
/** Leaderboard size, as the Worker's. */
const BOARD_SIZE = 100;

const starCount = (p: AttemptResult['progress'] | undefined) =>
  p ? Number(p.stars.result) + Number(p.stars.strategist) + Number(p.stars.mastery) : 0;
const tally = (have: number, total: number): Tally => ({ have, total });

/** The history book from this page's attempts, counted as the Worker counts (erasHistory.ts). */
function mockHistory(): HistoryBook {
  const eras = ERAS.map((era): HistoryEra => {
    const races = racesOfEra(era.id);
    const n = races.length;
    const normal = (raceId: string) => best.get(`${raceId}:false`);
    const legend = (raceId: string) => best.get(`${raceId}:true`);
    const stars = races.reduce((t, r) => t + starCount(normal(r.raceId)), 0);
    const legendStars = races.reduce((t, r) => t + starCount(legend(r.raceId)), 0);
    const rewritten = races.filter((r) => rewrites.has(r.raceId)).length;
    const rewritable = races.filter((r) => hasRewrite(r.raceId)).length;
    const hidden = races.filter(
      (r) => normal(r.raceId)?.hiddenDone || legend(r.raceId)?.hiddenDone,
    ).length;
    const badges: EraBadges = {
      cleared: n > 0 && races.every((r) => starCount(normal(r.raceId)) > 0),
      mastered: n > 0 && stars === 3 * n,
      legend: n > 0 && legendStars === 3 * n,
    };
    const badgeCount = Number(badges.cleared) + Number(badges.mastered) + Number(badges.legend);
    const collected = stars + legendStars + rewritten + hidden + badgeCount;
    const total = 3 * n * 2 + rewritable + n + 3;
    return {
      eraId: era.id,
      name: era.name,
      years: era.years,
      playOrder: era.playOrder,
      races: n,
      stars: tally(stars, 3 * n),
      legendStars: tally(legendStars, 3 * n),
      rewrites: tally(rewritten, rewritable),
      hidden: tally(hidden, n),
      badges,
      percent: (collected / total) * 100,
    };
  });
  const sum = (pick: (e: HistoryEra) => Tally) =>
    eras.reduce((t, e) => tally(t.have + pick(e).have, t.total + pick(e).total), tally(0, 0));
  const collectibles = {
    stars: sum((e) => e.stars),
    legendStars: sum((e) => e.legendStars),
    rewrites: sum((e) => e.rewrites),
    hidden: sum((e) => e.hidden),
    badges: tally(
      eras.reduce(
        (t, e) =>
          t + Number(e.badges.cleared) + Number(e.badges.mastered) + Number(e.badges.legend),
        0,
      ),
      3 * eras.length,
    ),
  };
  const parts = Object.values(collectibles);
  const collected = parts.reduce((t, p) => t + p.have, 0);
  const total = parts.reduce((t, p) => t + p.total, 0);
  return {
    completion: { collected, total, percent: total > 0 ? (collected / total) * 100 : 0 },
    collectibles,
    eras,
    entries: [...rewrites.values()],
  };
}

export const mockErasApi: ErasApi & ErasBookApi = {
  async eras() {
    return { testMode: true, eras: ERAS.map((e) => summary(e.id)) };
  },

  async era(eraId) {
    const races = racesOfEra(eraId).map(
      (r): EraRaceSummary => ({
        raceId: r.raceId,
        position: r.position,
        stars: { result: false, strategist: false, mastery: false },
        hiddenDone: false,
        bestAccuracy: null,
        reconstructed: reconstructed(r.raceId),
        // Nothing is published yet: every race is Draft, playable on test only.
        draft: true,
      }),
    );
    const detail: EraDetail = { ...summary(eraId), races };
    return detail;
  },

  async startAttempt({ raceId, legend }: AttemptRequest): Promise<AttemptResponse> {
    const race = eraRace(raceId);
    if (!race) throw new Error(`${raceId} is not an Eras race`);
    if (!mockCanStart(raceId)) throw new Error(`no race file for ${raceId} in this build yet`);
    attempts += 1;
    const attemptId = `mock-attempt-${attempts}`;
    // A fresh seed per attempt, as the server will give (spec §9).
    const seed = Math.floor(Math.random() * 2 ** 31);
    // The era's settings from the Eras config, or Legend's (spec §7, §8).
    const difficulty = settings(legend ? legendDifficulty() : difficultyForEra(race.eraId));
    started.set(attemptId, { raceId, legend, seed, difficulty, done: false });
    return {
      attemptId,
      seed,
      modelUrl: `mock://races/${raceId}`,
      difficulty,
      // Nothing is published yet, as on the era cards.
      draft: true,
    };
  },

  async submitAttempt(attemptId, body) {
    const attempt = started.get(attemptId);
    if (!attempt) throw new ApiError(404, 'no-attempt');
    if (attempt.done) throw new ApiError(409, 'already-submitted');
    const model = await this.loadModel(`mock://races/${attempt.raceId}`);
    const evaluated = mockEvaluate(model, attempt, body);
    attempt.done = true;
    const key = `${attempt.raceId}:${attempt.legend}`;
    const had = best.get(key) ?? { stars: NO_STARS, hiddenDone: false, bestAccuracy: null };
    const s = evaluated.stars;
    const stars: Stars = {
      result: had.stars.result || s.result,
      strategist: had.stars.strategist || s.strategist,
      mastery: had.stars.mastery || s.mastery,
    };
    const progress = {
      stars,
      hiddenDone:
        had.hiddenDone ||
        (evaluated.hidden === true && stars.result && stars.strategist && stars.mastery),
      bestAccuracy: Math.max(had.bestAccuracy ?? 0, evaluated.accuracy),
    };
    best.set(key, progress);
    const firstRewrite = evaluated.rewrite === true && !rewrites.has(attempt.raceId);
    if (firstRewrite) {
      const race = eraRace(attempt.raceId);
      const storyline = model.eras?.storyline;
      rewrites.set(attempt.raceId, {
        raceId: attempt.raceId,
        eraId: race?.eraId ?? 0,
        position: race?.position ?? 0,
        attemptId,
        achievedAt: new Date().toISOString(),
        legend: attempt.legend,
        accuracy: evaluated.accuracy,
        stars: evaluated.stars,
        headline: storyline?.headline ?? null,
        real: storyline?.real ?? null,
        // The mock's one player rewrote it.
        community: { players: 1, rewrites: 1, share: 1 },
      });
    }
    return {
      attemptId,
      ...evaluated,
      newStars: {
        result: stars.result && !had.stars.result,
        strategist: stars.strategist && !had.stars.strategist,
        mastery: stars.mastery && !had.stars.mastery,
      },
      historyEntry: firstRewrite,
      progress,
      // The mock has one player.
      rank: 1,
      total: 1,
    };
  },

  async raceStats() {
    // No community in the mock: nothing to show.
    return null;
  },

  async history() {
    return mockHistory();
  },

  async leaderboard(raceId, legend): Promise<EraLeaderboard> {
    if (!eraRace(raceId)) throw new ApiError(404, 'no-race');
    // The mock's one player, on the board once they have an evaluated attempt in this mode.
    const accuracy = best.get(`${raceId}:${legend}`)?.bestAccuracy ?? null;
    const entries = accuracy === null ? [] : [{ rank: 1, name: 'You (mock)', accuracy }];
    return {
      raceId,
      legend,
      size: BOARD_SIZE,
      total: entries.length,
      entries,
      me: accuracy === null ? null : { rank: 1, accuracy },
    };
  },

  async loadModel(modelUrl) {
    const raceId = MODEL_URL.exec(modelUrl)?.[1];
    const load = raceId ? raceFile(raceId) : undefined;
    if (!load) throw new Error(`mock eras API has no model ${modelUrl}`);
    return (await load()).default;
  },
};
