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

  it('2008: McLaren, excluded from the 2007 standings, nearest the entry; Ferrari at the exit', () => {
    const g = garagesFor(2008);
    expect(g.at(-1)).toEqual(['Ferrari', 'FER']);
    expect(g[0]).toEqual(['McLaren', 'MCL']);
    expect(g).toHaveLength(10);
  });

  it('2000: Ferrari, the 1999 champions, nearest the exit; Stewart as Jaguar; BAR at the entry', () => {
    const g = garagesFor(2000);
    expect(g.at(-1)).toEqual(['Ferrari', 'FER']);
    expect(g).toContainEqual(['Jaguar', 'JAG']);
    expect(g[0]).toEqual(['BAR', 'BAR']);
    expect(g).toHaveLength(11);
  });

  it('1998 and 2003: the previous champions nearest the exit; unranked Minardi at the entry', () => {
    const g98 = garagesFor(1998);
    expect(g98.at(-1)).toEqual(['Williams', 'WIL']);
    expect(g98[0]).toEqual(['Minardi', 'MIN']);
    expect(g98).toHaveLength(11);
    const g03 = garagesFor(2003);
    expect(g03.at(-1)).toEqual(['Ferrari', 'FER']);
    expect(g03[0]).toEqual(['Toyota', 'TOY']);
    expect(g03).not.toContainEqual(['Arrows', 'ARR']); // gone after 2002
    expect(g03).toHaveLength(10);
  });

  it('2006: MF1 under its Brazil name when the race uses it; Super Aguri, new, at the entry', () => {
    const g = garagesFor(2006, ['Spyker MF1']);
    expect(g).toContainEqual(['Spyker MF1', 'MF1']);
    expect(garagesFor(2006)).toContainEqual(['MF1', 'MF1']);
    expect(g[0]).toEqual(['Super Aguri', 'SA']);
    expect(g.at(-1)).toEqual(['Renault', 'REN']);
  });

  it('2002-2004: Ferrari nearest the exit; the unranked teams at the entry', () => {
    const g = garagesFor(2002);
    expect(g.at(-1)).toEqual(['Ferrari', 'FER']);
    expect(g.slice(0, 2)).toEqual([
      ['Toyota', 'TOY'], // new in 2002, after Minardi in car-number order
      ['Minardi', 'MIN'],
    ]);
    expect(g).toContainEqual(['Renault', 'REN']); // 2001's Benetton
    expect(g).toHaveLength(11);
    expect(garagesFor(2003)).not.toContainEqual(['Arrows', 'ARR']); // gone after 2002
    expect(garagesFor(2003)).toHaveLength(10);
    expect(garagesFor(2004).at(-2)).toEqual(['Williams', 'WIL']);
    expect(garagesFor(2004)[0]).toEqual(['Minardi', 'MIN']);
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

  it('1983 and 1994-1999: the previous champions nearest the exit; renamed teams keep their place', () => {
    expect(garagesFor(1983).at(-1)).toEqual(['Ferrari', 'FER']);
    expect(garagesFor(1983)[0]).toEqual(['Spirit', 'SPI']); // new in 1983, highest car number
    expect(garagesFor(1983)).not.toContainEqual(['Fittipaldi', 'FIT']); // left after 1982
    expect(garagesFor(1994).at(-1)).toEqual(['Williams', 'WIL']);
    expect(garagesFor(1994)[0]).toEqual(['Pacific', 'PAC']);
    expect(garagesFor(1996).at(-1)).toEqual(['Benetton', 'BEN']);
    // Ligier (1996 6th) races as Prost in 1997, Footwork (9th) as Arrows.
    expect(garagesFor(1997).findIndex(([t]) => t === 'Prost')).toBe(11 - 6);
    expect(garagesFor(1997).findIndex(([t]) => t === 'Arrows')).toBe(11 - 9);
    expect(garagesFor(1999).at(-1)).toEqual(['McLaren', 'MCL']);
    expect(garagesFor(1999)[0]).toEqual(['BAR', 'BAR']); // new in 1999
  });

  it('1996-2003: the previous champions at the exit; unranked teams at the entry', () => {
    expect(garagesFor(1996).at(-1)).toEqual(['Benetton', 'BEN']);
    expect(garagesFor(1996)[0]).toEqual(['Forti', 'FOR']);
    expect(garagesFor(1999).at(-1)).toEqual(['McLaren', 'MCL']);
    expect(garagesFor(1999).slice(0, 2)).toEqual([
      ['BAR', 'BAR'],
      ['Minardi', 'MIN'],
    ]);
    // Stewart (1999 4th) races as Jaguar in 2000, in Stewart's place.
    expect(garagesFor(2000).findIndex(([t]) => t === 'Jaguar')).toBe(11 - 4);
    expect(garagesFor(2001)[0]).toEqual(['Prost', 'PRO']);
    expect(garagesFor(2003)).toHaveLength(10);
    expect(garagesFor(2003)).not.toContainEqual(['Arrows', 'ARR']);
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
