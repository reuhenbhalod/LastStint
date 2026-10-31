// useGame: the React driver for a Daily Race. It owns a GameSession in a ref (which owns the
// mutable sim engine), mirrors its state into React state after every action, runs the lap
// clock while racing, and persists/resumes the run. The session does the real work; this hook
// just wires it to render and to timers.

import type { Decision, RaceModel } from '@boxthislap/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Daily, DailyProvider } from '../data/types.js';
import type { GameState, Speed } from '../state/machine.js';
import { GameSession } from '../state/session.js';
import { clearRun, loadRun, saveRun } from '../state/storage.js';

const LAP_MS: Record<Speed, number> = { 1: 2600, 2: 1200 };

export interface Game {
  state: GameState | null;
  model: RaceModel | null;
  start: () => void;
  setSpeed: (s: Speed) => void;
  choose: (optionId: string) => void;
  call: (decision: Decision) => void;
  submit: () => void;
  reset: () => void;
}

export function useGame(provider: DailyProvider): Game {
  const session = useRef<GameSession | null>(null);
  const daily = useRef<Daily | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [model, setModel] = useState<RaceModel | null>(null);

  const sync = useCallback(() => {
    const s = session.current;
    if (!s) return;
    setState(s.state);
    saveRun(s.persist());
  }, []);

  // Load today's race once (resuming a saved run if it's for the same day).
  useEffect(() => {
    let alive = true;
    provider.today().then((today) => {
      if (!alive) return;
      daily.current = today;
      const saved = loadRun();
      session.current = (saved && GameSession.restore(today, saved)) || new GameSession(today);
      setModel(today.model);
      setState(session.current.state);
    });
    return () => {
      alive = false;
    };
  }, [provider]);

  // The lap clock: advance one lap on an interval while racing.
  useEffect(() => {
    if (state?.phase !== 'racing') return;
    const id = setInterval(() => {
      session.current?.tick();
      sync();
    }, LAP_MS[state.speed]);
    return () => clearInterval(id);
  }, [state?.phase, state?.speed, sync]);

  const start = useCallback(() => {
    session.current?.start();
    sync();
  }, [sync]);
  const setSpeed = useCallback(
    (s: Speed) => {
      session.current?.setSpeed(s);
      sync();
    },
    [sync],
  );
  const choose = useCallback(
    (optionId: string) => {
      session.current?.choose(optionId);
      sync();
    },
    [sync],
  );
  const call = useCallback(
    (decision: Decision) => {
      session.current?.call(decision);
      sync();
    },
    [sync],
  );
  const submit = useCallback(() => {
    session.current?.submit();
    sync();
  }, [sync]);

  // Clear the saved run and start a fresh session back at the daily card.
  const reset = useCallback(() => {
    if (!daily.current) return;
    clearRun();
    session.current = new GameSession(daily.current);
    setState(session.current.state);
  }, []);

  return { state, model, start, setSpeed, choose, call, submit, reset };
}
