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
   * The era's short briefing (spec §14), shown above its race cards: what shaped its strategy,
   * then one line on what to expect at its difficulty (eras-config.json; catalog.test.ts checks
   * the numbers). Facts and sources: docs/eras-checks/s11-era-briefings.md (spec §19).
   */
  briefing: string;
}

/** In play order (newest first). */
export const ERAS: readonly EraInfo[] = [
  {
    id: 10,
    name: 'Ground-effect era',
    years: '2022–2025',
    playOrder: 1,
    briefing:
      "Ground effect came back in 2022 for the first time since 1983: the cars make most of their grip under the floor, so they can follow each other more closely, and they run on 18-inch wheels. There's no refuelling, DRS opens in the zones and the hybrid battery is yours to spend, so races turn on tyre choice, stop timing and the safety car or VSC. Verstappen won the titles from 2022 to 2024, and Norris took 2025 by two points from him. Expect the gentlest settings in Eras: full information, Standard rivals, a 45-second decision timer and 70% accuracy for the Strategist star.",
  },
  {
    id: 9,
    name: 'The 2021 title fight',
    years: '2021',
    playOrder: 2,
    briefing:
      "The 2021 cars carried over from 2020 with a cut-back floor, while the new rules waited until 2022. Hamilton's Mercedes and Verstappen's Red Bull fought all year and reached the Abu Dhabi finale level on points; Verstappen won it with a last-lap pass after a late safety car restart. The calls are about the undercut, the safety car and VSC, and track position against one rival. Expect full information, Standard rivals, a 45-second decision timer and 72% accuracy for the Strategist star.",
  },
  {
    id: 8,
    name: 'Mercedes vs Ferrari',
    years: '2017–2020',
    playOrder: 3,
    briefing:
      "From 2017 the cars were wider, on tyres a quarter wider, and built to lap four to five seconds faster than in 2016. Hamilton and Mercedes won all four titles, with Vettel's Ferrari second in 2017 and 2018 and Bottas second in 2019 and 2020. There's no refuelling, so the game is DRS, the hybrid battery, the safety car and VSC, and how the rival answers your stop. Expect full information, Standard+ rivals that cover an undercut from further out, a 45-second decision timer and 75% accuracy for the Strategist star.",
  },
  {
    id: 7,
    name: 'Hybrid turbo',
    years: '2014–2016',
    playOrder: 4,
    briefing:
      "In 2014 the engines became 1.6-litre turbo V6 hybrids with energy recovery, run under a fuel-flow limit. Mercedes drivers finished first and second in all three seasons: Hamilton beat Rosberg in 2014 and 2015, and Rosberg won in 2016 by five points. The virtual safety car arrived in 2015, a second kind of neutralised lap to stop under. Expect reduced information (no gap trend, other cars' tyre ages as ranges), Standard+ rivals, a 45-second decision timer and 78% accuracy for the Strategist star.",
  },
  {
    id: 6,
    name: 'Fast-wearing tyres',
    years: '2010–2013',
    playOrder: 5,
    briefing:
      "Refuelling was banned from 2010, so every car starts with the fuel for the whole race. From 2011 Pirelli supplied tyres made to wear quickly, with testing pointing to three stops at most races, and the same year DRS arrived and KERS returned. Vettel won four titles in a row for Red Bull; Alonso's Ferrari was second in 2010, 2012 and 2013, four points short in 2010 and three in 2012. Expect reduced information, Smart rivals that try the overcut and switch to wet tyres on the crossover, a 30-second decision timer and 80% accuracy for the Strategist star.",
  },
  {
    id: 5,
    name: 'Alonso, Räikkönen, Hamilton',
    years: '2005–2009',
    playOrder: 6,
    briefing:
      'Refuelling shapes every stop: the fuel you take sets how long the next stint can run. In 2005 a car raced on one set of dry tyres, changed only if damaged or when the weather turned; from 2007 Bridgestone was the only supplier and each driver had to use both dry compounds, and slicks and KERS arrived in 2009. Alonso won in 2005 and 2006, Räikkönen beat Hamilton by a point in 2007, Hamilton beat Massa by a point in 2008, and Button won for Brawn in 2009. Expect reduced information, Smart rivals, a 30-second decision timer and 82% accuracy for the Strategist star.',
  },
  {
    id: 4,
    name: 'Ferrari dynasty',
    years: '2000–2004',
    playOrder: 7,
    briefing:
      "Refuelling makes every race a fuel race: a light car is quick but has to stop sooner, so the plan is when to stop and how much to take. Michelin joined Bridgestone in 2001 and their tyre war ran through the era, on grooved tyres. Schumacher and Ferrari won all five titles; the closest was 2003, when Räikkönen finished two points behind. Expect limited information (gaps rounded to 0.5 s, the rival's fuel load hidden), Smart rivals, a 30-second decision timer and 84% accuracy for the Strategist star.",
  },
  {
    id: 3,
    name: 'Refuelling returns',
    years: '1994–1999',
    playOrder: 8,
    briefing:
      'Refuelling returned in 1994 after ten seasons banned, and the safety car had been official in F1 since 1993. Schumacher beat Hill by one point in 1994 and won again in 1995; Hill, Villeneuve and Häkkinen, twice, took the titles after him. Bridgestone joined Goodyear in 1997 for a two-year tyre war, and grooved tyres arrived in 1998. Expect limited information, Expert rivals that react on the lap you stop and grade their own calls, a 20-second decision timer and 86% accuracy for the Strategist star.',
  },
  {
    id: 2,
    name: 'Senna vs Prost',
    years: '1989–1993',
    playOrder: 9,
    briefing:
      "Turbos were banned from 1989, leaving 3.5-litre engines without boost, and with refuelling still banned a stop was for tyres alone. Senna and Prost were McLaren teammates in 1989, when the title was settled at Suzuka; Senna won in 1990 and 1991, Mansell in 1992 and Prost in 1993. The safety car only became official in 1993, so before then none comes out that didn't really happen. Expect minimal information (only the gaps to the cars just ahead and behind, once a lap), Expert rivals, a 20-second decision timer and 88% accuracy for the Strategist star; calls come on a pit board, and every lap is reconstructed from race reports.",
  },
  {
    id: 1,
    name: 'Turbo era',
    years: '1983–1988',
    playOrder: 10,
    briefing:
      "Turbo power and fuel decide this era. Refuelling was allowed in 1983 and banned from 1984, when the turbo cars got 220 litres for the race, cut to 195 litres in 1986 and 150 in 1988, and a car that ran dry was out. Piquet won in 1983 and 1987, Lauda beat Prost by half a point in 1984, Prost won in 1985 and 1986, and Senna in 1988. Expect the hardest settings in Eras: minimal information, Expert rivals, a 20-second decision timer and 90% accuracy for the Strategist star; calls come on a pit board, every lap is reconstructed, and no safety car comes out that didn't really happen.",
  },
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
    [
      'bahrain-2023',
      "Ferrari stops early for hards; Aston Martin stretches Alonso's softs to catch Sainz late",
    ],
    [
      'great-britain-2023',
      'Box from third now, or hold out on old mediums and gamble on a neutralisation',
    ],
    ['hungary-2022', "Ferrari's hard-tyre gamble"],
    [
      'japan-2023',
      'Russell stretches his first set while the field stops twice: hold on one stop, or stop again and attack',
    ],
    ['netherlands-2023', 'Rain at the start and the finish'],
    [
      'emilia-romagna-2024',
      "Imola's one-stop chess: pit first to chase the leader, or stretch the mediums and trust the hards to the flag",
    ],
    ['hungary-2024', 'McLaren team orders'],
    ['belgium-2023', 'Verstappen wins from sixth after a gearbox penalty'],
    ['australia-2025', 'Wet-dry chaos'],
    [
      'abu-dhabi-2022',
      "Second in the title on strategy: Pérez's mediums grain while Ferrari stretches Leclerc's stint",
    ],
  ],
  9: [
    ['bahrain-2021', 'Track limits and the undercut'],
    [
      'styria-2021',
      'Hamilton on wilting mediums four seconds back: pit early, stretch the stint, or stop twice',
    ],
    ['azerbaijan-2021', 'Tyre failure, then the restart'],
    ['france-2021', "Red Bull's two-stop beats Hamilton"],
    ['hungary-2021', 'Hamilton alone on the grid at the restart'],
    ['russia-2021', 'Norris stays on slicks as the rain arrives'],
    ['turkey-2021', 'Hamilton argues against pitting'],
    [
      'netherlands-2021',
      'Mercedes splits its cars against a quicker Red Bull: Hamilton undercuts, Bottas runs long',
    ],
    [
      'great-britain-2021',
      'A 10-second penalty to serve at the one stop, then a one-stopping Ferrari to catch',
    ],
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
    ['great-britain-2016', 'A wet start that dries: when to switch tyres, Verstappen vs Rosberg'],
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
    [
      'canada-2003',
      'Fading brakes and one more lap of fuel than his brother: stop a lap after Ralf to jump him, then hold off three cars inside five seconds',
    ],
    ['japan-2000', 'A pit stop decides the title'],
    [
      'san-marino-2000',
      'Ferrari takes the bigger fill at the first stop and bets that four extra laps on a light car will jump the McLaren at the second',
    ],
    ['austria-2002', 'Team orders on the final lap'],
    [
      'hungary-2001',
      'A Ferrari is backing you into the pack on a track with no passing: stay out longer or stop shorter to break free, knowing a slow fuel rig can undo it',
    ],
    [
      'austria-2001',
      'Coulthard has saved fuel from P7: stay out three laps longer than the Ferrari and hope the lighter car makes the overcut stick',
    ],
    [
      'france-2001',
      "Pole on Michelins with a three-second lead: stop when the plan says, or stretch the stint before your brother's Ferrari jumps you in the pits",
    ],
    [
      'italy-2001',
      "Ferrari runs light on two stops to escape Montoya's one-stop Williams, but a slow first fill hands back most of the margin",
    ],
    ['france-2004', "Ferrari's four-stop strategy"],
    [
      'san-marino-2003',
      'From sixth in a slower McLaren, on a track with no overtaking: run long on two stops while the Ferraris and Williams sprint on three',
    ],
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
    ['france-1990', "Capelli's Leyton House runs non-stop and leads; Prost closes in"],
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
    ['germany-1986', 'The McLarens save fuel to the 195-litre limit and run dry on the last lap'],
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
 * The Eras route a path is on: the era map (`/eras`), the history book (`/eras/history`), an
 * era's detail (`/eras/<eraId>`), one of its races (`/eras/<eraId>/<raceId>`, or `…/legend` at
 * Legend difficulty), a race's leaderboard (`…/<raceId>/leaderboard`, or
 * `…/leaderboard/legend` for its Legend board), or `null` when the path isn't an Eras path. An
 * era or race that isn't known gives `{ kind: 'unknown' }` so the screen can say so.
 */
export type ErasRoute =
  | { kind: 'map' }
  | { kind: 'history' }
  | { kind: 'era'; era: EraInfo }
  | { kind: 'race'; era: EraInfo; race: EraRaceInfo; legend: boolean }
  | { kind: 'leaderboard'; era: EraInfo; race: EraRaceInfo; legend: boolean }
  | { kind: 'unknown'; segment: string };

/** The path a race card links to: the race, at the era's difficulty or at Legend. */
export function eraRacePath(race: EraRaceInfo, legend: boolean): string {
  return `/eras/${race.eraId}/${race.raceId}${legend ? '/legend' : ''}`;
}

/** The history book's path. */
export const HISTORY_PATH = '/eras/history';

/** A race's leaderboard: the normal board, or the Legend one. */
export function eraLeaderboardPath(race: Pick<EraRaceInfo, 'eraId' | 'raceId'>, legend: boolean) {
  return `/eras/${race.eraId}/${race.raceId}/leaderboard${legend ? '/legend' : ''}`;
}

export function erasRoute(pathname: string): ErasRoute | null {
  if (/^\/eras\/history\/?$/.test(pathname)) return { kind: 'history' };
  const m = /^\/eras(?:\/([^/]+)(?:\/([^/]+)(\/leaderboard)?(\/legend)?)?)?\/?$/.exec(pathname);
  if (!m) return null;
  const [, segment, raceSegment, board, legend] = m;
  if (segment === undefined) return { kind: 'map' };
  const era = /^\d+$/.test(segment) ? eraById(Number(segment)) : undefined;
  if (!era) return { kind: 'unknown', segment };
  if (raceSegment === undefined) return { kind: 'era', era };
  const race = racesOfEra(era.id).find((r) => r.raceId === raceSegment);
  if (!race) return { kind: 'unknown', segment: `${segment}/${raceSegment}` };
  return { kind: board ? 'leaderboard' : 'race', era, race, legend: legend !== undefined };
}
