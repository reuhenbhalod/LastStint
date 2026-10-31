// End of race: the result, a grade per call against the best option and the real team's call,
// the server's score, rank and percentile (live dailies), the day's leaderboard and stats, and
// a spoiler-free share line. Practice runs show the game's own grades, not submitted.

import { type Band, type DecisionMoment, bandFor } from '@boxthislap/sim';
import { useEffect, useState } from 'react';
import {
  type CallResult,
  type DailyStats,
  type LeaderboardEntry,
  type RunResponse,
  api,
} from '../data/api.js';
import type { Game } from '../game/useGame.js';
import type { GameState } from '../state/machine.js';

const BAND: Record<Band, { label: string; cls: string; square: string }> = {
  green: { label: 'Best call', cls: 'bg-green-500/20 text-green-300 ring-green-500', square: '🟩' },
  yellow: { label: 'Close', cls: 'bg-yellow-500/20 text-yellow-200 ring-yellow-500', square: '🟨' },
  orange: {
    label: 'Costly',
    cls: 'bg-orange-500/20 text-orange-200 ring-orange-500',
    square: '🟧',
  },
  red: { label: 'Big miss', cls: 'bg-red-500/20 text-red-300 ring-red-500', square: '🟥' },
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** The calls as the results screen shows them: the server's, or the game's own grades. */
function callsFrom(state: GameState, response: RunResponse | null): CallResult[] {
  if (response) return response.calls;
  return state.moments.flatMap((m): CallResult[] => {
    const graded = state.grades[m.id];
    const radio = state.decisions.find((d) => d.kind === 'radio' && d.momentId === m.id);
    if (!graded || radio?.kind !== 'radio') return [];
    const chosen = graded.grade.options.find((o) => o.id === radio.optionId);
    if (!chosen) return [];
    const best = Math.max(...graded.grade.options.map((o) => o.probability));
    const realGraded = graded.grade.options.find((o) => o.id === m.realOptionId);
    const realP = realGraded?.probability ?? graded.claim.real ?? 0;
    return [
      {
        momentId: m.id,
        lap: m.lap,
        chosen: chosen.id,
        band: chosen.band,
        points: 0,
        probability: chosen.probability,
        best: graded.grade.best,
        options: graded.grade.options,
        real: {
          optionId: m.realOptionId,
          probability: realP,
          band: realGraded?.band ?? bandFor((best - realP) * 100),
        },
        matchedReal: chosen.id === m.realOptionId,
      },
    ];
  });
}

function labelOf(moment: DecisionMoment | undefined, optionId: string | null): string {
  if (!optionId) return 'none of these';
  return moment?.options.find((o) => o.id === optionId)?.label ?? optionId;
}

export function shareLine(
  number: number | undefined,
  won: boolean,
  calls: CallResult[],
  percentile: number | null,
): string {
  const squares = calls.map((c) => BAND[c.band].square).join('');
  const head = number ? `Pit Wall #${number}` : 'Pit Wall (practice)';
  const tail = percentile !== null ? ` P${percentile}` : '';
  return `${head} ${won ? '🏆 ' : ''}${squares}${tail}`;
}

function CallRow({ call, moment }: { call: CallResult; moment?: DecisionMoment }) {
  const band = BAND[call.band];
  const best = call.options.find((o) => o.id === call.best);
  const behind = call.options.find((o) => o.id === call.chosen)?.behindBest ?? 0;
  return (
    <li className="rounded-lg bg-[var(--card)] p-3">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span>
            <span className="block font-mono text-xs text-neutral-500">Lap {call.lap}</span>
            <span className="font-medium">{labelOf(moment, call.chosen)}</span>
          </span>
          <span className={`rounded-full px-2 py-1 text-xs font-bold ring-1 ${band.cls}`}>
            {band.square} {band.label}
          </span>
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs text-neutral-400">
          <dt>Your call</dt>
          <dd>
            {pct(call.probability)} to beat the rival
            {behind > 0 ? ` (${behind.toFixed(1)} pts behind the best)` : ''}
          </dd>
          <dt>Best call</dt>
          <dd>
            {labelOf(moment, call.best)} · {best ? pct(best.probability) : '—'}
          </dd>
          <dt>Real team</dt>
          <dd>
            {labelOf(moment, call.real.optionId)} · {pct(call.real.probability)} ·{' '}
            {BAND[call.real.band].square}
            {call.matchedReal ? ' (you matched it)' : ''}
          </dd>
        </dl>
      </details>
    </li>
  );
}

export function ResultScreen({ state, game }: { state: GameState; game: Game }) {
  const sub = state.submission;
  const response = sub.status === 'done' || sub.status === 'already' ? sub.response : null;
  const order = response?.result.order ?? state.result?.order ?? state.race.order;
  const gaps = response?.result.gaps ?? state.result?.gaps ?? {};
  const { userSide, rival, date, number } = state.meta;
  const pos = response?.finishPosition ?? order.indexOf(userSide) + 1;
  const beatRival = order.indexOf(userSide) < order.indexOf(rival);
  const calls = callsFrom(state, response);
  const local = game.localScore();
  const score = response?.score ?? (calls.length ? local?.score : null);
  const momentById = new Map(state.moments.map((m) => [m.id, m]));
  const live = state.meta.source === 'live';

  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!response) return;
    api.leaderboard(date).then(
      (b) => setBoard(b.entries.slice(0, 10)),
      () => {},
    );
    api.stats(date).then(setStats, () => {});
  }, [response, date]);

  const share = shareLine(number, pos === 1, calls, response?.percentile ?? null);
  const copy = async () => {
    const text = `${share}\n${location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt('Copy your result:', text);
    }
  };

  if (state.phase === 'finished' || state.phase === 'submitting') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Chequered flag
        </p>
        <h1 className="disp text-[40px] leading-none">
          {pos === 1 ? 'You won!' : `P${pos}`}{' '}
          {pos !== 1 && (
            <span className="text-neutral-400">
              {beatRival ? `ahead of ${rival}` : `behind ${rival}`}
            </span>
          )}
        </h1>
        <button
          type="button"
          disabled={state.phase === 'submitting'}
          onClick={game.submit}
          className="rounded-xl bg-[var(--you)] py-4 text-lg font-bold text-neutral-950 disabled:opacity-60"
        >
          {state.phase === 'submitting' ? 'Grading your calls…' : 'See how you did'}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          {number ? `Pit Wall #${number}` : 'Practice'} ·{' '}
          {game.model?.race.name ?? state.meta.raceId}
        </p>
        <h1 className="mt-1 disp text-[40px] leading-none">
          {pos === 1 ? 'You won!' : `P${pos}`}{' '}
          {pos !== 1 && (
            <span className="text-neutral-400">
              {beatRival ? `ahead of ${rival}` : `behind ${rival}`}
            </span>
          )}
        </h1>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[var(--card)] p-3">
          <p className="text-xs uppercase text-neutral-500">Score</p>
          <p className="font-mono text-2xl font-bold">{score != null ? Math.round(score) : '—'}</p>
        </div>
        <div className="rounded-lg bg-[var(--card)] p-3">
          <p className="text-xs uppercase text-neutral-500">Rank</p>
          <p className="font-mono text-2xl font-bold">
            {response ? `${response.rank}/${response.total}` : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--card)] p-3">
          <p className="text-xs uppercase text-neutral-500">Beat</p>
          <p className="font-mono text-2xl font-bold">
            {response ? `${response.percentile}%` : '—'}
          </p>
        </div>
      </section>

      {sub.status === 'practice' && (
        <p className="rounded-lg bg-[var(--card)] p-3 text-sm text-neutral-400">
          Practice run: graded on this device, not submitted.
        </p>
      )}
      {sub.status === 'already' && (
        <p className="rounded-lg bg-[var(--card)] p-3 text-sm text-neutral-400">
          You’ve already played today’s race. Here’s your run; a new race arrives at midnight.
        </p>
      )}
      {sub.status === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-950/60 p-3 text-sm">
          <span>Not submitted ({sub.error}). Your grades are below.</span>
          <button
            type="button"
            onClick={game.submit}
            className="rounded-lg bg-red-600 px-3 py-2 font-bold"
          >
            Retry
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-400">
          Your calls{' '}
          <span className="font-normal normal-case text-neutral-600">(tap for details)</span>
        </h2>
        <ol className="flex flex-col gap-2">
          {calls.map((c) => (
            <CallRow key={c.momentId} call={c} moment={momentById.get(c.momentId)} />
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-[var(--rule)] p-3">
        <p className="font-mono text-lg">{share}</p>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-neutral-100 py-3 font-bold text-neutral-900"
        >
          {copied ? 'Copied!' : 'Share result'}
        </button>
      </section>

      {stats && stats.runs > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Today: {stats.runs} {stats.runs === 1 ? 'run' : 'runs'}, average score{' '}
            {Math.round(stats.meanScore)}
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-neutral-400">
            {stats.moments.map((m) => {
              const moment = momentById.get(m.id);
              const top = [...m.options].sort((a, b) => b.share - a.share)[0];
              return (
                <li key={m.id}>
                  Lap {moment?.lap}:{' '}
                  {top ? `${pct(top.share)} chose “${labelOf(moment, top.id)}”` : ''}
                  {moment?.realOptionId ? ` · ${pct(m.matchedReal)} matched the real team` : ''}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {board && board.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Leaderboard
          </h2>
          <ol className="flex flex-col gap-0.5 font-mono text-sm">
            {board.map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className="flex justify-between rounded bg-[var(--card)] px-2 py-1"
              >
                <span>
                  <span className="mr-2 text-neutral-500">{e.rank}</span>
                  {e.name}
                </span>
                <span>{Math.round(e.score)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <details className="rounded-lg bg-[var(--card)] p-3">
        <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-neutral-400">
          Classification
        </summary>
        <ol className="mt-2 flex flex-col gap-0.5 font-mono text-sm">
          {order.map((code, i) => (
            <li
              key={code}
              className={`flex justify-between rounded px-2 py-1 ${
                code === userSide
                  ? 'bg-[color-mix(in_srgb,var(--you)_16%,transparent)] text-[var(--you)]'
                  : code === rival
                    ? 'text-[var(--rival)]'
                    : ''
              }`}
            >
              <span>
                <span className="mr-2 text-neutral-500">{i + 1}</span>
                {code}
              </span>
              <span className="text-neutral-400">
                {i === 0 ? '—' : gaps[code] != null ? `+${gaps[code]?.toFixed(1)}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </details>

      {!live && (
        <button
          type="button"
          onClick={game.reset}
          className="rounded-xl border border-[var(--rule)] py-3 font-semibold text-neutral-300"
        >
          Play again
        </button>
      )}
    </main>
  );
}
