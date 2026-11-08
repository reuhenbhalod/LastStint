// Eras build step 2.5: every race in the eras build plan's appendix has a circuit outline that
// the race screen's map renders. Loads each through outlineFor (the race screen's lookup),
// checks the track format, and renders TrackMap to static markup with the race's id, the
// closest headless equivalent of the race screen drawing it.

import { readFileSync } from 'node:fs';
import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import { type RaceModel, initRun } from '@laststint/sim';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrackMap } from '../components/TrackMap.js';
import { cornerPoint, overtakingCorners } from './corners.js';
import { pitLane, polyline } from './geometry.js';
import { outlineFor } from './outlines.js';

const plan = readFileSync(new URL('../../../../docs/eras-build-plan.md', import.meta.url), 'utf8');
const appendix = plan.split('## Appendix')[1] ?? '';
const ids = [...appendix.matchAll(/^\| \d+ \| `([a-z0-9-]+)` \|/gm)].map((m) => m[1] as string);

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

describe('eras track maps', () => {
  it('reads the 100 races from the build plan appendix', () => {
    expect(ids.length).toBe(100);
    expect(new Set(ids).size).toBe(100);
  });

  it('every appendix race has an outline in the track format', () => {
    const problems: string[] = [];
    for (const id of ids) {
      const o = outlineFor(id);
      if (!o) {
        problems.push(`${id}: missing`);
        continue;
      }
      const inBox = ([x, y]: [number, number]) =>
        finite(x) && finite(y) && x >= 0 && y >= 0 && x <= o.width && y <= o.height;
      if (o.raceId !== id) problems.push(`${id}: raceId ${o.raceId}`);
      if (!finite(o.width) || !finite(o.height) || o.width <= 0 || o.height <= 0)
        problems.push(`${id}: box`);
      if (o.points.length < 40 || !o.points.every(inBox)) problems.push(`${id}: points`);
      if (
        o.corners.length < 5 ||
        !o.corners.every(([n, x, y]) => Number.isInteger(n) && n > 0 && inBox([x, y]))
      )
        problems.push(`${id}: corners`);
      if ((o.pit?.length ?? 0) < 2 || !(o.pit ?? []).every(inBox)) problems.push(`${id}: pit`);
    }
    expect(problems).toEqual([]);
  });

  it('every pit lane is a short stretch by the start line, and the corners are on the lap', () => {
    const problems: string[] = [];
    for (const id of ids) {
      const o = outlineFor(id);
      if (!o) continue;
      const line = polyline(o.points);
      const lane = pitLane(o, line);
      const span = ((((lane?.exit ?? 0) - (lane?.entry ?? 0)) % 1) + 1) % 1;
      if (!lane || lane.path.length > 0.35 * line.length || span > 0.3) problems.push(`${id}: pit`);
      if (!overtakingCorners(o).length) problems.push(`${id}: no overtaking corner`);
      if (o.corners.some(([n]) => !cornerPoint(o, n))) problems.push(`${id}: corner lookup`);
    }
    expect(problems).toEqual([]);
  });

  it('the race-screen map renders every appendix outline', () => {
    const base = abuDhabi2021 as unknown as RaceModel;
    const run = initRun(base, 1);
    const failures: string[] = [];
    for (const id of ids) {
      const outline = outlineFor(id);
      if (!outline) continue;
      // The race's own id, so its season picks the garages as it will in the game.
      const model = { ...base, race: { ...base.race, id } } as RaceModel;
      try {
        const svg = renderToStaticMarkup(
          createElement(TrackMap, {
            outline,
            race: run.state,
            model,
            userSide: base.userSide,
            rival: base.rival,
            clock: null,
            selected: null,
            onSelect: () => {},
            dim: false,
          }),
        );
        if (!svg.startsWith('<svg') || !svg.includes('PIT IN') || !svg.includes('PIT OUT'))
          failures.push(`${id}: incomplete map`);
        // A badge per corner.
        const badges = svg.match(/<circle r="9"/g)?.length ?? 0;
        if (badges !== outline.corners.length) failures.push(`${id}: ${badges} corner badges`);
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
