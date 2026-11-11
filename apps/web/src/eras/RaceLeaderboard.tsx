// A race's leaderboards (eras spec §8; build plan 8.8): the normal board and the Legend board as
// two tabs, each the top 100 by best accuracy and the player's own rank, from
// GET /api/eras/races/:raceId/leaderboard. The player's row is marked "You" in text as well as
// highlighted; when they're below the top 100 their row follows the list.

import { type KeyboardEvent, useRef } from 'react';
import { accuracyText } from './EraDetail.js';
import type { EraLeaderboard } from './api.js';
import { type LeaderboardState, myPlace } from './historyState.js';

const TABS = [
  { legend: false, name: 'Normal' },
  { legend: true, name: 'Legend' },
] as const;

const tabId = (legend: boolean) => `board-tab-${legend ? 'legend' : 'normal'}`;
const PANEL_ID = 'board-panel';

/** The Normal and Legend tabs: arrow keys move between them, as a tab list should. */
export function BoardTabs({
  legend,
  onLegend,
}: {
  legend: boolean;
  onLegend?: (legend: boolean) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    // Two tabs: either arrow moves to the other one.
    const next = e.key === 'Home' ? false : e.key === 'End' ? true : !legend;
    onLegend?.(next);
    refs.current[next ? 1 : 0]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Leaderboard"
      onKeyDown={onKey}
      className="flex gap-1 self-start rounded-lg border border-[var(--rule)] p-1"
    >
      {TABS.map((t, i) => {
        const on = t.legend === legend;
        return (
          <button
            key={t.name}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(t.legend)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => onLegend?.(t.legend)}
            className={`rounded-md px-4 py-1.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--you)] ${
              on
                ? t.legend
                  ? 'bg-[var(--box-ink)] text-[var(--paper)]'
                  : 'bg-[var(--ink)] text-[var(--paper)]'
                : 'text-[var(--muted)] hover:bg-[var(--card-2)]'
            }`}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

const ROW = 'grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5 text-[14px]';
const ME = 'rounded bg-[color-mix(in_srgb,var(--you)_22%,transparent)] font-semibold';

function YouTag() {
  return (
    <span className="ml-1.5 rounded bg-[var(--you)] px-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--you-ink)]">
      You
    </span>
  );
}

/** The player's standing on the board, in a sentence. */
export function meLine(board: EraLeaderboard): string {
  if (!board.me) {
    return board.legend
      ? 'You’re not on the Legend board yet: finish a Legend attempt to get a rank.'
      : 'You’re not on this board yet: finish an attempt to get a rank.';
  }
  return `Your rank: ${board.me.rank} of ${board.total}, best accuracy ${accuracyText(board.me.accuracy)}.`;
}

function Board({ board }: { board: EraLeaderboard }) {
  const place = myPlace(board);
  const me = board.me;
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px]" data-testid="me-line">
        {meLine(board)}
      </p>
      {board.entries.length === 0 ? (
        <p className="card m-0 text-[14px] text-[var(--muted)]">No one is on this board yet.</p>
      ) : (
        <div className="card !p-2">
          <div
            aria-hidden="true"
            className={`${ROW} !py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]`}
          >
            <span>Rank</span>
            <span>Strategist</span>
            <span>Accuracy</span>
          </div>
          <ol className="m-0 flex list-none flex-col p-0" aria-label="Top strategists">
            {board.entries.map((e) => {
              const mine = place === 'listed' && me?.rank === e.rank;
              return (
                <li
                  key={e.rank}
                  data-me={mine || undefined}
                  className={`${ROW} border-t border-[var(--rule)] first:border-t-0 ${mine ? ME : ''}`}
                >
                  <span className="font-mono text-[var(--muted)]">{e.rank}</span>
                  <span className="flex min-w-0 items-center">
                    <span className="truncate">{e.name}</span>
                    {mine && <YouTag />}
                  </span>
                  <span className="font-mono font-semibold">{accuracyText(e.accuracy)}</span>
                </li>
              );
            })}
          </ol>
          {place === 'below' && me && (
            <>
              <p aria-hidden="true" className="m-0 px-2 text-center text-[var(--muted)]">
                ⋯
              </p>
              <p data-me="true" className={`${ROW} m-0 ${ME}`}>
                <span className="font-mono">{me.rank}</span>
                <span className="flex min-w-0 items-center">
                  <span className="sr-only">Your rank, </span>
                  <YouTag />
                </span>
                <span className="font-mono">{accuracyText(me.accuracy)}</span>
              </p>
            </>
          )}
        </div>
      )}
      <p className="m-0 text-[12px] text-[var(--muted)]">
        Top {board.size} by best accuracy; a tie goes to whoever reached it first. {board.total}{' '}
        {board.total === 1 ? 'strategist' : 'strategists'} on this board. Leaderboards never reset.
      </p>
    </div>
  );
}

/** The tabs and the selected board for a load state: loading, the error with a retry, or it. */
export function LeaderboardBody({
  state,
  legend,
  onLegend,
  onRetry,
}: {
  state: LeaderboardState;
  legend: boolean;
  onLegend?: (legend: boolean) => void;
  onRetry?: () => void;
}) {
  return (
    <>
      <BoardTabs legend={legend} onLegend={onLegend} />
      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(legend)} className="flex flex-col">
        {state.kind === 'loading' && (
          <output className="block text-[var(--muted)]">Loading the leaderboard…</output>
        )}
        {state.kind === 'error' && (
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
        )}
        {state.kind === 'ready' && <Board board={state.board} />}
      </div>
    </>
  );
}
