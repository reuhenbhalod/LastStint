// @boxthislap/sim — public surface of the deterministic race simulator.

export * from './types.js';
export {
  AUTO_STAY_LAPS,
  AUTO_STAY_LAPS_NEUTRAL,
  NEAR_DROP_OFF,
  autoStay,
  boxingAt,
} from './autoStay.js';
export { mulberry32, deriveSeed } from './rng.js';
export { battlesFor, isAttack, isDefend, lappedAhead, moodOf, startTrust } from './engineer.js';
export type { EngineerConfig, MoodEffect, MoveEffect } from './engineer.js';
export type { Rng } from './rng.js';
export {
  DEFAULT_MODES,
  classify,
  cleanLap,
  DRY_COMPOUNDS,
  decide,
  engineerConfig,
  forkRun,
  fuelConfig,
  fuelMargin,
  initRun,
  lifeOf,
  isFinished,
  modeEffects,
  passProbability,
  planRemainingStop,
  realDecisions,
  readMove,
  rivalCover,
  ruleSatisfied,
  tyreLife,
  simulate,
  stepLap,
  teammateOf,
  validateDecisions,
} from './sim.js';
export type {
  ForkOptions,
  FuelConfig,
  ModeEffect,
  NeutralEvent,
  Run,
  RunOptions,
  Strategies,
} from './sim.js';
export {
  BAND_EDGES,
  GRADE_SAMPLES,
  bandFor,
  countHits,
  gradeFromHits,
  gradeJob,
  gradeMoment,
  mergeGradeJobs,
  runFromJob,
  runGradeJob,
  playOption,
  reachedTarget,
  realOption,
  sampleSeed,
} from './grade.js';
export type {
  Band,
  CallScore,
  GradeJob,
  GradeJobResult,
  GradeOption,
  MomentGrade,
  OptionGrade,
  RunScore,
  Target,
} from './grade.js';
export { BAND_POINTS, scoreRun } from './grade.js';
export {
  QUALITY,
  candidateMoments,
  pauseAt,
  proposeMoments,
  verdictFor,
} from './moments.js';
export type {
  DecisionMoment,
  MomentOption,
  MomentTrigger,
  ProposedMoment,
  Verdict,
} from './moments.js';
export {
  MAX_DECISIONS,
  PLAN_GRADE_ID,
  VerifyError,
  answerMoment,
  claimGrade,
  claimPlanGrade,
  verifyRun,
} from './verify.js';
export { MAX_PLAN_STOPS, MIN_STINT, PACES, planCalls, stintStarts, validatePlan } from './plan.js';
export { PLAN_TARGET, enginePlans, planOption } from './planner.js';
export type {
  ClaimedGrade,
  RealCall,
  VerifiedMoment,
  VerifiedPlan,
  VerifiedRun,
  VerifyErrorCode,
} from './verify.js';
export {
  WET_OFF_COST,
  WET_TYRES,
  wetCrash,
  wetOff,
  forecastWetness,
  isWetTyre,
  weatherWear,
  wetFactor,
  wetPenalty,
  wetnessOn,
} from './weather.js';
export {
  GRID_GAP,
  STAT_SCALE,
  VERSUS_CARS,
  VERSUS_LAPS,
  VERSUS_TRACKS,
  callVersus,
  classifyVersus,
  initVersus,
  simulateVersus,
  statPace,
  stepVersus,
  versusCar,
  versusFinished,
  versusRuleMet,
  versusTrack,
  versusCallsDue,
  NEUTRAL_CHANCE,
  PIT_WINDOW_NEAR,
  ATTACK_PICKS,
  BATTLE_GAP,
  BOOSTS,
  DEFEND_PICKS,
  DUEL,
  GRADED_KINDS,
  OUT_LAP_COST,
  UNDERCUT_AGE,
  UNDERCUT_GAP,
  autoPick,
  battleDue,
  canBoost,
  undercutEdge,
} from './versus.js';
export type {
  CarStat,
  CarStats,
  PlayerIndex,
  VersusCall,
  VersusCar,
  VersusCarState,
  VersusFlag,
  VersusNote,
  VersusPlayer,
  VersusResult,
  VersusRun,
  VersusSetup,
  VersusState,
  VersusTrack,
  VersusMoment,
  VersusMomentKind,
  AttackPick,
  BattlePick,
  DefendPick,
  GremlinKind,
} from './versus.js';
export {
  VERSUS_GRADE_SAMPLES,
  gradeVersus,
  gradeVersusCall,
  optionCalls,
  validOption,
  versusOptions,
} from './versusGrade.js';
export type { VersusAnswer, VersusScore } from './versusGrade.js';
export { ROOM_CODE } from './versusProtocol.js';
export type {
  ClientMessage,
  RaceSync,
  RoomPhase,
  RoomSeat,
  RoomView,
  ServerMessage,
  VersusOutcome,
} from './versusProtocol.js';
