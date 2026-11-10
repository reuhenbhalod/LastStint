// Production mode for the e2e Eras mock (e2e/eras.ts): what the Worker (apps/worker/src/eras.ts)
// serves with ERAS_TEST_MODE off. An era is released once its `released_at` is set and reached;
// it unlocks once the era before it in play order has its share of the stars (spec §5,
// ERA_UNLOCK_SHARE); production lists only published races of released eras and refuses an
// attempt on an unreleased or locked era or an unpublished race. Pure (no Node or browser APIs),
// so src/eras/erasProductionMock.test.ts can check it against the sim's unlock helper.

export type Stars = { result: boolean; strategist: boolean; mastery: boolean };

const STARS_PER_RACE = 3;

/** What the mock serves in production mode. Read on every request, so a test can change it
 * (release an era) and reload the page. */
export interface ErasProduction {
  /** Each era's `released_at` (ISO), as the `eras` table has it. Null or missing: unreleased. */
  releasedAt: Record<number, string | null | undefined>;
  /** Whether a race is published (`era_races.published = 1`). Default: every race. */
  published?: (raceId: string) => boolean;
}

/** As the Worker's `releasedForReal`: `released_at` set and reached. */
export function releasedForReal(releasedAt: string | null | undefined, nowIso: string): boolean {
  return releasedAt !== null && releasedAt !== undefined && releasedAt <= nowIso;
}

/** As the sim's `unlockThreshold`: ceil(share × 3 × races). */
export function unlockThreshold(races: number, share: number): number {
  if (!Number.isInteger(races) || races < 0) throw new RangeError(`races ${races}`);
  return Math.max(0, Math.ceil(share * STARS_PER_RACE * races - 1e-9));
}

/**
 * Each era's `unlocked`, as the Worker's `campaign`: the first in play order always, every other
 * once the era before it has `unlockThreshold` of its stars. `eras` in play order.
 */
export function unlockedEras(
  eras: ReadonlyArray<{ eraId: number; stars: number; races: number }>,
  share: number,
): Map<number, boolean> {
  return new Map(
    eras.map((era, i) => {
      const prev = eras[i - 1];
      return [era.eraId, !prev || prev.stars >= unlockThreshold(prev.races, share)];
    }),
  );
}

/**
 * `total` stars spread over `raceIds` in order, 3 a race (result, strategist, then mastery), so a
 * test can start with an era's star count. Throws on a count the races can't hold.
 */
export function seededStars(raceIds: readonly string[], total: number): Map<string, Stars> {
  if (!Number.isInteger(total) || total < 0 || total > STARS_PER_RACE * raceIds.length)
    throw new RangeError(`${total} stars over ${raceIds.length} races`);
  let left = total;
  return new Map(
    raceIds.map((raceId) => {
      const n = Math.min(STARS_PER_RACE, left);
      left -= n;
      return [raceId, { result: n >= 1, strategist: n >= 2, mastery: n >= 3 }];
    }),
  );
}

/** Why production refuses an attempt (the Worker's 403 codes), or null if it starts. */
export function attemptRefusal({
  released,
  unlocked,
  published,
}: {
  released: boolean;
  unlocked: boolean;
  published: boolean;
}): 'era-unreleased' | 'race-unpublished' | 'era-locked' | null {
  if (!released) return 'era-unreleased';
  if (!published) return 'race-unpublished';
  if (!unlocked) return 'era-locked';
  return null;
}
