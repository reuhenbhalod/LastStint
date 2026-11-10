// The history book's view (eras spec §8, §14 screen 6; build plan 8.8): overall completion,
// every collectible's count, each era's progress with its badges (Cleared, Mastered, Legend),
// and the player's rewrites with their headlines and the community share. Badges and stars are
// told apart by shape and text (a tick or an open ring, a filled or hollow star, read out as
// earned or not), never by colour alone. One column on a phone, no sideways scroll at 390 px.
//
// It reads as a bound annual in the era map's cartoon style: a cover with a spine, paper pages
// (dark ink on a warm page, AA contrast; the page re-points the palette's tokens), completion on
// a ribbon bookmark, the collectibles as stickers on a trophy shelf, one chapter per era in play
// order with its map scene as the plate, badges as rubber stamps and each rewrite as a
// newspaper clipping. The styles are the `hb-` classes in index.css.

import type { ReactNode } from 'react';
import { accuracyText } from './EraDetail.js';
import { StarIcon } from './EraMap.js';
import { STARS, rewriteShareLine } from './EraResults.js';
import type { EraBadges, HistoryBook, HistoryEntry, HistoryEra, Stars, Tally } from './api.js';
import { eraLeaderboardPath, raceName } from './catalog.js';
import { EraScene } from './eraMapArt.js';
import {
  FlagDoodle,
  HelmetDoodle,
  LegendStarDoodle,
  LensDoodle,
  MedalDoodle,
  PenDoodle,
  StarDoodle,
  TrophyDoodle,
  TyreDoodle,
} from './historyBookArt.js';
import {
  type HistoryState,
  displayPercent,
  entriesNewestFirst,
  entryDate,
  entryHeadline,
  eraChapter,
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
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Badges">
      {BADGES.map(({ key, name, what }) => {
        const earned = badges[key];
        return (
          <li
            key={key}
            data-badge={key}
            data-earned={earned}
            title={`${name}: ${what}`}
            className={`hb-stamp ${earned ? 'hb-stamp-earned border-solid' : 'border-dashed'}`}
          >
            <TickIcon done={earned} />
            <span>{name}</span>
            <span className="sr-only">
              : {earned ? 'earned' : 'not earned'} ({what})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A progress bar, hidden from screen readers (the number beside it says it). */
function Bar({ percent }: { percent: number }) {
  return (
    <span aria-hidden="true" className="hb-bar">
      <span className="hb-bar-fill" style={{ width: `${percent}%` }} />
    </span>
  );
}

/** A chequered strip between the book's sections. */
function Chequer() {
  return <span aria-hidden="true" className="hb-chequer block" />;
}

const tallyText = ({ have, total }: Tally) => `${have}/${total}`;

/** The collectibles and their counts, as the server sent them: stickers on a trophy shelf. */
function Collectibles({ book }: { book: HistoryBook }) {
  const { stars, legendStars, rewrites, hidden, badges } = book.collectibles;
  const rows: Array<[string, Tally, ReactNode]> = [
    ['Stars', stars, <StarDoodle key="s" size={30} />],
    ['Legend stars', legendStars, <LegendStarDoodle key="l" size={30} />],
    ['Rewrites', rewrites, <PenDoodle key="r" size={30} />],
    ['Hidden objectives', hidden, <LensDoodle key="h" size={30} />],
    ['Era badges', badges, <MedalDoodle key="b" size={30} />],
  ];
  return (
    <div className="flex flex-col">
      <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map(([name, t, icon]) => (
          <div key={name} className="hb-sticker">
            {icon}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <dt className="eyebrow !text-[10px] !tracking-[0.03em] leading-tight break-words sm:!text-[11px] sm:!tracking-[0.06em]">
                {name}
              </dt>
              <dd className="m-0 font-mono text-[18px] font-bold leading-none">{tallyText(t)}</dd>
            </div>
          </div>
        ))}
      </dl>
      <span aria-hidden="true" className="hb-shelf">
        <span className="absolute -top-[38px] right-3">
          <TrophyDoodle size={40} />
        </span>
      </span>
    </div>
  );
}

/** An era's chapter: its map scene as the plate, its numbers as a timing sheet, its stamps. */
function EraProgress({ era }: { era: HistoryEra }) {
  const { percent: pct } = eraChapter(era);
  return (
    <li className="min-w-0">
      <article className="hb-chapter" data-era={era.eraId}>
        <div className="relative h-[92px] overflow-hidden border-b-[3px] border-[#1c1b29] sm:h-[108px]">
          <EraScene eraId={era.eraId} />
          <span className="hb-plate absolute bottom-2 left-2">Chapter {era.playOrder}</span>
          <span className="hb-board absolute right-2 top-2 !text-[15px]">
            {pct}%<span className="sr-only"> collected</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3 sm:p-4">
          <span className="eyebrow">
            Era {era.eraId} · {era.years}
          </span>
          <h3 className="disp m-0 break-words text-[21px] leading-none">
            <a href={`/eras/${era.eraId}`} className="hb-link">
              {era.name}
            </a>
          </h3>
          <Bar percent={pct} />
          <dl className="hb-sheet m-0">
            {(
              [
                ['Stars', era.stars],
                ['Legend stars', era.legendStars],
                ['Rewrites', era.rewrites],
                ['Hidden', era.hidden],
              ] as const
            ).map(([name, t]) => (
              <div key={name} className="flex items-baseline gap-2 px-2 py-1">
                <dt>{name}</dt>
                <span aria-hidden="true" className="hb-leader" />
                <dd className="m-0 font-mono font-bold">{tallyText(t)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto pt-1">
            <BadgeList badges={era.badges} />
          </div>
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

/** A rewrite as a newspaper clipping, taped into the book. */
function RewriteEntry({ entry }: { entry: HistoryEntry }) {
  const date = entryDate(entry.achievedAt);
  const community = rewriteShareLine(entry.community);
  return (
    <li className="hb-clip-wrap min-w-0">
      <span aria-hidden="true" className="hb-tape" />
      <article className="hb-clip" data-race={entry.raceId}>
        <p className="hb-masthead m-0">
          <span>History rewritten</span>
          {date && <time dateTime={entry.achievedAt}>{date}</time>}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="eyebrow">
            Era {entry.eraId} · Race {entry.position}
          </span>
          {entry.legend && <span className="hb-stamp hb-stamp-earned border-solid">Legend</span>}
        </div>
        <h3 className="disp m-0 break-words text-[16px] leading-tight">{raceName(entry.raceId)}</h3>
        <p className="hb-headline m-0">{entryHeadline(entry)}</p>
        {entry.real && <p className="hb-note m-0">What really happened: {entry.real}</p>}
        <p className="hb-sheet m-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5">
          <EntryStars stars={entry.stars} />
          {entry.accuracy !== null && (
            <span>
              Accuracy <span className="font-mono font-bold">{accuracyText(entry.accuracy)}</span>
            </span>
          )}
        </p>
        {community && <p className="m-0 text-[14px] font-semibold">{community}</p>}
        <a
          href={eraLeaderboardPath(entry, entry.legend)}
          className="hb-link self-start text-[13px] underline"
        >
          {entry.legend ? 'Legend leaderboard' : 'Leaderboard'}
          <span className="sr-only"> for {raceName(entry.raceId)}</span>
        </a>
      </article>
    </li>
  );
}

/**
 * The book itself: a cover with a spine and the title, and the pages inside, where the body
 * goes. The screen's one h1 is on the cover.
 */
export function HistoryBookCover({ children }: { children: ReactNode }) {
  return (
    <div className="hb-book">
      <span aria-hidden="true" className="hb-spine" />
      <header className="hb-cover">
        <span aria-hidden="true" className="hb-cover-art">
          <HelmetDoodle size={46} />
          <TyreDoodle size={40} />
          <FlagDoodle size={44} />
        </span>
        <p className="eyebrow m-0 !text-[#ffe9a8]">Eras</p>
        <h1 className="disp wide m-0 text-[40px] leading-[0.95] text-[#ffd23f] sm:text-[60px]">
          History book
        </h1>
        <p className="m-0 text-[14px] font-semibold text-[#fff3dc]">
          Your annual of racing history, 2025 back to 1983.
        </p>
      </header>
      <div className="hb-page">{children}</div>
    </div>
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
              className="hb-link rounded-lg border-2 border-[#1c1b29] bg-[#fffaf0] px-3 py-1.5 text-[13px] font-semibold"
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
        <div className="flex flex-col gap-6 sm:gap-8">
          <section aria-labelledby="history-completion" className="relative flex flex-col gap-4">
            <div className="flex flex-col items-start gap-3 pr-[92px]">
              <h2 id="history-completion" className="hb-board m-0">
                Completion
              </h2>
              <p className="m-0 text-[15px] font-semibold">
                <span className="hb-ribbon">
                  <span className="disp wide text-[26px] leading-none" data-testid="completion">
                    {pct}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                    {' '}
                    complete
                  </span>
                </span>
                {collected} of {total} collected
              </p>
              <Bar percent={pct} />
            </div>
            <Collectibles book={book} />
            {collected === 0 && (
              <p className="m-0 text-[14px] text-[var(--muted)]">
                Nothing collected yet. Stars, rewrites, hidden objectives and badges land here as
                you earn them.
              </p>
            )}
          </section>

          <Chequer />

          <section aria-labelledby="history-eras" className="flex flex-col gap-4">
            <div className="flex flex-col items-start gap-2">
              <h2 id="history-eras" className="hb-board m-0">
                Chapters
              </h2>
              <p className="m-0 text-[14px] text-[var(--muted)]">
                One chapter per era, in play order.
              </p>
            </div>
            <ol className="hb-spread m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 sm:gap-x-12">
              {eras.map((era) => (
                <EraProgress key={era.eraId} era={era} />
              ))}
            </ol>
            <p className="m-0 text-[13px] text-[var(--muted)]">
              {BADGES.map((b) => `${b.name}: ${b.what}.`).join(' ')}
            </p>
          </section>

          <Chequer />

          <section aria-labelledby="history-rewrites" className="flex flex-col gap-4">
            <h2 id="history-rewrites" className="hb-board m-0 self-start">
              History rewritten
            </h2>
            {entries.length > 0 ? (
              <ol className="m-0 grid list-none grid-cols-1 gap-7 p-0 pt-2 sm:grid-cols-2 sm:gap-x-8">
                {entries.map((entry) => (
                  <RewriteEntry key={entry.raceId} entry={entry} />
                ))}
              </ol>
            ) : (
              <div className="hb-empty">
                <PenDoodle size={40} />
                <p className="m-0 text-[14px]">
                  No rewrites yet. Change how a race really ended and it’s written here.
                </p>
              </div>
            )}
          </section>
        </div>
      );
    }
  }
}
