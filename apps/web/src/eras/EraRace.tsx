// An Eras race (build-plan 8.3; spec §9): a race card links here (`/eras/<eraId>/<raceId>`, or
// `…/legend`), which starts a fresh attempt through EraProvider and plays it: the Eras race
// intro (8.4: dilemma, objectives, difficulty), the race at the attempt's difficulty (the
// race screen's `eras` prop, 8.6), then the review with the attempt's stars (8.7: submitted
// by useGame's `submit`, eras/submit.ts). Leaving goes back to the era; "New attempt" starts a
// fresh one (a new seed) on the same race.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTeamTheme } from '../game/teamTheme.js';
import { useGame } from '../game/useGame.js';
import { HowItWorks } from '../screens/HowItWorks.js';
import { RaceScreen } from '../screens/RaceScreen.js';
import { ResultScreen } from '../screens/ResultScreen.js';
import { clearRun } from '../state/storage.js';
import { EraIntro } from './EraIntro.js';
import { EraProvider, eraDailyOf } from './EraProvider.js';
import type { ErasResultInfo } from './EraResults.js';
import { type ErasApi, type RaceStats, erasApi } from './api.js';
import { type EraInfo, type EraRaceInfo, raceName } from './catalog.js';
import type { ErasRace } from './difficulty/erasRace.js';
import { timerOn } from './difficulty/settings.js';

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
  const game = useGame(provider, undefined, ERAS_RUN_KEY, api);
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
  // The attempt's difficulty, for the race screen's timer and information level (8.6).
  const attempt = eraDailyOf(game.daily);
  const eras = useMemo<ErasRace | undefined>(
    () => (attempt ? { difficulty: attempt.difficulty, attemptId: attempt.attemptId } : undefined),
    [attempt],
  );
  // "New attempt": the attempt being replaced, until the fresh one has loaded.
  const [leaving, setLeaving] = useState<string | null>(null);
  const newAttempt = useCallback(() => {
    if (!attempt) return;
    setLeaving(attempt.attemptId);
    clearRun(ERAS_RUN_KEY);
    game.reload();
  }, [attempt, game.reload]);
  // The race's community stats for the results (step 7.4); nothing shown if not served.
  const [stats, setStats] = useState<RaceStats | null>(null);
  const atResults = game.state?.phase === 'results';
  useEffect(() => {
    if (!atResults) return;
    let live = true;
    api.raceStats(race.raceId).then(
      (s) => live && setStats(s),
      () => live && setStats(null),
    );
    return () => {
      live = false;
    };
  }, [api, race.raceId, atResults]);
  const results = useMemo<ErasResultInfo | null>(
    () =>
      attempt
        ? {
            era,
            race,
            legend: attempt.legend,
            difficulty: attempt.difficulty,
            stats,
            onNewAttempt: newAttempt,
          }
        : null,
    [attempt, era, race, stats, newAttempt],
  );

  if (help) return <HowItWorks onClose={() => setHelp(false)} />;
  if (game.error) {
    return <RaceStartError era={era} race={race} message={game.error} onRetry={game.reload} />;
  }
  if (game.state && !attempt) {
    return (
      <RaceStartError
        era={era}
        race={race}
        message="The race loaded without its Eras attempt."
        onRetry={game.reload}
      />
    );
  }
  const restarting = leaving !== null && attempt?.attemptId === leaving;
  if (!game.state || !game.model || !attempt || !results || restarting) {
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
        <EraIntro
          era={era}
          race={race}
          model={game.model}
          difficulty={attempt.difficulty}
          legend={attempt.legend}
          draft={attempt.draft}
          timed={timerOn()}
          onStart={game.start}
          onHelp={() => setHelp(true)}
        />
      );
    case 'planning':
    case 'racing':
    case 'decision':
      return (
        <RaceScreen game={game} state={game.state} model={game.model} eras={eras} onHome={back} />
      );
    default:
      if (game.state.phase === 'finished' && !flagDone) {
        return (
          <RaceScreen
            game={game}
            state={game.state}
            model={game.model}
            eras={eras}
            onFinished={() => setFlagDone(true)}
            onHome={back}
          />
        );
      }
      return <ResultScreen state={game.state} game={game} onHome={back} eras={results} />;
  }
}
