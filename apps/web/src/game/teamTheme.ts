// The race in your team's colours: your car, your accents, buttons and good news (trust, tyre
// life, battery, a pass) take the team's livery colour (Ferrari red, McLaren papaya...); the
// rival takes their own real car's colour. Where the two would look alike (team-mates, or two
// reds), the rival falls back to a colour that stands apart. With a red team, warnings and BOX
// turn amber, so good news and bad never look the same.

import type { RaceModel } from '@laststint/sim';
import { useEffect } from 'react';

/** Each team's colour, picked to read on the dark pit-wall cards. */
export const TEAM_COLOR: Record<string, string> = {
  Mercedes: '#00d2be',
  Ferrari: '#e8002d',
  'Red Bull Racing': '#3671c6',
  McLaren: '#ff8000',
  Alpine: '#2293d1',
  'Aston Martin': '#229971',
  Williams: '#64c4ff',
  AlphaTauri: '#5e8faa',
  RB: '#6692ff',
  'Racing Bulls': '#6692ff',
  'Toro Rosso': '#469bff',
  'Alfa Romeo': '#c92d4b',
  'Alfa Romeo Racing': '#c92d4b',
  Sauber: '#c92d4b',
  'Kick Sauber': '#52e252',
  'Haas F1 Team': '#b6babd',
  'Racing Point': '#f596c8',
  'Force India': '#ff80c7',
  Renault: '#fff500',
};

/**
 * Historic colours by team and year (Eras mode, build plan 2.6), under the team names the
 * Jolpica results use. Each range cites the Wikipedia article of a car the team raced in its
 * first year; the colour is that livery's main colour, lifted to read on the dark cards. Every
 * range, and its owner check, is listed in docs/eras-checks/2.6-drivers-incidents.md.
 * A team and year with no range here takes TEAM_COLOR (today's teams).
 */
export interface TeamEraColour {
  team: string;
  from: number;
  to: number;
  colour: string;
  source: string;
}

export const TEAM_COLOR_BY_YEAR: TeamEraColour[] = [
  {
    team: 'AGS',
    from: 1987,
    to: 1991,
    colour: '#3b6fd1',
    source: 'https://en.wikipedia.org/wiki/AGS_JH22',
  },
  {
    team: 'ATS',
    from: 1983,
    to: 1984,
    colour: '#e8e8e0',
    source: 'https://en.wikipedia.org/wiki/ATS_D6',
  },
  {
    team: 'Alfa Romeo',
    from: 1983,
    to: 1983,
    colour: '#c8102e',
    source: 'https://en.wikipedia.org/wiki/Alfa_Romeo_183T',
  },
  {
    team: 'Alfa Romeo',
    from: 1984,
    to: 1985,
    colour: '#2e9d4f',
    source: 'https://en.wikipedia.org/wiki/Alfa_Romeo_184T',
  },
  {
    team: 'Andrea Moda',
    from: 1992,
    to: 1992,
    colour: '#7a7f87',
    source: 'https://en.wikipedia.org/wiki/Coloni_C4',
  },
  {
    team: 'Arrows',
    from: 1983,
    to: 1990,
    colour: '#4f7fd6',
    source: 'https://en.wikipedia.org/wiki/Arrows_A6',
  },
  {
    team: 'Arrows',
    from: 1997,
    to: 1997,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Arrows_A18',
  },
  {
    team: 'Arrows',
    from: 1998,
    to: 1999,
    colour: '#8c8f94',
    source: 'https://en.wikipedia.org/wiki/Arrows_A19',
  },
  {
    team: 'Arrows',
    from: 2000,
    to: 2002,
    colour: '#ff7a1a',
    source: 'https://en.wikipedia.org/wiki/Arrows_A21',
  },
  {
    team: 'BAR',
    from: 1999,
    to: 2005,
    colour: '#f2f2f2',
    source: 'https://en.wikipedia.org/wiki/BAR_01',
  },
  {
    team: 'BMW Sauber',
    from: 2006,
    to: 2009,
    colour: '#1f5fbf',
    source: 'https://en.wikipedia.org/wiki/BMW_Sauber_F1.06',
  },
  {
    team: 'Benetton',
    from: 1986,
    to: 1990,
    colour: '#3fae49',
    source: 'https://en.wikipedia.org/wiki/Benetton_B186',
  },
  {
    team: 'Benetton',
    from: 1991,
    to: 1993,
    colour: '#f2c200',
    source: 'https://en.wikipedia.org/wiki/Benetton_B190',
  },
  {
    team: 'Benetton',
    from: 1994,
    to: 2001,
    colour: '#2f8fe0',
    source: 'https://en.wikipedia.org/wiki/Benetton_B194',
  },
  {
    team: 'Brabham',
    from: 1983,
    to: 1992,
    colour: '#1f63c9',
    source: 'https://en.wikipedia.org/wiki/Brabham_BT52',
  },
  {
    team: 'Brawn',
    from: 2009,
    to: 2009,
    colour: '#d6ff3a',
    source: 'https://en.wikipedia.org/wiki/Brawn_BGP_001',
  },
  {
    team: 'Caterham',
    from: 2012,
    to: 2014,
    colour: '#1f9e4a',
    source: 'https://en.wikipedia.org/wiki/Caterham_CT01',
  },
  {
    team: 'Coloni',
    from: 1988,
    to: 1988,
    colour: '#e0c040',
    source: 'https://en.wikipedia.org/wiki/Scuderia_Coloni',
  },
  {
    team: 'Dallara',
    from: 1988,
    to: 1992,
    colour: '#d94a3a',
    source: 'https://en.wikipedia.org/wiki/Dallara_3087',
  },
  {
    team: 'Euro Brun',
    from: 1988,
    to: 1990,
    colour: '#5b8fd6',
    source: 'https://en.wikipedia.org/wiki/EuroBrun_ER188',
  },
  {
    team: 'Fondmetal',
    from: 1992,
    to: 1992,
    colour: '#4a6fa5',
    source: 'https://en.wikipedia.org/wiki/Fondmetal_GR01',
  },
  {
    team: 'Footwork',
    from: 1992,
    to: 1996,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Footwork_FA13',
  },
  {
    team: 'Force India',
    from: 2008,
    to: 2016,
    colour: '#f58020',
    source: 'https://en.wikipedia.org/wiki/Spyker_F8-VII',
  },
  {
    team: 'Forti',
    from: 1995,
    to: 1995,
    colour: '#f4d000',
    source: 'https://en.wikipedia.org/wiki/Forti_FG01',
  },
  {
    team: 'HRT',
    from: 2010,
    to: 2012,
    colour: '#c23b3b',
    source: 'https://en.wikipedia.org/wiki/Hispania_F110',
  },
  {
    team: 'Honda',
    from: 2006,
    to: 2006,
    colour: '#f2f2f2',
    source: 'https://en.wikipedia.org/wiki/Honda_RA106',
  },
  {
    team: 'Honda',
    from: 2007,
    to: 2008,
    colour: '#2f7fd0',
    source: 'https://en.wikipedia.org/wiki/Honda_RA107',
  },
  {
    team: 'Jaguar',
    from: 2000,
    to: 2004,
    colour: '#1e9a4e',
    source: 'https://en.wikipedia.org/wiki/Jaguar_R1',
  },
  {
    team: 'Jordan',
    from: 1991,
    to: 1991,
    colour: '#1fae5b',
    source: 'https://en.wikipedia.org/wiki/Jordan_191',
  },
  {
    team: 'Jordan',
    from: 1992,
    to: 1995,
    colour: '#3b8be0',
    source: 'https://en.wikipedia.org/wiki/Jordan_192',
  },
  {
    team: 'Jordan',
    from: 1996,
    to: 2005,
    colour: '#f5d300',
    source: 'https://en.wikipedia.org/wiki/Jordan_196',
  },
  {
    team: 'Larrousse',
    from: 1987,
    to: 1994,
    colour: '#4a7fd6',
    source: 'https://en.wikipedia.org/wiki/Lola_LC87',
  },
  {
    team: 'Leyton House',
    from: 1990,
    to: 1991,
    colour: '#3fc7c0',
    source: 'https://en.wikipedia.org/wiki/Leyton_House_CG901',
  },
  {
    team: 'Ligier',
    from: 1983,
    to: 1996,
    colour: '#2f6fe0',
    source: 'https://en.wikipedia.org/wiki/Ligier_JS21',
  },
  {
    team: 'Lola',
    from: 1986,
    to: 1986,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Lola_THL1',
  },
  {
    team: 'Lola',
    from: 1993,
    to: 1993,
    colour: '#d94a3a',
    source: 'https://en.wikipedia.org/wiki/Lola_T93/30',
  },
  {
    team: 'Lotus',
    from: 2010,
    to: 2011,
    colour: '#1f9e4a',
    source: 'https://en.wikipedia.org/wiki/Lotus_T127',
  },
  {
    team: 'Lotus F1',
    from: 2012,
    to: 2015,
    colour: '#c9a227',
    source: 'https://en.wikipedia.org/wiki/Lotus_E20',
  },
  {
    team: 'MF1',
    from: 2006,
    to: 2006,
    colour: '#d94040',
    source: 'https://en.wikipedia.org/wiki/Midland_M16',
  },
  {
    team: 'Spyker MF1',
    from: 2006,
    to: 2006,
    colour: '#ff7a1a',
    source: 'https://en.wikipedia.org/wiki/Midland_M16',
  },
  {
    team: 'Spyker',
    from: 2007,
    to: 2007,
    colour: '#ff7a1a',
    source: 'https://en.wikipedia.org/wiki/Spyker_F8-VII',
  },
  {
    team: 'Manor Marussia',
    from: 2015,
    to: 2016,
    colour: '#d63a3a',
    source: 'https://en.wikipedia.org/wiki/Marussia_MR03',
  },
  {
    team: 'March',
    from: 1987,
    to: 1989,
    colour: '#3fc7c0',
    source: 'https://en.wikipedia.org/wiki/March_871',
  },
  {
    team: 'March',
    from: 1992,
    to: 1992,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Leyton_House_CG911',
  },
  {
    team: 'Marussia',
    from: 2012,
    to: 2014,
    colour: '#c8262c',
    source: 'https://en.wikipedia.org/wiki/Marussia_MR01',
  },
  {
    team: 'McLaren',
    from: 1983,
    to: 1996,
    colour: '#e5262b',
    source: 'https://en.wikipedia.org/wiki/McLaren_MP4/1',
  },
  {
    team: 'McLaren',
    from: 1997,
    to: 2016,
    colour: '#b8bfc6',
    source: 'https://en.wikipedia.org/wiki/McLaren_MP4/12',
  },
  {
    team: 'Minardi',
    from: 1985,
    to: 1998,
    colour: '#f2c200',
    source: 'https://en.wikipedia.org/wiki/Minardi_M185',
  },
  {
    team: 'Minardi',
    from: 1999,
    to: 2005,
    colour: '#9aa0a6',
    source: 'https://en.wikipedia.org/wiki/Minardi_M01',
  },
  {
    team: 'Onyx',
    from: 1990,
    to: 1990,
    colour: '#3b6fd1',
    source: 'https://en.wikipedia.org/wiki/Onyx_Grand_Prix',
  },
  {
    team: 'Osella',
    from: 1983,
    to: 1990,
    colour: '#2f6fe0',
    source: 'https://en.wikipedia.org/wiki/Osella',
  },
  {
    team: 'Pacific',
    from: 1994,
    to: 1995,
    colour: '#2b62c4',
    source: 'https://en.wikipedia.org/wiki/Pacific_PR01',
  },
  {
    team: 'Prost',
    from: 1997,
    to: 2001,
    colour: '#2f6fe0',
    source: 'https://en.wikipedia.org/wiki/Prost_JS45',
  },
  {
    team: 'RAM',
    from: 1983,
    to: 1985,
    colour: '#d63a3a',
    source: 'https://en.wikipedia.org/wiki/RAM_01',
  },
  {
    team: 'Renault',
    from: 2002,
    to: 2006,
    colour: '#2f8fe0',
    source: 'https://en.wikipedia.org/wiki/Renault_R202',
  },
  {
    team: 'Renault',
    from: 2007,
    to: 2009,
    colour: '#ff7a1a',
    source: 'https://en.wikipedia.org/wiki/Renault_R27',
  },
  {
    team: 'Renault',
    from: 2011,
    to: 2011,
    colour: '#c9a227',
    source: 'https://en.wikipedia.org/wiki/Renault_R31',
  },
  {
    team: 'Rial',
    from: 1988,
    to: 1988,
    colour: '#2f6fe0',
    source: 'https://en.wikipedia.org/wiki/Rial_ARC1',
  },
  {
    team: 'Sauber',
    from: 1993,
    to: 1995,
    colour: '#7d8590',
    source: 'https://en.wikipedia.org/wiki/Sauber_C12',
  },
  {
    team: 'Sauber',
    from: 1996,
    to: 2005,
    colour: '#2a7fd0',
    source: 'https://en.wikipedia.org/wiki/Sauber_C15',
  },
  {
    team: 'Sauber',
    from: 2010,
    to: 2013,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Sauber_C29',
  },
  {
    team: 'Sauber',
    from: 2014,
    to: 2017,
    colour: '#3b6fd1',
    source: 'https://en.wikipedia.org/wiki/Sauber_C33',
  },
  {
    team: 'Sauber',
    from: 2024,
    to: 2025,
    colour: '#52e252',
    source: 'https://en.wikipedia.org/wiki/Kick_Sauber_C44',
  },
  {
    team: 'Simtek',
    from: 1994,
    to: 1994,
    colour: '#8f5cc9',
    source: 'https://en.wikipedia.org/wiki/Simtek_S941',
  },
  {
    team: 'Spirit',
    from: 1984,
    to: 1985,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Spirit_101',
  },
  {
    team: 'Stewart',
    from: 1997,
    to: 1999,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Stewart_SF01',
  },
  {
    team: 'Super Aguri',
    from: 2006,
    to: 2007,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Super_Aguri_SA05',
  },
  {
    team: 'Team Lotus',
    from: 1983,
    to: 1986,
    colour: '#c9a227',
    source: 'https://en.wikipedia.org/wiki/Lotus_92',
  },
  {
    team: 'Team Lotus',
    from: 1987,
    to: 1990,
    colour: '#f2c200',
    source: 'https://en.wikipedia.org/wiki/Lotus_99T',
  },
  {
    team: 'Team Lotus',
    from: 1991,
    to: 1994,
    colour: '#1f9e4a',
    source: 'https://en.wikipedia.org/wiki/Lotus_102',
  },
  {
    team: 'Toleman',
    from: 1983,
    to: 1984,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Toleman_TG183',
  },
  {
    team: 'Toyota',
    from: 2002,
    to: 2009,
    colour: '#ececec',
    source: 'https://en.wikipedia.org/wiki/Toyota_TF102',
  },
  {
    team: 'Tyrrell',
    from: 1983,
    to: 1998,
    colour: '#2b62c4',
    source: 'https://en.wikipedia.org/wiki/Tyrrell_011',
  },
  {
    team: 'Virgin',
    from: 2010,
    to: 2011,
    colour: '#d63a3a',
    source: 'https://en.wikipedia.org/wiki/Virgin_VR-01',
  },
  {
    team: 'Williams',
    from: 1983,
    to: 1984,
    colour: '#1f9e4a',
    source: 'https://en.wikipedia.org/wiki/Williams_FW08',
  },
  {
    team: 'Williams',
    from: 1985,
    to: 1993,
    colour: '#2f6fe0',
    source: 'https://en.wikipedia.org/wiki/Williams_FW10',
  },
  {
    team: 'Williams',
    from: 1994,
    to: 1997,
    colour: '#1f4fbf',
    source: 'https://en.wikipedia.org/wiki/Williams_FW16',
  },
  {
    team: 'Williams',
    from: 1998,
    to: 1999,
    colour: '#d63a3a',
    source: 'https://en.wikipedia.org/wiki/Williams_FW20',
  },
  {
    team: 'Williams',
    from: 2000,
    to: 2013,
    colour: '#2f6fe0',
    source: 'https://en.wikipedia.org/wiki/Williams_FW22',
  },
  {
    team: 'Williams',
    from: 2014,
    to: 2017,
    colour: '#e8e8e8',
    source: 'https://en.wikipedia.org/wiki/Williams_FW36',
  },
  {
    team: 'Zakspeed',
    from: 1985,
    to: 1989,
    colour: '#d63a3a',
    source: 'https://en.wikipedia.org/wiki/Zakspeed_841',
  },
];

/** Jolpica's names for teams TEAM_COLOR knows by their FastF1 names. */
export const TEAM_ALIAS: Record<string, string> = {
  'Red Bull': 'Red Bull Racing',
  'Alpine F1 Team': 'Alpine',
  'RB F1 Team': 'RB',
};

/** A team's colour in a given year: its historic livery if it has one, else today's. */
export function teamColour(team: string, year?: number): string | undefined {
  if (year !== undefined) {
    const era = TEAM_COLOR_BY_YEAR.find((e) => e.team === team && year >= e.from && year <= e.to);
    if (era) return era.colour;
  }
  return TEAM_COLOR[team] ?? TEAM_COLOR[TEAM_ALIAS[team] ?? ''];
}

/** The race's year, from its id (`monaco-1988`). */
const raceYear = (model: RaceModel): number | undefined => {
  const m = /(\d{4})$/.exec(model.race.id);
  return m ? Number(m[1]) : undefined;
};

/** The colours used when a team has none, or the rival's would clash with yours. */
const DEFAULT_YOU = '#19c7b4';
const FALLBACKS = ['#f2a13a', '#b48cff', '#e9ece9'];

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Text that reads on a background of `hex`: near-black on light colours, white on dark. */
export function inkOn(hex: string): string {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? '#0b0f0e' : '#ffffff';
}

/** How far apart two colours look (0-~440, a rough redmean distance). */
export function colourDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2,
  );
}

/** Close enough to be mistaken for each other on the map. */
const CLASH = 150;

export interface TeamTheme {
  you: string;
  youInk: string;
  rival: string;
  rivalInk: string;
  /** Warnings and BOX: red, or amber when your team is red. */
  box: string;
  boxInk: string;
}

/** Warnings and BOX: the pit-wall red, or amber beside a red team. */
const BOX_RED = { box: '#d4432f', boxInk: '#f07462' };
const BOX_AMBER = { box: '#d9731a', boxInk: '#f2a65a' };

export function teamTheme(model: RaceModel): TeamTheme {
  const team = (code: string) => model.drivers.find((d) => d.code === code)?.team ?? '';
  const year = raceYear(model);
  const you = teamColour(team(model.userSide), year) ?? DEFAULT_YOU;
  const theirs = teamColour(team(model.rival), year);
  const rival =
    theirs && colourDistance(theirs, you) >= CLASH
      ? theirs
      : (FALLBACKS.find((c) => colourDistance(c, you) >= CLASH) as string);
  const box = colourDistance(you, BOX_RED.box) < CLASH ? BOX_AMBER : BOX_RED;
  return { you, youInk: inkOn(you), rival, rivalInk: inkOn(rival), ...box };
}

const THEMED = [
  '--you',
  '--you-ink',
  '--rival',
  '--rival-ink',
  '--good',
  '--good-ink',
  '--box',
  '--box-ink',
];

/**
 * Put the race's team colours on the page while `model` is shown (the defaults after): the
 * colours of the team you race for, everywhere, the home page's race card included.
 */
export function useTeamTheme(model: RaceModel | null | undefined): void {
  useEffect(() => {
    if (!model) return;
    const t = teamTheme(model);
    const root = document.documentElement.style;
    root.setProperty('--you', t.you);
    root.setProperty('--you-ink', t.youInk);
    root.setProperty('--rival', t.rival);
    root.setProperty('--rival-ink', t.rivalInk);
    // Good news in the team's colour too.
    root.setProperty('--good', t.you);
    root.setProperty('--good-ink', t.youInk);
    root.setProperty('--box', t.box);
    root.setProperty('--box-ink', t.boxInk);
    return () => {
      for (const v of THEMED) root.removeProperty(v);
    };
  }, [model]);
}

/**
 * The player's favourite team (docs/auth0-spec.md A4) as `--fav`: only the top bar's buttons
 * use it, each falling back to its usual colour when there is no favourite.
 */
export function useFavouriteColour(favourite: string | null | undefined): void {
  useEffect(() => {
    const fav = favourite ? TEAM_COLOR[favourite] : undefined;
    if (!fav) return;
    const root = document.documentElement.style;
    root.setProperty('--fav', fav);
    return () => {
      root.removeProperty('--fav');
    };
  }, [favourite]);
}
