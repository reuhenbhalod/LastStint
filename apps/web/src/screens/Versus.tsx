// Versus mode (docs/versus-spec.md V6): /versus creates or joins a match; /versus/<CODE> is the
// match itself: the lobby, the car pick, the race (two cars on the track map, the big calls
// for both walls at once, the headset and battle calls) and the graded result.

import {
  type PlayerIndex,
  type RaceModel,
  STAT_SCALE,
  VERSUS_CARS,
  VERSUS_LAPS,
  VERSUS_TRACKS,
  type VersusCall,
  type VersusCarState,
  type VersusMoment,
  type VersusOutcome,
  type VersusRun,
  lifeOf,
  versusOptions,
  versusTrack,
} from '@boxthislap/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiPost } from '../api.js';
import { Brand } from '../components/Brand.js';
import { TrackMap } from '../components/TrackMap.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { RaceStage } from '../three/RaceStage.js';
import type { MapFeed } from '../track/feed.js';
import { outlineFor } from '../track/outlines.js';
import { type VersusView, useVersus } from '../versus/useVersus.js';
import { versusModel, versusRaceState } from '../versus/view.js';

const NAME_KEY = 'laststint:versus-name';
const TYRES = ['SOFT', 'MEDIUM', 'HARD'] as const;
const TYRE_NAME: Record<string, string> = { SOFT: 'Softs', MEDIUM: 'Mediums', HARD: 'Hards' };
const STAT_NAME: Record<string, string> = {
  topSpeed: 'Top speed',
  cornering: 'Cornering',
  tyreWear: 'Tyre life',
  fuelUse: 'Fuel saving',
  pitCrew: 'Pit crew',
};

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // private mode
  }
}

export function Versus() {
  const code = location.pathname.match(/^\/versus\/([A-Za-z]{4})/)?.[1]?.toUpperCase() ?? null;
  const [name, setName] = useState(storedName);
  const [named, setNamed] = useState(!!storedName());
  return (
    <main className="min-h-[100dvh] bg-[#0B0E0D] text-[#EEF1EF]">
      <header className="flex h-14 items-center justify-between border-b border-[#1F2523] px-4">
        <a href="/" aria-label="LastStint home">
          <Brand className="text-[20px]" />
        </a>
        <span className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--rival)]">
          Versus
        </span>
      </header>
      {!named ? (
        <NameCard
          name={name}
          onChange={setName}
          onDone={() => {
            storeName(name.trim());
            setNamed(true);
          }}
        />
      ) : code ? (
        <Match code={code} name={name.trim()} />
      ) : (
        <Lobby name={name.trim()} onRename={() => setNamed(false)} />
      )}
    </main>
  );
}

function NameCard({
  name,
  onChange,
  onDone,
}: {
  name: string;
  onChange: (n: string) => void;
  onDone: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="disp text-[28px] leading-tight">What should we call you?</h1>
      <p className="m-0 text-[14px] text-[var(--muted)]">
        Your name shows to the other player and on the result.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onDone();
        }}
      >
        <input
          value={name}
          onChange={(e) => onChange(e.target.value)}
          maxLength={20}
          placeholder="Your name"
          aria-label="Your name"
          className="min-w-0 flex-1 rounded-lg border border-[var(--rule)] bg-[var(--card)] px-3 py-2.5 text-[16px]"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-[var(--you)] px-5 font-bold text-[var(--you-ink)] disabled:opacity-40"
        >
          Continue
        </button>
      </form>
    </section>
  );
}

// --- Create or join -----------------------------------------------------------------------------

function Lobby({ name, onRename }: { name: string; onRename: () => void }) {
  const [track, setTrack] = useState(VERSUS_TRACKS[0]?.id ?? 'monza');
  const [join, setJoin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await apiPost<{ code: string }>('/api/versus', { track });
      location.assign(`/versus/${room.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : String(e));
      setBusy(false);
    }
  };
  const code = join.trim().toUpperCase();
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="disp text-[32px] leading-tight md:text-[40px]">Head to head</h1>
        <p className="m-0 max-w-[60ch] text-[15px] text-[var(--muted)]">
          Two players, two cars, 20 laps, nobody else on track. Whoever makes the better calls wins,
          graded like the daily. Racing as <strong className="text-[var(--ink)]">{name}</strong>{' '}
          <button type="button" onClick={onRename} className="underline">
            change
          </button>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
          New match: pick the track
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {VERSUS_TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrack(t.id)}
              aria-pressed={track === t.id}
              className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left ${
                track === t.id
                  ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_12%,transparent)]'
                  : 'border-[var(--rule)] bg-[var(--card)] hover:border-[#4a5350]'
              }`}
            >
              <span className="text-[16px] font-bold">{t.name}</span>
              <span className="text-[13px] text-[var(--muted)]">{t.character}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="self-start rounded-xl bg-[var(--you)] px-6 py-3 text-[16px] font-bold text-[var(--you-ink)] disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create match'}
        </button>
        {error && <p className="m-0 text-[13px] text-[var(--box-ink)]">Couldn't create: {error}</p>}
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[A-Z]{4}$/.test(code)) location.assign(`/versus/${code}`);
        }}
      >
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
          Join a match
        </h2>
        <div className="flex gap-2">
          <input
            value={join}
            onChange={(e) => setJoin(e.target.value)}
            maxLength={4}
            placeholder="CODE"
            aria-label="Match code"
            className="w-36 rounded-lg border border-[var(--rule)] bg-[var(--card)] px-3 py-2.5 text-center text-[18px] font-bold uppercase tracking-[0.3em]"
          />
          <button
            type="submit"
            disabled={!/^[A-Z]{4}$/.test(code)}
            className="rounded-lg border border-[var(--rule)] px-5 font-bold disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </form>
    </section>
  );
}

// --- The match ----------------------------------------------------------------------------------

function Match({ code, name }: { code: string; name: string }) {
  const { view, call, answer, pick, leave } = useVersus(code, name);
  const phase = view.room?.phase;
  if (view.error && !view.room)
    return <Notice title="No such match" text={`${code}: ${view.error}`} />;
  if (!view.room) return <Notice title="Connecting…" text={`Match ${code}`} />;
  if (phase === 'lobby') return <Waiting code={code} view={view} />;
  if (phase === 'pick') return <Pick view={view} onPick={pick} />;
  if (view.result) return <Result outcome={view.result} seat={view.seat} model={view.model} />;
  if (phase === 'grading' || view.grading)
    return <Notice title="Grading the calls…" text="Every call, both walls, 400 replays each." />;
  if (view.run && view.model && view.seat !== null)
    return <Race view={view} seat={view.seat} onCall={call} onAnswer={answer} onLeave={leave} />;
  return <Notice title="Lights out soon…" text="Loading the track." />;
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-2 px-4 py-16 text-center">
      <h1 className="disp text-[26px]">{title}</h1>
      <p className="m-0 text-[14px] text-[var(--muted)]">{text}</p>
    </section>
  );
}

function Waiting({ code, view }: { code: string; view: VersusView }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/versus/${code}`;
  const track = view.room ? versusTrack(view.room.track) : null;
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-14 text-center">
      <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {track?.name} · 20 laps
      </p>
      <h1 className="disp text-[56px] tracking-[0.2em]">{code}</h1>
      <p className="m-0 text-[15px] text-[var(--muted)]">
        Send the code or the link. The car pick starts when they join.
      </p>
      <div className="flex w-full items-center gap-2 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-2">
        <span className="min-w-0 flex-1 truncate px-2 text-left text-[13px]">{link}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              .writeText(link)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
          className="rounded-md bg-[var(--you)] px-3 py-1.5 text-[13px] font-bold text-[var(--you-ink)]"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <Seats view={view} />
    </section>
  );
}

function Seats({ view }: { view: VersusView }) {
  return (
    <ul className="m-0 flex w-full list-none flex-col gap-2 p-0">
      {view.room?.seats.map((s, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: two fixed seats
          key={i}
          className="flex items-center justify-between rounded-lg border border-[var(--rule)] px-3 py-2 text-[14px]"
        >
          <span className="font-semibold">
            {s ? s.name : 'Waiting for a player…'}
            {view.seat === i && <span className="ml-2 text-[var(--muted)]">(you)</span>}
          </span>
          <span className="text-[12px] text-[var(--muted)]">
            {s ? (s.connected ? (s.picked ? 'Picked' : 'In') : 'Dropped') : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --- The car pick -------------------------------------------------------------------------------

function useCountdown(until: number | undefined): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

function Pick({ view, onPick }: { view: VersusView; onPick: (car: string, tyre: string) => void }) {
  const [car, setCar] = useState('balanced');
  const [tyre, setTyre] = useState<string>('MEDIUM');
  const left = useCountdown(view.room?.pickUntil);
  const track = view.room ? versusTrack(view.room.track) : null;
  const mine = view.seat !== null ? view.room?.seats[view.seat] : null;
  const s = track?.straightShare ?? 0.66;
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
            {track?.name} · about {Math.round(s * 100)}% of the lap flat out (an estimate)
          </p>
          <h1 className="disp text-[28px] leading-tight">Pick your car</h1>
          <p className="m-0 text-[14px] text-[var(--muted)]">
            {track?.character}. Picks show when both are in.
          </p>
        </div>
        <span className="disp text-[32px] tabular-nums text-[var(--flag)]">{left}s</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VERSUS_CARS.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!!mine?.picked}
            onClick={() => setCar(c.id)}
            aria-pressed={car === c.id}
            className={`flex flex-col gap-3 rounded-lg border p-4 text-left ${
              car === c.id
                ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_10%,transparent)]'
                : 'border-[var(--rule)] bg-[var(--card)] hover:border-[#4a5350]'
            }`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="disp text-[20px]">{c.name}</span>
              <span className="text-[12px] text-[var(--muted)]">{c.blurb}</span>
            </span>
            <span className="flex w-full flex-col gap-1.5">
              {Object.entries(c.stats).map(([k, v]) => (
                <StatBar key={k} label={STAT_NAME[k] ?? k} value={v} />
              ))}
            </span>
            <span className="text-[12px] text-[var(--muted)]">Here: {lapEdge(track, c.stats)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-[var(--muted)]">Start on</span>
        {TYRES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={!!mine?.picked}
            onClick={() => setTyre(t)}
            aria-pressed={tyre === t}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] font-semibold ${
              tyre === t ? 'border-[var(--you)]' : 'border-[var(--rule)]'
            }`}
          >
            <TyreBadge compound={t} age={0} /> {TYRE_NAME[t]}
          </button>
        ))}
        <button
          type="button"
          disabled={!!mine?.picked}
          onClick={() => onPick(car, tyre)}
          className="ml-auto rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-[var(--you-ink)] disabled:opacity-50"
        >
          {mine?.picked ? 'Locked in: waiting for them' : 'Lock in'}
        </button>
      </div>
      <Seats view={view} />
    </section>
  );
}

/** What a car's pace stats come to on this track (s a lap vs a Balanced car). */
function lapEdge(
  track: ReturnType<typeof versusTrack> | null,
  stats: Record<string, number>,
): string {
  if (!track) return '';
  const mean = VERSUS_TRACKS.reduce((a, t) => a + t.straightShare, 0) / VERSUS_TRACKS.length;
  const s = track.straightShare;
  const d =
    -STAT_SCALE.pace *
    ((stats.topSpeed ?? 0) * (s / mean) + (stats.cornering ?? 0) * ((1 - s) / (1 - mean)));
  if (Math.abs(d) < 0.005) return 'same pace as Balanced';
  return `${Math.abs(d).toFixed(2)} s a lap ${d < 0 ? 'quicker' : 'slower'} than Balanced`;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <span className="grid w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-2 text-[12px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="relative block h-2 w-full rounded-full bg-[#232927]">
        <span className="absolute left-1/2 top-0 block h-2 w-px bg-[#4a5350]" />
        <span
          className="absolute top-0 block h-2 rounded-full"
          style={{
            left: value >= 0 ? '50%' : `${50 + value * 25}%`,
            width: `${Math.abs(value) * 25}%`,
            background: value >= 0 ? 'var(--you)' : 'var(--box)',
          }}
        />
      </span>
    </span>
  );
}

// --- The race -----------------------------------------------------------------------------------

const MOVES_DEFEND: Array<{ move: string; label: string; tag: string }> = [
  { move: 'cover-inside', label: 'Cover the inside', tag: 'Balanced' },
  { move: 'defend-hard', label: 'Defend hard', tag: 'Risky' },
  { move: 'let-go', label: 'Let him by', tag: 'Gives way' },
];
const MOVES_ATTACK: Array<{ move: string; label: string; tag: string }> = [
  { move: 'dive-inside', label: 'Dive down the inside', tag: 'Risky' },
  { move: 'round-outside', label: 'Round the outside', tag: 'Balanced' },
  { move: 'wait-drs', label: 'Wait for DRS', tag: 'Safer' },
  { move: 'overtake-button', label: 'Overtake button', tag: 'Safer' },
];
const BATTLE_WINDOW = 1.5;

function Race({
  view,
  seat,
  onCall,
  onAnswer,
  onLeave,
}: {
  view: VersusView;
  seat: PlayerIndex;
  onCall: (c: Omit<VersusCall, 'player'>) => void;
  onAnswer: (lap: number, option: string) => void;
  onLeave: () => void;
}) {
  const run = view.run as VersusRun;
  const base = view.model as RaceModel;
  const setup = run.setup;
  const model = useMemo(() => versusModel(base, setup, seat), [base, setup, seat]);
  const outline = outlineFor(base.race.id);
  const other: PlayerIndex = seat === 0 ? 1 : 0;
  const feed = useRef<MapFeed | null>(null);
  // The map glides from the lap's start to its end while the lap runs.
  const shown = view.before ?? run.state;
  const race = versusRaceState(shown, model, setup);
  const ahead = view.before ? { race: versusRaceState(run.state, model, setup), notes: [] } : null;
  const me = shown.cars[seat];
  const them = shown.cars[other];
  const gap = them.totalTime - me.totalTime; // > 0: we lead
  const nextLap = run.state.lap + 1;
  const myMoment = view.moments.find((m) => m.player === seat && !view.answered.includes(seat));
  const theirMoment = view.moments.some(
    (m) => m.player === other && !view.answered.includes(other),
  );
  const pending = run.calls.filter((c) => c.player === seat && c.lap >= run.state.lap);
  const boxing = pending.find((c) => c.kind === 'pit');
  const modeOf = (key: 'pace' | 'ers' | 'fuel') => {
    const last = [...run.calls]
      .reverse()
      .find((c) => c.player === seat && c.kind === 'mode' && c.key === key);
    return last && last.kind === 'mode' ? last.value : run.state.cars[seat].modes[key];
  };
  const fighting =
    run.state.flag === 'green' && Math.abs(gap) < BATTLE_WINDOW && !view.moments.length;
  const moveCalled = pending.find((c) => c.kind === 'move' && c.lap === nextLap);
  const lapsLeft = VERSUS_LAPS - shown.lap;
  const flag = run.state.nextFlag !== 'green' ? run.state.nextFlag : shown.flag;

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 md:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1F2523] bg-[#0F1312] px-3 py-2">
        <Driver name={setup.players[seat].name} car={setup.players[seat].car} you />
        <span className="flex flex-col items-center">
          <span className="disp text-[22px] tabular-nums">
            Lap {Math.min(VERSUS_LAPS, shown.lap + (view.before ? 1 : 0))}/{VERSUS_LAPS}
          </span>
          <span className="text-[12px] text-[var(--muted)]">
            {gap >= 0 ? `${gap.toFixed(1)} s ahead` : `${(-gap).toFixed(1)} s behind`}
          </span>
        </span>
        <Driver name={setup.players[other].name} car={setup.players[other].car} />
      </div>
      {flag !== 'green' && (
        <div className="rounded bg-[var(--flag)] px-3 py-1 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#141716]">
          {flag === 'sc' ? 'Safety car' : 'Virtual safety car'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative h-[42vh] min-h-[240px] overflow-hidden rounded-lg border border-[#1F2523] bg-[#0F1312] md:h-[56vh]">
            {outline ? (
              <RaceStage
                raceId={base.race.id}
                feedRef={feed}
                mapAspect={outline.width / outline.height}
              >
                <TrackMap
                  outline={outline}
                  race={race}
                  model={model}
                  userSide={model.userSide}
                  rival={model.rival}
                  clock={view.clock}
                  selected={null}
                  onSelect={() => undefined}
                  dim={!!view.moments.length}
                  ahead={ahead}
                  carShapes={{
                    [model.userSide]: setup.players[seat].car,
                    [model.rival]: setup.players[other].car,
                  }}
                  feedRef={feed}
                />
              </RaceStage>
            ) : (
              <p className="p-8 text-center text-[var(--muted)]">No map for this track.</p>
            )}
          </div>

          {view.waiting ? (
            <Plate tag="Waiting" accent="var(--flag)">
              <p className="m-0 text-[16px] font-bold">
                {setup.players[view.waiting.player].name} dropped out. Waiting up to{' '}
                <Countdown until={view.waiting.until} /> for them to come back.
              </p>
            </Plate>
          ) : myMoment ? (
            <MomentCard
              moment={myMoment}
              until={view.momentsUntil}
              me={run.state.cars[seat]}
              them={run.state.cars[other]}
              theirName={setup.players[other].name}
              model={base}
              lapsLeft={VERSUS_LAPS - run.state.lap}
              onAnswer={(o) => onAnswer(myMoment.lap, o)}
            />
          ) : theirMoment ? (
            <Plate tag="Paused" accent="var(--rival)">
              <p className="m-0 text-[16px] font-bold">The other wall is deciding…</p>
            </Plate>
          ) : fighting ? (
            <Plate tag={`Battle · ${gap >= 0 ? 'defending' : 'attacking'}`} accent="var(--box-ink)">
              <p className="m-0 text-[15px] font-semibold">
                {gap >= 0
                  ? `${setup.players[other].name} is ${gap.toFixed(1)} s behind. Next lap's move:`
                  : `${(-gap).toFixed(1)} s behind ${setup.players[other].name}. Next lap's move:`}
              </p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(gap >= 0 ? MOVES_DEFEND : MOVES_ATTACK).map((m) => (
                  <button
                    key={m.move}
                    type="button"
                    className={`call-opt ${moveCalled?.kind === 'move' && moveCalled.move === m.move ? 'main' : ''}`}
                    disabled={
                      !!moveCalled ||
                      (m.move === 'overtake-button' && run.state.cars[seat].battery < 25)
                    }
                    onClick={() =>
                      onCall({ lap: nextLap, kind: 'move', move: m.move } as Omit<
                        VersusCall,
                        'player'
                      >)
                    }
                  >
                    <span className="label">{m.label}</span>
                    <span className="text-[11px] text-[var(--muted)]">{m.tag}</span>
                  </button>
                ))}
              </div>
            </Plate>
          ) : null}
        </div>

        <aside className="flex flex-col gap-3">
          <Panel title="Your car">
            <div className="flex items-center justify-between">
              <TyreBadge compound={me.compound} age={me.tyreAge} />
              <span className="text-[12px] text-[var(--muted)]">
                about {Math.max(0, Math.round(lifeOf(base, me.compound) - me.tyreWear))} laps left
                in them · {lapsLeft} to go
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-[var(--muted)]">
              <span>Battery {Math.round(me.battery)}%</span>
              <span>
                Fuel {me.fuel.toFixed(1)} kg
                {me.stops === 0 && ' · stop still owed'}
              </span>
            </div>
            {boxing && boxing.kind === 'pit' ? (
              <p className="m-0 rounded bg-[color-mix(in_srgb,var(--box)_20%,transparent)] px-2 py-1.5 text-[13px] font-semibold">
                Boxing for {TYRE_NAME[boxing.compound]} at the end of lap {boxing.lap}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Box at the end of lap {nextLap}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {TYRES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!!myMoment || nextLap > VERSUS_LAPS - 1}
                      onClick={() =>
                        onCall({ lap: nextLap, kind: 'pit', compound: t } as Omit<
                          VersusCall,
                          'player'
                        >)
                      }
                      className="call-opt box items-center !min-h-[40px]"
                    >
                      <span className="label text-[13px]">{TYRE_NAME[t]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Headset">
            <Modes
              label="Pace"
              value={modeOf('pace')}
              options={[
                ['manage', 'Manage'],
                ['standard', 'Standard'],
                ['push', 'Push'],
              ]}
              onPick={(v) =>
                onCall({ lap: nextLap, kind: 'mode', key: 'pace', value: v } as Omit<
                  VersusCall,
                  'player'
                >)
              }
            />
            <Modes
              label="Battery"
              value={modeOf('ers')}
              options={[
                ['harvest', 'Harvest'],
                ['balanced', 'Balanced'],
                ['deploy', 'Deploy'],
              ]}
              onPick={(v) =>
                onCall({ lap: nextLap, kind: 'mode', key: 'ers', value: v } as Omit<
                  VersusCall,
                  'player'
                >)
              }
            />
            <Modes
              label="Fuel"
              value={modeOf('fuel')}
              options={[
                ['normal', 'Normal'],
                ['liftAndCoast', 'Lift and coast'],
              ]}
              onPick={(v) =>
                onCall({ lap: nextLap, kind: 'mode', key: 'fuel', value: v } as Omit<
                  VersusCall,
                  'player'
                >)
              }
            />
          </Panel>
          <Panel title={setup.players[other].name}>
            <div className="flex items-center justify-between">
              <TyreBadge compound={them.compound} age={them.tyreAge} />
              <span className="text-[12px] text-[var(--muted)]">
                {them.stops === 0 ? 'Not stopped yet' : `Stopped ${them.stops}×`}
              </span>
            </div>
          </Panel>
          <Feed run={run} seat={seat} upTo={shown.lap} />
          <button
            type="button"
            onClick={() => {
              if (confirmLeave()) onLeave();
            }}
            className="self-start text-[12px] text-[var(--muted)] underline"
          >
            Retire (they win)
          </button>
        </aside>
      </div>
    </section>
  );
}

let leaveArmed = 0;
/** A second tap within 3 s confirms (the page can't show a confirm dialog everywhere). */
function confirmLeave(): boolean {
  const now = Date.now();
  if (now - leaveArmed < 3000) return true;
  leaveArmed = now;
  return false;
}

function Driver({ name, car, you = false }: { name: string; car: string; you?: boolean }) {
  return (
    <span className={`flex flex-col ${you ? 'items-start' : 'items-end'}`}>
      <span className="flex items-center gap-2 text-[15px] font-bold">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: you ? 'var(--you)' : 'var(--rival)' }}
        />
        {name}
        {you && <span className="text-[11px] font-semibold text-[var(--muted)]">you</span>}
      </span>
      <span className="text-[12px] text-[var(--muted)]">
        {VERSUS_CARS.find((c) => c.id === car)?.name}
      </span>
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-[#1F2523] bg-[#0F1312] p-3">
      <h2 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Plate({
  tag,
  accent,
  children,
}: {
  tag: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="call-plate" style={{ '--accent': accent } as React.CSSProperties}>
      <span className="call-tag">{tag}</span>
      {children}
    </section>
  );
}

function Modes({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-[var(--muted)]">{label}</span>
      <div className="flex gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => v !== value && onPick(v)}
            aria-pressed={v === value}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] font-semibold ${
              v === value
                ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_16%,transparent)]'
                : 'border-[var(--rule)]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Countdown({ until }: { until: number }) {
  const left = useCountdown(until);
  return <span className="tabular-nums">{left}s</span>;
}

/** A big call (spec V3): the question from the race as it stands, the options, the clock. */
function MomentCard({
  moment,
  until,
  me,
  them,
  theirName,
  model,
  lapsLeft,
  onAnswer,
}: {
  moment: VersusMoment;
  until: number;
  me: VersusCarState;
  them: VersusCarState;
  theirName: string;
  model: RaceModel;
  lapsLeft: number;
  onAnswer: (option: string) => void;
}) {
  const left = useCountdown(until);
  const life = Math.max(0, Math.round(lifeOf(model, me.compound) - me.tyreWear));
  const gap = them.totalTime - me.totalTime;
  const t = model.track;
  const text =
    moment.kind === 'neutral'
      ? `The safety car is coming out. A stop under it costs about ${t.pitLossUnderSC.toFixed(0)} s instead of ${t.pitLoss.toFixed(0)} s. Box?`
      : moment.kind === 'theyPitted'
        ? `${theirName} has pitted for ${TYRE_NAME[them.compound]?.toLowerCase() ?? them.compound}. Box to answer, or stay out?`
        : moment.kind === 'finalLaps'
          ? `${lapsLeft} laps to go, ${Math.abs(gap).toFixed(1)} s ${gap >= 0 ? 'ahead of' : 'behind'} ${theirName}. How do we race it?`
          : me.stops === 0 && lapsLeft <= 2
            ? `Last chance: the stop is still owed. Stay out now and you're classified last.`
            : `About ${life} ${life === 1 ? 'lap' : 'laps'} left in these ${TYRE_NAME[me.compound]?.toLowerCase()}, ${lapsLeft} to go${me.stops === 0 ? ', and the stop is still owed' : ''}. Box, or stay out?`;
  const options = versusOptions(moment);
  const label = (o: string) =>
    o.startsWith('box-')
      ? `Box: ${TYRE_NAME[o.slice(4)]}`
      : o === 'stay'
        ? 'Stay out'
        : o === 'attack'
          ? 'Attack'
          : o === 'defend'
            ? 'Defend'
            : 'Race him normally';
  return (
    <Plate tag={`Your call · ${left}s`} accent="var(--you)">
      <p className="m-0 text-[17px] font-bold leading-snug">{text}</p>
      <div
        className={`grid gap-2 ${options.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onAnswer(o)}
            className={`call-opt ${o.startsWith('box-') ? 'box' : 'main'}`}
          >
            <span className="label">{label(o)}</span>
          </button>
        ))}
      </div>
      <p className="m-0 text-[12px] text-[var(--muted)]">
        No answer by then: stay out (or race him normally). They can't see your call.
      </p>
    </Plate>
  );
}

function Feed({ run, seat, upTo }: { run: VersusRun; seat: PlayerIndex; upTo: number }) {
  const names = run.setup.players.map((p) => p.name);
  const lines = run.state.notes
    .filter((n) => n.lap <= upTo)
    .slice(-6)
    .reverse()
    .map((n) => {
      const who = n.player === seat ? 'You' : names[n.player];
      const text =
        n.kind === 'pit'
          ? `${who} pitted for ${TYRE_NAME[n.detail ?? '']?.toLowerCase() ?? n.detail}`
          : n.kind === 'pass'
            ? `${who} got past`
            : n.kind === 'held'
              ? `${who} held on`
              : n.kind === 'wing'
                ? `${who} damaged the front wing`
                : n.kind === 'contact'
                  ? `${who} spun after contact`
                  : n.kind === 'fuel'
                    ? `${who} ran out of fuel`
                    : `${who} made a mistake`;
      return { lap: n.lap, text };
    });
  if (!lines.length) return null;
  return (
    <Panel title="Race">
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {lines.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a short, append-only feed
          <li key={i}>
            <span className="mr-2 text-[var(--muted)]">L{l.lap}</span>
            {l.text}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// --- The result ---------------------------------------------------------------------------------

const BAND_COLOR: Record<string, string> = {
  green: 'var(--good)',
  yellow: 'var(--medium)',
  orange: 'var(--rival)',
  red: 'var(--box)',
};

function Result({
  outcome,
  seat,
}: {
  outcome: VersusOutcome;
  seat: PlayerIndex | null;
  model: RaceModel | null;
}) {
  const names = outcome.players.map((p) => p.name);
  const score = outcome.score;
  const winner: PlayerIndex | null =
    outcome.forfeit !== undefined ? (outcome.forfeit === 0 ? 1 : 0) : (score?.winner ?? null);
  const headline =
    winner === null ? 'Result' : winner === seat ? 'You win' : `${names[winner]} wins`;
  const by =
    outcome.forfeit !== undefined
      ? `${names[outcome.forfeit]} retired from the race.`
      : score?.by === 'score'
        ? 'On the calls.'
        : score?.by === 'chance'
          ? 'Calls level: decided on the average chance of the calls made.'
          : 'Calls level: decided on the road.';
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
          {versusTrack(outcome.setup.track).name} · head to head
        </p>
        <h1 className="disp text-[40px] leading-tight">{headline}</h1>
        {score && (
          <p className="disp m-0 text-[26px] tabular-nums">
            {Math.round(score.scores[0].score)} <span className="text-[var(--muted)]">vs</span>{' '}
            {Math.round(score.scores[1].score)}
          </p>
        )}
        <p className="m-0 text-[14px] text-[var(--muted)]">{by}</p>
        {score && (
          <p className="m-0 text-[14px]">
            On the road: {names[score.road.order[0] as number]} first, {score.road.gap.toFixed(1)} s
            ahead
            {score.road.disqualified.length > 0 &&
              ` (${score.road.disqualified.map((p) => names[p]).join(' and ')} never stopped: classified last)`}
            .
          </p>
        )}
      </div>
      {score && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {([0, 1] as PlayerIndex[]).map((p) => (
            <section
              key={p}
              className="flex flex-col gap-2 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <h2 className="m-0 flex items-baseline justify-between text-[16px] font-bold">
                {names[p]}
                {p === seat && <span className="text-[12px] text-[var(--muted)]">you</span>}
                <span className="disp tabular-nums">{Math.round(score.scores[p].score)}</span>
              </h2>
              {score.scores[p].calls.length === 0 && (
                <p className="m-0 text-[13px] text-[var(--muted)]">No big calls.</p>
              )}
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {score.scores[p].calls.map((c) => (
                  <li
                    key={`${c.lap}-${c.optionId}`}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: BAND_COLOR[c.band] }}
                    />
                    <span className="text-[var(--muted)]">Lap {c.lap}</span>
                    <span className="flex-1">{optionText(c.optionId)}</span>
                    <span className="tabular-nums text-[var(--muted)]">
                      {Math.round(c.probability * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <div className="flex justify-center gap-3">
        <a
          href="/versus"
          className="rounded-xl bg-[var(--you)] px-6 py-3 font-bold text-[var(--you-ink)]"
        >
          New match
        </a>
        <a href="/" className="rounded-xl border border-[var(--rule)] px-6 py-3 font-bold">
          Home
        </a>
      </div>
    </section>
  );
}

function optionText(id: string): string {
  if (id.startsWith('box-')) return `Boxed for ${TYRE_NAME[id.slice(4)]?.toLowerCase()}`;
  if (id === 'stay') return 'Stayed out';
  if (id === 'hold') return 'Raced him normally';
  return id === 'attack' ? 'Attacked' : 'Defended';
}
