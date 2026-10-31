// The Daily Race state machine (pure). The reducer only maps actions to the next phase and
// snapshot fields; it runs no sim and holds no engine. The GameSession driver owns the
// mutable sim Run, computes each action's payload (stepped race state, which moment to pause
// at, the result), and dispatches here. Keeping it pure makes every transition unit-testable.
//
//   intro → racing ⇄ decision → finished → submitting → results
//
// (loading lives in the React layer, while the daily is being fetched.)

import type { Decision, DecisionMoment, RaceResult, RaceState } from '@boxthislap/sim';

export type Phase = 'intro' | 'racing' | 'decision' | 'finished' | 'submitting' | 'results';

export type Speed = 1 | 2;

export interface GameMeta {
  raceId: string;
  date: string;
  totalLaps: number;
  takeoverLap: number;
  userSide: string;
  rival: string;
}

export interface GameState {
  phase: Phase;
  speed: Speed;
  /** Latest sim snapshot (lap, flag, order, cars) for rendering. */
  race: RaceState;
  /** All decision moments for this race (derived from the model by the sim). */
  moments: DecisionMoment[];
  /** The moment the clock is paused at, or null. */
  currentMoment: DecisionMoment | null;
  /** Ids of moments already answered (so the loop doesn't re-pause on them). */
  resolved: string[];
  /** The player's run log so far (what the Worker replays). */
  decisions: Decision[];
  /** Final classification, set once the race finishes. */
  result: RaceResult | null;
  meta: GameMeta;
}

export type Action =
  | { type: 'START' }
  | {
      type: 'SYNC';
      race: RaceState;
      moment: DecisionMoment | null;
      finished: boolean;
      result: RaceResult | null;
    }
  | { type: 'RESOLVE'; momentId: string; decisions: Decision[] }
  | { type: 'CALL'; race: RaceState; decisions: Decision[] }
  | { type: 'SET_SPEED'; speed: Speed }
  | { type: 'SUBMIT' }
  | { type: 'RESULT'; result: RaceResult }
  | { type: 'HYDRATE'; state: GameState };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return state.phase === 'intro' ? { ...state, phase: 'racing' } : state;

    case 'SYNC': {
      // Only the running phases resolve to a new phase from a step.
      if (state.phase !== 'racing' && state.phase !== 'decision') return state;
      if (action.finished) {
        return {
          ...state,
          phase: 'finished',
          race: action.race,
          currentMoment: null,
          result: action.result,
        };
      }
      if (action.moment) {
        return { ...state, phase: 'decision', race: action.race, currentMoment: action.moment };
      }
      return { ...state, phase: 'racing', race: action.race, currentMoment: null };
    }

    case 'RESOLVE':
      // A moment was answered: mark it resolved and record the calls; a SYNC follows.
      if (state.phase !== 'decision') return state;
      return {
        ...state,
        resolved: state.resolved.includes(action.momentId)
          ? state.resolved
          : [...state.resolved, action.momentId],
        decisions: action.decisions,
      };

    case 'CALL': // a BOX / mode flip mid-lap — never pauses
      if (state.phase !== 'racing') return state;
      return { ...state, race: action.race, decisions: action.decisions };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'SUBMIT':
      return state.phase === 'finished' ? { ...state, phase: 'submitting' } : state;

    case 'RESULT':
      return state.phase === 'submitting'
        ? { ...state, phase: 'results', result: action.result }
        : state;

    case 'HYDRATE':
      return action.state;

    default:
      return state;
  }
}
