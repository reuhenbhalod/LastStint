// The era detail's view (build-plan 8.3; spec §14): the era's briefing, its lock state, then its
// ten race cards with stars, best accuracy and the Reconstructed, Draft and hidden-objective
// badges (the objective's text stays on the results screen; spec §6). Once the era
// is Cleared (spec §8) a Legend toggle switches the cards to Legend difficulty, whose progress
// is shown apart from the era's. Star and lock states are spelled out in text, not by colour or
// symbol alone; each playable card's race name is a link (a tab stop) that covers the card.

import { legendDifficulty } from '@laststint/sim';
import { LockLine, StarIcon } from './EraMap.js';
import { type EraInfo, eraLeaderboardPath, eraRace, eraRacePath } from './catalog.js';
import type {
  EraDetailState,
  EraDetailView,
  HiddenState,
  RaceCard,
  RaceProgress,
} from './eraDetailState.js';

const STARS = [
  { key: 'result', n: 1, name: 'Result' },
  { key: 'strategist', n: 2, name: 'Strategist' },
  { key: 'mastery', n: 3, name: 'Mastery' },
] as const;

/** ★1 Result, ★2 Strategist, ★3 Mastery, each earned or not; read out as "Star 1, Result:
 * earned". */
function StarList({ stars }: { stars: RaceProgress['stars'] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[13px]">
      {STARS.map(({ key, n, name }) => {
        const earned = stars[key];
        return (
          <li
            key={key}
            className={`flex items-center gap-1 ${earned ? 'font-semibold text-[var(--flag)]' : 'text-[var(--muted)]'}`}
          >
            <StarIcon hollow={!earned} />
            <span className="sr-only">Star {n}, </span>
            <span aria-hidden="true">★{n}</span>
            <span className={earned ? 'text-[var(--ink)]' : ''}>{name}</span>
            <span className="sr-only">: {earned ? 'earned' : 'not earned'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** A best accuracy as shown: one decimal at most ("82.5%"). */
export function accuracyText(accuracy: number | null): string {
  return accuracy === null ? 'not played yet' : `${Number(accuracy.toFixed(1))}%`;
}

/** A small outlined label: Reconstructed (muted), Draft (flag). */
export function Badge({ children, tone }: { children: string; tone: 'muted' | 'flag' }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        tone === 'flag'
          ? 'border-[var(--flag)] text-[var(--flag)]'
          : 'border-[var(--rule)] text-[var(--muted)]'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * The hidden objective's badge (spec §6): nothing before the race has all three stars, then
 * "open" (a new challenge) and "done". Never the objective's text.
 */
export function HiddenBadge({ state }: { state: HiddenState }) {
  if (state === 'hidden') return null;
  return state === 'done' ? (
    <Badge tone="flag">Hidden objective done</Badge>
  ) : (
    <Badge tone="muted">Hidden objective open</Badge>
  );
}

function RaceCardView({ card, legend }: { card: RaceCard; legend: boolean }) {
  const progress = legend ? card.legend : card.progress;
  const race = eraRace(card.raceId);
  const href = card.blocked === null && race ? eraRacePath(race, legend) : null;
  return (
    <li className="min-w-0">
      <article
        aria-disabled={href ? undefined : 'true'}
        className={`card relative flex h-full flex-col gap-2 !p-3 sm:!p-4 ${
          href ? 'hover:bg-[var(--card-2)]' : 'border-dashed'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-auto">Race {card.position}</span>
          {card.reconstructed && <Badge tone="muted">Reconstructed</Badge>}
          {card.draft && <Badge tone="flag">Draft</Badge>}
          <HiddenBadge state={card.hidden} />
        </div>
        <h3 className="disp m-0 break-words text-[22px] leading-none">
          {href ? (
            <a
              href={href}
              className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--you)]"
            >
              {card.name}
              <span className="sr-only">{legend ? ', play at Legend difficulty' : ', play'}</span>
            </a>
          ) : (
            card.name
          )}
        </h3>
        <p className="m-0 text-[14px] leading-snug">
          {card.dilemma ?? <span className="text-[var(--muted)]">Dilemma to come.</span>}
        </p>
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {legend && <span className="eyebrow !text-[var(--box-ink)]">Legend</span>}
          <StarList stars={progress.stars} />
          <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-[var(--muted)]">
            <span>
              Best accuracy{' '}
              <span className="font-mono font-semibold text-[var(--ink)]">
                {accuracyText(progress.bestAccuracy)}
              </span>
            </span>
            {/* Above the card's covering link, so it's its own tab stop and tap target. */}
            {race && (
              <a
                href={eraLeaderboardPath(race, legend)}
                className="relative z-10 underline hover:text-[var(--ink)]"
              >
                {legend ? 'Legend leaderboard' : 'Leaderboard'}
                <span className="sr-only"> for {card.name}</span>
              </a>
            )}
          </p>
          {card.blocked && (
            <p className="m-0 text-[13px] font-semibold text-[var(--rival)]">{card.blocked}</p>
          )}
        </div>
      </article>
    </li>
  );
}

/** The era's briefing (catalog.ts `briefing`). */
function Briefing({ era }: { era: EraInfo }) {
  return (
    <section aria-labelledby="era-briefing" className="flex max-w-2xl flex-col gap-1">
      <h2 id="era-briefing" className="eyebrow m-0">
        Briefing
      </h2>
      <p className="m-0 text-[15px]">{era.briefing}</p>
    </section>
  );
}

/** The era's stars, and Legend's: the toggle once Cleared, otherwise what it takes. */
function Progress({
  view,
  legend,
  onLegend,
}: {
  view: EraDetailView;
  legend: boolean;
  onLegend?: (on: boolean) => void;
}) {
  const races = view.cards.length;
  const hard = legendDifficulty();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="card flex flex-col gap-1 !p-3 sm:!p-4">
        <span className="eyebrow">Stars</span>
        <span className="font-mono text-[18px] font-semibold">
          <StarIcon /> {view.stars}/{view.maxStars}
          <span className="sr-only"> stars</span>
        </span>
        <span className="text-[12px] text-[var(--muted)]">
          {view.racesStarred} of {races} races with a star
        </span>
      </div>
      <div className="card flex flex-1 flex-col gap-1.5 !p-3 sm:!p-4">
        <span className="eyebrow !text-[var(--box-ink)]">Legend difficulty</span>
        {view.cleared ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[18px] font-semibold">
                <StarIcon /> {view.legendStars}/{view.maxStars}
                <span className="sr-only"> Legend stars</span>
              </span>
              <button
                type="button"
                aria-pressed={legend}
                onClick={() => onLegend?.(!legend)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--you)] ${
                  legend
                    ? 'border-[var(--box-ink)] bg-[var(--box-ink)] text-[var(--paper)]'
                    : 'border-[var(--rule)] hover:bg-[var(--card-2)]'
                }`}
              >
                Legend {legend ? 'on' : 'off'}
              </button>
            </div>
            <span className="text-[12px] text-[var(--muted)]">
              Era Cleared. Legend has its own stars: ★2 at {hard.accuracyThreshold} accuracy,{' '}
              {hard.information} information, {hard.rivalPolicy} rivals, a{' '}
              {hard.decisionTimerSeconds} s timer.
            </span>
          </>
        ) : (
          <span className="text-[13px] text-[var(--muted)]">
            Unlocks once the era is Cleared: a star on every race ({view.racesStarred} of {races} so
            far).
          </span>
        )}
      </div>
    </div>
  );
}

/** The detail's body for a load state: loading, the error with a retry, or the era. */
export function EraDetailBody({
  era,
  state,
  legend = false,
  onLegend,
  onRetry,
}: {
  era: EraInfo;
  state: EraDetailState;
  /** Legend on: the cards show and start Legend difficulty. Only once the era is Cleared. */
  legend?: boolean;
  onLegend?: (on: boolean) => void;
  onRetry?: () => void;
}) {
  switch (state.kind) {
    case 'loading':
      return <output className="block text-[var(--muted)]">Loading the era…</output>;
    case 'error':
      return (
        <div role="alert" className="card flex flex-col items-start gap-3">
          <p className="m-0">{state.message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)]"
            >
              Try again
            </button>
          )}
        </div>
      );
    case 'ready': {
      const { view } = state;
      const { node } = view;
      if (node.comingSoon) {
        // Production, not released: no cards to play (spec §5).
        return (
          <div className="card flex flex-col gap-1">
            <LockLine node={node} testMode={view.testMode} />
            <p className="m-0 text-[14px] text-[var(--muted)]">
              {era.years} arrives in a later release.
            </p>
          </div>
        );
      }
      const on = legend && view.cleared;
      return (
        <>
          {view.testMode && (
            <p className="card m-0 text-[13px] text-[var(--muted)]">
              <span className="eyebrow !text-[var(--flag)]">Test mode</span> Every race is open,
              Draft races included. Locks show as they would in production.
            </p>
          )}
          <Briefing era={era} />
          <div className="flex flex-col gap-1">
            <LockLine node={node} testMode={view.testMode} />
            {!node.open && (
              <p className="m-0 text-[13px] text-[var(--muted)]">
                You can look at its races, but not play them until it unlocks.
              </p>
            )}
          </div>
          <Progress view={view} legend={on} onLegend={onLegend} />
          <section aria-labelledby="era-races" className="flex flex-col gap-3">
            <h2 id="era-races" className="eyebrow m-0">
              {on ? 'Races · Legend difficulty' : 'Races'}
            </h2>
            <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
              {view.cards.map((card) => (
                <RaceCardView key={card.raceId} card={card} legend={on} />
              ))}
            </ol>
            <p className="m-0 text-[12px] text-[var(--muted)]">
              Reconstructed: rebuilt from race reports, without full lap timing. Draft: not
              published yet, so playable on test only. Hidden objective: a new challenge once a race
              has all three stars, shown on its results.
            </p>
          </section>
        </>
      );
    }
  }
}
