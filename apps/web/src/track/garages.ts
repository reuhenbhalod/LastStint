// Pit garages along the lane, entry to exit, per season. Garages go by the previous season's
// constructors' championship, the champions nearest the exit, so each list is that standings
// order reversed, under the season's own team names (as the race models spell them).

/** Previous season's constructors' standings, champions first, in this season's names. */
const STANDINGS: Record<number, string[]> = {
  // 2010, 2012, 2013 (Eras): the 2009, 2011 and 2012 final standings from the Jolpica dump
  // (2026-10-24, formula_one_teamchampionship), under the season's names (2010: Brawn is
  // Mercedes, BMW Sauber is Sauber; 2012: Renault is Lotus F1, Lotus is Caterham, Virgin is
  // Marussia). A team that left (Toyota after 2009, HRT after 2012) is dropped. Teams new that
  // season have no standing and go last, in car-number order (2010: Lotus, HRT, Virgin).
  2010: [
    'Mercedes',
    'Red Bull',
    'McLaren',
    'Ferrari',
    'Sauber',
    'Williams',
    'Renault',
    'Force India',
    'Toro Rosso',
    'Lotus',
    'HRT',
    'Virgin',
  ],
  2012: [
    'Red Bull',
    'McLaren',
    'Ferrari',
    'Mercedes',
    'Lotus F1',
    'Force India',
    'Sauber',
    'Toro Rosso',
    'Williams',
    'Caterham',
    'HRT',
    'Marussia',
  ],
  2013: [
    'Red Bull',
    'Ferrari',
    'McLaren',
    'Lotus F1',
    'Mercedes',
    'Sauber',
    'Force India',
    'Williams',
    'Toro Rosso',
    'Caterham',
    'Marussia',
  ],
  // 2014-2016 (Eras): the 2013-2015 final standings from the Jolpica dump (2026-10-24,
  // formula_one_teamchampionship). A team new that season has no standing and goes last:
  // Renault takes Lotus F1's 2015 place, Haas comes in after Manor.
  2014: [
    'Red Bull Racing',
    'Mercedes',
    'Ferrari',
    'Lotus F1',
    'McLaren',
    'Force India',
    'Sauber',
    'Toro Rosso',
    'Williams',
    'Marussia',
    'Caterham',
  ],
  2015: [
    'Mercedes',
    'Red Bull Racing',
    'Williams',
    'Ferrari',
    'McLaren',
    'Force India',
    'Toro Rosso',
    'Lotus F1',
    'Manor Marussia',
    'Sauber',
  ],
  2016: [
    'Mercedes',
    'Ferrari',
    'Williams',
    'Red Bull Racing',
    'Force India',
    'Renault',
    'Toro Rosso',
    'Sauber',
    'McLaren',
    'Manor Marussia',
    'Haas F1 Team',
  ],
  2018: [
    'Mercedes',
    'Ferrari',
    'Red Bull Racing',
    'Force India|Racing Point',
    'Williams',
    'Renault',
    'Toro Rosso',
    'Haas F1 Team',
    'McLaren',
    'Sauber',
  ],
  2019: [
    'Mercedes',
    'Ferrari',
    'Red Bull Racing',
    'Renault',
    'Haas F1 Team',
    'McLaren',
    'Racing Point',
    'Alfa Romeo Racing',
    'Toro Rosso',
    'Williams',
  ],
  2020: [
    'Mercedes',
    'Ferrari',
    'Red Bull Racing',
    'McLaren',
    'Renault',
    'AlphaTauri',
    'Racing Point',
    'Alfa Romeo Racing',
    'Haas F1 Team',
    'Williams',
  ],
  2021: [
    'Mercedes',
    'Red Bull Racing',
    'McLaren',
    'Aston Martin',
    'Alpine',
    'Ferrari',
    'AlphaTauri',
    'Alfa Romeo Racing',
    'Haas F1 Team',
    'Williams',
  ],
  2022: [
    'Mercedes',
    'Red Bull Racing',
    'Ferrari',
    'McLaren',
    'Alpine',
    'AlphaTauri',
    'Aston Martin',
    'Williams',
    'Alfa Romeo',
    'Haas F1 Team',
  ],
  2023: [
    'Red Bull Racing',
    'Ferrari',
    'Mercedes',
    'Alpine',
    'McLaren',
    'Alfa Romeo',
    'Aston Martin',
    'Haas F1 Team',
    'AlphaTauri',
    'Williams',
  ],
  2024: [
    'Red Bull Racing',
    'Mercedes',
    'Ferrari',
    'McLaren',
    'Aston Martin',
    'Alpine',
    'Williams',
    'RB',
    'Kick Sauber',
    'Haas F1 Team',
  ],
  2025: [
    'McLaren',
    'Ferrari',
    'Red Bull Racing',
    'Mercedes',
    'Aston Martin',
    'Alpine',
    'Haas F1 Team',
    'Racing Bulls',
    'Williams',
    'Kick Sauber',
  ],
};

const SHORT: Record<string, string> = {
  Mercedes: 'MER',
  Ferrari: 'FER',
  'Red Bull Racing': 'RBR',
  'Red Bull': 'RBR',
  McLaren: 'MCL',
  Renault: 'REN',
  Alpine: 'ALP',
  'Racing Point': 'RP',
  'Force India': 'FI',
  'Aston Martin': 'AM',
  'Toro Rosso': 'STR',
  AlphaTauri: 'AT',
  RB: 'RB',
  'Racing Bulls': 'RB',
  'Alfa Romeo Racing': 'ALF',
  'Alfa Romeo': 'ALF',
  Sauber: 'SAU',
  'Kick Sauber': 'SAU',
  'Haas F1 Team': 'HAA',
  Williams: 'WIL',
};

/**
 * The garages for a race, entry to exit: [team, short label], under the names the race uses
 * (a team renamed mid-season, like Force India to Racing Point in 2018, is listed both ways).
 * Unknown seasons use the nearest one listed.
 */
export function garagesFor(season: number, teams: string[] = []): Array<[string, string]> {
  const years = Object.keys(STANDINGS).map(Number);
  const near = years.reduce((a, b) => (Math.abs(b - season) < Math.abs(a - season) ? b : a));
  return [...(STANDINGS[near] as string[])].reverse().map((entry) => {
    const names = entry.split('|');
    const team = names.find((n) => teams.includes(n)) ?? (names[0] as string);
    return [team, SHORT[team] ?? team.slice(0, 3).toUpperCase()];
  });
}

/** A race's season, from its id (e.g. abu-dhabi-2021). */
export const seasonOf = (raceId: string): number => Number(raceId.slice(-4)) || 2021;
