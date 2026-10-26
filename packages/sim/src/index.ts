// @boxthislap/sim — public surface of the deterministic race simulator.

export * from './types.js';
export { mulberry32, deriveSeed } from './rng.js';
export type { Rng } from './rng.js';
export {
  DEFAULT_MODES,
  classify,
  cleanLap,
  decide,
  forkRun,
  initRun,
  isFinished,
  passProbability,
  realDecisions,
  simulate,
  stepLap,
  validateDecisions,
} from './sim.js';
export type { Run, RunOptions, Strategies } from './sim.js';
