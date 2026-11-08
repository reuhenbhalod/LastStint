// The Daily Race state machine (pure). The reducer only maps actions to the next phase and
// snapshot fields; it runs no sim and holds no engine. The GameSession driver owns the
// mutable sim Run, computes each action's payload (stepped race state, which moment to pause
// at, the result), and dispatches here. Keeping it pure makes every transition unit-testable.
//
//   intro → planning → racing ⇄ decision → finished → submitting → results
//
// (loading lives in the React layer, while the daily is being fetched.)

import type {
  Decision,
  DecisionMoment,
  PlanId,
  RacePlan,
  RaceResult,
  RaceState,
} from '@laststint/sim';
import type { RunResponse } from '../data/api.js';
import type { RaceSource } from '../data/types.js';
import type { GradedMoment } from '../engine/grading.js';
import type { AttemptResult } from '../eras/api.js';

export type Phase =
  | 'intro'
  | 'planning'
  | 'racing'
  | 'decision'
  | 'finished'
  | 'submitting'
  | 'results';

/** A plan's chance of beating the rival, as graded playouts: hits out of samples. */
export interface PlanChance {
  hits: number;
  samples: number;
}

/** The race plan (docs/strategy-planner-spec.md). */
export interface PlanState {
  /** The engineer's plans at takeover. */
  offered: RacePlan[];
  /** Each plan's chance at takeover, by id, as grading finishes ('own': the player's plan). */
  chances: Partial<Record<PlanId, PlanChance>>;
  /** The player's own plan, once built. */
  own: RacePlan | null;
  /** The plan picked at takeover (graded; logged as the run's plan call). */
  picked: RacePlan | null;
  /** The plan the car runs to now: the picked one, as changed during the race (not graded). */
  active: RacePlan | null;
  /** The latest re-rank during the race: your plan's chance and the engineer's best now. */
  live: { lap: number; mine: number; best: { plan: RacePlan; chance: number } | null } | null;
}

export type Speed = 1 | 2;

/**
 * The run's submission: `practice` (not submitted), `sending`, `done` (the server's numbers),
 * `already` (this player already played today; `response` is that run), or `error` (`retry`
 * false: submitting again can't help). An Eras attempt (eras/submit.ts) starts `eras` (not
 * sent yet), and ends `eras-done` (the server's stars and accuracy) or `eras-held` (the server
 * kept the calls but can't evaluate them now: `message` says why).
 */
export type Submission =
  | { status: 'none' }
  | { status: 'practice' }
  | { status: 'eras' }
  | { status: 'sending' }
  | { status: 'done' | 'already'; response: RunResponse }
  | { status: 'eras-done'; result: AttemptResult }
  | { status: 'eras-held'; message: string }
  | { status: 'error'; error: string; retry?: boolean };

/** A new run's submission: a live daily waits to be sent; an Eras attempt is its own. */
export function initialSubmission(source: RaceSource): Submission {
  if (source === 'live') return { status: 'none' };
  if (source === 'eras') return { status: 'eras' };
  return { status: 'practice' };
}

/**
 * What submitting a finished run does, by its source: `post` it as a daily or survivor run,
 * keep it on this device (`practice`), or hand it to the Eras attempt (`eras`, build plan 8.7).
 */
export function submitRoute(source: RaceSource): 'post' | 'practice' | 'eras' {
  if (source === 'practice') return 'practice';
  if (source === 'eras') return 'eras';
  return 'post';
}

/** A radio message from the driver: a "copy" or a refused call (feedback spec D1). */
export interface RadioMessage {
  /** The lap it was said on (the lap being run). */
  lap: number;
  from: string;
  text: string;
  refused: boolean;
}

export interface GameMeta {
  raceId: string;
  /** Puzzle number, for the share line (live dailies only). */
  number?: number;
  /** A live daily is submitted and ranked; practice is played locally only. */
  source: RaceSource;
  practiceReason?: string;
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
  /** Each moment's grade and claim, by moment id, as grading finishes. */
  grades: Record<string, GradedMoment>;
  submission: Submission;
  meta: GameMeta;
  /** The driver's radio replies to live calls, newest last (not persisted). */
  radio: RadioMessage[];
  plan: PlanState;
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
  | { type: 'RADIO'; message: RadioMessage }
  | { type: 'GRADED'; momentId: string; graded: GradedMoment }
  /** The plan changed; `go` also starts the race (the plan was picked). */
  | { type: 'PLAN'; plan: PlanState; go?: boolean }
  | { type: 'SUBMIT' }
  | { type: 'RESULT'; result: RaceResult; submission: Submission }
  | { type: 'ALREADY_PLAYED'; response: RunResponse }
  | { type: 'HYDRATE'; state: GameState };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return state.phase === 'intro' ? { ...state, phase: 'planning' } : state;

    case 'PLAN':
      return {
        ...state,
        plan: action.plan,
        ...(action.go && state.phase === 'planning' ? { phase: 'racing' as const } : {}),
      };

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

    case 'CALL': // a BOX / mode flip mid-lap, never pauses
      if (state.phase !== 'racing') return state;
      return { ...state, race: action.race, decisions: action.decisions };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'RADIO':
      return { ...state, radio: [...state.radio, action.message].slice(-12) };

    case 'GRADED': // grading finishes in a worker, whatever the phase
      return { ...state, grades: { ...state.grades, [action.momentId]: action.graded } };

    case 'SUBMIT':
      return state.phase === 'finished' ||
        (state.phase === 'results' &&
          state.submission.status === 'error' &&
          state.submission.retry !== false)
        ? { ...state, phase: 'submitting', submission: { status: 'sending' } }
        : state;

    case 'RESULT':
      return state.phase === 'submitting'
        ? { ...state, phase: 'results', result: action.result, submission: action.submission }
        : state;

    case 'ALREADY_PLAYED': // today's run was submitted before (another tab or device)
      return {
        ...state,
        phase: 'results',
        submission: { status: 'already', response: action.response },
      };

    case 'HYDRATE':
      return action.state;

    default:
      return state;
  }
}
