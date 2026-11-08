// @laststint/sim — public surface of the deterministic race simulator.

export * from './types.js';
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
  isFinished,
  modeEffects,
  passProbability,
  planRemainingStop,
  planRemainingStops,
  realDecisions,
  readMove,
  redFlagFree,
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
  boxCall,
  candidateMoments,
  legendMoments,
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
export { PLAN_TARGET, enginePlans, fuelled, planOption } from './planner.js';
export type {
  ClaimedGrade,
  RealCall,
  ReplayOptions,
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
export * from './eras/config.js';
export * from './eras/evaluate.js';
export * from './eras/race-log.js';
export {
  LEGEND_STREAM,
  circuitFor,
  drawnEvents,
  isKept,
  legendEvents,
  legendLoss,
  legendRates,
  parseRaceId,
  realFlags,
  removedEvents,
} from './legend.js';
export type { LegendRates, ScRates } from './legend.js';
export {
  PIT_CLOSED_SC_LAPS,
  SAFETY_CAR_FROM,
  STOP_GO_SECONDS,
  allowedFlag,
  hasMove,
  illegalPitCompound,
  minStopsRule,
  pitLaneClosed,
  raceYear,
  resolveRules,
  safetyCarRule,
  scQueue,
  stopChangesTyres,
  stopGoCost,
  stopsBeforeTakeover,
  stopsOwed,
  twoCompoundRule,
} from './rules.js';
export type { ResolvedRules } from './rules.js';
export { FAULT_KINDS, faultCost, faultTable, faultsOf } from './faults.js';
export type { FaultCost, FaultEntry, FaultTable } from './faults.js';
export {
  COVER_WINDOWS,
  DEFAULT_RIVAL_POLICY,
  EXPERT_SAMPLES,
  RIVAL_POLICY_NAMES,
  RivalPolicyError,
  coverWindow,
  hasSmartRules,
  playoutPolicy,
  resolveRivalPolicy,
} from './rivals/policy.js';
export {
  RIVAL_OPTION_IDS,
  boxNowCompound,
  decisionReasons,
  latestStop,
  overcutLap,
  planTime,
  rivalOptions,
  sameLapCover,
  wetSwitch,
} from './rivals/rules.js';
export type {
  KnownFlags,
  RivalDecisionReason,
  RivalOptionId,
  RivalPlanOption,
} from './rivals/rules.js';
export { wetCrossover } from './rivals/wet.js';
export {
  RivalClaimError,
  parseRivalChoices,
  resolveRivalDecision,
  rivalChoices,
} from './rivals/react.js';
export type {
  RivalChoice,
  RivalClaimErrorCode,
  RivalGrading,
  RivalPoint,
  RivalRunState,
} from './rivals/react.js';
export {
  RIVAL_GRADE_STREAM,
  countRivalHits,
  gradeRivalMoment,
  mergeRivalGradeJobs,
  rivalAhead,
  rivalGradeJob,
  rivalPlayout,
  rivalSampleSeed,
  runRivalGradeJob,
} from './rivals/expert.js';
export type { RivalGrade, RivalGradeJob, RivalOption } from './rivals/expert.js';
export { regradeRivalPoints, replayWithRivalClaims } from './rivals/claims.js';
export type { RivalClaimReplay, RivalRegrade } from './rivals/claims.js';
export { RESTART_QUEUE_GAP, STANDING_RESTART_GAP, redFlagPlan } from './redflag.js';
export type { RedFlagPlan } from './redflag.js';
// Refuelling and fuel limits (eras build plan 4.2): the fill choice and the tank reading for
// the fuel UI (build plan 8.5), and the fill every pit call in a refuelling race carries.
// Fill, FillChoice and RefuelModel are in types.ts.
export {
  FILL_CHOICES,
  RESERVE_LAPS,
  checkFill,
  fillCap,
  fillLaps,
  fillOptions,
  fillStint,
  fuelLimit,
  limitBurnPerLap,
  refuelModel,
  realFill,
  refuelling,
  tankReading,
  validFill,
} from './refuel.js';
export type { TankReading } from './refuel.js';
// Eras model fixes M4 (scripted.ts): the SC restart, scripted team orders and let-bys, and
// avoidable storyline retirements. RestartModel, StorylineCondition and StorylineRetirement are
// in types.ts.
export {
  TEAM_ORDER_GAP,
  TEAM_ORDER_LAPS,
  TEAM_ORDER_WINDOW,
  conditionMet,
  isRestartLap,
  restartExtra,
  storylineFor,
  teamOrdersOf,
  userOrdersOn,
} from './scripted.js';
export type { StorylineLap, TeamOrderState } from './scripted.js';
