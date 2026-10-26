// @boxthislap/sim — public surface of the deterministic race simulator.

export * from './types.js';
export { mulberry32, deriveSeed } from './rng.js';
export type { Rng } from './rng.js';
export {
  DEFAULT_MODES,
  classify,
  cleanLap,
  DRY_COMPOUNDS,
  decide,
  forkRun,
  initRun,
  isFinished,
  passProbability,
  planRemainingStop,
  realDecisions,
  ruleSatisfied,
  simulate,
  stepLap,
  teammateOf,
  validateDecisions,
} from './sim.js';
export type { Run, RunOptions, Strategies } from './sim.js';
export {
  BAND_EDGES,
  GRADE_SAMPLES,
  bandFor,
  gradeMoment,
  playOption,
  reachedTarget,
  realOption,
  sampleSeed,
} from './grade.js';
export type { Band, GradeOption, MomentGrade, OptionGrade, Target } from './grade.js';
