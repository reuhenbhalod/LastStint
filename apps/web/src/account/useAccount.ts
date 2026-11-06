// The player's account and streak (feedback spec D3, docs/auth0-spec.md). Loads them for the
// current player ID; signing in adopts the account's player ID (and tells the game to reload,
// so "already played today" is checked for the account); signing out goes back to a fresh
// anonymous ID. Sign-in is Auth0's login page when it's set up, else the Google button. A new
// account, or one without a display name, is asked for its profile. An admin account (on the
// Worker's ADMIN_EMAILS) gets the Admin button and keeps its token for /admin.

import { useCallback, useEffect, useRef, useState } from 'react';
import { setAdminToken } from '../admin/session.js';
import { ApiError, type PlayerResponse, api } from '../data/api.js';
import { adoptPlayerId, anonId, localDate, resetPlayerId } from '../data/player.js';
import { AUTH0_ENABLED, completeLogin, idToken, login, logout } from './auth0.js';
import { GOOGLE_CLIENT_ID, loadGoogle } from './google.js';
import { markHowToPending } from './howTo.js';

/** How the player signs in: Auth0's login page, the Google button, or not at all. */
export const SIGN_IN: 'auth0' | 'google' | null = AUTH0_ENABLED
  ? 'auth0'
  : GOOGLE_CLIENT_ID
    ? 'google'
    : null;

const ASKED = 'laststint:profile-asked';

/** The profile was asked for this session (marks it asked). */
function askedThisSession(): boolean {
  try {
    if (sessionStorage.getItem(ASKED)) return true;
    sessionStorage.setItem(ASKED, '1');
  } catch {
    // storage blocked: ask
  }
  return false;
}

export interface AccountState {
  player: PlayerResponse | null;
  /** The account has been looked up (signed in or out), or the lookup failed. */
  loaded: boolean;
  busy: boolean;
  error: string | null;
  /** The Google button's credential (the Google path). */
  signIn: (credential: string) => Promise<void>;
  /** Auth0: go to its login page. */
  startSignIn: () => void;
  signOut: () => void;
  refresh: () => void;
  /** The profile sheet is open (first sign-in, or Edit profile). */
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  /** Save the display name and favourite team; resolves to an error message, or null. */
  saveProfile: (displayName: string, favouriteTeam: string) => Promise<string | null>;
}

export function useAccount(onSwitch: () => void): AccountState {
  const [player, setPlayer] = useState<PlayerResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [n, setN] = useState(0);
  // The Google path's last credential (the profile call proves the account with it).
  const credential = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `n` re-runs the load (refresh).
  useEffect(() => {
    let alive = true;
    api
      .player(anonId(), localDate())
      .then(
        (p) => {
          if (!alive) return;
          setPlayer(p);
          // An account without a display name (made before profiles) is asked once a session.
          if (SIGN_IN === 'auth0' && p.account?.needsProfile && !askedThisSession()) {
            setProfileOpen(true);
          }
        },
        () => alive && setPlayer(null), // offline or no API: no streak shown
      )
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [n]);

  const refresh = useCallback(() => setN((x) => x + 1), []);

  const signIn = useCallback(
    async (token: string) => {
      setBusy(true);
      setError(null);
      try {
        const account = await api.signIn(token, anonId());
        credential.current = token;
        // A brand-new account sees how to play once (account/howTo.ts).
        if (account.created) markHowToPending(account.playerId);
        // An admin's ID token also opens the admin page (while it lasts).
        setAdminToken(account.admin ? token : null);
        const switched = account.playerId !== anonId();
        adoptPlayerId(account.playerId);
        refresh();
        if (account.needsProfile) setProfileOpen(true);
        if (switched) onSwitch();
      } catch {
        setError('Sign-in failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [onSwitch, refresh],
  );

  // Back from Auth0's login page: finish signing in with its ID token (once).
  const returned = useRef(false);
  useEffect(() => {
    if (SIGN_IN !== 'auth0' || returned.current) return;
    returned.current = true;
    completeLogin().then(
      (token) => {
        if (token) signIn(token);
      },
      () => setError('Sign-in failed. Try again.'),
    );
  }, [signIn]);

  const startSignIn = useCallback(() => {
    setBusy(true);
    login().catch(() => {
      setBusy(false);
      setError('Couldn’t open the sign-in page. Try again.');
    });
  }, []);

  const signOut = useCallback(() => {
    resetPlayerId();
    setAdminToken(null);
    credential.current = null;
    if (SIGN_IN === 'auth0') {
      // Auth0's session too: it comes back to the site, signed out.
      logout().catch(() => {});
      return;
    }
    loadGoogle().then(
      (g) => g.disableAutoSelect(),
      () => {},
    );
    refresh();
    onSwitch();
  }, [onSwitch, refresh]);

  const saveProfile = useCallback(
    async (displayName: string, favouriteTeam: string) => {
      const token = SIGN_IN === 'auth0' ? await idToken() : credential.current;
      if (!token) return 'Your sign-in has expired. Sign in again to save.';
      try {
        await api.profile(token, displayName, favouriteTeam);
        refresh();
        setProfileOpen(false);
        return null;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'name-taken') return 'That name is taken.';
        if (e instanceof ApiError && e.code === 'bad-name')
          return 'Use 3-20 letters, digits or spaces.';
        if (e instanceof ApiError && e.status === 401)
          return 'Your sign-in has expired. Sign in again to save.';
        return 'Couldn’t save. Try again.';
      }
    },
    [refresh],
  );

  return {
    player,
    loaded,
    busy,
    error,
    signIn,
    startSignIn,
    signOut,
    refresh,
    profileOpen,
    setProfileOpen,
    saveProfile,
  };
}
