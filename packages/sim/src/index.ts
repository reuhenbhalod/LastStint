// @boxthislap/sim — public surface of the deterministic race simulator.

export * from './types.js';
export { mulberry32, deriveSeed } from './rng.js';
export type { Rng } from './rng.js';
export {
  classify,
  cleanLap,
  initRun,
  isFinished,
  passProbability,
  simulate,
  stepLap,
} from './sim.js';
export type { Run, Strategies } from './sim.js';
