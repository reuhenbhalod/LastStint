// The Eras API in production mode (`ERAS_TEST_MODE` off), for the launch-state e2e
// (eras-launch.spec.ts). Pure: no Playwright, so its rules are unit-tested
// (src/eras/launchMock.test.ts). It mirrors the Worker (apps/worker/src/eras.ts):
// - `campaign`: an era is released once `released_at` is set and reached; it unlocks with the
//   sim's `unlocksNextEra` on the previous era's stars (all its races, published or not);
//   `maxStars` is 3 per race row of the era.
// - `GET /api/eras/:eraId` (`visibleInProduction`): only published races of a released era are
//   listed, and `draft` is `published !== 1`.
// - `POST /api/eras/attempts` (`startAttempt`): 404 no-race, then 403 era-unreleased,
//   race-unpublished, era-locked, legend-locked, in that order.
// - `GET /api/eras/races/:raceId/model`: 404 unless the race is published in a released era.
//
// The unlock rule is the sim's (`unlocksNextEra`: ceil(unlockShare x 3 x races) stars) on the
// Eras config, read here directly: Playwright can't load the sim package (its JSON imports).
// The unit test checks it against the sim's helper.
import { readFileSync } from 'node:fs';
import type {
  EraDetail,
  EraRaceSummary,
  EraSummary,
  ErasResponse,
  Stars,
} from '../src/eras/api.js';
import { ERAS, eraRace, racesOfEra } from '../src/eras/catalog.js';

/** What production's D1 holds: `eras.released_at`, `era_races.published` and a player's stars. */
export interface LaunchSeed {
  /** `released_at` (ISO) by era id; missing or null is Coming soon. */
  releasedAt: Readonly<Record<number, string | null>>;
  /** Race ids with `published = 1`. */
  published: readonly string[];
  /** The player's normal (not Legend) stars, by race id. */
  stars?: Readonly<Record<string, Stars>>;
}

/** The release the owner plans: Eras 10 and 9 together, every one of their races published. */
export const RELEASED_AT = '2026-11-01T00:00:00.000Z';
export const LAUNCH: LaunchSeed = {
  releasedAt: { 10: RELEASED_AT, 9: RELEASED_AT },
  published: [...racesOfEra(10), ...racesOfEra(9)].map((r) => r.raceId),
};

const { unlockShare } = JSON.parse(
  readFileSync(new URL('../../../packages/sim/src/eras/eras-config.json', import.meta.url), 'utf8'),
) as { unlockShare: number };

export const STARS_PER_RACE = 3;

/** As the sim's `unlocksNextEra`: `stars` in an era of `races` races unlock the next era. */
export function unlocksNextEra(stars: number, races: number): boolean {
  return stars >= Math.max(0, Math.ceil(unlockShare * STARS_PER_RACE * races - 1e-9));
}

const NO_STARS: Stars = { result: false, strategist: false, mastery: false };
const count = (s: Stars) => Number(s.result) + Number(s.strategist) + Number(s.mastery);

interface EraState {
  summary: EraSummary;
  releasedForReal: boolean;
  cleared: boolean;
}

/** Every era in play order, as the Worker's `campaign` in production. */
function campaign(seed: LaunchSeed, now: Date): EraState[] {
  const nowIso = now.toISOString();
  const starsOf = (raceId: string) => seed.stars?.[raceId] ?? NO_STARS;
  const out: EraState[] = [];
  for (const era of [...ERAS].sort((a, b) => a.playOrder - b.playOrder)) {
    const races = racesOfEra(era.id);
    const stars = races.reduce((n, r) => n + count(starsOf(r.raceId)), 0);
    const prev = out.at(-1);
    const unlocked =
      era.playOrder === 1 ||
      (!!prev && unlocksNextEra(prev.summary.stars, prev.summary.maxStars / STARS_PER_RACE));
    const at = seed.releasedAt[era.id] ?? null;
    const releasedForReal = at !== null && at <= nowIso;
    out.push({
      releasedForReal,
      cleared: races.length > 0 && races.every((r) => count(starsOf(r.raceId)) > 0),
      summary: {
        eraId: era.id,
        name: era.name,
        years: era.years,
        playOrder: era.playOrder,
        released: releasedForReal,
        unlocked,
        stars,
        maxStars: STARS_PER_RACE * races.length,
      },
    });
  }
  return out;
}

const published = (seed: LaunchSeed, raceId: string) => seed.published.includes(raceId);

/** `GET /api/eras` in production. */
export function launchEras(seed: LaunchSeed, now = new Date()): ErasResponse {
  return { testMode: false, eras: campaign(seed, now).map((e) => e.summary) };
}

/** `GET /api/eras/:eraId` in production; null for an era that doesn't exist (404 no-era). */
export function launchEraDetail(
  seed: LaunchSeed,
  eraId: number,
  now = new Date(),
): (EraDetail & { legendUnlocked: boolean }) | null {
  const era = campaign(seed, now).find((e) => e.summary.eraId === eraId);
  if (!era) return null;
  const races = racesOfEra(eraId)
    .filter((r) => era.releasedForReal && published(seed, r.raceId))
    .map(
      (r): EraRaceSummary => ({
        raceId: r.raceId,
        position: r.position,
        stars: seed.stars?.[r.raceId] ?? NO_STARS,
        hiddenDone: false,
        bestAccuracy: null,
        reconstructed: Number(r.raceId.slice(-4)) <= 1995,
        draft: !published(seed, r.raceId),
      }),
    );
  return { ...era.summary, legendUnlocked: era.cleared, races };
}

/** Why `POST /api/eras/attempts` refuses a race in production, or null when it starts. */
export function launchRefusal(
  seed: LaunchSeed,
  raceId: string,
  legend: boolean,
  now = new Date(),
): { status: 403 | 404; error: string } | null {
  const info = eraRace(raceId);
  const era = info && campaign(seed, now).find((e) => e.summary.eraId === info.eraId);
  if (!info || !era) return { status: 404, error: 'no-race' };
  if (!era.releasedForReal) return { status: 403, error: 'era-unreleased' };
  if (!published(seed, raceId)) return { status: 403, error: 'race-unpublished' };
  if (!era.summary.unlocked) return { status: 403, error: 'era-locked' };
  if (legend && !era.cleared) return { status: 403, error: 'legend-locked' };
  return null;
}

/** Whether production serves a race's model: published, in a released era. */
export function launchModelServed(seed: LaunchSeed, raceId: string, now = new Date()): boolean {
  const info = eraRace(raceId);
  const at = info ? (seed.releasedAt[info.eraId] ?? null) : null;
  return at !== null && at <= now.toISOString() && published(seed, raceId);
}
