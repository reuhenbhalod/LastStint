// Survivor mode (docs/survivor-spec.md): races back to back from the survivor pool until the
// first loss. The server deals each race and its seed and verifies each finished race; this
// screen runs the mode: the lobby (rules, Start, the leaderboards), each race (its card, then
// the race screen), the result between races, and the run's end. A run in progress is kept
// (its id here, the race in its own save slot), so a refresh carries on where it was.

import type { RaceModel } from '@boxthislap/sim';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChequeredIcon, FlagIcon, OvertakeIcon } from '../components/Icons.js';
import { ApiError, type SurvivorBoardEntry, type SurvivorState, survivorApi } from '../data/api.js';
import { anonId } from '../data/player.js';
import { SurvivorProvider } from '../data/provider.js';
import { goalOf } from '../game/goal.js';
import { useGame } from '../game/useGame.js';
import { clearRun } from '../state/storage.js';
import { IntroCard } from './IntroCard.js';
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
    if (e.code === 'no-survivor-races') return 'Survivor races are on their way. Check back soon.';
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

function Header({ onHome }: { onHome: () => void }) {
  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onHome}
          className="flex items-baseline gap-2 hover:text-[var(--you)]"
        >
          <span className="disp wide text-[20px] leading-none">Pit Wall</span>
          <span className="eyebrow">Survivor</span>
        </button>
        <button
          type="button"
          onClick={onHome}
          className="rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)]"
        >
          Today’s daily
        </button>
      </div>
    </header>
  );
}

function Board({ mine }: { mine?: string }) {
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
    <section aria-label="Survivor leaderboard" className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="disp m-0 text-[18px] leading-none">Leaderboard</h2>
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
              className={`rounded-md px-2.5 py-1 ${tab === k ? 'bg-[var(--ink)] text-[var(--paper)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="m-0 text-[13px] text-[var(--muted)]">The leaderboard isn’t available.</p>
      ) : !board ? (
        <p className="m-0 text-[13px] text-[var(--muted)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-[13px] text-[var(--muted)]">No runs yet. Be the first.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
          {rows.slice(0, 15).map((r) => (
            <li
              key={`${r.rank}-${r.name}`}
              className={`grid grid-cols-[2rem_1fr_auto_auto] items-baseline gap-3 rounded-md px-2 py-1 ${r.name === mine ? 'bg-[color-mix(in_srgb,var(--you)_14%,transparent)]' : ''}`}
            >
              <span className="mono text-[var(--muted)]">{r.rank}</span>
              <span className="truncate font-semibold">
                {r.name}
                {r.live && <span className="ml-2 text-[11px] text-[var(--you)]">racing</span>}
              </span>
              <span className="disp">{r.rounds}</span>
              <span className="mono w-12 text-right text-[12px] text-[var(--muted)]">
                {r.meanScore.toFixed(0)} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Lobby({
  onStart,
  busy,
  error,
}: {
  onStart: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 85% 20%, color-mix(in srgb, var(--box) 16%, transparent), transparent 60%)',
          }}
        />
        <div className="relative flex flex-col gap-4">
          <p className="eyebrow m-0 !text-[var(--box-ink)]">Game mode</p>
          <h1 className="disp wide m-0 text-[48px] leading-[0.9] sm:text-[68px]">Survivor</h1>
          <p className="m-0 max-w-[52ch] text-[17px] leading-relaxed">
            Race after race, each one a different real race you haven’t seen in the daily. Win and
            you go on. Lose once and the run is over. How far can you go?
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14px] text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <OvertakeIcon size={16} className="text-[var(--you)]" /> Beat the rival, or hold them
              off in a defend race, to survive the round
            </li>
            <li className="flex items-center gap-2">
              <FlagIcon size={16} className="text-[var(--you)]" /> Short races: 2-3 big calls each,
              with the radio between
            </li>
            <li className="flex items-center gap-2">
              <ChequeredIcon size={16} className="text-[var(--you)]" /> Its own leaderboard: rounds
              survived, then your calls
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onStart}
              className="rounded-xl bg-[var(--box)] px-8 py-4 text-[18px] font-bold text-white shadow-[0_10px_40px_-12px_var(--box)] hover:brightness-110 disabled:opacity-60"
            >
              {busy ? 'Dealing the first race…' : 'Start a run →'}
            </button>
            <span className="text-[13px] text-[var(--muted)]">Play as many runs as you like.</span>
          </div>
          {error && (
            <p className="m-0 rounded-lg border border-[var(--box)] px-3 py-2 text-[14px]">
              {error}
            </p>
          )}
        </div>
      </section>
      <Board />
    </div>
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

  if (game.error) return <p className="p-6 text-center text-[var(--muted)]">{game.error}</p>;
  if (!game.state || !game.model) {
    return <p className="p-6 text-center text-[var(--muted)]">Loading round {cur.round}…</p>;
  }
  const phase = game.state.phase;
  if (phase === 'intro') {
    return (
      <IntroCard
        state={game.state}
        model={game.model}
        onStart={game.start}
        onHelp={() => {}}
        resume={`Start round ${cur.round}`}
      />
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
              className="rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-[#08231f]"
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
  const goal = next ? goalOf(next) : null;
  return (
    <section className="flex flex-col items-center gap-6 py-6 text-center">
      <p className="eyebrow m-0 !text-[var(--you)]">Round {run.rounds} survived</p>
      <h1 className="disp wide m-0 text-[56px] leading-[0.9] sm:text-[80px]">{run.rounds}</h1>
      <p className="m-0 text-[16px] text-[var(--muted)]">{finish}</p>
      <div className="card flex w-full max-w-md flex-col gap-2 text-left">
        <span className="eyebrow">Next · round {run.current?.round}</span>
        <span className="disp text-[24px] leading-tight">
          {next?.race.name ?? run.current?.raceId}
        </span>
        {next && goal && (
          <span className="text-[14px] text-[var(--muted)]">
            You run {next.userSide}. {goal.short}.
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="rounded-xl bg-[var(--you)] px-10 py-4 text-[18px] font-bold text-[#08231f] hover:brightness-110"
      >
        Next race →
      </button>
    </section>
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
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="eyebrow m-0 !text-[var(--box-ink)]">Run over</p>
        <h1 className="disp wide m-0 text-[56px] leading-[0.9] sm:text-[80px]">
          {run.rounds} {run.rounds === 1 ? 'round' : 'rounds'}
        </h1>
        {finish && <p className="m-0 text-[16px] text-[var(--muted)]">Last race: {finish}</p>}
        {run.rank && run.rounds > 0 && (
          <p className="m-0 text-[15px]">
            #{run.rank} of {run.total} runs all time
            {run.rounds ? ` · ${run.meanScore.toFixed(0)} pts a call` : ''}
          </p>
        )}
        <button
          type="button"
          onClick={onAgain}
          className="rounded-xl bg-[var(--box)] px-10 py-4 text-[18px] font-bold text-white hover:brightness-110"
        >
          Start a new run →
        </button>
      </section>
      {run.history.length > 0 && (
        <section className="card flex flex-col gap-2">
          <span className="eyebrow">Your run</span>
          <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
            {run.history.map((h) => (
              <li key={h.round} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="mono mr-2 text-[var(--muted)]">{h.round}</span>
                  <RaceName id={h.raceId} />
                </span>
                <span
                  className="font-semibold"
                  style={{ color: h.won ? 'var(--you)' : 'var(--box-ink)' }}
                >
                  {h.won ? 'Survived' : 'Out'} · P{h.finishPosition}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <Board />
    </div>
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
  const home = useCallback(() => {
    location.href = '/';
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
          setView('race');
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
    <div className="flex min-h-screen flex-col">
      <Header onHome={home} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {view === 'loading' && <p className="text-center text-[var(--muted)]">Loading…</p>}
        {view === 'lobby' && <Lobby onStart={start} busy={busy} error={error} />}
        {view === 'between' && run && (
          <Between run={run} finish={finish} onNext={() => setView('race')} />
        )}
        {view === 'over' && run && <Over run={run} finish={finish} onAgain={start} />}
      </main>
    </div>
  );
}
