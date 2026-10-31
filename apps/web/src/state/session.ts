// GameSession: the headless driver that connects the mutable sim engine to the pure state
// machine. It decides when to pause (at the sim's decision moments), advances the engine lap
// by lap, applies the player's calls, and serialises/resumes a run. The React layer (3.3)
// drives the same reducer with the engine in a ref; this class is its testable twin.

import type { Decision, DecisionMoment, RaceState } from '@boxthislap/sim';
import type { Daily } from '../data/types.js';
import { GameEngine, decisionMoments } from '../engine/engine.js';
import {
  type Action,
  type GameMeta,
  type GameState,
  type Phase,
  type Speed,
  reducer,
} from './machine.js';

export interface PersistedRun {
  date: string;
  raceId: string;
  seed: number;
  speed: Speed;
  phase: Phase;
  lap: number;
  decisions: Decision[];
  resolved: string[];
}

function metaOf(daily: Daily): GameMeta {
  const m = daily.model;
  return {
    raceId: m.race.id,
    date: daily.date,
    totalLaps: m.race.laps,
    takeoverLap: m.race.takeoverLap,
    userSide: m.userSide,
    rival: m.rival,
  };
}

/** The unresolved moment to pause at from a given lap: the game pauses after lap - 1. */
function momentAt(
  moments: DecisionMoment[],
  lap: number,
  resolved: string[],
): DecisionMoment | null {
  return moments.find((m) => m.lap === lap + 1 && !resolved.includes(m.id)) ?? null;
}

export class GameSession {
  private readonly engine: GameEngine;
  private readonly daily: Daily;
  state: GameState;

  constructor(daily: Daily, engine?: GameEngine, state?: GameState) {
    this.daily = daily;
    this.engine = engine ?? new GameEngine(daily.model, daily.seed, { decisions: [] });
    this.state = state ?? {
      phase: 'intro',
      speed: 1,
      race: this.engine.state,
      moments: decisionMoments(daily.model),
      currentMoment: null,
      resolved: [],
      decisions: this.engine.decisions,
      result: null,
      meta: metaOf(daily),
    };
  }

  private dispatch(action: Action): void {
    this.state = reducer(this.state, action);
  }

  /** Recompute the phase from the engine's current lap (pause / keep racing / finish). */
  private sync(): void {
    const finished = this.engine.isFinished();
    const moment = finished
      ? null
      : momentAt(this.state.moments, this.engine.lap, this.state.resolved);
    const result = finished ? this.engine.result() : null;
    this.dispatch({ type: 'SYNC', race: this.engine.state, moment, finished, result });
  }

  start(): void {
    this.dispatch({ type: 'START' });
    this.sync(); // pause immediately if a moment sits at takeoverLap + 1
  }

  /** Advance one lap (no-op unless racing), then settle the phase. */
  tick(): void {
    if (this.state.phase !== 'racing') return;
    this.engine.step();
    this.sync();
  }

  /** Answer the current decision moment with one of its options, then resume. */
  choose(optionId: string): void {
    const moment = this.state.currentMoment;
    if (this.state.phase !== 'decision' || !moment) return;
    const option = moment.options.find((o) => o.id === optionId);
    if (!option) throw new Error(`unknown option '${optionId}' for moment '${moment.id}'`);
    for (const decision of option.decisions) this.engine.apply(decision);
    this.dispatch({ type: 'RESOLVE', momentId: moment.id, decisions: this.engine.decisions });
    this.sync();
  }

  /** A standing-mode flip or BOX call mid-lap; never pauses. */
  call(decision: Decision): void {
    if (this.state.phase !== 'racing') return;
    this.engine.apply(decision);
    this.dispatch({ type: 'CALL', race: this.engine.state, decisions: this.engine.decisions });
  }

  setSpeed(speed: Speed): void {
    this.dispatch({ type: 'SET_SPEED', speed });
  }

  submit(): void {
    if (this.state.phase !== 'finished') return;
    this.dispatch({ type: 'SUBMIT' });
    this.dispatch({ type: 'RESULT', result: this.engine.result() });
  }

  /** Serialisable run: a run is fully defined by (model, seed, decisions); lap/phase let
   * resume land back on the exact same frame. */
  persist(): PersistedRun {
    return {
      date: this.daily.date,
      raceId: this.state.meta.raceId,
      seed: this.daily.seed,
      speed: this.state.speed,
      phase: this.state.phase,
      lap: this.engine.lap,
      decisions: this.engine.decisions,
      resolved: this.state.resolved,
    };
  }

  /** Rebuild a session from a saved run by replaying its decisions to the saved lap. Returns
   * null if the save is for a different race/day. Deterministic, so it lands exactly. */
  static restore(daily: Daily, saved: PersistedRun): GameSession | null {
    if (saved.raceId !== daily.model.race.id || saved.date !== daily.date) return null;
    const engine = new GameEngine(daily.model, daily.seed, { decisions: saved.decisions });
    while (engine.lap < saved.lap && !engine.isFinished()) engine.step();

    const moments = decisionMoments(daily.model);
    const finished = engine.isFinished();
    const state: GameState = {
      phase: saved.phase,
      speed: saved.speed,
      race: engine.state as RaceState,
      moments,
      currentMoment:
        saved.phase === 'decision' ? momentAt(moments, engine.lap, saved.resolved) : null,
      resolved: saved.resolved,
      decisions: engine.decisions,
      result: finished ? engine.result() : null,
      meta: metaOf(daily),
    };
    return new GameSession(daily, engine, state);
  }
}
