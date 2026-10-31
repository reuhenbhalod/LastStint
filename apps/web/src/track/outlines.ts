// Circuit outlines bundled from the repo's data/tracks (written by `pipeline outline`). A race
// without one plays without the map.

import type { TrackOutline } from './geometry.js';

const files = import.meta.glob<TrackOutline>('../../../../data/tracks/*.json', {
  eager: true,
  import: 'default',
});

const byRace = new Map(Object.values(files).map((o) => [o.raceId, o]));

export function outlineFor(raceId: string): TrackOutline | null {
  return byRace.get(raceId) ?? null;
}
