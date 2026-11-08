// The ten eras of Eras mode (docs/laststint-eras-mode-spec.md §4): id, name, years and play
// order. Players start at Era 10 (play order 1) and move back through the timeline to Era 1.
// Each era's ten races carry their one-line dilemma, copied exactly from the spec's §4 tables
// (catalog.test.ts checks them against the spec and data/pools.json). The server's `eras` and
// `era_races` tables (spec §12) are the source of truth once the Eras API is up; this is the
// client's copy for routing and the screens' text.

export interface EraInfo {
  /** 1..10, oldest first (Era 1 is 1983–1988). */
  id: number;
  name: string;
  /** For display, e.g. "2022–2025". */
  years: string;
  /** 1..10, newest first: Era 10 is play order 1. */
  playOrder: number;
  /**
   * The era's short briefing (spec §14), shown above its race cards. None is written yet.
   * TODO(content): add each era's briefing once it's written and checked (spec §19: no
   * invented facts). Until then the era detail shows a marked empty slot.
   */
  briefing?: string;
}

/** In play order (newest first). */
export const ERAS: readonly EraInfo[] = [
  { id: 10, name: 'Ground-effect era', years: '2022–2025', playOrder: 1 },
  { id: 9, name: 'The 2021 title fight', years: '2021', playOrder: 2 },
  { id: 8, name: 'Mercedes vs Ferrari', years: '2017–2020', playOrder: 3 },
  { id: 7, name: 'Hybrid turbo', years: '2014–2016', playOrder: 4 },
  { id: 6, name: 'Fast-wearing tyres', years: '2010–2013', playOrder: 5 },
  { id: 5, name: 'Alonso, Räikkönen, Hamilton', years: '2005–2009', playOrder: 6 },
  { id: 4, name: 'Ferrari dynasty', years: '2000–2004', playOrder: 7 },
  { id: 3, name: 'Refuelling returns', years: '1994–1999', playOrder: 8 },
  { id: 2, name: 'Senna vs Prost', years: '1989–1993', playOrder: 9 },
  { id: 1, name: 'Turbo era', years: '1983–1988', playOrder: 10 },
];

export function eraById(id: number): EraInfo | undefined {
  return ERAS.find((e) => e.id === id);
}

/** A race of an era (spec §4). */
export interface EraRaceInfo {
  /** `<event-slug>-<year>`, e.g. `abu-dhabi-2021`. */
  raceId: string;
  eraId: number;
  /** 1..10 within the era. */
  position: number;
  /** The storyline the race is built around, exactly as in the spec. */
  dilemma: string;
}

/** Spec §4: each era's races in position order, as `[raceId, dilemma]`, by era id. */
const RACE_TABLE: Record<number, ReadonlyArray<readonly [string, string]>> = {
  10: [
    ['monaco-2022', "Ferrari's calls in the rain"],
    ['great-britain-2022', "Ferrari doesn't pit Leclerc under the safety car"],
    ['hungary-2022', "Ferrari's hard-tyre gamble"],
    ['singapore-2023', "Sainz manages the gaps; Mercedes' late stop"],
    ['netherlands-2023', 'Rain at the start and the finish'],
    ['miami-2024', "Norris' first win, timed with the safety car"],
    ['hungary-2024', 'McLaren team orders'],
    ['brazil-2024', 'Red flag timing, Verstappen from 17th'],
    ['australia-2025', 'Wet-dry chaos'],
    ['monaco-2025', 'The mandatory two-stop race'],
  ],
  9: [
    ['bahrain-2021', 'Track limits and the undercut'],
    ['spain-2021', "Mercedes' extra stop catches Verstappen"],
    ['azerbaijan-2021', 'Tyre failure, then the restart'],
    ['france-2021', "Red Bull's two-stop beats Hamilton"],
    ['hungary-2021', 'Hamilton alone on the grid at the restart'],
    ['russia-2021', 'Norris stays on slicks as the rain arrives'],
    ['turkey-2021', 'Hamilton argues against pitting'],
    ['brazil-2021', 'Hamilton from 10th'],
    ['saudi-arabia-2021', 'Red flags and restarts'],
    ['abu-dhabi-2021', 'The finale'],
  ],
  8: [
    ['monaco-2017', 'Ferrari overcuts Vettel past Räikkönen'],
    ['azerbaijan-2017', 'Red flag chaos'],
    ['germany-2018', 'Vettel crashes in the rain; Hamilton stays out from 14th'],
    ['russia-2018', 'Bottas told to let Hamilton through'],
    ['germany-2019', 'Rain and constant tyre swaps'],
    ['hungary-2019', 'Mercedes switches to two stops to catch Verstappen'],
    ['brazil-2019', 'Late safety car chaos'],
    ['italy-2020', 'Red flag and a pit-lane penalty hand Gasly the win'],
    ['turkey-2020', "Hamilton's worn intermediates win the title"],
    ['sakhir-2020', "Mercedes' pit stop mix-up costs Russell"],
  ],
  7: [
    ['bahrain-2014', 'Hamilton vs Rosberg, the Duel in the Desert'],
    ['canada-2014', 'Both Mercedes have power failures'],
    ['hungary-2014', 'Safety car chaos'],
    ['monaco-2015', "Mercedes' unnecessary stop costs Hamilton the win"],
    ['hungary-2015', 'Chaos, Vettel wins'],
    ['united-states-2015', 'Hamilton clinches the title in mixed conditions'],
    ['spain-2016', "Mercedes cars collide; Red Bull's split strategy"],
    ['monaco-2016', "The tyres aren't ready at Ricciardo's stop"],
    ['brazil-2016', "Heavy rain, Verstappen's charge"],
    ['abu-dhabi-2016', 'Hamilton backs Rosberg into the pack'],
  ],
  6: [
    ['australia-2010', "Button's early switch to slicks"],
    ['abu-dhabi-2010', 'Ferrari covers the wrong car and loses the title'],
    ['china-2011', "Hamilton's three stops beat Vettel's two"],
    ['monaco-2011', "Vettel's long final stint, saved by a red flag"],
    ['canada-2011', 'Button from last to first in four hours of rain'],
    ['europe-2012', 'Alonso wins from 11th in Valencia'],
    ['abu-dhabi-2012', 'Vettel from the pit lane to the podium'],
    ['brazil-2012', 'Vettel recovers from a first-lap spin to win the title'],
    ['malaysia-2013', 'Multi 21 team orders'],
    ['spain-2013', 'Alonso wins on four stops'],
  ],
  5: [
    ['san-marino-2005', 'Alonso holds off Schumacher'],
    ['japan-2005', 'Räikkönen from 17th to win'],
    ['hungary-2006', "Button's first win, in the rain"],
    ['brazil-2006', 'Alonso protects the title'],
    ['china-2007', 'McLaren leaves Hamilton out on worn tyres'],
    ['europe-2007', 'Rain chaos at the Nürburgring'],
    ['brazil-2007', 'Three-way title decider'],
    ['monaco-2008', "Hamilton's puncture stop turns into a win"],
    ['brazil-2008', 'Glock on dry tyres in the rain, last-corner title'],
    ['brazil-2009', 'Button clinches the title from 14th'],
  ],
  4: [
    ['germany-2000', 'Barrichello stays on slicks in the rain'],
    ['japan-2000', 'A pit stop decides the title'],
    ['malaysia-2001', "Ferrari's double stop in a downpour"],
    ['austria-2002', 'Team orders on the final lap'],
    ['brazil-2003', 'Red flag chaos'],
    ['hungary-2003', "Alonso's first win on Renault's fuel strategy"],
    ['united-states-2003', 'The rain tyre gamble'],
    ['japan-2003', 'Schumacher needs one point'],
    ['france-2004', "Ferrari's four-stop strategy"],
    ['monaco-2004', 'A safety car shapes the stops'],
  ],
  3: [
    ['spain-1994', 'Schumacher stuck in fifth gear'],
    ['australia-1994', 'Schumacher vs Hill for the title'],
    ['belgium-1995', 'Schumacher from 16th on slicks in the wet'],
    ['spain-1996', "Schumacher's rain masterclass"],
    ['hungary-1997', "Hill's Arrows almost wins"],
    ['europe-1997', 'The title decider at Jerez'],
    ['hungary-1998', 'Ferrari switches to three stops mid-race'],
    ['belgium-1998', "Rain, a mass crash, Jordan's first win"],
    ['malaysia-1999', "Ferrari team orders for Irvine's title push"],
    ['europe-1999', "Rain chaos, Stewart's only win"],
  ],
  2: [
    ['japan-1989', 'Senna and Prost collide with the title at stake'],
    ['united-states-1990', 'Alesi in the Tyrrell vs Senna'],
    ['mexico-1990', 'Prost from 13th to the win on tyre strategy'],
    ['brazil-1991', 'Senna stuck in sixth gear'],
    ['monaco-1992', 'Mansell pits for fresh tyres and chases Senna'],
    ['belgium-1992', "Schumacher's first win, timing the switch to slicks"],
    ['hungary-1992', "Mansell's puncture stop with the title on the line"],
    ['brazil-1993', 'Rain arrives mid-race'],
    ['europe-1993', 'Constant wet-dry tyre calls at Donington'],
    ['australia-1993', "Senna's last win"],
  ],
  1: [
    ['south-africa-1983', "Brabham's planned refuelling stops decide the title"],
    ['monaco-1984', 'Rain, Prost leads, Senna closing'],
    ['portugal-1984', 'Lauda needs second place to win the title by half a point'],
    ['san-marino-1985', 'Leaders run out of fuel'],
    ['portugal-1985', "Senna's first win, in heavy rain"],
    ['mexico-1986', 'Berger wins without a tyre stop'],
    ['hungary-1986', 'Piquet vs Senna, tyres vs track position'],
    ['australia-1986', "Mansell's tyre explodes; pit Piquet as a precaution?"],
    ['great-britain-1987', 'Mansell pits for fresh tyres and chases down Piquet'],
    ['monaco-1988', 'Senna leads by nearly a minute; tell him to slow down?'],
  ],
};

/** Each era's ten races, in position order, by era id. */
export const ERA_RACES: Readonly<Record<number, readonly EraRaceInfo[]>> = Object.fromEntries(
  Object.entries(RACE_TABLE).map(([eraId, rows]) => [
    eraId,
    rows.map(([raceId, dilemma], i) => ({
      raceId,
      eraId: Number(eraId),
      position: i + 1,
      dilemma,
    })),
  ]),
);

/** An era's races in position order (empty for an id that isn't an era). */
export function racesOfEra(eraId: number): readonly EraRaceInfo[] {
  return ERA_RACES[eraId] ?? [];
}

/** A race of Eras mode by id, or undefined if it isn't one of the 100. */
export function eraRace(raceId: string): EraRaceInfo | undefined {
  for (const races of Object.values(ERA_RACES)) {
    const race = races.find((r) => r.raceId === raceId);
    if (race) return race;
  }
  return undefined;
}

/** A race's display name from its id: `abu-dhabi-2021` is "Abu Dhabi 2021". */
export function raceName(raceId: string): string {
  return raceId
    .split('-')
    .filter((w) => w !== '')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * The Eras route a path is on: the era map (`/eras`), an era's detail (`/eras/<eraId>`), one
 * of its races (`/eras/<eraId>/<raceId>`, or `…/legend` at Legend difficulty), or `null` when
 * the path isn't an Eras path. An era or race that isn't known gives `{ kind: 'unknown' }` so
 * the screen can say so.
 */
export type ErasRoute =
  | { kind: 'map' }
  | { kind: 'era'; era: EraInfo }
  | { kind: 'race'; era: EraInfo; race: EraRaceInfo; legend: boolean }
  | { kind: 'unknown'; segment: string };

/** The path a race card links to: the race, at the era's difficulty or at Legend. */
export function eraRacePath(race: EraRaceInfo, legend: boolean): string {
  return `/eras/${race.eraId}/${race.raceId}${legend ? '/legend' : ''}`;
}

export function erasRoute(pathname: string): ErasRoute | null {
  const m = /^\/eras(?:\/([^/]+)(?:\/([^/]+)(\/legend)?)?)?\/?$/.exec(pathname);
  if (!m) return null;
  const [, segment, raceSegment, legend] = m;
  if (segment === undefined) return { kind: 'map' };
  const era = /^\d+$/.test(segment) ? eraById(Number(segment)) : undefined;
  if (!era) return { kind: 'unknown', segment };
  if (raceSegment === undefined) return { kind: 'era', era };
  const race = racesOfEra(era.id).find((r) => r.raceId === raceSegment);
  return race
    ? { kind: 'race', era, race, legend: legend !== undefined }
    : { kind: 'unknown', segment: `${segment}/${raceSegment}` };
}
