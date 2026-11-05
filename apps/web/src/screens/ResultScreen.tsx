// End of race: the result, a grade per call against the best option and the real team's call,
// the server's score, rank and percentile (live dailies), the day's leaderboard and stats, and
// a spoiler-free share line. Practice runs show the game's own grades, not submitted.

import { type Band, type DecisionMoment, bandFor } from '@boxthislap/sim';
import { useEffect, useState } from 'react';
import type { AccountState } from '../account/useAccount.js';
import { AccountBar } from '../components/AccountBar.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { DriverDebrief } from '../components/DriverDebrief.js';
import { BandChip } from '../components/Icons.js';
import { ResultHero } from '../components/ResultHero.js';
import {
  type CallResult,
  type DailyStats,
  type LeaderboardEntry,
  type RunResponse,
  api,
} from '../data/api.js';
import { autoStay } from '../game/autoStay.js';
import { goalOf } from '../game/goal.js';
import type { Game } from '../game/useGame.js';
import { verdict } from '../game/verdict.js';
import type { GameState } from '../state/machine.js';

// `square` is for the share text (pasted elsewhere, the familiar grid); on screen, `color`.
const BAND: Record<Band, { label: string; cls: string; square: string; color: string }> = {
  green: {
    label: 'Best call',
    cls: 'bg-green-500/20 text-green-300 ring-green-500',
    square: '🟩',
    color: '#22c55e',
  },
  yellow: {
    label: 'Close',
    cls: 'bg-yellow-500/20 text-yellow-200 ring-yellow-500',
    square: '🟨',
    color: '#eab308',
  },
  orange: {
    label: 'Costly',
    cls: 'bg-orange-500/20 text-orange-200 ring-orange-500',
    square: '🟧',
    color: '#f97316',
  },
  red: {
    label: 'Big miss',
    cls: 'bg-red-500/20 text-red-300 ring-red-500',
    square: '🟥',
    color: '#ef4444',
  },
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
  return `${head} ${won ? 'WIN ' : ''}${squares}${tail}`;
}

function CallRow({
  call,
  moment,
  auto,
}: {
  call: CallResult;
  moment?: DecisionMoment;
  /** The wall answered for you (just stopped, see game/autoStay.ts). */
  auto?: boolean;
}) {
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
            {auto && (
              <span
                className="ml-2 rounded bg-[var(--rule)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                title="You had just stopped, so the wall stayed out without asking"
              >
                Auto
              </span>
            )}
          </span>
          <span className={`rounded-full px-2 py-1 text-xs font-bold ring-1 ${band.cls}`}>
            <BandChip color={band.color} /> {band.label}
          </span>
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs text-neutral-400">
          <dt>Your call</dt>
          <dd>
            {pct(call.probability)} chance of your goal
            {behind > 0 ? ` (${behind.toFixed(1)} pts behind the best)` : ''}
          </dd>
          <dt>Best call</dt>
          <dd>
            {labelOf(moment, call.best)} · {best ? pct(best.probability) : '-'}
          </dd>
          <dt>Real team</dt>
          <dd>
            {labelOf(moment, call.real.optionId)} · {pct(call.real.probability)} ·{' '}
            <BandChip color={BAND[call.real.band].color} />
            {call.matchedReal ? ' (you matched it)' : ''}
          </dd>
        </dl>
      </details>
    </li>
  );
}

export function ResultScreen({
  state,
  game,
  account,
  onHome,
}: {
  state: GameState;
  game: Game;
  account?: AccountState;
  /** The Pit Wall brand: the home page. */
  onHome?: () => void;
}) {
  const sub = state.submission;
  const response = sub.status === 'done' || sub.status === 'already' ? sub.response : null;
  const order = response?.result.order ?? state.result?.order ?? state.race.order;
  const gaps = response?.result.gaps ?? state.result?.gaps ?? {};
  const { userSide, rival, date, number } = state.meta;
  const pos = response?.finishPosition ?? order.indexOf(userSide) + 1;
  const beatRival = order.indexOf(userSide) < order.indexOf(rival);
  const model = game.model;
  const team = model?.drivers.find((d) => d.code === userSide)?.team ?? userSide;
  const realPos = (model?.realResult.indexOf(userSide) ?? -1) + 1;
  const v = verdict(
    pos,
    realPos,
    team,
    userSide,
    rival,
    beatRival,
    model ? goalOf(model).kind === 'defend' : false,
  );
  const calls = callsFrom(state, response);
  const local = game.localScore();
  const score = response?.score ?? (calls.length ? local?.score : null);
  const momentById = new Map(state.moments.map((m) => [m.id, m]));
  const live = state.meta.source === 'live';
  const finishers = response?.result.finishers ?? state.result?.finishers ?? [];
  const rivalPos = finishers.includes(rival) ? order.indexOf(rival) + 1 : 0;
  const gapToRival =
    gaps[userSide] !== undefined && gaps[rival] !== undefined
      ? (gaps[rival] as number) - (gaps[userSide] as number)
      : null;
  const hero = (
    <ResultHero
      v={v}
      raceName={model?.race.name ?? state.meta.raceId}
      userSide={userSide}
      rival={rival}
      pos={finishers.includes(userSide) ? pos : 0}
      dsq={(response?.result.disqualified ?? state.result?.disqualified ?? []).includes(userSide)}
      realPos={realPos}
      rivalPos={rivalPos}
      team={team}
      gapToRival={gapToRival}
      podium={finishers.slice(0, 3)}
    />
  );

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

  const share = shareLine(number, v.outcome === 'beat', calls, response?.percentile ?? null);
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
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6">
        {hero}
        <button
          type="button"
          disabled={state.phase === 'submitting'}
          onClick={game.submit}
          className="rounded-xl bg-[var(--you)] py-4 text-lg font-bold text-[var(--you-ink)] disabled:opacity-60"
        >
          {state.phase === 'submitting' ? 'Grading your calls…' : 'See how you did'}
        </button>
      </main>
    );
  }

  return (
    // A laptop shows two columns: the result, score and share on the left; your calls and
    // the day's numbers on the right.
    <main className="mx-auto grid min-h-screen max-w-5xl items-start gap-6 p-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5 lg:sticky lg:top-6">
        <p className="m-0 flex items-baseline gap-2">
          <button
            type="button"
            onClick={onHome}
            className="disp wide text-[18px] leading-none hover:text-[var(--you)]"
          >
            Pit Wall
          </button>
          <span className="eyebrow">{number ? `Daily #${number}` : 'Practice run'}</span>
        </p>
        {hero}
        {model && (
          <DriverDebrief race={state.race} model={model} notes={game.notes()} won={beatRival} />
        )}

        <section className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Score', score != null ? String(Math.round(score)) : '-', 'out of 100'],
            ['Rank', response ? `${response.rank}/${response.total}` : '-', 'today'],
            ['Beat', response ? `${response.percentile}%` : '-', 'of players'],
          ].map(([label, value, sub]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-xl bg-[var(--card)] px-2 py-3"
            >
              <span className="eyebrow">{label}</span>
              <span className="disp wide text-[28px] leading-none">{value}</span>
              <span className="text-[12px] text-[var(--muted)]">{sub}</span>
            </div>
          ))}
        </section>

        {account && live && <AccountBar account={account} />}

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
      </div>

      <div className="flex flex-col gap-5">
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Your calls{' '}
            <span className="font-normal normal-case text-neutral-600">(tap for details)</span>
          </h2>
          <ol className="flex flex-col gap-2">
            {calls.map((c) => (
              <CallRow
                key={c.momentId}
                call={c}
                moment={momentById.get(c.momentId)}
                auto={(() => {
                  const m = momentById.get(c.momentId);
                  return !!m && autoStay(m, state.decisions) === c.chosen;
                })()}
              />
            ))}
          </ol>
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
                  {i === 0 ? '-' : gaps[code] != null ? `+${gaps[code]?.toFixed(1)}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>

        <a
          href="/survivor"
          className="flex flex-col items-center gap-1 rounded-xl border-2 border-[var(--box)] px-4 py-4 text-center hover:bg-[color-mix(in_srgb,var(--box)_12%,transparent)]"
        >
          <span className="disp text-[20px] leading-none">Keep racing: Survivor</span>
          <span className="text-[13px] text-[var(--muted)]">
            Different races back to back until you lose one
          </span>
        </a>

        {!live && (
          <button
            type="button"
            onClick={game.reset}
            className="rounded-xl border border-[var(--rule)] py-3 font-semibold text-neutral-300"
          >
            Play again
          </button>
        )}
      </div>
      <Disclaimer className="mt-6 !px-0" />
    </main>
  );
}
