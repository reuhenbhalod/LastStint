// Survivor mode (docs/survivor-spec.md): races back to back from the survivor pool until the
// first loss. The server deals each race and its seed and verifies each finished race; this
// screen runs the mode: the lobby (rules, Start, the leaderboards), each race (straight into the
// race screen), the result and the next race's brief between races, and the run's end. A run
// in progress is kept (its id here, the race in its own save slot): leaving a race for the menu,
// or a refresh, lands on the lobby with only a way back to it, never a new run.

import type { RaceModel } from '@laststint/sim';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disclaimer } from '../components/Disclaimer.js';
import { ChequeredIcon, FlagIcon, OvertakeIcon } from '../components/Icons.js';
import { TopBar } from '../components/TopBar.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { ApiError, type SurvivorBoardEntry, type SurvivorState, survivorApi } from '../data/api.js';
import { anonId } from '../data/player.js';
import { SurvivorProvider } from '../data/provider.js';
import { goalOf } from '../game/goal.js';
import { useTeamTheme } from '../game/teamTheme.js';
import { useGame } from '../game/useGame.js';
import { Straight, type StraightState } from '../gauntlet/Straight.js';
import { clearRun } from '../state/storage.js';
import { RaceScreen } from './RaceScreen.js';

const RUN_KEY = 'pitwall:survivor-run';
const RACE_KEY = 'pitwall:survivor-race';

const RACE_FILES = import.meta.glob<{ default: RaceModel }>('../../../../data/races/*.json');

function savedRunId(): string | null {
  try {
    return localStorage.getItem(RUN_KEY);
  } catch {
    return null;
  }
}

function saveRunId(id: string | null): void {
  try {
    if (id) localStorage.setItem(RUN_KEY, id);
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // storage blocked: the run lasts for this page
  }
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'no-survivor-races') return 'Gauntlet races are on their way. Check back soon.';
    if (e.code === 'rate-limited') return 'Too many requests. Give it a minute.';
    return `The server said ${e.code}.`;
  }
  return 'Can’t reach the server. Check your connection and try again.';
}

/** A race's display name and duel, from its model. */
function useRaceName(raceId: string | undefined) {
  const [model, setModel] = useState<RaceModel | null>(null);
  useEffect(() => {
    setModel(null);
    if (!raceId) return;
    const load = RACE_FILES[`../../../../data/races/${raceId}.json`];
    load?.().then(
      (m) => setModel(m.default),
      () => {},
    );
  }, [raceId]);
  return model;
}

function Header() {
  return <TopBar active="gauntlet" />;
}

const PANEL = 'fl-panel flex min-w-0 flex-col gap-5 rounded-2xl p-6';
const EYEBROW = 'm-0 text-[12px] font-bold uppercase tracking-[0.18em]';
const GO =
  'fl-display h-[60px] rounded-md bg-[var(--fl-amber)] px-8 text-[26px] tracking-[0.06em] text-[#1A0E00] shadow-[0_0_48px_-8px_rgba(255,179,71,0.75)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60';

/**
 * The floodlit straight (gauntlet/Straight.tsx) across the page, with a panel either side of the
 * car. On a phone the scene is a band at the top and the panels stack under it.
 */
function Floodlit({
  next,
  state,
  label,
  left,
  right,
}: {
  next: number;
  state: StraightState;
  label: string;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <Straight
        next={next}
        state={state}
        label={label}
        className="relative block aspect-[4/3] w-full sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto lg:h-full"
      />
      <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-4 px-4 py-5 lg:min-h-[calc(100dvh-56px)] lg:grid-cols-[360px_minmax(0,1fr)_360px] lg:items-center lg:px-8 lg:py-10 xl:grid-cols-[400px_minmax(0,1fr)_380px]">
        <div className="min-w-0">{left}</div>
        <div aria-hidden="true" className="hidden lg:block" />
        <div className="min-w-0">{right}</div>
      </div>
    </section>
  );
}

function Board({ title = 'Furthest down the straight' }: { title?: string }) {
  const [board, setBoard] = useState<{
    allTime: SurvivorBoardEntry[];
    week: SurvivorBoardEntry[];
  } | null>(null);
  const [tab, setTab] = useState<'week' | 'allTime'>('week');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    survivorApi.leaderboard().then(setBoard, () => setFailed(true));
  }, []);
  const rows = board?.[tab] ?? [];
  return (
    <section aria-label="Gauntlet leaderboard" className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="fl-display m-0 text-[24px]">{title}</h2>
        <div className="flex gap-1 text-[12px] font-semibold">
          {(
            [
              ['week', 'This week'],
              ['allTime', 'All time'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`rounded px-2.5 py-1.5 ${tab === k ? 'bg-[#F4EFE6] text-[#05070D]' : 'text-[#A9B0C6] hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="m-0 text-[14px] text-[#A9B0C6]">The leaderboard isn’t available.</p>
      ) : !board ? (
        <p className="m-0 text-[14px] text-[#A9B0C6]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-[14px] text-[#A9B0C6]">
          No runs yet. Be the first down the straight.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-[15px]">
          {rows.slice(0, 10).map((r) => (
            <li
              key={`${r.rank}-${r.name}`}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_3.5rem] items-center gap-3 border-b border-white/5 py-1.5"
            >
              <span className="mono text-[12px] text-[#7F88A3]">{r.rank}</span>
              <span className="truncate font-semibold">
                {r.name}
                {r.live && (
                  <span className="ml-2 text-[11px] font-bold text-[var(--fl-green)]">racing</span>
                )}
              </span>
              <span className="fl-display text-[22px] text-[var(--fl-amber)]">
                <span className="sr-only">Round </span>
                {r.rounds}
              </span>
              <span className="mono text-right text-[12px] text-[#A9B0C6]">
                {r.meanScore.toFixed(0)} pts
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="m-0 text-[12px] text-[#7F88A3]">Rounds survived, then the points a call.</p>
    </section>
  );
}

function Lobby({
  onStart,
  busy,
  error,
  live,
  onResume,
}: {
  onStart: () => void;
  busy: boolean;
  error: string | null;
  /** A run in progress: the menu offers only to go back to it (no new run, so leaving a race
   * can't restart it). */
  live: SurvivorState | null;
  onResume: () => void;
}) {
  const round = live?.current?.round ?? 1;
  return (
    <Floodlit
      next={round}
      state="idle"
      label={`Your car on a floodlit straight at night. Round ${round}'s gantry is ahead, its lamps amber, and more gantries stretch away behind it.`}
      left={
        <div className={PANEL}>
          <p className={`${EYEBROW} text-[var(--fl-amber)]`}>Game mode · Survival</p>
          <h1 className="fl-display m-0 text-[80px] sm:text-[100px]">Gauntlet</h1>
          <p className="m-0 text-[17px] leading-relaxed text-[#E4DFD5]">
            Every gantry is a race. Win it and you drive under, and the next one lights up. Lose
            once and the lights go out.
          </p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px] text-[#C3C8D8]">
            <li className="flex items-start gap-2.5">
              <OvertakeIcon size={16} className="mt-0.5 shrink-0 text-[var(--fl-amber)]" /> Beat the
              rival, or hold them off in a defend race
            </li>
            <li className="flex items-start gap-2.5">
              <FlagIcon size={16} className="mt-0.5 shrink-0 text-[var(--fl-amber)]" /> Short races:
              two or three big calls, with the radio between
            </li>
            <li className="flex items-start gap-2.5">
              <ChequeredIcon size={16} className="mt-0.5 shrink-0 text-[var(--fl-amber)]" /> Real
              races you won’t get in the daily, in a random order
            </li>
          </ul>
          {live ? (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={onResume} className={GO}>
                Back to round {round}
              </button>
              <span className="text-[13px] text-[#A9B0C6]">
                Your run is still on: {live.rounds} {live.rounds === 1 ? 'round' : 'rounds'}{' '}
                survived. Your race waits where you left it.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button type="button" disabled={busy} onClick={onStart} className={GO}>
                {busy ? 'Dealing round 1…' : 'Start a run'}
              </button>
              <span className="text-[13px] text-[#A9B0C6]">Play as many runs as you like.</span>
            </div>
          )}
          {error && (
            <p className="m-0 rounded-lg border border-[var(--fl-red)] px-3 py-2 text-[14px]">
              {error}
            </p>
          )}
        </div>
      }
      right={<Board />}
    />
  );
}

/** One race of the run: its card, the race, then the result goes to the server. */
function RoundRace({
  run,
  onResult,
  onHome,
}: {
  run: SurvivorState;
  onResult: (won: boolean, state: SurvivorState, finish: string) => void;
  onHome: () => void;
}) {
  const cur = run.current as NonNullable<SurvivorState['current']>;
  const provider = useMemo(
    () => new SurvivorProvider(run.runId, cur.round, cur.raceId, cur.seed),
    [run.runId, cur.round, cur.raceId, cur.seed],
  );
  const game = useGame(provider, undefined, RACE_KEY);
  // The race in the driver's team colours (game/teamTheme.ts).
  useTeamTheme(game.model);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const body = await game.submission();
      if (!body) throw new Error('no race');
      const res = await survivorApi.round(run.runId, { ...body, round: cur.round });
      clearRun(RACE_KEY);
      const order = res.result.result.order;
      const model = game.model as RaceModel;
      const me = order.indexOf(model.userSide) + 1;
      const them = order.indexOf(model.rival) + 1;
      const finish = res.result.disqualified
        ? `${model.userSide} was disqualified`
        : `${model.userSide} P${me}, ${model.rival} ${them ? `P${them}` : 'out'}`;
      onResult(res.won, res.state, finish);
    } catch (e) {
      // Already submitted (a reload before the result showed): carry on from the server's run.
      if (e instanceof ApiError && e.code === 'wrong-round') {
        try {
          const s = await survivorApi.state(run.runId, anonId());
          const last = s.history.find((h) => h.round === cur.round);
          clearRun(RACE_KEY);
          onResult(!!last?.won, s, '');
          return;
        } catch {
          // fall through to the error
        }
      }
      setError(errorText(e));
      setSending(false);
    }
  }, [game, run.runId, cur.round, onResult]);
  // The race screen calls this once the flag has fallen; keep one function for it.
  const sendRef = useRef(send);
  sendRef.current = send;
  const finished = useCallback(() => {
    sendRef.current();
  }, []);

  // No race card in a run: the straight already briefed the round, so the race starts as soon
  // as it has loaded (and a reload mid-run lands back on the race).
  const phase = game.state?.phase;
  const start = game.start;
  useEffect(() => {
    if (phase === 'intro') start();
  }, [phase, start]);

  if (game.error) return <p className="p-6 text-center text-[var(--muted)]">{game.error}</p>;
  if (!game.state || !game.model || phase === 'intro') {
    return (
      <div className="fl flex min-h-screen items-center justify-center">
        <p className={`${EYEBROW} text-[var(--fl-amber)]`}>Round {cur.round} · lights out</p>
      </div>
    );
  }
  if (sending || error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        {error ? (
          <>
            <p className="m-0">{error}</p>
            <button
              type="button"
              onClick={send}
              className="rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-[var(--you-ink)]"
            >
              Try again
            </button>
          </>
        ) : (
          <p className="m-0 text-[var(--muted)]">Checking your race with the stewards…</p>
        )}
      </main>
    );
  }
  return (
    <RaceScreen
      game={game}
      state={game.state}
      model={game.model}
      onFinished={finished}
      onHome={onHome}
    />
  );
}

function Between({
  run,
  finish,
  onNext,
}: {
  run: SurvivorState;
  finish: string;
  onNext: () => void;
}) {
  const next = useRaceName(run.current?.raceId);
  const round = run.current?.round ?? run.rounds + 1;
  return (
    <Floodlit
      next={round}
      state="advance"
      label={`Your car drives under round ${run.rounds}'s gantry, its lamps green. Round ${round}'s gantry comes up and its lamps light amber.`}
      left={
        <div className={PANEL}>
          <p className={`${EYEBROW} text-[var(--fl-green)]`}>Round {run.rounds} survived</p>
          <h1 className="fl-display m-0 text-[120px] leading-[0.8]">
            {run.rounds}
            <span className="sr-only"> {run.rounds === 1 ? 'round' : 'rounds'} survived</span>
          </h1>
          {finish && <p className="m-0 text-[16px] text-[#E4DFD5]">{finish}</p>}
          <p className="m-0 text-[14px] text-[#A9B0C6]">
            Through the gantry. Round {round} is lit.
          </p>
        </div>
      }
      right={
        <div className={PANEL}>
          <p className={`${EYEBROW} text-[var(--fl-amber)]`}>Next · round {round}</p>
          {next ? (
            <RaceBrief model={next} />
          ) : (
            <h2 className="fl-display m-0 text-[40px] leading-[0.95]">Next race</h2>
          )}
          <button type="button" onClick={onNext} className={GO}>
            Next race
          </button>
          <p className="m-0 text-[13px] text-[#A9B0C6]">
            {run.meanScore.toFixed(0)} pts a call so far.
          </p>
        </div>
      }
    />
  );
}

/** The seconds from one car to the other at the takeover, from the cars' gaps to the car
 * ahead; positive when `a` is ahead. */
function gapAt(model: RaceModel, a: string, b: string): number | null {
  const pos = (c: string) => model.drivers.find((d) => d.code === c)?.stateAtTakeover.position;
  const pa = pos(a);
  const pb = pos(b);
  if (!pa || !pb) return null;
  const [lo, hi] = pa < pb ? [pa, pb] : [pb, pa];
  const sum = model.drivers
    .filter((d) => d.stateAtTakeover.position > lo && d.stateAtTakeover.position <= hi)
    .reduce((t, d) => t + d.stateAtTakeover.gapAhead, 0);
  return pa < pb ? sum : -sum;
}

/** One side of the brief's duel: code, place and tyre at the takeover. */
function BriefSide({ model, code, you }: { model: RaceModel; code: string; you?: boolean }) {
  const at = model.drivers.find((d) => d.code === code)?.stateAtTakeover;
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${you ? '' : 'items-end text-right'}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7F88A3]">
        {you ? 'You run' : 'Rival'}
      </span>
      <span
        className="fl-display text-[34px] leading-none"
        style={{ color: you ? 'var(--fl-amber)' : '#F4EFE6' }}
      >
        {code}
      </span>
      {at && (
        <span className="flex items-center gap-2 text-[13px] text-[#C3C8D8]">
          P{at.position} <TyreBadge compound={at.compound} age={at.tyreAge} />
        </span>
      )}
    </div>
  );
}

/** The next race in a few lines: where and when you take over, the duel, and the job. */
function RaceBrief({ model }: { model: RaceModel }) {
  const goal = goalOf(model);
  const [title, subtitle] = (model.race.name ?? model.race.id).split(': ');
  const lapsLeft = model.race.laps - model.race.takeoverLap;
  const gap = gapAt(model, model.userSide, model.rival);
  const team = model.drivers.find((d) => d.code === model.userSide)?.team;
  const realPos = goal.place;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="fl-display m-0 text-[40px] leading-[0.95]">{title}</h2>
        {subtitle && <p className="m-0 text-[14px] text-[#A9B0C6]">{subtitle}</p>}
      </div>
      <p className="m-0 text-[14px] text-[#E4DFD5]">
        You take over on lap {model.race.takeoverLap} of {model.race.laps}:{' '}
        <span className="font-semibold">{lapsLeft} laps to run</span>
        {team ? ` on the ${team} pit wall.` : '.'}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <BriefSide model={model} code={model.userSide} you />
        <div className="flex flex-col items-center text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7F88A3]">
            Gap
          </span>
          <span className="fl-display text-[26px] leading-none">
            {gap === null ? '-' : `${Math.abs(gap).toFixed(1)}s`}
          </span>
          <span className="text-[11px] text-[#7F88A3]">
            {gap === null ? '' : gap >= 0 ? 'you lead' : 'ahead of you'}
          </span>
        </div>
        <BriefSide model={model} code={model.rival} />
      </div>
      <p className="m-0 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="rounded-full bg-[color-mix(in_srgb,var(--fl-amber)_18%,transparent)] px-3 py-1 font-bold text-[var(--fl-amber)]">
          {goal.short}
        </span>
        {realPos > 0 && (
          <span className="text-[#A9B0C6]">
            The real pit wall got P{realPos}. {goal.kind === 'defend' ? 'Keep it.' : 'Beat it.'}
          </span>
        )}
      </p>
    </>
  );
}

function Over({
  run,
  finish,
  onAgain,
}: {
  run: SurvivorState;
  finish: string;
  onAgain: () => void;
}) {
  const lost = run.rounds + 1;
  return (
    <>
      <Floodlit
        next={lost}
        state="out"
        label={`Round ${lost}'s lamps are red, and the floodlights go out down the straight.`}
        left={
          <div className={PANEL}>
            <p className={`${EYEBROW} text-[var(--fl-red)]`}>Lights out · run over</p>
            <h1 className="fl-display m-0 text-[88px] leading-[0.85]">
              {run.rounds} {run.rounds === 1 ? 'round' : 'rounds'}
            </h1>
            {finish && <p className="m-0 text-[16px] text-[#E4DFD5]">Last race: {finish}</p>}
            {run.rank && run.rounds > 0 && (
              <p className="m-0 text-[15px]">
                #{run.rank} of {run.total} runs all time · {run.meanScore.toFixed(0)} pts a call
              </p>
            )}
            <button type="button" onClick={onAgain} className={GO}>
              Start a new run
            </button>
          </div>
        }
        right={
          run.history.length > 0 ? (
            <section aria-label="Your run" className={PANEL}>
              <h2 className="fl-display m-0 text-[24px]">Your run</h2>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px]">
                {run.history.map((h) => (
                  <li key={h.round} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: h.won ? 'var(--fl-green)' : 'var(--fl-red)',
                        boxShadow: `0 0 10px ${h.won ? 'var(--fl-green)' : 'var(--fl-red)'}`,
                      }}
                    />
                    <span className="mono w-6 text-[#7F88A3]">{h.round}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <RaceName id={h.raceId} />
                    </span>
                    <span
                      className="font-semibold"
                      style={{ color: h.won ? 'var(--fl-green)' : 'var(--fl-red)' }}
                    >
                      {h.won ? 'Survived' : 'Out'} · P{h.finishPosition}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <Board />
          )
        }
      />
      {run.history.length > 0 && (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <Board />
        </div>
      )}
    </>
  );
}
function RaceName({ id }: { id: string }) {
  const m = useRaceName(id);
  return <>{m?.race.name ?? id}</>;
}

export function Survivor() {
  const [run, setRun] = useState<SurvivorState | null>(null);
  const [view, setView] = useState<'loading' | 'lobby' | 'race' | 'between' | 'over'>('loading');
  const [finish, setFinish] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Out of a race to the Gauntlet menu: the race is saved and the run stays live.
  const home = useCallback(() => {
    setView('lobby');
    window.scrollTo(0, 0);
  }, []);

  // Carry on a run in progress.
  useEffect(() => {
    const id = savedRunId();
    if (!id) {
      setView('lobby');
      return;
    }
    survivorApi.state(id, anonId()).then(
      (s) => {
        if (s.status === 'live' && s.current) {
          setRun(s);
          setView('lobby');
        } else {
          saveRunId(null);
          setView('lobby');
        }
      },
      () => {
        saveRunId(null);
        setView('lobby');
      },
    );
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await survivorApi.start(anonId());
      clearRun(RACE_KEY);
      saveRunId(s.runId);
      setRun(s);
      setFinish('');
      setView('race');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onResult = useCallback((won: boolean, s: SurvivorState, text: string) => {
    setRun(s);
    setFinish(text);
    if (!won) saveRunId(null);
    setView(won ? 'between' : 'over');
    window.scrollTo(0, 0);
  }, []);

  if (view === 'race' && run?.current) {
    return <RoundRace key={run.current.round} run={run} onResult={onResult} onHome={home} />;
  }
  return (
    <div className="fl relative isolate flex min-h-screen flex-col">
      <Header />
      <main className="flex w-full flex-1 flex-col">
        {view === 'loading' && <p className="p-6 text-center text-[#A9B0C6]">Loading…</p>}
        {view === 'lobby' && (
          <Lobby
            onStart={start}
            busy={busy}
            error={error}
            live={run?.status === 'live' && run.current ? run : null}
            onResume={() => setView('race')}
          />
        )}
        {view === 'between' && run && (
          <Between run={run} finish={finish} onNext={() => setView('race')} />
        )}
        {view === 'over' && run && <Over run={run} finish={finish} onAgain={start} />}
      </main>
      <Disclaimer />
    </div>
  );
}
