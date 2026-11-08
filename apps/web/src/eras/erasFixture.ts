// Test fixture: a `GET /api/eras` response for the era map's tests.

import type { EraSummary, ErasResponse } from './api.js';
import { ERAS } from './catalog.js';

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
