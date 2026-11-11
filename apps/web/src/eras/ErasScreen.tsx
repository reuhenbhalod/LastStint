// Eras mode's screens (docs/laststint-eras-mode-spec.md §14), routed from App.tsx: the era map
// at /eras (build-plan 8.2), an era's detail at /eras/<eraId> (8.3), one of its races at
// /eras/<eraId>/<raceId>, or …/legend (EraRace.tsx), the history book at /eras/history and a
// race's leaderboards at /eras/<eraId>/<raceId>/leaderboard, or …/leaderboard/legend (8.8).

import { ERA_UNLOCK_SHARE } from '@laststint/sim';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Brand } from '../components/Brand.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { EraDetailBody } from './EraDetail.js';
import { EraMapBody } from './EraMap.js';
import { EraRace } from './EraRace.js';
import { HistoryBookBody, HistoryBookCover } from './HistoryBook.js';
import { LeaderboardBody } from './RaceLeaderboard.js';
import { type ErasApi, type ErasBookApi, canStartWith, erasApi, erasBookApi } from './api.js';
import {
  type EraInfo,
  type EraRaceInfo,
  type ErasRoute,
  HISTORY_PATH,
  eraLeaderboardPath,
  raceName,
} from './catalog.js';
import { type EraDetailState, loadEraDetail } from './eraDetailState.js';
import { type EraMapState, loadEraMap } from './eraMapState.js';
import {
  type HistoryState,
  type LeaderboardState,
  loadHistory,
  loadLeaderboard,
} from './historyState.js';

function Header() {
  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="/eras" className="flex items-baseline gap-2 hover:text-[var(--you)]">
          <Brand className="text-[20px]" />
          <span className="eyebrow">Eras</span>
        </a>
        <a
          href="/"
          className="rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)]"
        >
          Today’s daily
        </a>
      </div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
        <DataCredit />
      </main>
      <Disclaimer />
    </div>
  );
}

/** The data sources' credit (their licences ask for it), on every Eras screen. */
export function DataCredit() {
  return (
    <p className="m-0 mt-auto pt-4 text-[13px] text-[var(--muted)]">
      Race data from the TUM f1-timing-database, Jolpica-F1, F1DB and others:{' '}
      <a href="/credits" className="underline underline-offset-2 hover:text-[var(--ink)]">
        data credits
      </a>
      .
    </p>
  );
}

/** The era map: every era in play order, newest first, with its stars and lock. */
export function EraMap({
  api = erasApi,
  initial = { kind: 'loading' },
}: {
  api?: ErasApi;
  /** The state before the first load finishes (tests render a given state). */
  initial?: EraMapState;
}) {
  const [state, setState] = useState<EraMapState>(initial);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    // `attempt` re-runs the load on Try again.
    void attempt;
    let live = true;
    setState({ kind: 'loading' });
    loadEraMap(api).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [api, attempt]);

  return (
    <Shell>
      <p className="eyebrow m-0 !text-[var(--box-ink)]">Game mode</p>
      <h1 className="disp wide m-0 text-[48px] leading-[0.9] sm:text-[68px]">Eras</h1>
      <p className="m-0 max-w-2xl text-[15px] text-[var(--muted)]">
        Start in 2025 and work back to 1983. Earn {Math.round(ERA_UNLOCK_SHARE * 100)}% of an era’s
        stars to unlock the one before it.
      </p>
      <a
        href={HISTORY_PATH}
        className="self-start rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)]"
      >
        Your history book
      </a>
      <EraMapBody state={state} onRetry={retry} />
    </Shell>
  );
}

/** An era's detail: its briefing, lock, stars and Legend, and its ten race cards. */
export function EraDetailScreen({
  era,
  api = erasApi,
  initial = { kind: 'loading' },
  initialLegend = false,
}: {
  era: EraInfo;
  api?: ErasApi;
  /** The state before the first load finishes (tests render a given state). */
  initial?: EraDetailState;
  /** Legend on at first (tests). */
  initialLegend?: boolean;
}) {
  const [state, setState] = useState<EraDetailState>(initial);
  const [legend, setLegend] = useState(initialLegend);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    // `attempt` re-runs the load on Try again.
    void attempt;
    let live = true;
    setState({ kind: 'loading' });
    loadEraDetail(api, era.id, canStartWith(api)).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [api, era.id, attempt]);

  return (
    <Shell>
      <a href="/eras" className="text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]">
        All eras
      </a>
      <p className="eyebrow m-0 !text-[var(--box-ink)]">
        Era {era.id} · {era.years}
      </p>
      <h1 className="disp wide m-0 break-words text-[40px] leading-[0.95] sm:text-[60px]">
        {era.name}
      </h1>
      <EraDetailBody era={era} state={state} legend={legend} onLegend={setLegend} onRetry={retry} />
    </Shell>
  );
}

/** The history book: completion, each era's progress and badges, and the player's rewrites. */
export function HistoryBookScreen({
  api = erasBookApi,
  initial = { kind: 'loading' },
}: {
  api?: ErasBookApi;
  /** The state before the first load finishes (tests render a given state). */
  initial?: HistoryState;
}) {
  const [state, setState] = useState<HistoryState>(initial);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    // `attempt` re-runs the load on Try again.
    void attempt;
    let live = true;
    setState({ kind: 'loading' });
    loadHistory(api).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [api, attempt]);

  return (
    <Shell>
      <a href="/eras" className="text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]">
        All eras
      </a>
      <HistoryBookCover>
        <HistoryBookBody state={state} onRetry={retry} />
      </HistoryBookCover>
    </Shell>
  );
}

/** A race's leaderboards: the Normal and Legend tabs, each loaded when first shown. */
export function RaceLeaderboardScreen({
  era,
  race,
  legend: initialLegend,
  api = erasBookApi,
  initial = { kind: 'loading' },
}: {
  era: EraInfo;
  race: EraRaceInfo;
  /** The Legend tab first (`…/leaderboard/legend`). */
  legend: boolean;
  api?: ErasBookApi;
  /** The state before the first load finishes (tests render a given state). */
  initial?: LeaderboardState;
}) {
  const [legend, setLegend] = useState(initialLegend);
  const [state, setState] = useState<LeaderboardState>(initial);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const choose = useCallback(
    (next: boolean) => {
      setLegend(next);
      // The address follows the tab, so a reload or a shared link opens the same board.
      history.replaceState(history.state, '', eraLeaderboardPath(race, next));
    },
    [race],
  );

  useEffect(() => {
    // `attempt` re-runs the load on Try again.
    void attempt;
    let live = true;
    setState({ kind: 'loading' });
    loadLeaderboard(api, race.raceId, legend).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [api, race.raceId, legend, attempt]);

  return (
    <Shell>
      <a
        href={`/eras/${era.id}`}
        className="text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]"
      >
        Back to era {era.id}
      </a>
      <p className="eyebrow m-0 !text-[var(--box-ink)]">
        Era {era.id} · Race {race.position} · Leaderboard
      </p>
      <h1 className="disp wide m-0 break-words text-[40px] leading-[0.95] sm:text-[60px]">
        {raceName(race.raceId)}
      </h1>
      <LeaderboardBody state={state} legend={legend} onLegend={choose} onRetry={retry} />
    </Shell>
  );
}

/** The screen for an Eras route. */
export function Eras({ route }: { route: ErasRoute }) {
  switch (route.kind) {
    case 'map':
      return <EraMap />;
    case 'history':
      return <HistoryBookScreen />;
    case 'leaderboard':
      return <RaceLeaderboardScreen era={route.era} race={route.race} legend={route.legend} />;
    case 'era':
      return <EraDetailScreen era={route.era} />;
    case 'race':
      return <EraRace era={route.era} race={route.race} legend={route.legend} />;
    case 'unknown':
      return (
        <Shell>
          <h1 className="disp m-0 text-[32px]">No such era</h1>
          <p className="m-0 text-[var(--muted)]">There’s no era or race “{route.segment}”.</p>
          <a href="/eras" className="underline">
            See all eras
          </a>
        </Shell>
      );
  }
}
