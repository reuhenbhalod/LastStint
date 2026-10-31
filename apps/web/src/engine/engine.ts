// GameEngine: a thin, UI-facing wrapper over a sim Run. It owns the run, advances it lap by
// lap, applies player calls, and reports the result. It holds no race physics of its own —
// everything delegates to @boxthislap/sim, so the browser shows exactly what the Worker will
// later recompute from the same (model, seed, decisions).

import {
  type Decision,
  type DecisionMoment,
  type RaceModel,
  type RaceResult,
  type RaceState,
  type Run,
  type RunOptions,
  type Target,
  candidateMoments,
  classify,
  decide,
  initRun,
  isFinished,
  stepLap,
} from '@boxthislap/sim';

export class GameEngine {
  private readonly run: Run;

  /**
   * Pass `{ decisions: [] }` for a player-controlled race (the user's car and the rival go
   * live); omit options to replay the scripted real strategies (matches `simulate`).
   */
  constructor(model: RaceModel, seed: number, options: RunOptions = {}) {
    this.run = initRun(model, seed, options);
  }

  get state(): RaceState {
    return this.run.state;
  }

  /** Last completed lap (the takeover lap before the first step). */
  get lap(): number {
    return this.run.state.lap;
  }

  /** The player's calls so far — the run log the Worker replays. */
  get decisions(): Decision[] {
    return this.run.decisions;
  }

  isFinished(): boolean {
    return isFinished(this.run);
  }

  /** Record a player call (BOX, a mode flip, a radio answer) on the current lap. */
  apply(decision: Decision): void {
    decide(this.run, decision);
  }

  /** Advance one lap; returns the new race state. */
  step(): RaceState {
    return stepLap(this.run);
  }

  /** Play straight to the flag (used for grading-free fast-forward and tests). */
  runToFlag(): RaceResult {
    while (!isFinished(this.run)) stepLap(this.run);
    return classify(this.run);
  }

  result(): RaceResult {
    return classify(this.run);
  }
}

/** The decision moments for a race, derived from the model by the simulator. */
export function decisionMoments(model: RaceModel, target?: Target): DecisionMoment[] {
  return candidateMoments(model, target);
}
