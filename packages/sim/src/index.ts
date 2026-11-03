// @boxthislap/sim — public surface of the deterministic race simulator.

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
  initRun,
  isFinished,
  modeEffects,
  passProbability,
  planRemainingStop,
  realDecisions,
  ruleSatisfied,
  simulate,
  stepLap,
  teammateOf,
  validateDecisions,
} from './sim.js';
export type {
  ForkOptions,
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
export { MAX_DECISIONS, VerifyError, answerMoment, claimGrade, verifyRun } from './verify.js';
export type {
  ClaimedGrade,
  RealCall,
  VerifiedMoment,
  VerifiedRun,
  VerifyErrorCode,
} from './verify.js';
