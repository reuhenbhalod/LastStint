import { describe, expect, it } from 'vitest';
import type { EraDetail, ErasApi } from './api.js';
import { racesOfEra } from './catalog.js';
import { eraDetailView, isCleared, loadEraDetail, starCount } from './eraDetailState.js';
import { eraDetail, erasResponse, starredRaces } from './erasFixture.js';
import { mockCanStart, mockErasApi } from './mockErasApi.js';

const all = () => true;
const ALL_STARS = { result: true, strategist: true, mastery: true };

describe('eraDetailView', () => {
  it("makes the era's ten cards in position order with names, dilemmas, stars and badges", () => {
    const detail = eraDetail(9, {
      races: {
        10: { stars: ALL_STARS, bestAccuracy: 91.24, reconstructed: true, draft: true },
        2: { stars: { result: false, strategist: true, mastery: false }, bestAccuracy: 72 },
      },
    });
    detail.races.reverse();
    const view = eraDetailView(erasResponse(true), detail, all);
    expect(view.cards.map((c) => c.raceId)).toEqual(racesOfEra(9).map((r) => r.raceId));
    const finale = view.cards[9];
    expect(finale).toMatchObject({
      position: 10,
      name: 'Abu Dhabi 2021',
      dilemma: 'The finale',
      progress: { stars: ALL_STARS, bestAccuracy: 91.24 },
      reconstructed: true,
      draft: true,
      blocked: null,
    });
    expect(view.cards[1]?.dilemma).toBe("Mercedes' extra stop catches Verstappen");
    expect(view.stars).toBe(4);
    expect(view.maxStars).toBe(30);
    expect(view.racesStarred).toBe(2);
    expect(view.cleared).toBe(false);
  });

  it('is Cleared at a star on every race, not before (spec §8)', () => {
    const at9 = eraDetailView(erasResponse(true), eraDetail(10, { races: starredRaces(9) }), all);
    expect(at9.cleared).toBe(false);
    expect(at9.racesStarred).toBe(9);

    const at10 = eraDetailView(erasResponse(true), eraDetail(10, { races: starredRaces(10) }), all);
    expect(at10.cleared).toBe(true);
    expect(at10.stars).toBe(10);

    // Any one of the three stars counts.
    const mastery = { result: false, strategist: false, mastery: true };
    expect(isCleared([{ stars: mastery }])).toBe(true);
    expect(isCleared([])).toBe(false);
    expect(starCount(ALL_STARS)).toBe(3);
  });

  it('keeps Legend progress apart from the era’s', () => {
    const detail = eraDetail(10, {
      races: {
        ...starredRaces(10),
        3: {
          stars: ALL_STARS,
          legend: { stars: { result: true, strategist: true, mastery: false }, bestAccuracy: 88 },
        },
      },
    });
    const view = eraDetailView(erasResponse(true), detail, all);
    expect(view.stars).toBe(12);
    expect(view.legendStars).toBe(2);
    expect(view.cards[2]?.legend).toEqual({
      stars: { result: true, strategist: true, mastery: false },
      bestAccuracy: 88,
    });
    expect(view.cards[0]?.legend).toEqual({
      stars: { result: false, strategist: false, mastery: false },
      bestAccuracy: null,
    });
  });

  it('on test opens every race of a locked era, Draft included, with the lock shown', () => {
    const view = eraDetailView(erasResponse(true), eraDetail(8, { draft: true }), all);
    expect(view.node).toMatchObject({ locked: true, open: true, comingSoon: false });
    expect(view.cards.every((c) => c.blocked === null)).toBe(true);
  });

  it('in production blocks a locked era, an unreleased one and Draft races', () => {
    const locked = eraDetailView(erasResponse(false), eraDetail(9), all);
    expect(locked.node).toMatchObject({ locked: true, open: false });
    expect(locked.cards.every((c) => c.blocked === 'Unlock this era to play its races.')).toBe(
      true,
    );

    const soon = eraDetailView(
      erasResponse(false, { 10: { stars: 30 }, 9: { released: false } }),
      eraDetail(9),
      all,
    );
    expect(soon.node).toMatchObject({ comingSoon: true, open: false });

    const draft = eraDetailView(
      erasResponse(false),
      eraDetail(10, { races: { 4: { draft: true } } }),
      all,
    );
    expect(draft.cards.map((c) => c.blocked)).toEqual([
      null,
      null,
      null,
      'Not published yet.',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('blocks races an attempt can’t start on, saying why', () => {
    const view = eraDetailView(erasResponse(true), eraDetail(9), mockCanStart);
    const byId = Object.fromEntries(view.cards.map((c) => [c.raceId, c.blocked]));
    expect(byId['abu-dhabi-2021']).toBeNull();
    expect(byId['azerbaijan-2021']).toBe(
      'Not playable yet: this race has no race file in this build.',
    );

    const detail = eraDetail(9);
    detail.races[0] = { ...(detail.races[0] as EraDetail['races'][number]), raceId: 'spa-2099' };
    const unknown = eraDetailView(erasResponse(true), detail, all).cards[0];
    expect(unknown).toMatchObject({ name: 'Spa 2099', dilemma: null });
    expect(unknown?.blocked).toMatch(/doesn’t have this race/);
  });

  it('rejects a response that does not make sense', () => {
    const gap = eraDetail(10);
    gap.races.splice(4, 1);
    expect(() => eraDetailView(erasResponse(true), { ...gap, maxStars: 27 }, all)).toThrow(
      /positions are not 1..9/,
    );
    expect(() =>
      eraDetailView(erasResponse(true), { ...eraDetail(10), maxStars: 33 }, all),
    ).toThrow(/10 races but 33 stars/);
    const elsewhere = eraDetail(10);
    elsewhere.races[0] = {
      ...(elsewhere.races[0] as EraDetail['races'][number]),
      raceId: 'abu-dhabi-2021',
    };
    expect(() => eraDetailView(erasResponse(true), elsewhere, all)).toThrow(/in Era 9, not Era 10/);
    expect(() =>
      eraDetailView(
        erasResponse(true),
        eraDetail(10, { races: { 1: { bestAccuracy: 101 } } }),
        all,
      ),
    ).toThrow(/best accuracy 101/);
    const without = erasResponse(true);
    without.eras = without.eras.filter((e) => e.eraId !== 3);
    expect(() => eraDetailView(without, eraDetail(10), all)).toThrow();
  });
});

describe('loadEraDetail', () => {
  it('loads an era from the mock, with only bundled races startable', async () => {
    const state = await loadEraDetail(mockErasApi, 9);
    if (state.kind !== 'ready') throw new Error(state.kind);
    expect(state.view.testMode).toBe(true);
    expect(state.view.cards).toHaveLength(10);
    expect(state.view.cards.filter((c) => c.blocked === null).map((c) => c.raceId)).toEqual(
      racesOfEra(9)
        .map((r) => r.raceId)
        .filter(mockCanStart),
    );
  });

  it('turns a failure into an error state', async () => {
    const offline: ErasApi = {
      ...mockErasApi,
      era: async () => {
        throw new Error('offline');
      },
    };
    expect(await loadEraDetail(offline, 9)).toEqual({
      kind: 'error',
      message: 'Couldn’t load this era (offline).',
    });
    const wrong: ErasApi = { ...mockErasApi, era: async () => mockErasApi.era(8) };
    expect(await loadEraDetail(wrong, 9)).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('asked for Era 9, got Era 8'),
    });
  });
});
