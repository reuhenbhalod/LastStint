// A versus race as the track map draws it (docs/versus-spec.md V6): the map and its motion are
// built for the solo game's RaceState and RaceModel, so a versus race is shown as one with two
// cars: yours (userSide) and theirs (rival), each under a code from the player's name.

import {
  type CarState,
  type PlayerIndex,
  type RaceModel,
  type RaceState,
  VERSUS_LAPS,
  type VersusCall,
  type VersusSetup,
  type VersusState,
} from '@laststint/sim';

/** A three-letter code for each player (their name's letters, made distinct). */
export function codesFor(setup: VersusSetup): [string, string] {
  const code = (name: string, fallback: string) => {
    const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
    return letters.length >= 3 ? letters.slice(0, 3) : fallback;
  };
  const a = code(setup.players[0].name, 'ONE');
  let b = code(setup.players[1].name, 'TWO');
  if (b === a) b = `${b.slice(0, 2)}2`;
  return [a, b];
}

/** The race file's model, reshaped as a two-car versus race seen from `me`'s side. */
export function versusModel(base: RaceModel, setup: VersusSetup, me: PlayerIndex): RaceModel {
  const codes = codesFor(setup);
  // Garages on the map belong to teams of the race's season: borrow the two real teams.
  const teams = [
    base.drivers.find((d) => d.code === base.userSide)?.team ?? base.drivers[0]?.team ?? '',
    base.drivers.find((d) => d.code === base.rival)?.team ?? base.drivers[1]?.team ?? '',
  ];
  const driver = (i: PlayerIndex) => ({
    ...(base.drivers[i] as RaceModel['drivers'][number]),
    code: codes[i],
    team: teams[i] as string,
    realStrategy: [],
  });
  return {
    ...base,
    race: { ...base.race, laps: VERSUS_LAPS, takeoverLap: 0 },
    drivers: [driver(0), driver(1)],
    // The race's SC or VSC isn't known ahead (the state's next flag says when it's coming).
    events: [],
    decisionMoments: [],
    realResult: [...codes],
    userSide: codes[me],
    rival: codes[me === 0 ? 1 : 0],
  };
}

/** The versus state as a solo RaceState for the map. The pit calls known so far become each
 * car's strategy, so the map drives it down the pit lane: a stop called for lap L boxes at the
 * end of it, and its out-lap (the solo strategy's lap) is L + 1. */
export function versusRaceState(
  state: VersusState,
  model: RaceModel,
  setup: VersusSetup,
  calls: readonly VersusCall[] = [],
): RaceState {
  const codes = codesFor(setup);
  const cars: Record<string, CarState> = {};
  for (const c of state.cars) {
    const code = codes[c.player];
    const d = model.drivers.find((x) => x.code === code);
    cars[code] = {
      code,
      team: d?.team ?? '',
      basePace: d?.basePace ?? 0,
      noise: 0,
      compound: c.compound,
      tyreAge: c.tyreAge,
      tyreWear: c.tyreWear,
      compoundsUsed: [...c.compoundsUsed],
      totalTime: c.totalTime,
      strategy: calls.flatMap((x) =>
        x.player === c.player && x.kind === 'pit' ? [{ lap: x.lap + 1, to: x.compound }] : [],
      ),
      pittedThisLap: c.pittedThisLap,
      retired: false,
      retiredLap: null,
      modes: { ...c.modes },
      battery: c.battery,
      fuel: c.fuel,
    };
  }
  const order = [...codes].sort((a, b) => (cars[a]?.totalTime ?? 0) - (cars[b]?.totalTime ?? 0));
  return {
    lap: state.lap,
    flag: state.flag,
    nextFlag: state.nextFlag,
    order,
    cars,
    teamOrders: { holdUp: false, swap: null },
  };
}
