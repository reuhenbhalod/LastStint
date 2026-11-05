// Core simulator types (Implementation Plan 2.1).

import type { DecisionMoment } from './moments.js';
// A run is fully defined by (race model, seed, list of decisions) — that is what the
// Worker replays to verify a score.

export type Compound = string; // e.g. 'SOFT' | 'MEDIUM' | 'HARD'; era-dependent set

export type Era = '1988-1993' | '1994-2009' | '2010-2013' | '2014-2025' | '2026+';

export type FlagState = 'green' | 'sc' | 'vsc' | 'red';

export type PaceMode = 'push' | 'standard' | 'manage';
export type FuelMode = 'normal' | 'liftAndCoast';
export type BattleMode = 'attack' | 'hold' | 'defend';
/** The hybrid battery's use (feedback round 2): spending modes drain it, harvest refills it. */
export type ErsMode = 'harvest' | 'balanced' | 'deploy' | 'overtake';

export interface Modes {
  pace: PaceMode;
  fuel: FuelMode;
  battle: BattleMode;
  ers: ErsMode;
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
  race: {
    id: string;
    name?: string;
    laps: number;
    takeoverLap: number;
    seed: number;
    /** Which lapped cars unlap before a SC restart: all (the rule, default), or only those
     * between userSide and rival (Abu Dhabi 2021's race-control call). */
    scUnlap?: 'all' | 'duel';
  };
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
  /** Approved decision moments (data/moments/<race>.json); empty until curated. */
  decisionMoments: DecisionMoment[];
  /** Laps where a strategic event happened (SC/VSC starts, stops): raw input for the finder. */
  candidateMomentLaps?: number[];
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
  /**
   * A real fastest-lap stop (late, green, 2019-2024, made with a free gap behind). In live play
   * the rival takes it only if its gap to the car behind at the start of the out-lap exceeds
   * the stop's cost; replays and every other car keep it.
   */
  optional?: boolean;
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
  /** Hybrid battery charge, 0-100 (the player's car in live play only). */
  battery?: number;
}

/**
 * A user call. `pit`: box at the end of `lap` (the in-lap); the stop is charged on lap + 1.
 * `mode`: the standing mode applies from `lap` on. `radio`: an answer to a radio moment
 * (mapped to pit/mode calls by the game; no direct sim effect).
 */
/**
 * Team orders (product doc). `letTeammatePast`: the user's car yields to its teammate;
 * `teammateLetsYouPast`: the teammate yields to the user. Either happens only when the
 * yielding car is directly ahead within the swap window. `holdUp`: the teammate defends
 * against the rival whenever directly ahead of it, until `release`.
 */
export type TeamOrder = 'letTeammatePast' | 'teammateLetsYouPast' | 'holdUp' | 'release';

/**
 * Race engineer spec: a battle call for one lap, against the car directly behind (the defending
 * moves) or directly ahead (the attacking moves). `wait-drs` holds station this lap to attack
 * with DRS on the next; `overtake-button` spends battery on the attempt.
 */
export type BattleMove =
  | 'cover-inside'
  | 'hold-outside'
  | 'defend-hard'
  | 'let-go'
  | 'dive-inside'
  | 'round-outside'
  | 'wait-drs'
  | 'overtake-button';

export const DEFEND_MOVES: readonly BattleMove[] = [
  'cover-inside',
  'hold-outside',
  'defend-hard',
  'let-go',
];
export const ATTACK_MOVES: readonly BattleMove[] = [
  'dive-inside',
  'round-outside',
  'wait-drs',
  'overtake-button',
];

/** What the driver asks the wall for (race engineer spec D5). */
export type DriverRequest = 'box' | 'push';

/** A lapped car ahead: wait for the blue flags (and complain to race control), or go round. */
export type BlueAction = 'complain' | 'go-round';

export type Decision = (
  | { lap: number; kind: 'pit'; compound: Compound }
  | { lap: number; kind: 'mode'; key: keyof Modes; value: string }
  | { lap: number; kind: 'teamOrder'; order: TeamOrder }
  | { lap: number; kind: 'radio'; momentId: string; optionId: string }
  /** One lap's battle move. `driver`: the driver's own choice (no answer, or a refused call). */
  | { lap: number; kind: 'battle'; move: BattleMove; driver?: boolean }
  /** Track limits: careful (give a little time at the corner) or normal, from this lap on. */
  | { lap: number; kind: 'limits'; careful: boolean }
  /** One lap behind a lapped car. */
  | { lap: number; kind: 'blue'; action: BlueAction }
  /** The wall's answer to a driver's request (a yes also logs the call it asked for). */
  | { lap: number; kind: 'reply'; request: DriverRequest; yes: boolean }
) & {
  /**
   * The last completed lap when the call was made; decide() stamps it. The server needs it to
   * rebuild a moment's grade, which counts the calls already queued for later laps.
   */
  at?: number;
};

/** Something the sim did on its own that the game may narrate (e.g. the rival covering). */
export interface RaceNote {
  lap: number;
  kind:
    | 'rival-cover'
    | 'rival-stays-out'
    | 'error'
    | 'team-swap'
    | 'incident'
    // Race engineer spec (the user's car, live play):
    | 'battle' // detail: 'passed' | 'held' | 'lost' | 'stuck' (other: the car fought)
    | 'contact' // detail: 'wing' | 'puncture' | 'spin'
    | 'strike' // track limits; value: the strike count
    | 'penalty' // value: seconds added at the flag
    | 'nose' // a stop fixed the front wing
    | 'blue' // went round a lapped car; value: the time it gained (negative)
    | 'trust' // value: the change; detail: why (TrustReason)
    | 'rogue'; // a furious driver picks his own battle move (detail: the move)
  driver: string;
  /** For an incident: 'crash', 'mechanical' or 'puncture'; see the kinds above. */
  detail?: string;
  /** The other car in a battle or a blue flag. */
  other?: string;
  value?: number;
}

/** Why the driver's trust in the wall moved (race engineer spec D4). */
export type TrustReason =
  | 'pass-called' // an attack the wall called worked
  | 'pass-failed'
  | 'held-called' // a defence the wall called held
  | 'passed-anyway' // a defence the wall called didn't
  | 'let-rival-go' // told to let the rival by
  | 'let-car-go' // told to let another car by
  | 'contact' // contact on a move the wall called
  | 'undercut' // a stop put him ahead of the rival
  | 'stop-lost' // a stop dropped him behind the rival
  | 'micromanaging' // too many orders in a few laps
  | 'request-yes'
  | 'request-wrong' // the wall said no and he was right
  | 'request-right' // the wall said no and it was right
  | 'penalty'
  | 'strike'
  | 'settled'; // a few quiet laps calm him down

/** The four moods trust maps to (race engineer spec D4). */
export type Mood = 'calm' | 'tense' | 'frustrated' | 'furious';

/** The race engineer's side of the user's car (live play only). */
export interface EngineerState {
  /** The driver's trust in the wall, 0-100. */
  trust: number;
  /** Where trust started (the driver's attitude); quiet laps drift back toward it. */
  baseTrust: number;
  /** Front-wing damage: seconds a lap until a stop fixes it (0: none). */
  damage: number;
  /** Track-limit strikes so far, and the time penalty they've earned (added at the flag). */
  strikes: number;
  penalty: number;
  careful: boolean;
  /** This lap's battle move (set from the calls before the lap is run). */
  move: BattleMove | null;
  /** The move is the driver's own (no trust change on its outcome). */
  moveByDriver: boolean;
  /** `wait-drs` last lap: the next attack gets DRS. */
  drsLap: number;
  /** This lap's answer to a lapped car ahead. */
  blue: BlueAction | null;
  /** Laps of recent headset orders (micromanaging). */
  orders: number[];
  /** Requests the wall turned down, watched for a few laps to see who was right. */
  refused: Array<{ request: DriverRequest; lap: number; gap: number }>;
  /** His last stop, judged once the rival answers it: was he ahead of the rival before it? */
  stopWatch: { lap: number; ahead: boolean } | null;
  /** The last lap anything moved trust (quiet laps after it settle him). */
  lastEvent: number;
  /** The last battle move, against whom and when: the other driver reads a repeat of it. */
  lastMove?: { move: BattleMove; other: string; lap: number } | null;
}

export interface RaceState {
  /** Last completed lap (the takeover lap before the first stepLap). */
  lap: number;
  /** Flag the last completed lap ran under. */
  flag: FlagState;
  /** Race order: running cars by total time, then retired cars. */
  order: string[];
  cars: Record<string, CarState>;
  /** Standing team orders for the user's team. */
  teamOrders: {
    holdUp: boolean;
    /** A pending yield call: which car yields, and the last lap it stays open. */
    swap: { yielder: string; untilLap: number } | null;
  };
  /** The race engineer's side of the user's car (live play only). */
  engineer?: EngineerState;
  /** The flag the next lap will run under, as known now (live play adds neutralizations
   * after crashes, so the race model's events alone don't say). */
  nextFlag?: FlagState;
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
