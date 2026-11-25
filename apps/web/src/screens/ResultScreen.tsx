// End of race: the result, a grade per call against the best option and the real team's call,
// the server's score, rank and percentile (live dailies), the day's leaderboard and stats, and
// a spoiler-free share line. Practice runs show the game's own grades, not submitted. An Eras
// attempt (`eras`) shows the server's grades with its stars, accuracy and rank in place of the
// daily's score (eras/EraResults.tsx), and offers a new attempt or the way back to its era.

import { type Band, type DecisionMoment, autoStay, bandFor } from '@laststint/sim';
import { useEffect, useState } from 'react';
import type { AccountState } from '../account/useAccount.js';
import { AccountBar } from '../components/AccountBar.js';
import { AnnouncementBanner } from '../components/AnnouncementBanner.js';
import { Brand } from '../components/Brand.js';
import { Disclaimer } from '../components/Disclaimer.js';
import { DriverDebrief } from '../components/DriverDebrief.js';
import { GroundBackdrop } from '../components/GroundBackdrop.js';
import { Panel, Stat, Stats } from '../components/Panel.js';
import { ResultHero } from '../components/ResultHero.js';
import {
  type CallResult,
  type DailyStats,
  type LeaderboardEntry,
  type PlanResult,
  type RunResponse,
  api,
} from '../data/api.js';
import { surname } from '../data/names.js';
import {
  EraResultActions,
  EraResultsPanel,
  type ErasResultInfo,
  erasShareLine,
} from '../eras/EraResults.js';
import { goalOf } from '../game/goal.js';
import { planGrade, stopsLine, stopsWord } from '../game/plans.js';
import { TEAM_COLOR } from '../game/teamTheme.js';
import type { Game } from '../game/useGame.js';
import { verdict } from '../game/verdict.js';
import type { GameState } from '../state/machine.js';

// `square` is for the share text (pasted elsewhere, the familiar grid); on screen, `color`.
const BAND: Record<Band, { label: string; square: string; color: string }> = {
  green: { label: 'Best call', square: '🟩', color: '#4ade80' },
  yellow: { label: 'Close', square: '🟨', color: '#facc15' },
  orange: { label: 'Costly', square: '🟧', color: '#fb923c' },
  red: { label: 'Big miss', square: '🟥', color: '#f87171' },
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** What the server graded: a daily run, or an Eras attempt (the same calls and result). */
type Served = Pick<RunResponse, 'calls' | 'plan' | 'result' | 'finishPosition'>;

/** The race plan's grade: the server's, or the game's own (practice). */
function planFrom(state: GameState, response: Served | null): PlanResult | null {
  if (response) return response.plan ?? null;
  const picked = state.plan.picked;
  const grade = planGrade(state.plan, state.meta.takeoverLap);
  const mine = grade?.options.find((o) => o.id === picked?.id);
  if (!grade || !mine || !picked) return null;
  return {
    chosen: picked.id,
    band: mine.band,
    points: 0,
    probability: mine.probability,
    best: grade.best,
    options: grade.options,
  };
}

/** A plan by its id, in words ("Plan C: two stops"). */
function planLabel(state: GameState, id: string): string {
  const all = [...state.plan.offered, ...(state.plan.own ? [state.plan.own] : [])];
  const plan = all.find((p) => p.id === id);
  const name = id === 'own' ? 'Your own plan' : `Plan ${id.toUpperCase()}`;
  return plan
    ? `${name}: ${stopsWord(plan).toLowerCase()}, ${stopsLine(plan).toLowerCase()}`
    : name;
}

function PlanRow({ plan, state }: { plan: PlanResult; state: GameState }) {
  const best = plan.options.find((o) => o.id === plan.best);
  return (
    <GradedCall
      lap={`L${state.meta.takeoverLap + 1}`}
      kind="race plan"
      title={planLabel(state, plan.chosen)}
      band={plan.band}
      you={plan.probability}
      best={
        best && plan.best !== plan.chosen
          ? { label: planLabel(state, plan.best), p: best.probability }
          : null
      }
      real={null}
    />
  );
}

/** The calls in order, as coloured blocks (the share line's squares, drawn). */
function GradeStrip({ bands, size = 'md' }: { bands: Band[]; size?: 'md' | 'lg' }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {bands.map((b, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the calls, in race order.
          key={i}
          className={`-skew-x-12 ${size === 'lg' ? 'h-7 w-5' : 'h-4 w-3'}`}
          style={{ background: BAND[b].color }}
        />
      ))}
    </span>
  );
}

/** Your chance against the best call's and the real team's, on one 0-100% track. */
function ChanceBar({
  you,
  best,
  real,
  color,
}: {
  you: number;
  best: number | null;
  real: number | null;
  color: string;
}) {
  const at = (p: number) => `${Math.max(0, Math.min(100, p * 100))}%`;
  return (
    <span aria-hidden="true" className="relative block h-2 bg-[#252D31]">
      <span className="absolute inset-y-0 left-0" style={{ width: at(you), background: color }} />
      {real !== null && (
        <span
          className="absolute -inset-y-1 w-[3px] -translate-x-1/2 border border-[#EEF1EE] bg-[var(--glass)]"
          style={{ left: at(real) }}
        />
      )}
      {best !== null && (
        <span
          className="absolute -inset-y-1 w-[3px] -translate-x-1/2 bg-[#EEF1EE]"
          style={{ left: at(best) }}
        />
      )}
    </span>
  );
}

/** One graded call on the timeline: what you chose, its band, and the chances. */
function GradedCall({
  lap,
  kind,
  title,
  band,
  auto = false,
  you,
  best,
  real,
}: {
  lap: string;
  kind?: string;
  title: string;
  band: Band;
  auto?: boolean;
  you: number;
  /** The best option when it isn't yours. */
  best: { label: string; p: number } | null;
  real: { label: string; p: number; band: Band; matched: boolean } | null;
}) {
  const b = BAND[band];
  return (
    <li className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-3">
      {/* The timeline: the lap, a node in the band's colour, the line on to the next call. */}
      <span className="flex flex-col items-center gap-1.5 pt-3">
        <span className="mono text-[11px] font-bold text-[#9AA5A0]">{lap}</span>
        <span className="h-3 w-3 rotate-45" style={{ background: b.color }} />
        <span className="w-px flex-1 bg-[#283034]" />
      </span>
      <div
        className="mb-2.5 flex min-w-0 flex-col gap-2.5 rounded-md border border-[var(--glass-edge)] bg-[var(--glass)] px-3.5 py-3"
        style={{ borderLeft: `3px solid ${b.color}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            {kind && (
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
                {kind}
              </span>
            )}
            <span className="text-[14px] font-bold leading-snug">
              {title}
              {auto && (
                <span
                  className="ml-2 bg-[#252D31] px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-[#9AA5A0]"
                  title="The wall stayed out without asking (a stop just made, or tyres still good). Not scored."
                >
                  Auto · not scored
                </span>
              )}
            </span>
          </span>
          <span
            className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: b.color }}
          >
            {b.label}
          </span>
        </div>
        <ChanceBar you={you} best={best?.p ?? null} real={real?.p ?? null} color={b.color} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#B9C2BD]">
          <span>
            <span className="text-[#9AA5A0]">You </span>
            <b className="mono">{pct(you)}</b>
          </span>
          {best && (
            <span className="min-w-0">
              <span className="text-[#9AA5A0]">Best </span>
              {best.label} <b className="mono">{pct(best.p)}</b>
            </span>
          )}
          {real && (
            <span className="min-w-0">
              <span className="text-[#9AA5A0]">Real team </span>
              {real.matched ? 'same call' : real.label} <b className="mono">{pct(real.p)}</b>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/** The calls as the results screen shows them: the server's, or the game's own grades. */
function callsFrom(state: GameState, response: Served | null): CallResult[] {
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

/** The calls' bands as share squares. */
export function squaresOf(calls: { band: Band }[]): string {
  return calls.map((c) => BAND[c.band].square).join('');
}

export function shareLine(
  number: number | undefined,
  won: boolean,
  calls: CallResult[],
  percentile: number | null,
  plan: { band: Band } | null = null,
): string {
  const squares = squaresOf([...(plan ? [plan] : []), ...calls]);
  // The Daily's number isn't shown (owner, Nov 24 2026): it only tells a Daily from practice.
  const head = number ? 'LastStint' : 'LastStint (practice)';
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
  /** The wall answered for you (sim autoStay.ts). */
  auto?: boolean;
}) {
  const best = call.options.find((o) => o.id === call.best);
  return (
    <GradedCall
      lap={`L${call.lap}`}
      title={labelOf(moment, call.chosen)}
      band={call.band}
      auto={auto}
      you={call.probability}
      best={
        best && call.best !== call.chosen
          ? { label: labelOf(moment, call.best), p: best.probability }
          : null
      }
      real={{
        label: labelOf(moment, call.real.optionId),
        p: call.real.probability,
        band: call.real.band,
        matched: call.matchedReal,
      }}
    />
  );
}

/** The score, 0-100, as a ring. */
function ScoreRing({ score }: { score: number | null }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <span className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#252D31" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--you)"
          strokeWidth="7"
          strokeDasharray={`${(c * v).toFixed(1)} ${c.toFixed(1)}`}
          className="transition-[stroke-dasharray] duration-1000"
        />
      </svg>
      <span className="disp wide text-[28px] leading-none">
        {score === null ? '-' : Math.round(score)}
      </span>
    </span>
  );
}

export function ResultScreen({
  state,
  game,
  account,
  onHome,
  eras,
}: {
  state: GameState;
  game: Game;
  account?: AccountState;
  /** The Pit Wall brand: the home page. */
  onHome?: () => void;
  /** An Eras attempt: its era, difficulty and the way to a new attempt. */
  eras?: ErasResultInfo;
}) {
  const sub = state.submission;
  const response = sub.status === 'done' || sub.status === 'already' ? sub.response : null;
  const attempt = sub.status === 'eras-done' ? sub.result : null;
  const served: Served | null = response ?? attempt;
  const order = served?.result.order ?? state.result?.order ?? state.race.order;
  const gaps = served?.result.gaps ?? state.result?.gaps ?? {};
  const { userSide, rival, date, number } = state.meta;
  const pos = served?.finishPosition ?? order.indexOf(userSide) + 1;
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
  const calls = callsFrom(state, served);
  const planResult = planFrom(state, served);
  const local = game.localScore();
  const score = response?.score ?? (calls.length ? local?.score : null);
  const momentById = new Map(state.moments.map((m) => [m.id, m]));
  const live = state.meta.source === 'live';
  const finishers = served?.result.finishers ?? state.result?.finishers ?? [];
  const rivalPos = finishers.includes(rival) ? order.indexOf(rival) + 1 : 0;
  const gapToRival =
    gaps[userSide] !== undefined && gaps[rival] !== undefined
      ? (gaps[rival] as number) - (gaps[userSide] as number)
      : null;
  const teamOf = (code: string) =>
    TEAM_COLOR[model?.drivers.find((d) => d.code === code)?.team ?? ''] ?? '#3B454A';
  const hero = (
    <ResultHero
      v={v}
      raceName={model?.race.name ?? state.meta.raceId}
      userSide={userSide}
      rival={rival}
      pos={finishers.includes(userSide) ? pos : 0}
      dsq={(served?.result.disqualified ?? state.result?.disqualified ?? []).includes(userSide)}
      realPos={realPos}
      rivalPos={rivalPos}
      team={team}
      gapToRival={gapToRival}
      podium={finishers.slice(0, 3)}
      teamOf={teamOf}
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

  const share = eras
    ? erasShareLine(
        state.meta.raceId,
        eras.legend,
        squaresOf([...(planResult ? [planResult] : []), ...calls]),
        attempt,
      )
    : shareLine(number, v.outcome === 'beat', calls, response?.percentile ?? null, planResult);
  const copy = async () => {
    const text = `${share}\n${location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt('Copy your result:', text);
    }
  };

  const bands = [...(planResult ? [planResult.band] : []), ...calls.map((c) => c.band)];
  const counts = (['green', 'yellow', 'orange', 'red'] as Band[])
    .map((b) => [b, bands.filter((x) => x === b).length] as const)
    .filter(([, n]) => n > 0);

  if (state.phase === 'finished' || state.phase === 'submitting') {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6">
        {hero}
        <button
          type="button"
          disabled={state.phase === 'submitting'}
          onClick={game.submit}
          className="disp rounded-md bg-[var(--you)] py-4 text-[17px] tracking-wide text-[var(--you-ink)] hover:brightness-110 disabled:opacity-60"
        >
          {state.phase === 'submitting' ? 'Grading your calls…' : 'See how you did'}
        </button>
      </main>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <GroundBackdrop raceId={state.meta.raceId} />
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--glass-edge)] bg-[var(--paper)]/70 px-4 backdrop-blur md:h-16 md:px-6">
        <button
          type="button"
          onClick={onHome}
          className="disp wide text-[18px] leading-none hover:text-[var(--you)]"
        >
          <Brand />
        </button>
        <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9AA5A0]">
          {eras
            ? `Eras · Era ${eras.era.id}${eras.legend ? ' · Legend' : ''}`
            : number
              ? 'Daily'
              : 'Practice run'}{' '}
          · {model?.race.name ?? state.meta.raceId}
        </span>
      </header>
      <AnnouncementBanner />

      {/* A laptop shows two columns: the result, score and share on the left; your calls and
          the day's numbers on the right. */}
      <main className="mx-auto grid w-full max-w-6xl items-start gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          {hero}

          {eras && <EraResultsPanel sub={sub} model={model} info={eras} onRetry={game.submit} />}

          {!eras && (
            <section
              aria-label="Score"
              className="flex items-center gap-5 rounded-lg border border-[var(--glass-edge)] bg-[var(--glass)] p-4"
            >
              <ScoreRing score={score ?? null} />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
                  Score out of 100
                </span>
                <Stats cols={2}>
                  <Stat label="Rank today">
                    <span className="text-[22px]">
                      {response ? `${response.rank}/${response.total}` : '-'}
                    </span>
                  </Stat>
                  <Stat label="Beat">
                    <span className="text-[22px]">
                      {response ? `${response.percentile}%` : '-'}
                    </span>
                  </Stat>
                </Stats>
              </div>
            </section>
          )}

          {model && (
            <DriverDebrief race={state.race} model={model} notes={game.notes()} won={beatRival} />
          )}

          {model?.postRacePenalties?.length ? (
            <p className="m-0 rounded-md border border-[var(--glass-edge)] bg-[var(--glass)] px-3.5 py-3 text-[13px] text-[#B9C2BD]">
              Stewards after the flag, as in the real race:{' '}
              {model.postRacePenalties
                .map((p) => `${surname(p.driver)} +${p.seconds}s (${p.reason})`)
                .join(', ')}
              .
            </p>
          ) : null}

          {account && live && <AccountBar account={account} />}

          {sub.status === 'practice' && (
            <p className="m-0 rounded-md border border-[var(--glass-edge)] bg-[var(--glass)] px-3.5 py-3 text-[13px] text-[#B9C2BD]">
              Practice run: graded on this device, not submitted.
            </p>
          )}
          {sub.status === 'already' && (
            <p className="m-0 rounded-md border border-[var(--glass-edge)] bg-[var(--glass)] px-3.5 py-3 text-[13px] text-[#B9C2BD]">
              You’ve already played today’s race. Here’s your run; a new race arrives at midnight.
            </p>
          )}
          {sub.status === 'error' && !eras && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_14%,#12171A)] px-3.5 py-3 text-[13px]">
              <span>Not submitted ({sub.error}). Your grades are below.</span>
              <button
                type="button"
                onClick={game.submit}
                className="rounded-md bg-[var(--box)] px-3 py-2 font-bold text-white"
              >
                Retry
              </button>
            </div>
          )}

          <Panel title="Share">
            <div className="flex flex-col gap-3">
              <GradeStrip bands={bands} size="lg" />
              <p className="mono m-0 break-words text-[13px] text-[#B9C2BD]">{share}</p>
              <button
                type="button"
                onClick={copy}
                className="disp rounded-md bg-[#EEF1EE] py-3 text-[15px] tracking-wide text-[#0E1214] hover:bg-white"
              >
                {copied ? 'Copied!' : 'Share result'}
              </button>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <section aria-label="Your calls" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-4 w-[5px] -skew-x-12 bg-[var(--you)]" />
                <h2 className="disp m-0 text-[18px] leading-none">Your calls</h2>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.1em]">
                {counts.map(([b, n]) => (
                  <span key={b} style={{ color: BAND[b].color }}>
                    {n} {BAND[b].label}
                  </span>
                ))}
              </span>
            </div>
            {/* How to read the bars. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#9AA5A0]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-5 bg-[#9AA5A0]" /> Your chance of the goal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-[3px] bg-[#EEF1EE]" /> Best call
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-[3px] border border-[#EEF1EE]" /> Real team
              </span>
            </div>
            <ol className="m-0 flex list-none flex-col p-0">
              {planResult && <PlanRow plan={planResult} state={state} />}
              {calls.map((c) => (
                <CallRow
                  key={c.momentId}
                  call={c}
                  moment={momentById.get(c.momentId)}
                  auto={(() => {
                    const m = momentById.get(c.momentId);
                    return !!m && !!model && autoStay(model, m, state.decisions) === c.chosen;
                  })()}
                />
              ))}
            </ol>
          </section>

          {stats && stats.runs > 0 && (
            <Panel
              title="Today"
              right={
                <span className="mono text-[12px] font-bold text-[#B9C2BD]">
                  {stats.runs} {stats.runs === 1 ? 'run' : 'runs'} · avg{' '}
                  {Math.round(stats.meanScore)}
                </span>
              }
            >
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {stats.moments.map((m) => {
                  const moment = momentById.get(m.id);
                  const top = [...m.options].sort((a, b) => b.share - a.share)[0];
                  return (
                    <li key={m.id} className="flex flex-col gap-1">
                      <span className="flex justify-between gap-3 text-[12px]">
                        <span className="min-w-0 truncate">
                          <span className="mono mr-1.5 text-[#9AA5A0]">L{moment?.lap}</span>
                          {top ? `“${labelOf(moment, top.id)}”` : ''}
                        </span>
                        <span className="mono shrink-0 font-bold">{top ? pct(top.share) : ''}</span>
                      </span>
                      <span className="block h-1.5 bg-[#252D31]">
                        <span
                          className="block h-full bg-[#9AA5A0]"
                          style={{ width: top ? pct(top.share) : 0 }}
                        />
                      </span>
                      {moment?.realOptionId && (
                        <span className="text-[11px] text-[#9AA5A0]">
                          {pct(m.matchedReal)} matched the real team
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {board && board.length > 0 && (
            <Panel title="Leaderboard">
              <ol className="m-0 flex list-none flex-col p-0">
                {board.map((e) => (
                  <li
                    key={`${e.rank}-${e.name}`}
                    className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-t border-[#1B2226] py-1.5 text-[13px] first:border-t-0"
                  >
                    <span className="mono text-[#9AA5A0]">{e.rank}</span>
                    <span className="truncate font-semibold">{e.name}</span>
                    <span className="mono font-bold">{Math.round(e.score)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <details className="group rounded-lg border border-[var(--glass-edge)] bg-[var(--glass)] p-3.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3.5 w-[5px] -skew-x-12 bg-[var(--you)]" />
                <span className="disp text-[12px] tracking-[0.08em]">Classification</span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA5A0] group-open:hidden">
                Show
              </span>
            </summary>
            <ol className="m-0 mt-3 flex list-none flex-col p-0">
              {order.map((code, i) => (
                <li
                  key={code}
                  className={`grid grid-cols-[24px_4px_minmax(0,1fr)_auto] items-center gap-2 px-1.5 py-1 text-[13px] ${
                    code === userSide
                      ? 'bg-[color-mix(in_srgb,var(--you)_24%,#12171A)]'
                      : code === rival
                        ? 'bg-[color-mix(in_srgb,var(--rival)_16%,#12171A)]'
                        : ''
                  }`}
                >
                  <span className="mono text-right text-[#9AA5A0]">{i + 1}</span>
                  <span className="h-3.5 w-1 -skew-x-12" style={{ background: teamOf(code) }} />
                  <span className="disp text-[13px]">{code}</span>
                  <span className="mono text-[12px] text-[#B9C2BD]">
                    {i === 0 ? 'Winner' : gaps[code] != null ? `+${gaps[code]?.toFixed(1)}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </details>

          {eras && <EraResultActions info={eras} />}

          {!eras && (
            <a
              href="/gauntlet"
              className="call-plate !gap-1 hover:bg-[#192024]"
              style={{ '--accent': 'var(--box)' } as React.CSSProperties}
            >
              <span className="disp text-[19px] leading-none">Keep racing: Gauntlet</span>
              <span className="text-[13px] text-[#9AA5A0]">
                Different races back to back until you lose one
              </span>
            </a>
          )}

          {!live && !eras && (
            <button
              type="button"
              onClick={game.reset}
              className="rounded-md border border-[#343D42] py-3 font-semibold text-[#D5DBD7] hover:border-[#6E7A75]"
            >
              Play again
            </button>
          )}
        </div>
      </main>
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
