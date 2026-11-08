// Eras mode's screens (docs/laststint-eras-mode-spec.md §14), routed from App.tsx: the era map
// at /eras (build-plan 8.2) and an era's detail at /eras/<eraId>. The detail is a placeholder
// with the era's name; step 8.3 replaces it with the briefing and race cards.

import { ERA_UNLOCK_SHARE } from '@laststint/sim';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Brand } from '../components/Brand.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { EraMapBody } from './EraMap.js';
import { type ErasApi, erasApi } from './api.js';
import type { EraInfo, ErasRoute } from './catalog.js';
import { type EraMapState, loadEraMap } from './eraMapState.js';

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
      </main>
      <Disclaimer />
    </div>
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
      <EraMapBody state={state} onRetry={retry} />
    </Shell>
  );
}

/** An era's detail (placeholder): its name and years. */
export function EraDetailScreen({ era }: { era: EraInfo }) {
  return (
    <Shell>
      <a href="/eras" className="text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]">
        All eras
      </a>
      <p className="eyebrow m-0 !text-[var(--box-ink)]">
        Era {era.id} · {era.years}
      </p>
      <h1 className="disp wide m-0 text-[40px] leading-[0.95] sm:text-[60px]">{era.name}</h1>
    </Shell>
  );
}

/** The screen for an Eras route. */
export function Eras({ route }: { route: ErasRoute }) {
  switch (route.kind) {
    case 'map':
      return <EraMap />;
    case 'era':
      return <EraDetailScreen era={route.era} />;
    case 'unknown':
      return (
        <Shell>
          <h1 className="disp m-0 text-[32px]">No such era</h1>
          <p className="m-0 text-[var(--muted)]">There’s no era “{route.segment}”.</p>
          <a href="/eras" className="underline">
            See all eras
          </a>
        </Shell>
      );
  }
}
