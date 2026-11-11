// An Eras attempt's results (eras spec §6, §8, §14 screen 5; build plan 8.7), added to the
// review screen (screens/ResultScreen.tsx): the stars this attempt earned (★1 Result,
// ★2 Strategist, ★3 Mastery) with a "new star" animation, the race accuracy against the era's
// threshold, rank, the untimed mark, the rewrite headline, the community rewrite stat and,
// once the race has all three stars, its hidden objective. Then "New attempt" and "Back to era".
//
// Every number here is the server's (the client only previews; spec §6 Evaluation). The rewrite
// headline is the race's authored `eras.storyline.headline`; a race without one gets a neutral
// line, never invented copy about real events.

import type { DifficultySettings, RaceModel } from '@laststint/sim';
import type { ReactNode } from 'react';
import type { Submission } from '../state/machine.js';
import { accuracyText } from './EraDetail.js';
import { StarIcon } from './EraMap.js';
import type { AttemptResult, RaceStats, RewriteShare, Stars } from './api.js';
import {
  type EraInfo,
  type EraRaceInfo,
  HISTORY_PATH,
  eraLeaderboardPath,
  raceName,
} from './catalog.js';

/** What the review screen needs to show an Eras attempt. */
export interface ErasResultInfo {
  era: EraInfo;
  /** The race of the attempt, for its leaderboard link. */
  race: EraRaceInfo;
  legend: boolean;
  difficulty: DifficultySettings;
  /** The race's community stats (GET /api/eras/races/:raceId/stats), if served. */
  stats: RaceStats | null;
  /** Start a fresh attempt (a new seed) on the race. */
  onNewAttempt: () => void;
}

export const STARS = [
  { key: 'result', n: 1, name: 'Result' },
  { key: 'strategist', n: 2, name: 'Strategist' },
  { key: 'mastery', n: 3, name: 'Mastery' },
] as const;

/** The line shown for a rewrite: the authored headline, or a neutral one. */
export const NEUTRAL_REWRITE = 'You rewrote this race’s history.';

export function rewriteHeadline(model: RaceModel | null): string {
  const authored = model?.eras?.storyline?.headline?.trim();
  return authored ? authored : NEUTRAL_REWRITE;
}

/**
 * False for a race the Eras side really won: its storyline has no rewrite condition, so it has
 * no rewrite to earn and no rewrite stat (owner decision, Nov 8 2026). True without a model.
 */
export function raceHasRewrite(model: RaceModel | null): boolean {
  const storyline = model?.eras?.storyline;
  return !storyline || storyline.rewriteCondition !== undefined;
}

/** The community stat's line, or null when the API sent none (no players, or nonsense). */
export function communityLine(stats: RaceStats | null): string | null {
  return rewriteShareLine(stats?.rewrite);
}

/** "Only 9% of strategists rewrote this race.", from a race's rewrite share; null without one. */
export function rewriteShareLine(rewrite: RewriteShare | null | undefined): string | null {
  if (!rewrite || !(rewrite.players > 0)) return null;
  const share = rewrite.share;
  if (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1) return null;
  const pct = Math.round(share * 100);
  return `${share < 0.5 ? 'Only ' : ''}${pct}% of strategists rewrote this race.`;
}

/** All three stars on the race (the hidden objective shows from then on, spec §6). */
export function allStars(stars: Stars): boolean {
  return stars.result && stars.strategist && stars.mastery;
}

const starGlyphs = (stars: Stars) => STARS.map(({ key }) => (stars[key] ? '★' : '☆')).join('');

/**
 * The share line for an Eras attempt: the race ("Abu Dhabi 2021"), its stars and accuracy once
 * evaluated, and the calls as squares. Spoiler-free, like the daily's.
 */
export function erasShareLine(
  raceId: string,
  legend: boolean,
  squares: string,
  result: Pick<AttemptResult, 'stars' | 'accuracy'> | null,
): string {
  const head = `LastStint Eras: ${raceName(raceId)}${legend ? ' (Legend)' : ''}`;
  const tail = result ? ` ${starGlyphs(result.stars)} ${Math.round(result.accuracy)}%` : '';
  return `${head}${tail} ${squares}`.trimEnd();
}

/** The three stars, each earned or not; a star new on this race pops in, labelled "New". */
export function EraStars({ stars, newStars }: { stars: Stars; newStars: Stars }) {
  return (
    <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label="Stars this attempt">
      {STARS.map(({ key, n, name }) => {
        const earned = stars[key];
        const fresh = earned && newStars[key];
        return (
          <li
            key={key}
            data-star={key}
            className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-center ${
              earned
                ? 'border-[var(--flag)] text-[var(--flag)]'
                : 'border-[var(--glass-edge)] text-[var(--muted)]'
            } ${fresh ? 'star-new' : ''}`}
          >
            <span className="text-[22px] leading-none">
              <StarIcon hollow={!earned} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]">
              <span aria-hidden="true">★{n} </span>
              <span className={earned ? 'text-[var(--ink)]' : ''}>{name}</span>
            </span>
            <span className="sr-only">
              Star {n}: {earned ? 'earned' : 'not earned'}
              {fresh ? ', new' : ''}
            </span>
            {fresh && (
              <span
                aria-hidden="true"
                className="rounded bg-[var(--flag)] px-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0B0E0D]"
              >
                New star
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'box' }) {
  return (
    <p
      className={`m-0 rounded-md border px-3.5 py-3 text-[13px] ${
        tone === 'box'
          ? 'border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_14%,var(--glass-strong))]'
          : 'border-[var(--glass-edge)] bg-[var(--glass)] backdrop-blur text-[var(--ink)]'
      }`}
    >
      {children}
    </p>
  );
}

/** Why the attempt has no stars to show, with a retry when one can help. */
function SubmitStatus({ sub, onRetry }: { sub: Submission; onRetry: () => void }) {
  if (sub.status === 'eras-held') return <Note>{sub.message}</Note>;
  if (sub.status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_14%,var(--glass-strong))] px-3.5 py-3 text-[13px]"
      >
        <span className="min-w-0 flex-1">No stars yet. {sub.error}</span>
        {sub.retry !== false && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-[var(--box)] px-3 py-2 font-bold text-white"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  if (sub.status === 'eras' || sub.status === 'sending') {
    return <Note>Your calls are graded below; the server hasn’t scored this attempt yet.</Note>;
  }
  return null;
}

/** The attempt's stars and standing, as the server evaluated it; or why it has none yet. */
export function EraResultsPanel({
  sub,
  model,
  info,
  onRetry,
}: {
  sub: Submission;
  model: RaceModel | null;
  info: ErasResultInfo;
  onRetry: () => void;
}) {
  const result = sub.status === 'eras-done' ? sub.result : null;
  const threshold = info.difficulty.accuracyThreshold;
  const hidden = model?.eras?.hidden;
  const community = raceHasRewrite(model) ? communityLine(info.stats) : null;
  return (
    <section
      aria-label="Stars"
      className="flex flex-col gap-3 rounded-lg border border-[var(--glass-edge)] bg-[var(--glass)] backdrop-blur p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          {info.legend ? 'Legend stars' : 'Stars'} · Era {info.era.id}
        </span>
        {result?.untimed && (
          <span
            className="rounded border border-[var(--rule)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
            title="The decision timer was off for this attempt"
          >
            Untimed
          </span>
        )}
      </div>

      {result ? (
        <>
          <EraStars stars={result.stars} newStars={result.newStars} />
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Accuracy
              </dt>
              <dd className="m-0">
                <span className="mono text-[22px] font-bold">{accuracyText(result.accuracy)}</span>
                <span className="block text-[12px] text-[var(--ink)]">
                  ★2 needs {threshold}:{' '}
                  {result.accuracy >= threshold
                    ? 'reached'
                    : `${accuracyText(threshold - result.accuracy)} short`}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Rank on this race
              </dt>
              <dd className="m-0">
                <span className="mono text-[22px] font-bold">
                  {result.total > 0 ? `${result.rank}/${result.total}` : '-'}
                </span>
                <span className="block text-[12px] text-[var(--ink)]">by best accuracy</span>
              </dd>
            </div>
          </dl>
          {result.untimed && (
            <p className="m-0 text-[12px] text-[var(--muted)]">
              Untimed: the decision timer was off, so these stars are marked untimed.
            </p>
          )}
          {result.rewrite === true && (
            <div className="flex flex-col gap-1 border-l-[3px] border-[var(--flag)] pl-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--flag)]">
                History rewritten
              </span>
              <p className="disp m-0 text-[18px] leading-snug">{rewriteHeadline(model)}</p>
              {result.historyEntry && (
                <span className="text-[12px] text-[var(--ink)]">Added to your history book.</span>
              )}
            </div>
          )}
          {community && <p className="m-0 text-[13px] text-[var(--ink)]">{community}</p>}
          {hidden && allStars(result.progress.stars) && (
            <div className="flex flex-col gap-1 rounded-md border border-[var(--glass-edge)] px-3 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Hidden objective
              </span>
              <span className="text-[14px] font-semibold">{hidden.label}</span>
              <span className="text-[12px] text-[var(--ink)]">
                {result.hidden === true
                  ? 'Done on this attempt: added to your history book.'
                  : result.progress.hiddenDone
                    ? 'Done.'
                    : 'A new challenge: all three stars unlocked it.'}
              </span>
            </div>
          )}
        </>
      ) : (
        <SubmitStatus sub={sub} onRetry={onRetry} />
      )}
    </section>
  );
}

/** The way on: a fresh attempt (a new seed), or back to the era's races; then the race's
 * leaderboard (the Legend one after a Legend attempt) and the history book. */
export function EraResultActions({ info }: { info: ErasResultInfo }) {
  const link =
    'flex items-center justify-center rounded-md border border-[var(--glass-edge)] px-2 py-2.5 text-center text-[13px] font-semibold text-[var(--ink)] hover:border-[var(--muted)]';
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={info.onNewAttempt}
          className="disp rounded-md bg-[var(--you)] py-3 text-[15px] tracking-wide text-[var(--you-ink)] hover:brightness-110"
        >
          New attempt
        </button>
        <a
          href={`/eras/${info.era.id}`}
          className="flex items-center justify-center rounded-md border border-[var(--rule)] py-3 text-center font-semibold text-[var(--ink)] hover:border-[var(--muted)]"
        >
          Back to era
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <a href={eraLeaderboardPath(info.race, info.legend)} className={link}>
          {info.legend ? 'Legend leaderboard' : 'Leaderboard'}
        </a>
        <a href={HISTORY_PATH} className={link}>
          History book
        </a>
      </div>
    </div>
  );
}
