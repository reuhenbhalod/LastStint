import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pools from '@data/pools.json';
import type { RaceModel } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { neutralCause } from './neutral.js';

const load = (id: string) =>
  JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', '..', 'data', 'races', `${id}.json`), 'utf8'),
  ) as RaceModel;

describe('why the safety car is out', () => {
  it('says why for every safety car and VSC in the daily and survivor races', () => {
    const unknown: string[] = [];
    for (const id of [...pools.daily, ...Object.keys(pools.survivor)]) {
      const model = load(id);
      for (const e of model.events) {
        if (e.type !== 'SC' && e.type !== 'VSC') continue;
        const why = neutralCause(model, [], e.lap, e.type === 'SC' ? 'sc' : 'vsc');
        if (!why || why.includes('hasn’t said')) unknown.push(`${id} ${e.type} ${e.lap}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('names the car and what happened (Abu Dhabi 2021)', () => {
    const model = load('abu-dhabi-2021');
    expect(neutralCause(model, [], 36, 'vsc')).toBe('Giovinazzi stopped with a gearbox failure');
    expect(neutralCause(model, [], 55, 'sc')).toBe('Latifi crashed');
    expect(neutralCause(model, [], 45, 'green')).toBeNull();
  });

  it('a crash in live play brings its own cause', () => {
    const model = load('abu-dhabi-2021');
    const notes = [{ lap: 40, kind: 'incident', driver: 'LEC', detail: 'crash' }] as never;
    expect(neutralCause(model, notes, 41, 'sc')).toBe('Leclerc crashed');
  });
});
