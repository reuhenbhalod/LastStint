// Phase-routed game shell: load today's race, then render by game phase.

import { useMemo } from 'react';
import { StaticDailyProvider } from './data/provider.js';
import { useGame } from './game/useGame.js';
import { IntroCard } from './screens/IntroCard.js';
import { RaceScreen } from './screens/RaceScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';

export function App() {
  const provider = useMemo(() => new StaticDailyProvider(), []);
  const game = useGame(provider);

  if (!game.state || !game.model) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-neutral-500">Loading today’s race…</p>
      </main>
    );
  }

  switch (game.state.phase) {
    case 'intro':
      return <IntroCard state={game.state} model={game.model} onStart={game.start} />;
    case 'racing':
    case 'decision':
      return <RaceScreen game={game} state={game.state} model={game.model} />;
    default:
      return <ResultScreen state={game.state} onSubmit={game.submit} onReset={game.reset} />;
  }
}
