// An era detail's state (docs/laststint-eras-mode-spec.md §5, §6, §8, §13, §14; build-plan
// 8.3): the era's race cards with their stars, best accuracy and badges, whether each can be
// started, and whether the era is Cleared (which opens Legend). The era's lock and release
// state come from `GET /api/eras` through the era map's own rules (eraMapState.ts), so the map
// and the detail always agree; the cards come from `GET /api/eras/:eraId`.

import { STARS_PER_RACE } from '@laststint/sim';
import type { EraDetail, EraRaceSummary, ErasApi } from './api.js';
import { type EraRaceInfo, eraRace, raceName } from './catalog.js';
import { type EraNode, eraNodes } from './eraMapState.js';

export type RaceStars = EraRaceSummary['stars'];

/**
 * A race's hidden objective as its card may show it (spec §6, "Hidden objectives"): `hidden`
 * until the race has all three stars (nothing is shown, not even that it exists), then `open` (a
 * new challenge) and `done` once completed. The card never shows the objective's text; that is
 * the results screen's. From the era's own difficulty, where the server keeps it.
 */
export type HiddenState = 'hidden' | 'open' | 'done';

/** A race's progress at one difficulty: its three stars and best accuracy. */
export interface RaceProgress {
  stars: RaceStars;
  bestAccuracy: number | null;
}

export interface RaceCard {
  raceId: string;
  position: number;
  /** "Abu Dhabi 2021". */
  name: string;
  /** The race's dilemma (spec §4), or null for a race the client catalog doesn't know. */
  dilemma: string | null;
  /** At the era's own difficulty. */
  progress: RaceProgress;
  /** At Legend difficulty (spec §8: its own stars, tracked separately). */
  legend: RaceProgress;
  /** The hidden objective's state (spec §6). */
  hidden: HiddenState;
  reconstructed: boolean;
  draft: boolean;
  /** Why the race can't be started from here, or null when it can. */
  blocked: string | null;
}

export interface EraDetailView {
  testMode: boolean;
  /** The era with its lock and release state, as on the map. */
  node: EraNode;
  /** The race cards, in position order. */
  cards: RaceCard[];
  /** The player's stars over the cards, at the era's difficulty and at Legend. */
  stars: number;
  legendStars: number;
  maxStars: number;
  /** Races with at least one star (at the era's difficulty). */
  racesStarred: number;
  /** Spec §8 era badge: at least 1 star on every race of the era. Opens Legend. */
  cleared: boolean;
}

const NO_STARS: RaceStars = { result: false, strategist: false, mastery: false };

export function starCount(stars: RaceStars): number {
  return Number(stars.result) + Number(stars.strategist) + Number(stars.mastery);
}

/**
 * Cleared (spec §8, "Era badges"): at least 1 star on all the era's races. Legend difficulty
 * unlocks for an era once it's Cleared (spec §8, "Legend difficulty"). An era with no races
 * isn't Cleared.
 */
export function isCleared(races: readonly Pick<EraRaceSummary, 'stars'>[]): boolean {
  return races.length > 0 && races.every((r) => starCount(r.stars) > 0);
}

/**
 * The hidden objective's state from a race's progress at the era's difficulty. The server only
 * marks it done once the race has all three stars; a payload that says done without them still
 * shows nothing, so the card never reveals more than the spec allows.
 */
export function hiddenState(race: Pick<EraRaceSummary, 'stars' | 'hiddenDone'>): HiddenState {
  if (starCount(race.stars) < STARS_PER_RACE) return 'hidden';
  return race.hiddenDone ? 'done' : 'open';
}

function invalid(why: string): never {
  throw new Error(`era response: ${why}`);
}

/** Whether a race can be started from the era detail: the reason it can't, or null. */
export function blockedReason(
  race: Pick<EraRaceSummary, 'raceId' | 'draft'>,
  {
    open,
    testMode,
    known,
    canStart,
  }: { open: boolean; testMode: boolean; known: boolean; canStart: boolean },
): string | null {
  // Production only: the server rejects attempts on locked or unreleased eras and on
  // unpublished (Draft) races (spec §13). On test everything is open.
  if (!open) return 'Unlock this era to play its races.';
  if (race.draft && !testMode) return 'Not published yet.';
  if (!known) return 'Not playable yet: this version of the app doesn’t have this race.';
  if (!canStart) return 'Not playable yet: this race has no race file in this build.';
  return null;
}

/**
 * The detail's view from the two responses. Throws on a response that doesn't make sense (the
 * era missing from the list, a star total that isn't a whole number of races, a position or a
 * race listed twice or outside the era, a race from another era), so a bad payload shows as an
 * error rather than a wrong card.
 *
 * Production lists only an era's published races, at their real positions, with `maxStars` for
 * every race of the era (the server's unlock rule counts them all). So the positions may have
 * gaps and the listing may be shorter than `maxStars / 3`: the cards keep position order and the
 * star total stays the era's, as on the map.
 */
export function eraDetailView(
  eras: Parameters<typeof eraNodes>[0],
  detail: EraDetail,
  canStart: (raceId: string) => boolean,
): EraDetailView {
  const node = eraNodes(eras).find((n) => n.era.eraId === detail.eraId);
  if (!node) invalid(`era ${detail.eraId} is not in the eras list`);

  if (detail.maxStars !== node.era.maxStars)
    invalid(`${detail.maxStars} stars to earn, but ${node.era.maxStars} on the eras list`);
  const eraRaces = detail.maxStars / STARS_PER_RACE;
  if (!Number.isInteger(eraRaces) || eraRaces < 0)
    invalid(`${detail.maxStars} stars to earn is not ${STARS_PER_RACE} per race`);
  const ordered = [...detail.races].sort((a, b) => a.position - b.position);
  if (ordered.length > eraRaces)
    invalid(`${ordered.length} races but ${detail.maxStars} stars to earn`);
  const ids = new Set<string>();
  ordered.forEach((r, i) => {
    if (!Number.isInteger(r.position) || r.position < 1 || r.position > eraRaces)
      invalid(`${r.raceId} is at position ${r.position}, not 1..${eraRaces}`);
    if (i > 0 && ordered[i - 1]?.position === r.position)
      invalid(`two races at position ${r.position}`);
    if (ids.has(r.raceId)) invalid(`${r.raceId} is listed twice`);
    ids.add(r.raceId);
    const known = eraRace(r.raceId);
    if (known && known.eraId !== detail.eraId)
      invalid(`${r.raceId} is in Era ${known.eraId}, not Era ${detail.eraId}`);
    if (r.bestAccuracy !== null && !(r.bestAccuracy >= 0 && r.bestAccuracy <= 100))
      invalid(`${r.raceId} has best accuracy ${r.bestAccuracy}`);
  });

  const cards = ordered.map((r): RaceCard => {
    const info: EraRaceInfo | undefined = eraRace(r.raceId);
    return {
      raceId: r.raceId,
      position: r.position,
      name: raceName(r.raceId),
      dilemma: info?.dilemma ?? null,
      progress: { stars: r.stars, bestAccuracy: r.bestAccuracy },
      legend: r.legend ?? { stars: NO_STARS, bestAccuracy: null },
      hidden: hiddenState(r),
      reconstructed: r.reconstructed,
      draft: r.draft,
      blocked: blockedReason(r, {
        open: node.open,
        testMode: eras.testMode,
        // A race the client catalog doesn't have has no route to link to.
        known: info !== undefined,
        canStart: canStart(r.raceId),
      }),
    };
  });

  const stars = cards.reduce((n, c) => n + starCount(c.progress.stars), 0);
  return {
    testMode: eras.testMode,
    node,
    cards,
    stars,
    legendStars: cards.reduce((n, c) => n + starCount(c.legend.stars), 0),
    // The era's total, from the server (as on the map and in the unlock rule), not just the
    // listed races'.
    maxStars: detail.maxStars,
    racesStarred: cards.filter((c) => starCount(c.progress.stars) > 0).length,
    // Cleared needs a star on every race of the era (the server's rule for Legend), so a
    // partial listing is never Cleared here: Legend stays shut rather than being refused.
    cleared: ordered.length === eraRaces && isCleared(ordered),
  };
}

export type EraDetailState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; view: EraDetailView };

/**
 * Loads an era's detail through the Eras API. Never rejects: a failure is an `error` state.
 * `canStart` says which races an attempt can start on: MOCK, only those with a bundled race
 * file; with the HTTP client every race can be asked for (the server refuses what it must).
 */
export async function loadEraDetail(
  api: ErasApi,
  eraId: number,
  canStart: (raceId: string) => boolean,
): Promise<EraDetailState> {
  try {
    const [eras, detail] = await Promise.all([api.eras(), api.era(eraId)]);
    if (detail.eraId !== eraId) invalid(`asked for Era ${eraId}, got Era ${detail.eraId}`);
    return { kind: 'ready', view: eraDetailView(eras, detail, canStart) };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { kind: 'error', message: `Couldn’t load this era (${detail}).` };
  }
}
