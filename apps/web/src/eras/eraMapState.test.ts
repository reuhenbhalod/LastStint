import { unlockThreshold } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import type { ErasApi, ErasResponse } from './api.js';
import {
  NODE_X,
  currentEraId,
  eraNodes,
  isMastered,
  loadEraMap,
  nodeLabel,
  nodeX,
  trailLegs,
} from './eraMapState.js';
import { erasResponse } from './erasFixture.js';
import { mockErasApi } from './mockErasApi.js';

const byId = (res: ErasResponse) => new Map(eraNodes(res).map((n) => [n.era.eraId, n]));

describe('eraNodes', () => {
  it('puts the eras in play order, Era 10 first, whatever order they come in', () => {
    const res = erasResponse(false);
    res.eras.reverse();
    expect(eraNodes(res).map((n) => n.era.eraId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('opens Era 10 from the start and locks the rest', () => {
    const nodes = eraNodes(erasResponse(false));
    expect(nodes.filter((n) => !n.locked).map((n) => n.era.eraId)).toEqual([10]);
    expect(nodes.filter((n) => n.open).map((n) => n.era.eraId)).toEqual([10]);
  });

  it('unlocks the next era at the threshold: 21 of 30, not 20', () => {
    expect(unlockThreshold(10)).toBe(21);

    const at20 = byId(erasResponse(false, { 10: { stars: 20 } })).get(9);
    expect(at20).toMatchObject({ locked: true, open: false });
    expect(at20?.unlock).toMatchObject({ threshold: 21, remaining: 1 });
    expect(at20?.unlock?.from.eraId).toBe(10);

    const at21 = byId(erasResponse(false, { 10: { stars: 21 } })).get(9);
    expect(at21).toMatchObject({ locked: false, open: true, unlock: null });
    // ...and only that one: Era 8 waits on Era 9's stars.
    expect(byId(erasResponse(false, { 10: { stars: 30 } })).get(8)?.locked).toBe(true);
  });

  it('chains unlocks back through the timeline', () => {
    const nodes = byId(erasResponse(false, { 10: { stars: 25 }, 9: { stars: 21 } }));
    expect([10, 9, 8, 7].map((id) => nodes.get(id)?.locked)).toEqual([false, false, false, true]);
  });

  it('shows unreleased eras as Coming soon in production, not open even if unlocked', () => {
    const nodes = byId(erasResponse(false, { 10: { stars: 30 }, 9: { released: false } }));
    expect(nodes.get(9)).toMatchObject({ comingSoon: true, locked: false, open: false });
    expect(nodes.get(10)).toMatchObject({ comingSoon: false, open: true });
  });

  it('opens every era on test, keeping the lock state and never Coming soon', () => {
    const nodes = eraNodes(erasResponse(true, { 10: { stars: 20 }, 5: { released: false } }));
    expect(nodes.every((n) => n.open && !n.comingSoon)).toBe(true);
    expect(nodes.filter((n) => n.locked).map((n) => n.era.eraId)).toEqual([
      9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it('rejects a response that does not make sense', () => {
    expect(() => eraNodes({ testMode: false, eras: [] })).toThrow(/no eras/);
    expect(() => eraNodes(erasResponse(false, { 9: { playOrder: 1 } }))).toThrow(/play orders/);
    expect(() => eraNodes(erasResponse(false, { 9: { maxStars: 29 } }))).toThrow(/multiple of 3/);
    expect(() => eraNodes(erasResponse(false, { 9: { stars: 31 } }))).toThrow(/31 of 30/);
    expect(() => eraNodes(erasResponse(false, { 9: { stars: -1 } }))).toThrow(/-1 of 30/);
  });
});

describe('loadEraMap', () => {
  it('loads the map from the API, with its mode', async () => {
    const state = await loadEraMap(mockErasApi);
    expect(state.kind).toBe('ready');
    if (state.kind !== 'ready') return;
    expect(state.testMode).toBe(true);
    expect(state.nodes).toHaveLength(10);
  });

  it('turns a failed request into an error state', async () => {
    const api: ErasApi = {
      ...mockErasApi,
      eras: () => Promise.reject(new Error('network down')),
    };
    expect(await loadEraMap(api)).toEqual({
      kind: 'error',
      message: 'Couldn’t load the eras (network down).',
    });
  });

  it('turns a malformed response into an error state', async () => {
    const api: ErasApi = {
      ...mockErasApi,
      eras: async () => erasResponse(false, { 1: { stars: 99 } }),
    };
    const state = await loadEraMap(api);
    expect(state).toMatchObject({ kind: 'error' });
    if (state.kind === 'error') expect(state.message).toMatch(/99 of 30/);
  });
});

describe('the map path', () => {
  it('names each node by its era and state', () => {
    const prod = byId(erasResponse(false, { 10: { stars: 20 }, 8: { released: false } }));
    expect(nodeLabel(prod.get(10) as never, false)).toBe(
      'Era 10, Ground-effect era, 2022–2025. Unlocked. 20/30 stars.',
    );
    expect(nodeLabel(prod.get(9) as never, false)).toBe(
      'Era 9, The 2021 title fight, 2021. Locked. 21 stars in Era 10 to unlock (1 to go). 0/30 stars.',
    );
    expect(nodeLabel(prod.get(8) as never, false)).toBe(
      'Era 8, Mercedes vs Ferrari, 2017–2020. Coming soon. 0/30 stars.',
    );
    const test = byId(erasResponse(true, { 10: { stars: 30 } }));
    expect(nodeLabel(test.get(10) as never, true)).toBe(
      'Era 10, Ground-effect era, 2022–2025. Unlocked. 30/30 stars. Mastered.',
    );
    expect(nodeLabel(test.get(8) as never, true)).toBe(
      'Era 8, Mercedes vs Ferrari, 2017–2020. Locked, open on test. 21 stars in Era 9 to unlock (21 to go). 0/30 stars.',
    );
  });

  it('marks Mastered only with every star', () => {
    const nodes = byId(erasResponse(false, { 10: { stars: 30 }, 9: { stars: 29 } }));
    expect(isMastered(nodes.get(10) as never)).toBe(true);
    expect(isMastered(nodes.get(9) as never)).toBe(false);
  });

  it('marks the furthest open era as the one to play next', () => {
    expect(currentEraId(eraNodes(erasResponse(false)))).toBe(10);
    expect(currentEraId(eraNodes(erasResponse(false, { 10: { stars: 21 } })))).toBe(9);
    // Unlocked but not released: the marker stays on the last playable era.
    expect(
      currentEraId(eraNodes(erasResponse(false, { 10: { stars: 21 }, 9: { released: false } }))),
    ).toBe(10);
    // On test every era opens, but the marker still follows the locks.
    expect(currentEraId(eraNodes(erasResponse(true, { 10: { stars: 25 } })))).toBe(9);
  });

  it('winds the trail: nodes alternate sides and stay clear of the edges', () => {
    for (let i = 0; i < 10; i++) {
      expect(nodeX(i) < 50).toBe(i % 2 === 0);
      expect(nodeX(i)).toBeGreaterThanOrEqual(20);
      expect(nodeX(i)).toBeLessThanOrEqual(80);
    }
    expect(nodeX(NODE_X.length)).toBe(nodeX(0));
  });

  it('joins each node to the next, bright only where the next era is open', () => {
    const nodes = eraNodes(erasResponse(false, { 10: { stars: 21 } }));
    const legs = trailLegs(nodes);
    expect(legs).toHaveLength(9);
    expect(legs[0]?.d).toBe(`M${nodeX(0)} 50C${nodeX(0)} 100 ${nodeX(1)} 100 ${nodeX(1)} 150`);
    expect(legs[8]?.d.endsWith(`${nodeX(9)} 950`)).toBe(true);
    expect(legs.map((l) => l.open)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
