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

  it('2008: McLaren, excluded from the 2007 standings, nearest the entry; Ferrari at the exit', () => {
    const g = garagesFor(2008);
    expect(g.at(-1)).toEqual(['Ferrari', 'FER']);
    expect(g[0]).toEqual(['McLaren', 'MCL']);
    expect(g).toHaveLength(10);
  });

  it('2006: MF1 under its Brazil name when the race uses it; Super Aguri, new, at the entry', () => {
    const g = garagesFor(2006, ['Spyker MF1']);
    expect(g).toContainEqual(['Spyker MF1', 'MF1']);
    expect(garagesFor(2006)).toContainEqual(['MF1', 'MF1']);
    expect(g[0]).toEqual(['Super Aguri', 'SA']);
    expect(g.at(-1)).toEqual(['Renault', 'REN']);
  });

  it('2020: Red Bull and Alfa Romeo under the Jolpica spelling when the race uses it', () => {
    const g = garagesFor(2020, ['Red Bull', 'Alfa Romeo', 'Mercedes']);
    expect(g).toContainEqual(['Red Bull', 'RBR']);
    expect(g).toContainEqual(['Alfa Romeo', 'ALF']);
    expect(garagesFor(2020)).toContainEqual(['Red Bull Racing', 'RBR']);
  });

  it("2020-2021: the Jolpica dump's team names get their teams' garages", () => {
    const g = garagesFor(2021, ['Red Bull', 'Alpine F1 Team', 'Alfa Romeo']);
    expect(g.at(-2)).toEqual(['Red Bull', 'RBR']);
    expect(g.find(([t]) => t === 'Alpine F1 Team')).toEqual(['Alpine F1 Team', 'ALP']);
    expect(garagesFor(2020, ['Alfa Romeo'])[2]).toEqual(['Alfa Romeo', 'ALF']);
    expect(garagesFor(2021).at(-2)).toEqual(['Red Bull Racing', 'RBR']);
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
