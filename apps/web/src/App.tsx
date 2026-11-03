// Phase-routed game shell: load today's race from the Worker (practice on the bundled race if
// there's no daily), then render by game phase.

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from './account/useAccount.js';
import { AdminPage } from './admin/AdminPage.js';
import { adminToken } from './admin/session.js';
import { ApiDailyProvider, RaceFileProvider } from './data/provider.js';
import { useGame } from './game/useGame.js';
import { HowItWorks } from './screens/HowItWorks.js';
import { IntroCard } from './screens/IntroCard.js';
import { RaceScreen } from './screens/RaceScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';

export function App() {
  if (location.pathname.startsWith('/admin')) return <AdminPage />;
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
  const account = useAccount(game.reload);
  const [help, setHelp] = useState(false);
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
          className="rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-neutral-950"
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
    case 'racing':
    case 'decision':
      return <RaceScreen game={game} state={game.state} model={game.model} />;
    case 'finished':
      if (!flagDone) {
        return (
          <RaceScreen
            game={game}
            state={game.state}
            model={game.model}
            onFinished={() => setFlagDone(true)}
          />
        );
      }
      return <ResultScreen state={game.state} game={game} account={account} />;
    default:
      return <ResultScreen state={game.state} game={game} account={account} />;
  }
}
