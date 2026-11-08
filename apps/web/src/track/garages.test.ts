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

  it('1986: the 1985 champions (McLaren) nearest the exit; Toleman as Benetton, unranked', () => {
    const g = garagesFor(1986);
    expect(g.at(-1)).toEqual(['McLaren', 'MCL']);
    expect(g.at(-3)).toEqual(['Williams', 'WIL']);
    expect(g[0]).toEqual(['AGS', 'AGS']); // new in 1986, highest car number
    expect(g).toContainEqual(['Benetton', 'BEN']);
    expect(g).toHaveLength(14);
    expect(garagesFor(1984).at(-1)).toEqual(['Ferrari', 'FER']);
    expect(garagesFor(1988)).not.toContainEqual(['Brabham', 'BRA']); // sat out 1988
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

  it('1989-1993: the previous champions nearest the exit; renamed teams keep their place', () => {
    expect(garagesFor(1989).at(-1)).toEqual(['McLaren', 'MCL']);
    expect(garagesFor(1993).at(-1)).toEqual(['Williams', 'WIL']);
    expect(garagesFor(1993)[0]).toEqual(['Sauber', 'SAU']); // new in 1993
    // March (1989 12th) races as Leyton House in 1990, in March's place.
    expect(garagesFor(1990).findIndex(([t]) => t === 'Leyton House')).toBe(17 - 12);
    // 1991's Larrousse, under whichever name the race uses.
    expect(garagesFor(1991, ['Lola'])).toContainEqual(['Lola', 'LOL']);
    expect(garagesFor(1991, ['Larrousse'])).toContainEqual(['Larrousse', 'LAR']);
    expect(garagesFor(1992).find(([t]) => t === 'Team Lotus')).toEqual(['Team Lotus', 'LOT']);
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
