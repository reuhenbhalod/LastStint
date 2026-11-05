// useGame: the React driver for a Daily Race. It owns a GameSession in a ref (which owns the
// mutable sim engine), mirrors its state into React state after every action, runs the lap
// clock while racing, persists/resumes the run, and talks to the Worker: "already played
// today?" on load, and the run submission (calls + the game's grades) at the flag.

import type { Decision, RaceModel, RaceNote } from '@boxthislap/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type RunResponse, type RunSubmission, api } from '../data/api.js';
import { anonId } from '../data/player.js';
import type { Daily, DailyProvider } from '../data/types.js';
import { type Grader, browserGrader } from '../engine/grading.js';
import type { GameState, Speed } from '../state/machine.js';
import { GameSession } from '../state/session.js';
import { RUN_KEY, clearRun, loadRun, saveRun } from '../state/storage.js';

// One lap tick on screen. Testers found 3-5 s per lap too fast to follow (feedback spec D4).
// The track map runs the field one lap round per tick, so this is also how fast the dots move.
export const LAP_MS: Record<Speed, number> = { 1: 10000, 2: 5000 };
/** A battle slows the lap by this much as the cars near the corner (race engineer spec D7). */
export const SLOW_MOTION = 3;

/** How fast the lap runs: as set, slowed for a battle, or frozen at the braking zone waiting
 * for your call (battles and trust spec D2). */
export type Pace = 'normal' | 'slow' | 'frozen';

/** The lap tick in progress: when it started (performance.now()) and how long it lasts. The
 * track map animates from this, so the dots and the lap clock never drift apart. Frozen, it
 * holds at `frozen` (the share of the tick run). */
export interface LapClock {
  start: number;
  ms: number;
  frozen?: number;
}

/** How far through its tick the clock is at `now` (0-0.995). */
export function clockProgress(clock: LapClock, now = performance.now()): number {
  const p = clock.frozen ?? (now - clock.start) / clock.ms;
  return Math.min(0.995, Math.max(0, p));
}

export interface Game {
  state: GameState | null;
  model: RaceModel | null;
  daily: Daily | null;
  /** The running lap tick, or null while paused / not racing. */
  clock: LapClock | null;
  /** The game's own score from its grades (shown before/without the server's). */
  localScore: () => ReturnType<GameSession['localScore']> | null;
  error: string | null;
  start: () => void;
  setSpeed: (s: Speed) => void;
  /** A battle's pace: slowed near the corner, frozen at the braking zone. */
  setPace: (pace: Pace) => void;
  /** Hold the race (the player went to the home page); the lap resumes where it was. */
  setHold: (on: boolean) => void;
  choose: (optionId: string) => void;
  call: (decision: Decision, options?: { asked?: boolean; quiet?: boolean }) => void;
  /** What the race model noted so far (battles, contact, trust...). */
  notes: () => RaceNote[];
  /** The lap being shown, run ahead to its end (a battle's result at its corner). */
  preview: () => ReturnType<GameSession['previewLap']>;
  /** The finished race's call log and grades, for a submission (survivor posts its own). */
  submission: () => Promise<RunSubmission | null>;
  /** Put a line on the radio (no call). */
  radio: (text: string) => void;
  submit: () => void;
  reset: () => void;
  reload: () => void;
}

/** POST the run, retrying once if the request itself failed (network or server error). */
async function postRun(session: GameSession): Promise<RunResponse> {
  const body = await session.submission(anonId());
  try {
    return await api.submit(body);
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) throw e;
    return api.submit(body);
  }
}

export function useGame(
  provider: DailyProvider,
  grader?: Grader,
  /** Where the in-progress race is saved (survivor keeps its own, apart from the daily's). */
  storageKey = RUN_KEY,
): Game {
  const session = useRef<GameSession | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState<LapClock | null>(null);
  const [pace, setPace] = useState<Pace>('normal');
  const [hold, setHold] = useState(false);
  // How far through the lap tick the clock was when it stopped (a speed change keeps it).
  const carry = useRef(0);
  // One grading worker for the page's lifetime.
  const graderRef = useRef<Grader | null>(null);
  if (!graderRef.current) graderRef.current = grader ?? browserGrader();

  const sync = useCallback(() => {
    const s = session.current;
    if (!s) return;
    setState(s.state);
    saveRun(s.persist(), storageKey);
  }, [storageKey]);

  const adopt = useCallback(
    (s: GameSession) => {
      session.current = s;
      s.onChange = sync;
      sync();
    },
    [sync],
  );

  // Load today's race once (resuming a saved run if it's for the same day and seed), then
  // check whether this player already submitted today's run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load ("Try again").
  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      const today = await provider.today();
      if (!alive) return;
      setDaily(today);
      const saved = loadRun(storageKey);
      const s =
        (saved && GameSession.restore(today, saved, graderRef.current ?? undefined)) ||
        new GameSession(today, { grader: graderRef.current ?? undefined });
      adopt(s);
      if (today.source === 'live' && s.state.submission.status !== 'done') {
        try {
          const played = await api.run(today.date, anonId());
          if (alive) {
            s.alreadyPlayed(played);
            sync();
          }
        } catch {
          // 404: not played yet (or offline), play on
        }
      }
    })().catch((e) => alive && setError(String((e as Error).message ?? e)));
    return () => {
      alive = false;
    };
  }, [provider, adopt, sync, attempt, storageKey]);

  // The lap clock: advance one lap per tick while racing. A tick starts the moment racing
  // starts or resumes (no dead wait after a decision), and a speed change keeps the lap's
  // progress rather than starting it over.
  useEffect(() => {
    if (state?.phase !== 'racing' || hold) {
      setClock(null);
      return;
    }
    if (pace === 'frozen') {
      // Held where it was (the last clock's cleanup kept its progress); no tick runs.
      setClock({ start: 0, ms: 1, frozen: carry.current });
      return;
    }
    const ms = LAP_MS[state.speed] * (pace === 'slow' ? SLOW_MOTION : 1);
    let start = performance.now() - carry.current * ms;
    let id = 0;
    const schedule = () => {
      setClock({ start, ms });
      id = window.setTimeout(
        () => {
          carry.current = 0;
          start = performance.now();
          session.current?.tick();
          sync();
          schedule();
        },
        Math.max(0, start + ms - performance.now()),
      );
    };
    schedule();
    return () => {
      clearTimeout(id);
      carry.current = Math.min(0.99, (performance.now() - start) / ms);
    };
  }, [state?.phase, state?.speed, pace, hold, sync]);

  const act = useCallback(
    (f: (s: GameSession) => void) => () => {
      if (session.current) f(session.current);
      sync();
    },
    [sync],
  );

  const submit = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.beginSubmit();
    sync();
    (async () => {
      if (s.state.meta.source === 'practice') {
        await s.allGraded();
        s.finish({ status: 'practice' });
        return;
      }
      try {
        s.finish({ status: 'done', response: await postRun(s) });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'already-submitted') {
          s.finish({ status: 'already', response: await api.run(s.state.meta.date, anonId()) });
        } else {
          s.finish({
            status: 'error',
            error: e instanceof ApiError ? e.code : 'Can’t reach the server.',
          });
        }
      }
    })()
      .catch(() => s.finish({ status: 'error', error: 'Can’t reach the server.' }))
      .finally(sync);
  }, [sync]);

  // Clear the saved run and start a fresh session back at the daily card (practice only:
  // a submitted daily can't be replayed).
  const reset = useCallback(() => {
    if (!daily) return;
    clearRun(storageKey);
    adopt(new GameSession(daily, { grader: graderRef.current ?? undefined }));
  }, [daily, adopt, storageKey]);

  return {
    state,
    model: daily?.model ?? null,
    daily,
    clock,
    localScore: () => session.current?.localScore() ?? null,
    error,
    start: act((s) => s.start()),
    setSpeed: (speed) => act((s) => s.setSpeed(speed))(),
    setPace,
    setHold,
    choose: (optionId) => act((s) => s.choose(optionId))(),
    call: (decision, options) => act((s) => s.call(decision, options))(),
    radio: (text) => act((s) => s.radio(text))(),
    notes: () => session.current?.notes ?? [],
    preview: () => session.current?.previewLap() ?? null,
    submission: async () => session.current?.submission(anonId()) ?? null,
    submit,
    reset,
    reload: () => setAttempt((n) => n + 1),
  };
}
