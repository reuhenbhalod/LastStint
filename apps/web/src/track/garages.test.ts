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

  it('2014: the 2013 champions (Red Bull) nearest the exit, Caterham nearest the entry', () => {
    const g = garagesFor(2014);
    expect(g.at(-1)).toEqual(['Red Bull Racing', 'RBR']);
    expect(g[0]).toEqual(['Caterham', 'CAT']);
    expect(g).toHaveLength(11);
  });

  it('2010: Brawn, the 2009 champions, as Mercedes nearest the exit; the new teams at the entry', () => {
    const g = garagesFor(2010);
    expect(g.at(-1)).toEqual(['Mercedes', 'MER']);
    expect(g.slice(0, 3)).toEqual([
      ['Virgin', 'VIR'],
      ['HRT', 'HRT'],
      ['Lotus', 'LOT'],
    ]);
    expect(g).toHaveLength(12);
  });

  it('2020: Red Bull and Alfa Romeo under the Jolpica spelling when the race uses it', () => {
    const g = garagesFor(2020, ['Red Bull', 'Alfa Romeo', 'Mercedes']);
    expect(g).toContainEqual(['Red Bull', 'RBR']);
    expect(g).toContainEqual(['Alfa Romeo', 'ALF']);
    expect(garagesFor(2020)).toContainEqual(['Red Bull Racing', 'RBR']);
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
