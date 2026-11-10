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
    [
      'saudi-arabia-2023',
      'From 15th on the grid, Verstappen has to time his only stop and chase down his own team-mate',
    ],
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
    [
      'portugal-2021',
      'Leading on worn mediums with Verstappen in the mirrors: stop for hards before Red Bull tries the undercut, or stretch the stint',
    ],
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
    [
      'australia-2017',
      "Hamilton's ultrasofts fade into Verstappen's traffic: cover his stop, or stay out and overcut",
    ],
    [
      'australia-2018',
      'Run long behind the early stoppers and bank on a neutralisation to jump the leader',
    ],
    ['germany-2018', 'Vettel crashes in the rain; Hamilton stays out from 14th'],
    [
      'spain-2017',
      'A late virtual safety car with the lead: box now for the slower tyre, or stay out and risk the cheap stop behind',
    ],
    ['germany-2019', 'Rain and constant tyre swaps'],
    ['hungary-2019', 'Mercedes switches to two stops to catch Verstappen'],
    ['brazil-2019', 'Late safety car chaos'],
    [
      'china-2017',
      'Vettel stops first for fresh softs: cover him at once, or stay out and defend the lead on older tyres?',
    ],
    ['turkey-2020', "Hamilton's worn intermediates win the title"],
    [
      'china-2018',
      'A safety car with 25 laps left: give up the lead for fresh softs, or stay out on old mediums and hold off the Red Bulls?',
    ],
  ],
  7: [
    [
      'united-states-2014',
      'Leading from pole with Hamilton under a second behind on the same softs: box first to cover him, or stay out and keep the track position?',
    ],
    [
      'brazil-2014',
      'Stay out to overcut your team-mate on fading rears, or pit with him and fight on track?',
    ],
    [
      'canada-2016',
      'A virtual safety car hands Ferrari a cheap stop from the lead: take it and commit to two, or stay out and trust the tyres to last in the cold?',
    ],
    [
      'singapore-2014',
      'Second behind Hamilton, who still owes a stop on the harder tyre: make two stops last on the softs, or take a third under the safety car?',
    ],
    [
      'abu-dhabi-2015',
      "Second to your team-mate: stretch the softs, or skip the last stop and gamble on Rosberg's tyres fading?",
    ],
    [
      'germany-2016',
      'Leading from the start as the tyres fade in the heat: time three stops against two Red Bulls on split strategies.',
    ],
    ['spain-2016', "Mercedes cars collide; Red Bull's split strategy"],
    [
      'bahrain-2015',
      'Ferrari runs Räikkönen against the grain: mediums in the middle, then a late sprint on softs to reel in the Mercedes',
    ],
    [
      'malaysia-2015',
      'Vettel stayed out under the early safety car and leads: make two stops last on a 60-degree track while Mercedes, on hards, stops three times',
    ],
    ['abu-dhabi-2016', 'Hamilton backs Rosberg into the pack'],
  ],
  6: [
    [
      'bahrain-2012',
      "Räikkönen closes in on Lotus' fresher softs: cover the undercut at the last stop, or trust Red Bull's own plan",
    ],
    ['abu-dhabi-2010', 'Ferrari covers the wrong car and loses the title'],
    [
      'germany-2013',
      'Räikkönen inherits the lead when Vettel and Grosjean make their last stops: run to the flag on ageing tyres, or stop for softs and hunt Vettel down',
    ],
    [
      'italy-2010',
      'Button blinks first: does Alonso stay out one more lap and trust his crew to win it in the pit lane?',
    ],
    [
      'australia-2013',
      'Lotus is kind to its tyres: stretch Räikkönen to two stops while the Ferraris and Red Bulls stop three times',
    ],
    ['europe-2012', 'Alonso wins from 11th in Valencia'],
    [
      'germany-2012',
      'Button sits third behind Alonso and Vettel: bring the last stop forward a lap to jump the Red Bull, then chase the Ferrari on fresher tyres',
    ],
    [
      'china-2013',
      "Ferrari's softs last only a handful of laps: commit Alonso to three stops and find a way past the cars running long on mediums",
    ],
    ['malaysia-2013', 'Multi 21 team orders'],
    [
      'abu-dhabi-2011',
      'Three seconds clear of Alonso on the same tyres: box first for the last stint to cover the undercut, or stay out and risk Ferrari going longer',
    ],
  ],
  5: [
    ['san-marino-2005', 'Alonso holds off Schumacher'],
    [
      'europe-2009',
      "Hamilton leads on the lighter tank while Barrichello's longer-fuelled Brawn keeps closing: box now and cover him, or stretch the stint and risk losing the lead in the pits?",
    ],
    [
      'france-2007',
      'Two seconds behind team-mate Massa with lapped cars ahead, Räikkönen must choose: box when Massa does, or stretch the stint three laps longer and jump him at the second stops',
    ],
    [
      'san-marino-2006',
      'Glued to a grip-starved Ferrari on a track where nobody passes, does Renault gamble on stopping a lap early, or wait for Schumacher to blink?',
    ],
    [
      'great-britain-2007',
      'Two-stopping at Silverstone with fuel deciding the order: short-fill Alonso to jump Räikkönen at the first stops, or run long like Ferrari and win it at the second?',
    ],
    ['europe-2007', 'Rain chaos at the Nürburgring'],
    ['brazil-2007', 'Three-way title decider'],
    [
      'bahrain-2006',
      'Schumacher pits first on lap 36; Renault can keep Alonso out three more laps on a lighter tank and gamble that the overcut puts him ahead at pit exit',
    ],
    [
      'turkey-2008',
      "A tyre warning forces Hamilton onto three stops: can a light McLaren build enough of a gap to beat Massa's two-stop Ferrari?",
    ],
    [
      'malaysia-2006',
      'Stuck with a heavy tank after a fuel mistake in qualifying, Alonso starts 7th: how long can Renault stretch the first stint, and how little fuel is enough at the last stop to come out ahead of Button?',
    ],
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
    [
      'germany-1996',
      'Boxed in behind the one-stopping Benettons: a short first stop for Hill to find clear air',
    ],
    [
      'germany-1997',
      'Two stops and a light car against a one-stopping Jordan: make the gap, then pass him again',
    ],
    [
      'san-marino-1999',
      'Coulthard runs one long stop; Ferrari switches Schumacher to two short ones and sprints, if the backmarkers allow',
    ],
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
