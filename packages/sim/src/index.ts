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
export * from './eras/config.js';
