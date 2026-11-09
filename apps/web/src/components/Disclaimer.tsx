// The site footer, with the legal notice (F1's fan guidelines,
// formula1.com/en/information/guidelines): an unofficial site about F1 carries the wording
// below, word for word, in the footer of its pages; we add that the teams, drivers and the FIA
// aren't associated with it either. The brand and what the game is on one side, the notice on
// the other (stacked on a phone).

import { Brand } from './Brand.js';

export function Disclaimer({
  className = '',
  compact = false,
}: {
  className?: string;
  /** In a narrow page column: one column, no side padding of its own. */
  compact?: boolean;
}) {
  return (
    <footer className={`mt-10 border-t border-[var(--rule)] ${className}`}>
      <div
        className={
          compact
            ? 'grid gap-5 py-6'
            : 'mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12'
        }
      >
        <div className="flex flex-col gap-2">
          <Brand className="text-[18px]" />
          <p className="m-0 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">
            A fan-made race-strategy game. Take the pit wall in a real race, one a day.
          </p>
          <span className="mt-1 w-fit rounded-full border border-[var(--rule)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Unofficial fan game
          </span>
        </div>
        <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-[var(--muted)]">
          <span className="eyebrow">Legal</span>
          <p className="m-0">
            This website is unofficial and is not associated in any way with the Formula 1
            companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX
            and related marks are trade marks of Formula One Licensing B.V.
          </p>
          <p className="m-0">
            LastStint isn’t endorsed by or associated with the FIA, any team or any driver. Team and
            driver names are used only to describe the real races, and team names and colours belong
            to their owners.
          </p>
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href="/privacy"
              className="underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              Privacy
            </a>
            <a href="/terms" className="underline-offset-2 hover:text-[var(--ink)] hover:underline">
              Terms
            </a>
            <a
              href="/credits"
              className="underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              Credits
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
