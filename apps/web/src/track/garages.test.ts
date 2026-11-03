import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { garagesFor, seasonOf } from './garages.js';

const races = join(__dirname, '..', '..', '..', '..', 'data', 'races');

describe('garages', () => {
  it('2021: the 2020 champions (Mercedes) nearest the exit, Williams nearest the entry', () => {
    const g = garagesFor(2021);
    expect(g.at(-1)).toEqual(['Mercedes', 'MER']);
    expect(g[0]).toEqual(['Williams', 'WIL']);
  });

  it("has a garage for every team in every race, under the race's own team names", () => {
    for (const file of readdirSync(races).filter((f) => f.endsWith('.json'))) {
      const model = JSON.parse(readFileSync(join(races, file), 'utf8')) as {
        race: { id: string };
        drivers: Array<{ team: string }>;
      };
      const teams = new Set(
        garagesFor(
          seasonOf(model.race.id),
          model.drivers.map((d) => d.team),
        ).map(([t]) => t),
      );
      for (const d of model.drivers)
        expect([model.race.id, teams.has(d.team)]).toEqual([model.race.id, true]);
    }
  });
});
