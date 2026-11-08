// Eras mode's screens (docs/laststint-eras-mode-spec.md §14), routed from App.tsx: the era map
// at /eras and an era's detail at /eras/<eraId>. Placeholders for now: the era list and the
// era's name. The map (build-plan 8.2) and the detail with its race cards (8.3) replace them.

import type { ReactNode } from 'react';
import { Brand } from '../components/Brand.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { ERAS, type EraInfo, type ErasRoute } from './catalog.js';

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

/** The era map (placeholder): every era in play order, newest first. */
export function EraMap() {
  return (
    <Shell>
      <p className="eyebrow m-0 !text-[var(--box-ink)]">Game mode</p>
      <h1 className="disp wide m-0 text-[48px] leading-[0.9] sm:text-[68px]">Eras</h1>
      <ol aria-label="Eras" className="m-0 flex list-none flex-col gap-2 p-0">
        {ERAS.map((era) => (
          <li key={era.id}>
            <a
              href={`/eras/${era.id}`}
              className="card flex flex-wrap items-baseline justify-between gap-2 hover:bg-[var(--card-2)]"
            >
              <span className="font-semibold">
                Era {era.id}: {era.name}
              </span>
              <span className="font-mono text-[13px] text-[var(--muted)]">{era.years}</span>
            </a>
          </li>
        ))}
      </ol>
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
