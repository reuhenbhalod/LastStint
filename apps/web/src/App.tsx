// Path routing (the daily at `/`, the Gauntlet, Eras, admin, legal and credits pages), and the
// phase-routed daily shell: load today's race from the Worker (practice on the bundled race if
// there's no daily), then render by game phase.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from './account/useAccount.js';
import { AdminPage } from './admin/AdminPage.js';
import { adminToken } from './admin/session.js';
import { ProfileSheet } from './components/ProfileSheet.js';
import { ApiDailyProvider, RaceFileProvider } from './data/provider.js';
import { Eras } from './eras/ErasScreen.js';
import { type ErasRoute, erasRoute } from './eras/catalog.js';
import { useFavouriteColour, useTeamTheme } from './game/teamTheme.js';
import { useGame } from './game/useGame.js';
import { Credits } from './screens/Credits.js';
import { HowItWorks } from './screens/HowItWorks.js';
import { IntroCard } from './screens/IntroCard.js';
import { Privacy, Terms } from './screens/Legal.js';
import { RaceScreen } from './screens/RaceScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';
import { Survivor } from './screens/Survivor.js';

/** The page a path is on: the daily (`/`, and any path not below) or a mode's or page's own. */
export type Route =
  | { page: 'admin' | 'privacy' | 'terms' | 'credits' | 'gauntlet' | 'daily' }
  | { page: 'eras'; eras: ErasRoute };

export function routeOf(pathname: string): Route {
  if (pathname.startsWith('/admin')) return { page: 'admin' };
  if (pathname.startsWith('/privacy')) return { page: 'privacy' };
  if (pathname.startsWith('/terms')) return { page: 'terms' };
  if (pathname.startsWith('/credits')) return { page: 'credits' };
  if (pathname.startsWith('/gauntlet') || pathname.startsWith('/survivor'))
    return { page: 'gauntlet' };
  const eras = erasRoute(pathname);
  if (eras) return { page: 'eras', eras };
  return { page: 'daily' };
}

export function App() {
  const route = routeOf(location.pathname);
  switch (route.page) {
    case 'admin':
      return <AdminPage />;
    case 'privacy':
      return <Privacy />;
    case 'terms':
      return <Terms />;
    case 'credits':
      return <Credits />;
    case 'gauntlet':
      return <Survivor />;
    case 'eras':
      return <Eras route={route.eras} />;
    default:
      return <Game />;
  }
}

function Game() {
  // ?race=<id>&seed=<n> practises any race file: on localhost, or for a signed-in admin
  // (the admin page links here).
  const provider = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const race = import.meta.env.DEV || adminToken() ? q.get('race') : null;
    const seed = q.get('seed');
    return race
      ? new RaceFileProvider(race, seed ? Number(seed) : undefined)
      : new ApiDailyProvider();
  }, []);
  const game = useGame(provider);
  const account = useAccount(game.reload);
  const [help, setHelp] = useState(false);
  // The home page mid-race (the Pit Wall brand): the race holds until you go back to it.
  const [home, setHome] = useState(false);
  // The race, and its card on the home page, in the colours of the team you race for
  // (game/teamTheme.ts); only the top bar's buttons take the player's favourite team's.
  useTeamTheme(game.model);
  useFavouriteColour(account.player?.account?.favouriteTeam);
  const { setHold } = game;
  const goHome = useCallback(() => {
    setHold(true);
    setHome(true);
    window.scrollTo(0, 0);
  }, [setHold]);
  const leaveHome = useCallback(() => {
    setHome(false);
    setHold(false);
  }, [setHold]);
  // At the flag the race screen runs the field to the line; then the results.
  const [flagDone, setFlagDone] = useState(false);
  const phase = game.state?.phase;
  useEffect(() => {
    if (phase === 'intro' || phase === 'racing') setFlagDone(false);
  }, [phase]);
  // A submitted run adds to the streak.
  const submitted = game.state?.submission.status;
  const { refresh } = account;
  useEffect(() => {
    if (submitted === 'done') refresh();
  }, [submitted, refresh]);

  if (help) return <HowItWorks onClose={() => setHelp(false)} />;
  const profile = account.profileOpen && <ProfileSheet account={account} />;

  if (game.error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-neutral-300">Couldn’t load today’s race.</p>
        <p className="font-mono text-xs text-neutral-500">{game.error}</p>
        <button
          type="button"
          onClick={game.reload}
          className="rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-[var(--you-ink)]"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!game.state || !game.model) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="font-mono text-sm text-neutral-500">Loading today’s race…</p>
      </main>
    );
  }

  if (home && game.state.phase !== 'intro') {
    const racing = ['planning', 'racing', 'decision'].includes(game.state.phase);
    return (
      <>
        <IntroCard
          state={game.state}
          model={game.model}
          onStart={leaveHome}
          onHelp={() => setHelp(true)}
          account={account}
          resume={racing ? `Back to the race · lap ${game.state.race.lap}` : 'See your result'}
        />
        {profile}
      </>
    );
  }

  switch (game.state.phase) {
    case 'intro':
      return (
        <>
          <IntroCard
            state={game.state}
            model={game.model}
            onStart={game.start}
            onHelp={() => setHelp(true)}
            account={account}
          />
          {profile}
        </>
      );
    case 'planning':
    case 'racing':
    case 'decision':
      return <RaceScreen game={game} state={game.state} model={game.model} onHome={goHome} />;
    case 'finished':
      if (!flagDone) {
        return (
          <RaceScreen
            game={game}
            state={game.state}
            model={game.model}
            onFinished={() => setFlagDone(true)}
            onHome={goHome}
          />
        );
      }
      return (
        <>
          <ResultScreen state={game.state} game={game} account={account} onHome={goHome} />
          {profile}
        </>
      );
    default:
      return (
        <>
          <ResultScreen state={game.state} game={game} account={account} onHome={goHome} />
          {profile}
        </>
      );
  }
}
