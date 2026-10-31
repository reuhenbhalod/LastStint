// Phase-routed game shell: load today's race from the Worker (practice on the bundled race if
// there's no daily), then render by game phase.

import { useMemo, useState } from 'react';
import { ApiDailyProvider } from './data/provider.js';
import { useGame } from './game/useGame.js';
import { HowItWorks } from './screens/HowItWorks.js';
import { IntroCard } from './screens/IntroCard.js';
import { RaceScreen } from './screens/RaceScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';

export function App() {
  const provider = useMemo(() => new ApiDailyProvider(), []);
  const game = useGame(provider);
  const [help, setHelp] = useState(false);

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
        />
      );
    case 'racing':
    case 'decision':
      return <RaceScreen game={game} state={game.state} model={game.model} />;
    default:
      return <ResultScreen state={game.state} game={game} />;
  }
}
