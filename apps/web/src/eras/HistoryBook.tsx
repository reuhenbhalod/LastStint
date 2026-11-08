// The history book's view (eras spec §8, §14 screen 6; build plan 8.8): overall completion,
// every collectible's count, each era's progress with its badges (Cleared, Mastered, Legend),
// and the player's rewrites with their headlines and the community share. Badges and stars are
// told apart by shape and text (a tick or an open ring, a filled or hollow star, read out as
// earned or not), never by colour alone. One column on a phone, no sideways scroll at 390 px.

import { accuracyText } from './EraDetail.js';
import { StarIcon } from './EraMap.js';
import { STARS, rewriteShareLine } from './EraResults.js';
import type { EraBadges, HistoryBook, HistoryEntry, HistoryEra, Stars, Tally } from './api.js';
import { eraLeaderboardPath, raceName } from './catalog.js';
import {
  type HistoryState,
  displayPercent,
  entriesNewestFirst,
  entryDate,
  entryHeadline,
} from './historyState.js';

/** The era badges in order, with what earns each (spec §8). */
export const BADGES = [
  { key: 'cleared', name: 'Cleared', what: 'a star on every race' },
  { key: 'mastered', name: 'Mastered', what: 'every star' },
  { key: 'legend', name: 'Legend', what: 'every Legend star' },
] as const;

function TickIcon({ done }: { done: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={done ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block shrink-0"
    >
      {done ? <path d="M4 12.5l5 5L20 6.5" /> : <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

/** An era's three badges, each earned (solid, a tick) or not yet (dashed, an open ring). */
export function BadgeList({ badges }: { badges: EraBadges }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Badges">
      {BADGES.map(({ key, name, what }) => {
        const earned = badges[key];
        return (
          <li
            key={key}
            data-badge={key}
            data-earned={earned}
            title={`${name}: ${what}`}
            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              earned
                ? 'border-[var(--flag)] text-[var(--flag)]'
                : 'border-dashed border-[var(--rule)] text-[var(--muted)]'
            }`}
          >
            <TickIcon done={earned} />
            <span className={earned ? 'text-[var(--ink)]' : ''}>{name}</span>
            <span className="sr-only">
              : {earned ? 'earned' : 'not earned'} ({what})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A thin bar for a share, hidden from screen readers (the number beside it says it). */
function Bar({ percent }: { percent: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-full overflow-hidden rounded bg-[var(--rule)]"
    >
      <span className="block h-full bg-[var(--you)]" style={{ width: `${percent}%` }} />
    </span>
  );
}

const tallyText = ({ have, total }: Tally) => `${have}/${total}`;

/** The collectibles and their counts, as the server sent them. */
function Collectibles({ book }: { book: HistoryBook }) {
  const { stars, legendStars, rewrites, hidden, badges } = book.collectibles;
  const rows: Array<[string, Tally]> = [
    ['Stars', stars],
    ['Legend stars', legendStars],
    ['Rewrites', rewrites],
    ['Hidden objectives', hidden],
    ['Era badges', badges],
  ];
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
      {rows.map(([name, t]) => (
        <div key={name} className="flex min-w-0 flex-col gap-0.5">
          <dt className="eyebrow">{name}</dt>
          <dd className="m-0 font-mono text-[16px] font-semibold">{tallyText(t)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EraProgress({ era }: { era: HistoryEra }) {
  const collected =
    era.stars.have +
    era.legendStars.have +
    era.rewrites.have +
    era.hidden.have +
    BADGES.filter((b) => era.badges[b.key]).length;
  const total =
    era.stars.total + era.legendStars.total + era.rewrites.total + era.hidden.total + BADGES.length;
  const pct = displayPercent(era.percent, collected, total);
  return (
    <li className="min-w-0">
      <article className="card flex h-full flex-col gap-2 !p-3 sm:!p-4" data-era={era.eraId}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="eyebrow">
            Era {era.eraId} · {era.years}
          </span>
          <span className="font-mono text-[14px] font-semibold">{pct}%</span>
        </div>
        <h3 className="disp m-0 break-words text-[20px] leading-none">
          <a href={`/eras/${era.eraId}`} className="hover:text-[var(--you)]">
            {era.name}
          </a>
        </h3>
        <Bar percent={pct} />
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
          {(
            [
              ['Stars', era.stars],
              ['Legend stars', era.legendStars],
              ['Rewrites', era.rewrites],
              ['Hidden', era.hidden],
            ] as const
          ).map(([name, t]) => (
            <div key={name} className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--muted)]">{name}</dt>
              <dd className="m-0 font-mono font-semibold">{tallyText(t)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto pt-1">
          <BadgeList badges={era.badges} />
        </div>
      </article>
    </li>
  );
}

/** The attempt's three stars, filled or hollow, read out as earned or not. */
function EntryStars({ stars }: { stars: Stars }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[var(--flag)]">
      {STARS.map(({ key, n, name }) => (
        <span key={key} className="inline-flex">
          <StarIcon hollow={!stars[key]} />
          <span className="sr-only">
            Star {n}, {name}: {stars[key] ? 'earned' : 'not earned'}.{' '}
          </span>
        </span>
      ))}
    </span>
  );
}

function RewriteEntry({ entry }: { entry: HistoryEntry }) {
  const date = entryDate(entry.achievedAt);
  const community = rewriteShareLine(entry.community);
  return (
    <li className="min-w-0">
      <article
        className="flex flex-col gap-1.5 border-l-[3px] border-[var(--flag)] py-1 pl-3"
        data-race={entry.raceId}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="eyebrow">
            Era {entry.eraId} · Race {entry.position}
          </span>
          {entry.legend && (
            <span className="rounded border border-[var(--box-ink)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--box-ink)]">
              Legend
            </span>
          )}
        </div>
        <h3 className="disp m-0 break-words text-[20px] leading-tight">{raceName(entry.raceId)}</h3>
        <p className="m-0 text-[16px] font-semibold leading-snug">{entryHeadline(entry)}</p>
        {entry.real && (
          <p className="m-0 text-[13px] text-[var(--muted)]">What really happened: {entry.real}</p>
        )}
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
          <EntryStars stars={entry.stars} />
          {entry.accuracy !== null && (
            <span>
              Accuracy{' '}
              <span className="font-mono font-semibold text-[var(--ink)]">
                {accuracyText(entry.accuracy)}
              </span>
            </span>
          )}
          {date && <time dateTime={entry.achievedAt}>{date}</time>}
        </p>
        {community && <p className="m-0 text-[13px]">{community}</p>}
        <a
          href={eraLeaderboardPath(entry, entry.legend)}
          className="self-start text-[13px] text-[var(--muted)] underline hover:text-[var(--ink)]"
        >
          {entry.legend ? 'Legend leaderboard' : 'Leaderboard'}
          <span className="sr-only"> for {raceName(entry.raceId)}</span>
        </a>
      </article>
    </li>
  );
}

/** The book's body for a load state: loading, the error with a retry, or the book. */
export function HistoryBookBody({ state, onRetry }: { state: HistoryState; onRetry?: () => void }) {
  switch (state.kind) {
    case 'loading':
      return <output className="block text-[var(--muted)]">Loading your history book…</output>;
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
      const { book } = state;
      const { collected, total, percent } = book.completion;
      const pct = displayPercent(percent, collected, total);
      const eras = [...book.eras].sort((a, b) => a.playOrder - b.playOrder);
      const entries = entriesNewestFirst(book.entries);
      return (
        <>
          <section aria-labelledby="history-completion" className="card flex flex-col gap-3">
            <h2 id="history-completion" className="eyebrow m-0">
              Completion
            </h2>
            <p className="m-0 flex flex-wrap items-baseline gap-x-3">
              <span className="disp text-[48px] leading-none" data-testid="completion">
                {pct}%
              </span>
              <span className="text-[14px] text-[var(--muted)]">
                {collected} of {total} collected
              </span>
            </p>
            <Bar percent={pct} />
            <Collectibles book={book} />
            {collected === 0 && (
              <p className="m-0 text-[13px] text-[var(--muted)]">
                Nothing collected yet. Stars, rewrites, hidden objectives and badges land here as
                you earn them.
              </p>
            )}
          </section>

          <section aria-labelledby="history-eras" className="flex flex-col gap-3">
            <h2 id="history-eras" className="eyebrow m-0">
              Eras
            </h2>
            <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {eras.map((era) => (
                <EraProgress key={era.eraId} era={era} />
              ))}
            </ol>
            <p className="m-0 text-[12px] text-[var(--muted)]">
              {BADGES.map((b) => `${b.name}: ${b.what}.`).join(' ')}
            </p>
          </section>

          <section aria-labelledby="history-rewrites" className="flex flex-col gap-3">
            <h2 id="history-rewrites" className="eyebrow m-0">
              Rewrites
            </h2>
            {entries.length > 0 ? (
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {entries.map((entry) => (
                  <RewriteEntry key={entry.raceId} entry={entry} />
                ))}
              </ol>
            ) : (
              <p className="card m-0 text-[14px] text-[var(--muted)]">
                No rewrites yet. Change how a race really ended and it’s written here.
              </p>
            )}
          </section>
        </>
      );
    }
  }
}
