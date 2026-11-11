// Tyre life (tyre-life fix): every daily and survivor race's compounds last a believable number
// of laps, the hards longest-ish, and no compound is "done" after a handful of laps.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pools from '@data/pools.json';
import { type RaceModel, tyreLife } from '@laststint/sim';
import { describe, expect, it } from 'vitest';

const load = (id: string) =>
  JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', '..', 'data', 'races', `${id}.json`), 'utf8'),
  ) as RaceModel;
const ids = [...pools.daily, ...Object.keys(pools.survivor)];

/** The least life a compound may have (laps). */
const FLOOR: Record<string, number> = { SOFT: 10, MEDIUM: 14, HARD: 15 };

describe('tyre life', () => {
  it('is believable for every compound in every daily and survivor race', () => {
    const short: string[] = [];
    const table: string[] = [];
    for (const id of ids) {
      const m = load(id);
      const lives = Object.entries(m.compounds).map(([c, t]) => [c, tyreLife(t)] as const);
      table.push(`${id.padEnd(20)} ${lives.map(([c, l]) => `${c[0]} ${l}`).join('  ')}`);
      for (const [c, l] of lives) if (l < (FLOOR[c] ?? 10)) short.push(`${id} ${c} ${l}`);
    }
    if (process.env.TYRE_TABLE) console.log(table.join('\n'));
    expect(short).toEqual([]);
  });

  it('Canada 2022 hards last a race distance, not 7 laps', () => {
    const hard = load('canada-2022').compounds.HARD;
    expect(hard && tyreLife(hard)).toBeGreaterThanOrEqual(35);
  });
});
