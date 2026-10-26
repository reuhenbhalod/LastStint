// Core simulator types (Implementation Plan 2.1).
// A run is fully defined by (race model, seed, list of decisions) — that is what the
// Worker replays to verify a score.

export type Compound = string; // e.g. 'SOFT' | 'MEDIUM' | 'HARD'; era-dependent set

export type Era = '1988-1993' | '1994-2009' | '2010-2013' | '2014-2025' | '2026+';

export type FlagState = 'green' | 'sc' | 'vsc' | 'red';

export type PaceMode = 'push' | 'standard' | 'manage';
export type FuelMode = 'normal' | 'liftAndCoast';
export type BattleMode = 'attack' | 'hold' | 'defend';

export interface Modes {
  pace: PaceMode;
  fuel: FuelMode;
  battle: BattleMode;
}

export interface CompoundModel {
  offset: number;
  degPerLap: number;
  cliffLap: number;
  /** Extra seconds per lap of tyre age past cliffLap; absent when no cliff was fitted. */
  cliffDegPerLap?: number;
}

export interface DriverModel {
  code: string;
  team: string;
  basePace: number;
  noise: number;
  stateAtTakeover: {
    position: number;
    gapAhead: number;
    compound: Compound;
    tyreAge: number;
    /** Dry compounds run up to the takeover lap (two-compound rule). */
    compoundsUsed: Compound[];
  };
  realStrategy: PitStop[];
}

export interface RaceEvent {
  lap: number;
  type: 'SC' | 'VSC' | 'RED' | 'RAIN' | 'RETIREMENT';
  laps?: number;
  driver?: string;
}

// Parsed + validated race JSON (validated at load time with zod or ajv).
export interface RaceModel {
  schemaVersion: number;
  race: { id: string; name?: string; laps: number; takeoverLap: number; seed: number };
  era: Era;
  track: {
    pitLoss: number;
    pitLossUnderSC: number;
    pitLossUnderVSC: number;
    /** Measured green-stop losses minus pitLoss: new stops sample from these (spec B1). */
    pitLossDeviations?: number[];
    overtakeDifficulty: number;
    /** P(pass) = sigmoid(intercept + paceCoef * paceAdvantage + gapCoef * gap). */
    overtakeModel: { intercept: number; paceCoef: number; gapCoef: number };
    dirtyAirPenalty: number;
    greenLapTime?: number;
    scLapTime?: number;
    vscLapTime?: number;
  };
  compounds: Record<Compound, CompoundModel>;
  drivers: DriverModel[];
  fuelEffectPerLap: number;
  /** Bonus (s, negative = faster) on a new set's first laps after the out-lap. */
  freshTyre?: { bonus: number; laps: number };
  events: RaceEvent[];
  decisionMoments: number[];
  realResult: string[];
  userSide: string;
  /** The direct rival: reacts to the user's calls (rival policy); everyone else is scripted. */
  rival: string;
  reconstructed?: boolean;
}

export interface PitStop {
  /** The out-lap: the first lap run on the new tyres (pit loss is charged on this lap). */
  lap: number;
  to: Compound;
  /** Measured loss of a real green-flag stop (frozen). */
  loss?: number;
  /** A stop the player or the rival added during the run: its loss is sampled (spec B1). */
  added?: boolean;
}

export interface CarState {
  code: string;
  team: string;
  basePace: number;
  noise: number;
  compound: Compound;
  /** Laps on the current tyres (what the timing tower shows). */
  tyreAge: number;
  /** Effective wear in laps: advances by the headset wear multiplier each green lap. */
  tyreWear: number;
  /** Dry compounds run so far, including the takeover state (two-compound rule). */
  compoundsUsed: Compound[];
  /** Cumulative race time (s) since the takeover snapshot; order is by this. */
  totalTime: number;
  /** Remaining planned stops (real strategy, or the player's/rival's plan). */
  strategy: PitStop[];
  pittedThisLap: boolean;
  retired: boolean;
  retiredLap: number | null;
  modes: Modes;
}

/**
 * A user call. `pit`: box at the end of `lap` (the in-lap); the stop is charged on lap + 1.
 * `mode`: the standing mode applies from `lap` on. `radio`: an answer to a radio moment
 * (mapped to pit/mode calls by the game; no direct sim effect).
 */
export type Decision =
  | { lap: number; kind: 'pit'; compound: Compound }
  | { lap: number; kind: 'mode'; key: keyof Modes; value: string }
  | { lap: number; kind: 'radio'; momentId: string; optionId: string };

/** Something the sim did on its own that the game may narrate (e.g. the rival covering). */
export interface RaceNote {
  lap: number;
  kind: 'rival-cover' | 'rival-stays-out' | 'error';
  driver: string;
  detail?: string;
}

export interface RaceState {
  /** Last completed lap (the takeover lap before the first stepLap). */
  lap: number;
  /** Flag the last completed lap ran under. */
  flag: FlagState;
  /** Race order: running cars by total time, then retired cars. */
  order: string[];
  cars: Record<string, CarState>;
}

export interface RaceResult {
  /** Finishers by time, then retirees (latest retirement first), then disqualified cars. */
  order: string[];
  finishers: string[];
  /** Cars excluded from the result (e.g. two-compound rule); empty unless a live run. */
  disqualified: string[];
  /** Seconds behind the winner, finishers only. */
  gaps: Record<string, number>;
  /** Total time since takeover, finishers only. */
  times: Record<string, number>;
}
