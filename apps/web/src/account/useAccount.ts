// The player's account and streak (feedback spec D3). Loads them for the current player ID;
// signing in adopts the account's player ID (and tells the game to reload, so "already played
// today" is checked for the account); signing out goes back to a fresh anonymous ID.

import { useCallback, useEffect, useState } from 'react';
import { type PlayerResponse, api } from '../data/api.js';
import { adoptPlayerId, anonId, localDate, resetPlayerId } from '../data/player.js';
import { loadGoogle } from './google.js';

export interface AccountState {
  player: PlayerResponse | null;
  busy: boolean;
  error: string | null;
  signIn: (credential: string) => Promise<void>;
  signOut: () => void;
  refresh: () => void;
}

export function useAccount(onSwitch: () => void): AccountState {
  const [player, setPlayer] = useState<PlayerResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `n` re-runs the load (refresh).
  useEffect(() => {
    let alive = true;
    api.player(anonId(), localDate()).then(
      (p) => alive && setPlayer(p),
      () => alive && setPlayer(null), // offline or no API: no streak shown
    );
    return () => {
      alive = false;
    };
  }, [n]);

  const refresh = useCallback(() => setN((x) => x + 1), []);

  const signIn = useCallback(
    async (credential: string) => {
      setBusy(true);
      setError(null);
      try {
        const account = await api.signIn(credential, anonId());
        const switched = account.playerId !== anonId();
        adoptPlayerId(account.playerId);
        refresh();
        if (switched) onSwitch();
      } catch {
        setError('Sign-in failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [onSwitch, refresh],
  );

  const signOut = useCallback(() => {
    resetPlayerId();
    loadGoogle().then(
      (g) => g.disableAutoSelect(),
      () => {},
    );
    refresh();
    onSwitch();
  }, [onSwitch, refresh]);

  return { player, busy, error, signIn, signOut, refresh };
}
