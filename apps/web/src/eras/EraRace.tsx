// An Eras race (build-plan 8.3; spec §9): a race card links here (`/eras/<eraId>/<raceId>`, or
// `…/legend`), which starts a fresh attempt through EraProvider and plays it on the existing
// screens: the race card, the race, then the review. Leaving goes back to the era.
// TODO(8.4): the Eras race intro (dilemma, objectives, difficulty) replaces the daily's card.
// TODO(8.7): submit the attempt and show its stars; until then it's graded locally only.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTeamTheme } from '../game/teamTheme.js';
import { useGame } from '../game/useGame.js';
import { HowItWorks } from '../screens/HowItWorks.js';
import { IntroCard } from '../screens/IntroCard.js';
import { RaceScreen } from '../screens/RaceScreen.js';
import { ResultScreen } from '../screens/ResultScreen.js';
import { EraProvider } from './EraProvider.js';
import { type ErasApi, erasApi } from './api.js';
import { type EraInfo, type EraRaceInfo, raceName } from './catalog.js';

/** Where an Eras race in progress is saved, apart from the daily's and the Gauntlet's. */
export const ERAS_RUN_KEY = 'pitwall:eras-race';

/** Couldn't start the race: what went wrong, a retry and the way back. */
export function RaceStartError({
  era,
  race,
  message,
  onRetry,
}: {
  era: EraInfo;
  race: EraRaceInfo;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div role="alert" className="flex flex-col gap-2">
        <p className="m-0 font-semibold">Couldn’t start {raceName(race.raceId)}.</p>
        <p className="m-0 text-[14px] text-[var(--muted)]">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-[var(--you-ink)]"
          >
            Try again
          </button>
        )}
        <a
          href={`/eras/${era.id}`}
          className="rounded-xl border border-[var(--rule)] px-6 py-3 font-bold hover:bg-[var(--card-2)]"
        >
          Back to {era.name}
        </a>
      </div>
    </main>
  );
}

export function EraRace({
  era,
  race,
  legend,
  api = erasApi,
}: {
  era: EraInfo;
  race: EraRaceInfo;
  legend: boolean;
  api?: ErasApi;
}) {
  const provider = useMemo(
    () => new EraProvider(race.raceId, legend, api),
    [race.raceId, legend, api],
  );
  const game = useGame(provider, undefined, ERAS_RUN_KEY);
  // The race in the driver's team colours (game/teamTheme.ts).
  useTeamTheme(game.model);
  const [help, setHelp] = useState(false);
  const back = useCallback(() => location.assign(`/eras/${era.id}`), [era.id]);
  // At the flag the race screen runs the field to the line; then the review.
  const [flagDone, setFlagDone] = useState(false);
  const phase = game.state?.phase;
  useEffect(() => {
    if (phase === 'intro' || phase === 'racing') setFlagDone(false);
  }, [phase]);

  if (help) return <HowItWorks onClose={() => setHelp(false)} />;
  if (game.error) {
    return <RaceStartError era={era} race={race} message={game.error} onRetry={game.reload} />;
  }
  if (!game.state || !game.model) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <output className="font-mono text-sm text-[var(--muted)]">
          Starting {raceName(race.raceId)}
          {legend ? ' at Legend difficulty' : ''}…
        </output>
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
          resume={legend ? 'Start the race · Legend' : 'Start the race'}
        />
      );
    case 'planning':
    case 'racing':
    case 'decision':
      return <RaceScreen game={game} state={game.state} model={game.model} onHome={back} />;
    default:
      if (game.state.phase === 'finished' && !flagDone) {
        return (
          <RaceScreen
            game={game}
            state={game.state}
            model={game.model}
            onFinished={() => setFlagDone(true)}
            onHome={back}
          />
        );
      }
      return <ResultScreen state={game.state} game={game} onHome={back} />;
  }
}
