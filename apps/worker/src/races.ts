// Race models bundled into the Worker (Phase 4 spec A2), each identified by the SHA-256 of
// its canonical JSON. A daily pins the hash it was scheduled with, so a rebuilt race file can
// never change the scores of a day already played.

import type { RaceModel } from '@laststint/sim';
import { modelHash } from './hash.js';
import { RACE_FILES } from './races.gen.js';

export { modelHash };

const hashes = new Map<string, Promise<string>>();

export interface BundledRace {
  model: RaceModel;
  hash: string;
}

export async function getRace(id: string): Promise<BundledRace | null> {
  const model = Object.hasOwn(RACE_FILES, id) ? (RACE_FILES[id] as RaceModel) : undefined;
  if (!model) return null;
  let hash = hashes.get(id);
  if (!hash) {
    hash = modelHash(model);
    hashes.set(id, hash);
  }
  return { model, hash: await hash };
}
