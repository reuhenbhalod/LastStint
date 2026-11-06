// Phase-routed game shell: load today's race from the Worker (practice on the bundled race if
// there's no daily), then render by game phase.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from './account/useAccount.js';
import { AdminPage } from './admin/AdminPage.js';
import { adminToken } from './admin/session.js';
import { ApiDailyProvider, RaceFileProvider } from './data/provider.js';
import { useTeamTheme } from './game/teamTheme.js';
import { useGame } from './game/useGame.js';
import { HowItWorks } from './screens/HowItWorks.js';
import { IntroCard } from './screens/IntroCard.js';
import { Privacy, Terms } from './screens/Legal.js';
import { RaceScreen } from './screens/RaceScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';
import { Survivor } from './screens/Survivor.js';

export function App() {
  if (location.pathname.startsWith('/admin')) return <AdminPage />;
  if (location.pathname.startsWith('/privacy')) return <Privacy />;
  if (location.pathname.startsWith('/terms')) return <Terms />;
  if (location.pathname.startsWith('/gauntlet') || location.pathname.startsWith('/survivor'))
    return <Survivor />;
  return <Game />;
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
  // The race in the driver's team colours (game/teamTheme.ts).
  useTeamTheme(game.model);
  const account = useAccount(game.reload);
  const [help, setHelp] = useState(false);
  // The home page mid-race (the Pit Wall brand): the race holds until you go back to it.
  const [home, setHome] = useState(false);
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
      <IntroCard
        state={game.state}
        model={game.model}
        onStart={leaveHome}
        onHelp={() => setHelp(true)}
        account={account}
        resume={racing ? `Back to the race · lap ${game.state.race.lap}` : 'See your result'}
      />
    );
  }

  switch (game.state.phase) {
    case 'intro':
      return (
        <IntroCard
          state={game.state}
          model={game.model}
          onStart={game.start}
          onHelp={() => setHelp(true)}
          account={account}
        />
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
      return <ResultScreen state={game.state} game={game} account={account} onHome={goHome} />;
    default:
      return <ResultScreen state={game.state} game={game} account={account} onHome={goHome} />;
  }
}
