// Shared races (eras build plan, "Shared races"): a race in both Eras and a Daily or Gauntlet
// pool keeps its Daily race file (and its hash) unchanged, so `pipeline build` leaves its Eras
// overlay (data/eras/<race-id>.json) out of it. The Eras API serves the race file merged with
// the overlay instead, pinned by the merged model's own hash.
//
// withErasOverlay is the pipeline's merge (export.with_eras_fields, as `pipeline build` applies
// an overlay to a non-pool race): eras, provenance and rules replace the race file's blocks (a
// key already there keeps its place, a new one goes last, in that order), decisionMoments
// replaces the race file's moments, the model is then seen from eras.userSide (the hard-call
// side: when that is the race file's rival, userSide and rival swap in place, so the Eras run
// is the other car's, from its own takeover state), and each storylineEvents [lap, type] flags
// its events `storylineEvent: true`. Parity vectors:
// pipeline/tests/fixtures/eras_overlay_parity.json (pipeline/tests/test_shared_races.py).

import type { RaceModel } from '@laststint/sim';

/** The keys an overlay may have (pipeline build.OVERLAY_KEYS). */
export const OVERLAY_KEYS = [
  'eras',
  'provenance',
  'rules',
  'storylineEvents',
  'decisionMoments',
] as const;

/** A data/eras/<race-id>.json overlay. */
export interface ErasOverlay {
  eras?: unknown;
  provenance?: unknown;
  rules?: unknown;
  storylineEvents?: [number, string][];
  /** The Eras side's decision moments (a shared race whose Eras driver isn't its Daily one). */
  decisionMoments?: unknown[];
}

const isBlock = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A copy of `model` with `overlay` applied; neither input is changed. Throws on an overlay the
 * pipeline would refuse: an unknown key, a block that isn't an object, moments that aren't a
 * list, an Eras side that is neither storyline driver, or a storyline event that matches no
 * event of the race.
 */
export function withErasOverlay(model: RaceModel, overlay: unknown): RaceModel {
  const id = model.race.id;
  if (!isBlock(overlay)) throw new Error(`${id}: the Eras overlay must be an object`);
  const unknown = Object.keys(overlay).filter(
    (k) => !(OVERLAY_KEYS as readonly string[]).includes(k),
  );
  if (unknown.length > 0) {
    throw new Error(`${id}: unknown Eras overlay keys ${unknown.sort().join(', ')}`);
  }
  const out = structuredClone(model);
  const blocks = out as unknown as Record<string, unknown>;
  for (const key of ['eras', 'provenance', 'rules'] as const) {
    const block = overlay[key];
    if (block === undefined || block === null) continue;
    if (!isBlock(block)) throw new Error(`${id}: the Eras overlay's ${key} must be an object`);
    blocks[key] = structuredClone(block);
  }
  const moments = overlay.decisionMoments;
  if (moments !== undefined && moments !== null) {
    if (!Array.isArray(moments)) throw new Error(`${id}: decisionMoments must be a list`);
    out.decisionMoments = structuredClone(moments) as RaceModel['decisionMoments'];
  }
  const side = out.eras?.userSide;
  if (side !== undefined && side !== out.userSide) {
    if (side !== out.rival) {
      throw new Error(
        `${id}: eras.userSide ${side} is neither the userSide ${out.userSide} nor the rival ${out.rival}`,
      );
    }
    out.rival = out.userSide;
    out.userSide = side;
  }
  const storyline = overlay.storylineEvents ?? [];
  if (!Array.isArray(storyline)) throw new Error(`${id}: storylineEvents must be a list`);
  for (const pair of storyline) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new Error(`${id}: a storyline event is a [lap, type] pair`);
    }
    const [lap, kind] = pair as [unknown, unknown];
    const hits = out.events.filter((e) => e.lap === Number(lap) && e.type === String(kind));
    if (hits.length === 0) throw new Error(`${id}: no ${kind} event on lap ${lap} to flag`);
    for (const event of hits) event.storylineEvent = true;
  }
  return out;
}
