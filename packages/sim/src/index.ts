// @boxthislap/sim — public surface of the deterministic race simulator.
// Phase 2 fills in the lap loop, overtakes, rival policy, headset effects and grader.

export * from './types.js';
export { mulberry32, deriveSeed } from './rng.js';
export type { Rng } from './rng.js';

import type { Decision, RaceModel, RaceState } from './types.js';

/** Build the initial race state at the takeover lap from a race model. (Phase 2.3) */
export function initState(_model: RaceModel): RaceState {
  throw new Error('not implemented: Phase 2.3 initState');
}

/** Advance the race by one lap, applying events, pace, pit stops and overtakes. (Phase 2.3) */
export function stepLap(_model: RaceModel, _state: RaceState, _decisions: Decision[]): RaceState {
  throw new Error('not implemented: Phase 2.3 stepLap');
}
