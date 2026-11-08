// Core simulator types (Implementation Plan 2.1).

import type { DecisionMoment } from './moments.js';
// A run is fully defined by (race model, seed, list of decisions) — that is what the
// Worker replays to verify a score.

/**
 * The race-model schema version the pipeline writes (pipeline.SCHEMA_VERSION). v11 added
 * eras, provenance, rules, events[].storylineEvent and scUnlap 'none', all optional: files
 * at any earlier version still load unchanged.
 */
export const SCHEMA_VERSION = 11;

export type Compound = string; // e.g. 'SOFT' | 'MEDIUM' | 'HARD'; era-dependent set

export type Era = '1988-1993' | '1994-2009' | '2010-2013' | '2014-2025' | '2026+';

export type FlagState = 'green' | 'sc' | 'vsc' | 'red';

export type PaceMode = 'push' | 'standard' | 'manage';

/** One wet-tyre curve: the share of a dry lap lost, least (`min`) at wetness `best`. */
export interface WetCurve {
  min: number;
  dry: number;
  wet: number;
  best: number;
}

/**
 * A wet race (docs/weather-spec.md; fitted by pipeline/wet.py). At wetness w (0 dry .. 1
 * soaked) a slick loses a·w + b·w² of a dry lap, an inter or a wet its curve's share.
 * `wetness[lap - 1]` is the real race's wetness on each lap.
 */
export interface Weather {
  curves: { slick: { a: number; b: number }; inter: WetCurve; wet: WetCurve };
  wetness: number[];
}

/** One planned stop: box at the end of `lap` (the in-lap) for `compound`. */
export interface PlanStop {
  lap: number;
  compound: Compound;
  /** A refuelling race: the stop's fill, required there (refuel.ts); the call carries it. */
  fill?: Fill;
}

/**
 * A race plan (strategy planner spec): the stops to the flag and the pace of each stint
 * (`pace.length === stops.length + 1`). `id` is the engineer's plan it is ('a', 'b', 'c'),
 * or 'own' for a plan the player built.
 */
export interface RacePlan {
  id: PlanId;
  stops: PlanStop[];
  pace: PaceMode[];
}

export type PlanId = 'a' | 'b' | 'c' | 'own';
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
  /** The longest stint run on it in the real race: its life is at least this (tyre-life fix 2). */
  provenLaps?: number;
}

export interface DriverModel {
  code: string;
  team: string;
  basePace: number;
  noise: number;
  /** A wet race: the driver's extra share of a lap in the wet beyond the curves. */
  wetPace?: number;
  /** An Eras build: the driver's share on a damp track (wetness < DAMP_EDGE); absent: wetPace. */
  dampPace?: number;
  stateAtTakeover: {
    position: number;
    gapAhead: number;
    compound: Compound;
    tyreAge: number;
    /**
     * Compounds run up to the takeover lap (two-compound rule), wet tyres included since the
     * wet-tyre fix; an older file lists dry ones only (rules.ts takeoverCompoundsUsed).
     */
    compoundsUsed: Compound[];
  };
  realStrategy: PitStop[];
  /**
   * Real stops after the takeover that changed no tyres (a repair, a penalty stop-go, a
   * drive-through; pipeline track.service_stops): the car pays each one's measured loss on its
   * out-lap whatever its strategy, and keeps its set. Eras builds only.
   */
  serviceStops?: ServiceStop[];
  /**
   * Pace by stint (Eras model fix M2; pipeline pace.stint_offsets): the car's offset to
   * basePace in each real stint after the takeover, keyed by the lap the stint began (a real
   * stop's out-lap, or 0 for the takeover stint). A car runs an offset while its current stint
   * began on that lap; any other stint runs at 0, and so does the player's car in live play.
   * Eras builds only.
   */
  stintPace?: StintPace[];
}

/** One stint's pace offset (DriverModel.stintPace). */
export interface StintPace {
  /** The out-lap the stint began on, or 0 for the stint the car is on at the takeover. */
  lap: number;
  /** Seconds per lap added to basePace in the stint (negative: quicker). */
  offset: number;
}

/** A stop with no tyre change (DriverModel.serviceStops). */
export interface ServiceStop {
  /** The out-lap: its loss is charged on this lap. */
  lap: number;
  /** Measured time lost to the stop (s). */
  loss: number;
}

/** A car fault's kind (simulator roadmap R2; faults.ts). */
export type FaultKind = 'gear-stuck' | 'power-loss' | 'puncture' | 'tyre-failure';

export interface RaceEvent {
  lap: number;
  type: 'SC' | 'VSC' | 'RED' | 'RAIN' | 'RETIREMENT' | 'FAULT' | 'TEAM_ORDER';
  /** How long it lasts. A FAULT without it lasts to the flag (or its car's next stop). */
  laps?: number;
  /** A TEAM_ORDER: the car told to let `other` by (scripted.ts). */
  driver?: string;
  /** A TEAM_ORDER (Eras builds; sourced in data/incidents.json): the car let by. */
  other?: string;
  /** A RED event: how the race resumed (eras build plan 4.3, redflag.ts). Absent: it didn't. */
  restart?: 'standing' | 'rolling';
  /** Defines the storyline: Legend difficulty always runs it on its real lap (eras spec 8). */
  storylineEvent?: boolean;
  /** A FAULT (driver required): its kind. */
  fault?: FaultKind;
  /** A FAULT: seconds a green lap the car loses while it lasts (fitted from its real laps). */
  paceLoss?: number;
  /** A FAULT: extra seconds on the fault's own lap (a puncture's forced slow lap). */
  slowLap?: number;
  /** A FAULT that lasts until the car's next stop (new tyres fix a puncture). */
  untilStop?: boolean;
}

// Eras mode (eras spec sections 6, 8 and 11; schema v11). Types and validation only: the
// evaluator is eras build plan 1.4, the rules' behaviour 4.1 / 4.2.

/** The six star 1 target types (eras spec 6). */
export const ERAS_TARGET_TYPES = [
  'win',
  'defend',
  'position',
  'beat-rival',
  'team',
  'deny',
] as const;
export type ErasTargetType = (typeof ERAS_TARGET_TYPES)[number];

/**
 * A result condition from the player's side: the star 1 target, and the storyline's rewrite
 * condition. `position`: P`position` or better. `deny`: the rival finishes P`position` or worse
 * (or doesn't finish). `team`: positions[0] is the player's car, positions[1] its teammate,
 * each at or better. `defend` is `win` from P1, framed as a defence.
 */
export type ErasTarget =
  | { type: 'win' }
  | { type: 'defend' }
  | { type: 'position'; position: number }
  | { type: 'beat-rival'; rival: string }
  | { type: 'team'; positions: [number, number] }
  | { type: 'deny'; rival: string; position: number };

/** The eight mastery / hidden objective types (eras spec 6). */
export const ERAS_OBJECTIVE_TYPES = [
  'stop_count',
  'beat_real_call',
  'finish_position',
  'margin',
  'compound_rule',
  'mode_rule',
  'no_neutralized_stop',
  'team_result',
] as const;
export type ErasObjectiveType = (typeof ERAS_OBJECTIVE_TYPES)[number];

/** Every mode value (each names its Modes key): what a `mode_rule` limits. */
export type ModeValue = Modes[keyof Modes];
export const MODE_VALUES: readonly ModeValue[] = [
  'push',
  'standard',
  'manage',
  'normal',
  'liftAndCoast',
  'attack',
  'hold',
  'defend',
  'harvest',
  'balanced',
  'deploy',
  'overtake',
];

/** A mastery or hidden objective, with the label the UI shows. */
export type ErasObjective = { label: string } & (
  | { type: 'stop_count'; max: number; exact?: never }
  | { type: 'stop_count'; exact: number; max?: never }
  | { type: 'beat_real_call' }
  | { type: 'finish_position'; position: number }
  | { type: 'margin'; seconds: number }
  | { type: 'compound_rule'; mustUse: Compound; mustAvoid?: Compound }
  | { type: 'compound_rule'; mustUse?: Compound; mustAvoid: Compound }
  | { type: 'mode_rule'; mode: ModeValue; maxLaps: number }
  | { type: 'no_neutralized_stop' }
  | { type: 'team_result'; positions: [number, number] }
);

export interface ErasStoryline {
  /** What really happened. */
  real: string;
  /** The result that rewrites the storyline, from the player's side. */
  rewriteCondition: ErasTarget;
  /** An original history-book headline (never quoted team radio). */
  headline: string;
}

/**
 * The race's Eras block. Only `eraId` and `order` are required, so a race can join an era
 * before its content is written; the content checklist (spec 15) requires the rest.
 */
export interface ErasBlock {
  /** The era, 1 (turbo era) to 10 (ground effect): not the play order. */
  eraId: number;
  /** The race's number within its era, 1-10. */
  order: number;
  /** The driver the player runs in Eras (more hard calls). Absent: the top-level userSide. */
  userSide?: string;
  target?: ErasTarget;
  storyline?: ErasStoryline;
  mastery?: ErasObjective;
  hidden?: ErasObjective;
  /** Hard calls per storyline driver (driver code -> count; `pipeline hard-calls`). */
  hardCalls?: Record<string, number>;
  /** The short era-appropriate intro shown before the race. */
  briefing?: string;
  /**
   * Avoidable storyline retirements (owner decision, Nov 8 2026; scripted.ts): the player's
   * car retires on its real lap only if the player repeats the real call. Scripted cars keep
   * their real retirements.
   */
  storylineRetirements?: StorylineRetirement[];
}

/**
 * The real call behind a storyline retirement (scripted.ts conditionMet). `mode`: the
 * standing mode `key` was `value` on every lap from `fromLap` to the retirement lap (Monaco
 * 1988: still pushing). `tyre_age`: the car started the retirement lap on tyres at least
 * `minLaps` old (Australia 1986: the original set). `pressure`: `driver` started the lap behind
 * the player's car, within `seconds` (Australia 1994: Hill catching). `fuel`: the fuel model
 * decides (the frozen retirement is dropped; the car stops if its tank runs dry).
 */
export type StorylineCondition =
  | { type: 'mode'; key: keyof Modes; value: ModeValue; fromLap: number }
  | { type: 'tyre_age'; minLaps: number }
  | { type: 'pressure'; driver: string; seconds: number }
  | { type: 'fuel' };

export interface StorylineRetirement {
  /** The storyline driver: conditional only when he is the player's car. */
  driver: string;
  condition: StorylineCondition;
  /** Other cars whose real retirement is the same incident (a collision): they retire with
   * the player's car, or not at all. */
  alsoRetires?: string[];
  /** What really happened, in words. */
  real: string;
  /** Where the fact and the call were checked (http(s) URLs, '; '-separated). */
  source: string;
}

/** The SC restart (track.restart; pipeline restart.py): the restart lap's extra time for the
 * car k places behind the leader is jump + spread x min(k, places). */
export interface RestartModel {
  jump: number;
  spread: number;
  places: number;
}

/** Fields estimated rather than measured (eras build plan 2.4). */
export const ESTIMATED_FIELDS = ['compounds', 'safetyCars', 'fuelLoads', 'weather'] as const;
export type EstimatedField = (typeof ESTIMATED_FIELDS)[number];

/** Where the race's data came from. Absent: real, nothing estimated. */
export interface Provenance {
  kind: 'real' | 'reconstructed';
  estimated?: EstimatedField[];
}

/**
 * The race's sporting rules (roadmap R5). An absent field keeps today's behaviour (the
 * defaults below); `drs` and `ers` default to the era's headset.json block.
 */
export interface RaceRules {
  /** A dry race must use two dry compounds (2007+). Default true. */
  twoCompound?: boolean;
  /** False: a stop only refuels (2005). Default true. */
  tyreChanges?: boolean;
  /**
   * The fewest pit stops a car must make in the race (Monaco 2025: 2); a car that reaches the
   * flag with fewer is disqualified, like the two-compound rule (wet tyres waive it). Absent:
   * no minimum.
   */
  minStops?: number;
  /** Stops refuel (1994-2009, 1983). Default false. */
  refuelling?: boolean;
  /** The fixed race fuel allowance in kg (1984-88); not with refuelling. Absent: no cap. */
  fuelLimit?: number;
  /** The pit lane closes when the SC is called; a stop takes a penalty (2007-09). Default false. */
  pitLaneClosedUnderSC?: boolean;
  /** A virtual safety car exists (2015+). Default true. */
  vsc?: boolean;
  /** DRS and the wait-drs move. Absent: the era block's `drs`. */
  drs?: boolean;
  /** The battery: none, KERS (2009, 2011-13) or hybrid ERS (2014+). Absent: the era block's. */
  ers?: 'none' | 'kers' | 'hybrid';
}

// Parsed + validated race JSON (validated at load time with zod or ajv).
export interface RaceModel {
  /** The version written; every version is additive, so any up to SCHEMA_VERSION loads. */
  schemaVersion: number;
  race: {
    id: string;
    name?: string;
    laps: number;
    takeoverLap: number;
    seed: number;
    /** Which lapped cars unlap before a SC restart: all (the rule, default), only those
     * between userSide and rival (Abu Dhabi 2021's race-control call), or none (lapped cars
     * stay a lap down: before 2007 and 2010-11; rules.ts scQueue). */
    scUnlap?: 'all' | 'duel' | 'none';
  };
  era: Era;
  track: {
    pitLoss: number;
    pitLossUnderSC: number;
    pitLossUnderVSC: number;
    /** Measured green-stop losses minus pitLoss: new stops sample from these (spec B1). */
    pitLossDeviations?: number[];
    overtakeDifficulty: number;
    /**
     * P(pass) = sigmoid(intercept + paceCoef * paceAdvantage + gapCoef * gap). An Eras build's
     * model (pipeline overtaking.py: pooled slopes per era group, intercept per track layout)
     * adds trainCoef when the car ahead started the lap within TRAIN_GAP of its own car ahead.
     */
    overtakeModel: { intercept: number; paceCoef: number; gapCoef: number; trainCoef?: number };
    dirtyAirPenalty: number;
    greenLapTime?: number;
    scLapTime?: number;
    vscLapTime?: number;
    /** A refuelling race's fill model, fitted from the real stops (eras build plan 4.2;
     * refuel.ts). Absent: the physical prior (0.25 s per lap of fuel). */
    refuel?: RefuelModel;
    /** The SC restart's leader jump and field spread (Eras builds; scripted.ts). Absent: a
     * restart lap is an ordinary green lap. */
    restart?: RestartModel;
  };
  compounds: Record<Compound, CompoundModel>;
  drivers: DriverModel[];
  /** A wet race (weather spec): the curves and the track's wetness on each lap. */
  weather?: Weather;
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
  /** Hand-built without official lap timing; agrees with `provenance.kind` when both are set. */
  reconstructed?: boolean;
  /** Eras mode (eras spec 11); Daily and Gauntlet ignore it. */
  eras?: ErasBlock;
  provenance?: Provenance;
  rules?: RaceRules;
}

/**
 * A refuelling race's fill model (eras build plan 4.2), fitted per race by
 * pipeline/src/pipeline/refuel.py from the real stops: pit-lane time = laneBase +
 * secondsPerLap x the laps of fuel put in (the next stint's length). Fuel is counted in laps
 * at the standard burn.
 */
export interface RefuelModel {
  /** Fill time per lap of fuel added (s). */
  secondsPerLap: number;
  /** The fitted pit-lane time of a stop that adds no fuel (s); informative. */
  laneBase: number;
  /** The mean fill of the real stops (laps): what the track's pitLoss figures already hold. */
  refFill: number;
  /** The longest real stint (laps): the tank's capacity, less the reserve. */
  tankLaps: number;
  /** Real stops in the fit. */
  stops: number;
}

/** The player's fill at a refuelling stop (refuel.ts fillStint has the definitions). */
export type FillChoice = 'short' | 'standard' | 'long';

/**
 * A stop's fill in a refuelling race (refuel.ts): one of the player's three choices, or an
 * exact number of laps of fuel from the out-lap (the reserve goes on top). The real team's
 * calls (realDecisions) and the engineer's plans carry exact laps: the real next stint, or the
 * plan's. In a refuelling race every pit call must carry one (owner decision, Nov 7 2026).
 */
export type Fill = FillChoice | { laps: number };

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
  /** A stop forced by a damaged tyre (a puncture): it fits new tyres even when a race allows
   * no tyre changes (rules.tyreChanges false, eras build plan 4.1). */
  damaged?: boolean;
  /** A refuelling race: the stop's fill (refuel.ts; every pit call's carries one). Absent:
   * fuel for the next planned stint, as every scripted car (the real fill, for a real stop). */
  fill?: Fill;
}

export interface CarState {
  code: string;
  team: string;
  basePace: number;
  noise: number;
  /** A wet race: the driver's extra share of a lap in the wet (DriverModel.wetPace). */
  wetPace?: number;
  /** An Eras build: its share on a damp track (DriverModel.dampPace). */
  dampPace?: number;
  /** Pace by stint: the offset of the stint the car is on (DriverModel.stintPace; 0 if none). */
  stintPace?: number;
  compound: Compound;
  /** Laps on the current tyres (what the timing tower shows). */
  tyreAge: number;
  /** Effective wear in laps: advances by the headset wear multiplier each green lap. */
  tyreWear: number;
  /** Compounds run so far, wet tyres and the takeover tyre included (two-compound rule). */
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
  /** Fuel in the tank, kg (the player's car in live play only; fuel load spec). */
  fuel?: number;
  /** A stop-go penalty owed (s), for entering a closed pit lane (rules.pitLaneClosedUnderSC). */
  stopGo?: number;
  /** Pit stops made so far, takeover included (rules.minStops; set only in a race with it). */
  stops?: number;
  /** A refuelling race (refuel.ts): fuel on board, in laps at the standard burn (every car). */
  tank?: number;
  /** The tank burns by the modes and an empty one stops the car: the player's car in live
   * play with incidents (off in replays and the grader's playouts). */
  tankLive?: boolean;
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
export type TeamOrder =
  | 'letTeammatePast'
  | 'teammateLetsYouPast'
  | 'holdUp'
  | 'release'
  /** Obey a scripted team order telling the player's car to let a car by (TEAM_ORDER). */
  | 'comply';

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
  | { lap: number; kind: 'pit'; compound: Compound; fill?: Fill }
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
  /**
   * The race plan picked at takeover (strategy planner spec): graded, but it makes no calls
   * itself; the game logs the plan's pit and pace calls as their laps come.
   */
  | ({ lap: number; kind: 'plan' } & RacePlan)
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
    // A scripted team order or let-by (TEAM_ORDER): driver the car let by, detail the yielder.
    | 'team-order'
    // An avoidable storyline retirement (eras.storylineRetirements): detail 'retired' (the
    // player repeated the real call) or 'avoided'.
    | 'storyline'
    | 'incident'
    // Race engineer spec (the user's car, live play):
    | 'battle' // detail: 'passed' | 'held' | 'lost' | 'stuck' (other: the car fought)
    | 'contact' // detail: 'wing' | 'puncture' | 'spin'
    | 'strike' // track limits; value: the strike count
    | 'penalty' // value: seconds added at the flag
    | 'nose' // a stop fixed the front wing
    | 'blue' // went round a lapped car; value: the time it gained (negative)
    | 'trust' // value: the change; detail: why (TrustReason)
    | 'rogue' // a furious driver picks his own battle move (detail: the move)
    | 'fuel' // fuel load spec: detail 'empty' (the tank ran dry); 'out' (the car stopped:
    // a refuelling or fuel-limit race, eras build plan 4.2); 'fill' (value: laps put in)
    | 'stop-go' // era rules: a closed pit lane's penalty; detail 'owed' | 'served', value: s
    | 'fault'; // a car fault struck (faults.ts); detail: its kind
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
