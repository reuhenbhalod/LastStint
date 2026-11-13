// Versus mode (docs/versus-spec.md V6): /versus creates or joins a match; /versus/<CODE> is the
// match itself: the lobby, the car pick, the race (two cars on the track map, the big calls
// for both walls at once, the headset and battle calls) and the graded result.

import {
  type AttackPick,
  BOOSTS,
  type DefendPick,
  OUT_LAP_COST,
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
  simulateVersus,
  undercutEdge,
  versusOptions,
  versusRuleMet,
  versusTrack,
} from '@laststint/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiPost } from '../api.js';
import { GroundBackdrop } from '../components/GroundBackdrop.js';
import { MapCredit } from '../components/MapCredit.js';
import { TopBar } from '../components/TopBar.js';
import { type BattleView, TrackMap } from '../components/TrackMap.js';
import { TyreBadge } from '../components/TyreBadge.js';
import type { BattleLine } from '../game/quickCalls.js';
import { clockProgress } from '../game/useGame.js';
import { RaceStage } from '../three/RaceStage.js';
import type { MapFeed } from '../track/feed.js';
import { outlineFor } from '../track/outlines.js';
import { Lobby } from '../versus/Lobby.js';
import { PitLane } from '../versus/PitLane.js';
import { STAT_NAME, TYRES, lapEdge, loadSetup } from '../versus/setup.js';
import { type VersusView, useVersus } from '../versus/useVersus.js';
import { versusModel, versusRaceState } from '../versus/view.js';

const NAME_KEY = 'laststint:versus-name';
const TYRE_NAME: Record<string, string> = { SOFT: 'Softs', MEDIUM: 'Mediums', HARD: 'Hards' };

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
    <main className="relative isolate flex min-h-[100dvh] flex-col text-[#EEF1EE]">
      <TopBar active="versus" />
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

/** How long the pit lane shows the second car arriving before the car pick (the pick has 30 s). */
const ARRIVAL_MS = 2600;

function Match({ code, name }: { code: string; name: string }) {
  const { view, call, answer, pick, leave } = useVersus(code, name);
  const phase = view.room?.phase;
  // When the second car arrives the pit lane plays it in (PitLane `arriving`) for a moment
  // before the car pick: the rival's car if you were waiting in the lobby, yours if you joined.
  const sawLobby = useRef(false);
  const [arrival, setArrival] = useState<'idle' | 'playing' | 'done'>('idle');
  useEffect(() => {
    if (phase === 'lobby') sawLobby.current = true;
    if (phase !== 'pick' || arrival !== 'idle') return;
    setArrival('playing');
    window.setTimeout(() => setArrival('done'), ARRIVAL_MS);
  }, [phase, arrival]);
  if (view.error && !view.room)
    return <Notice title="No such match" text={`${code}: ${view.error}`} />;
  if (!view.room) return <Notice title="Connecting…" text={`Match ${code}`} />;
  if (phase === 'lobby') return <Waiting code={code} view={view} />;
  if (phase === 'pick' && arrival !== 'done')
    return <PitLane code={code} view={view} arriving={sawLobby.current ? 'them' : 'me'} />;
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
  return <PitLane code={code} view={view} />;
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
  // Starts from the setup picked in the garage (versus/setup.ts); still yours to change here.
  const [car, setCar] = useState(() => loadSetup().car);
  const [tyre, setTyre] = useState<string>(() => loadSetup().tyre);
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
                : 'border-[var(--rule)] bg-[var(--card)] hover:border-[#4A555B]'
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

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <span className="grid w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-2 text-[12px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="relative block h-2 w-full rounded-full bg-[#252D31]">
        <span className="absolute left-1/2 top-0 block h-2 w-px bg-[#4A555B]" />
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

/** The battle picks (action spec A1), in the words on the buttons, and the line each draws on
 * the map. */
const ATTACKS: Array<{ pick: AttackPick; label: string; tag: string; line: BattleLine | null }> = [
  { pick: 'inside', label: 'Dive down the inside', tag: 'Beats a cover outside', line: 'inside' },
  { pick: 'outside', label: 'Round the outside', tag: 'Beats a cover inside', line: 'outside' },
  {
    pick: 'switchback',
    label: 'Switchback',
    tag: 'Fake one way, cut back. Loses to defending hard',
    line: null,
  },
  {
    pick: 'wait',
    label: 'Wait for a better run',
    tag: 'Safe. A stronger attack next lap',
    line: 'wait',
  },
];
const DEFENCES: Array<{ pick: DefendPick; label: string; tag: string; line: BattleLine | null }> = [
  { pick: 'cover-inside', label: 'Cover the inside', tag: 'Shuts the dive', line: 'inside' },
  {
    pick: 'cover-outside',
    label: 'Cover the outside',
    tag: 'Shuts the round-the-outside',
    line: 'outside',
  },
  {
    pick: 'defend-hard',
    label: 'Defend hard',
    tag: 'Beats the switchback. Risks contact',
    line: 'hard',
  },
];
const PICK_WORDS: Record<string, string> = {
  inside: 'dived down the inside',
  outside: 'went round the outside',
  switchback: 'tried the switchback',
  wait: 'waited for a better run',
  'cover-inside': 'covered the inside',
  'cover-outside': 'covered the outside',
  'defend-hard': 'defended hard',
};

/** A battle on screen: from its call to a moment after its result. */
interface ShownBattle {
  lap: number;
  corner: number;
  at: number;
  attacker: PlayerIndex;
  /** The result, once the lap is resolved (from the race's battle note). */
  result: { attack: string; defence: string; outcome: string } | null;
  stage: 'approach' | 'move' | 'done';
  zoom: boolean;
}

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
  const theirName = setup.players[other].name;
  const feed = useRef<MapFeed | null>(null);
  // The map glides from the lap's start to its end while the lap runs (a battle's lap holds at
  // the braking zone, not yet run, until the picks are in).
  const shown = view.before ?? run.state;
  const race = versusRaceState(shown, model, setup, run.calls);
  const ahead =
    view.before && run.state.lap === view.before.lap + 1
      ? { race: versusRaceState(run.state, model, setup, run.calls), notes: [] }
      : null;
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
  const lapsLeft = VERSUS_LAPS - shown.lap;
  const flag = run.state.nextFlag !== 'green' ? run.state.nextFlag : shown.flag;
  const owed = !versusRuleMet(me);

  // The battle (action spec A1): the call raises it, the lap runs to the braking zone, the
  // picks come in, then the cars take the corner and the result shows there.
  const [battle, setBattle] = useState<ShownBattle | null>(null);
  const battleRef = useRef<ShownBattle | null>(null);
  battleRef.current = battle;
  const [myPick, setMyPick] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean; corner: number } | null>(null);
  const battleMoment = view.moments.find((m) => m.kind === 'battle' && m.player === seat);
  useEffect(() => {
    const b = battleMoment?.battle;
    if (!battleMoment || !b || battleRef.current?.lap === battleMoment.lap) return;
    setMyPick(null);
    setBattle({
      lap: battleMoment.lap,
      corner: b.corner,
      at: b.at,
      attacker: b.attacker,
      result: null,
      stage: 'approach',
      zoom: true,
    });
  }, [battleMoment]);
  // Resolved: the lap has run with the picks in.
  const note = battle
    ? run.state.notes.find((n) => n.kind === 'battle' && n.lap === battle.lap)
    : undefined;
  useEffect(() => {
    if (!battle || battle.result || !note?.detail) return;
    const [attack = '', defence = '', outcome = ''] = note.detail.split('|');
    setBattle({ ...battle, result: { attack, defence, outcome }, stage: 'move' });
  }, [battle, note]);
  // The result shows as the cars reach the corner; the camera eases out after.
  const clockRef = useRef(view.clock);
  clockRef.current = view.clock;
  const stage = battle?.stage;
  useEffect(() => {
    if (stage !== 'move') return;
    let raf = 0;
    const frame = () => {
      const b = battleRef.current;
      const c = clockRef.current;
      const p = c ? clockProgress(c) : 1;
      if (b?.result && (p >= b.at + 0.01 || !c)) {
        const attacking = b.attacker === seat;
        const o = b.result.outcome;
        const text =
          o === 'contact'
            ? 'CONTACT'
            : o === 'pass'
              ? attacking
                ? 'PASSED'
                : 'PASSED BY'
              : o === 'wait'
                ? attacking
                  ? 'BIDING TIME'
                  : 'HELD'
                : attacking
                  ? 'HELD UP'
                  : 'HELD';
        const good =
          o === 'contact' ? false : o === 'pass' ? attacking : !attacking || o === 'wait';
        setFlash({ text, good, corner: b.corner });
        setBattle({ ...b, stage: 'done' });
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stage, seat]);
  useEffect(() => {
    if (stage !== 'done') return;
    const id = setTimeout(() => {
      const b = battleRef.current;
      if (b) setBattle({ ...b, zoom: false });
    }, 2500);
    const end = setTimeout(() => setBattle(null), 4500);
    return () => {
      clearTimeout(id);
      clearTimeout(end);
    };
  }, [stage]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(id);
  }, [flash]);

  const attacking = battle?.attacker === seat;
  const picks = attacking ? ATTACKS : DEFENCES;
  const chosenLine = picks.find((x) => x.pick === (myPick ?? '').split('+')[0])?.line ?? null;
  const battleView: BattleView | null = battle
    ? {
        other: model.rival,
        corner: battle.corner,
        at: battle.at,
        options: picks
          .map((x, i) => ({ n: i + 1, line: x.line }))
          .filter((x): x is { n: number; line: BattleLine } => x.line !== null),
        chosen: chosenLine,
        zoom: battle.zoom,
        swap: battle.result ? { at: battle.at } : null,
      }
    : null;
  const answerBattle = (option: string) => {
    if (!battleMoment) return;
    setMyPick(option);
    onAnswer(battleMoment.lap, option);
  };
  // A gremlin on the lap running: the radio says so.
  const gremlin = run.state.notes.find(
    (n) => n.kind === 'gremlin' && n.lap === shown.lap + (view.before ? 1 : 0),
  );

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 md:px-4">
      <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2">
        <Driver name={setup.players[seat].name} car={setup.players[seat].car} you />
        <span className="flex flex-col items-center">
          <span className="disp text-[22px] tabular-nums">
            Lap {Math.min(VERSUS_LAPS, shown.lap + (view.before ? 1 : 0))}/{VERSUS_LAPS}
          </span>
          <span className="text-[12px] text-[var(--muted)]">
            {gap >= 0 ? `${gap.toFixed(1)} s ahead` : `${(-gap).toFixed(1)} s behind`}
          </span>
        </span>
        <Driver name={theirName} car={setup.players[other].car} />
      </div>
      {flag !== 'green' && (
        <div className="rounded bg-[var(--flag)] px-3 py-1 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#151A1D]">
          {flag === 'sc' ? 'Safety car' : 'Virtual safety car'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative h-[42vh] min-h-[240px] overflow-hidden rounded-xl border border-[var(--glass-edge)] bg-[var(--ground)] md:h-[56vh]">
            <MapCredit raceId={base.race.id} className="absolute right-2 bottom-1.5 z-10" />
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
                  dim={!!view.moments.length && !battle}
                  ahead={ahead}
                  battle={battleView}
                  flash={flash}
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
            {gremlin && (
              <div className="glass-strong absolute left-3 top-3 max-w-[70%] rounded-lg px-3 py-2 text-[13px] font-semibold">
                <span className="mr-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--box)]">
                  Radio
                </span>
                {gremlinText(gremlin.detail, gremlin.player === seat ? null : theirName)}
              </div>
            )}
          </div>

          {view.waiting ? (
            <Plate tag="Waiting" accent="var(--flag)">
              <p className="m-0 text-[16px] font-bold">
                {setup.players[view.waiting.player].name} dropped out. Waiting up to{' '}
                <Countdown until={view.waiting.until} /> for them to come back.
              </p>
            </Plate>
          ) : myMoment?.kind === 'battle' && myMoment.battle ? (
            <BattleCard
              key={myMoment.lap}
              attacking={myMoment.battle.attacker === seat}
              corner={myMoment.battle.corner}
              theirName={theirName}
              gap={Math.abs(gap)}
              until={view.momentsUntil}
              boosts={run.state.cars[seat].boosts}
              canBoost={myMoment.battle.canBoost}
              onPick={answerBattle}
            />
          ) : myMoment ? (
            <MomentCard
              run={run}
              moment={myMoment}
              until={view.momentsUntil}
              me={run.state.cars[seat]}
              them={run.state.cars[other]}
              theirName={theirName}
              model={base}
              lapsLeft={VERSUS_LAPS - run.state.lap}
              onAnswer={(o) => onAnswer(myMoment.lap, o)}
            />
          ) : battle && !battle.result && view.moments.length ? (
            <Plate tag="Battle · locked in" accent="var(--box)">
              <p className="m-0 text-[16px] font-bold">
                You {PICK_WORDS[(myPick ?? '').split('+')[0] ?? ''] ?? 'left it to the driver'}
                {myPick?.endsWith('+boost') ? ', with a boost' : ''}.{' '}
                {theirMoment ? `${theirName} is still deciding…` : 'Into the corner…'}
              </p>
            </Plate>
          ) : battle?.result && battle.stage === 'done' ? (
            <Plate
              tag={`Turn ${battle.corner} · ${battle.result.outcome === 'pass' ? 'pass' : battle.result.outcome === 'contact' ? 'contact' : 'held'}`}
              accent={flash?.good ? 'var(--good)' : 'var(--box)'}
            >
              <p className="m-0 text-[16px] font-bold">
                {battleStory(battle.result, battle.attacker === seat, theirName)}
              </p>
            </Plate>
          ) : theirMoment ? (
            <Plate tag="Paused" accent="var(--rival)">
              <p className="m-0 text-[16px] font-bold">The other wall is deciding…</p>
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
              <span>
                Boosts {me.boosts}/{BOOSTS}
                {me.ersFaultUntil > shown.lap + 1 && ' · ERS fault'}
              </span>
              <span>Fuel {me.fuel.toFixed(1)} kg</span>
            </div>
            {owed && !boxing && (
              <p className="m-0 rounded bg-[color-mix(in_srgb,var(--flag)_18%,transparent)] px-2 py-1.5 text-[13px] font-semibold">
                Stop owed: box by the end of lap {VERSUS_LAPS - 1}
              </p>
            )}
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
          <Panel title={theirName}>
            <div className="flex items-center justify-between">
              <TyreBadge compound={them.compound} age={them.tyreAge} />
              <span className="text-[12px] text-[var(--muted)]">
                {them.stops === 0 ? 'Not stopped yet' : `Stopped ${them.stops}×`} · Boosts{' '}
                {them.boosts}
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

/** The battle's story in a line: what each did, and how it ended. */
function battleStory(
  r: { attack: string; defence: string; outcome: string },
  attacking: boolean,
  theirName: string,
): string {
  const mine = PICK_WORDS[attacking ? r.attack : r.defence];
  const theirs = PICK_WORDS[attacking ? r.defence : r.attack];
  const end =
    r.outcome === 'contact'
      ? 'Contact!'
      : r.outcome === 'pass'
        ? attacking
          ? 'You’re through.'
          : `${theirName} is through.`
        : r.outcome === 'wait'
          ? attacking
            ? 'You’re right with them for the next go.'
            : 'They’ll come again next lap.'
          : attacking
            ? 'The door was shut.'
            : 'You held on.';
  return `You ${mine}; ${theirName} ${theirs}. ${end}`;
}

function gremlinText(kind: string | undefined, other: string | null): string {
  const who = other ? `${other} has` : 'We have';
  if (kind === 'ers') return `${who} an ERS fault: no boosts for two laps.`;
  if (kind === 'flatspot')
    return other
      ? `${other} has flat-spotted the tyres. They'll wear quicker until the stop.`
      : 'Lock-up, we have a flat spot. The tyres will wear quicker until we stop.';
  return other
    ? `${other}'s crew has a problem with a wheel gun. Their next stop will be slow.`
    : 'Problem with a wheel gun in the garage. Our next stop will be slow.';
}

/** A battle (action spec A1): blind picks on a short clock, an optional boost. */
function BattleCard({
  attacking,
  corner,
  theirName,
  gap,
  until,
  boosts,
  canBoost,
  onPick,
}: {
  attacking: boolean;
  corner: number;
  theirName: string;
  gap: number;
  until: number;
  boosts: number;
  canBoost: boolean;
  onPick: (option: string) => void;
}) {
  const left = useCountdown(until);
  const [boost, setBoost] = useState(false);
  const list = attacking ? ATTACKS : DEFENCES;
  return (
    <Plate tag={`Battle · turn ${corner} · ${left}s`} accent="var(--box)">
      <p className="m-0 text-[17px] font-bold leading-snug">
        {attacking
          ? `${gap.toFixed(1)} s behind ${theirName} into turn ${corner}. Where do you go?`
          : `${theirName} is ${gap.toFixed(1)} s behind into turn ${corner}. What do you cover?`}
      </p>
      <div
        className={`grid gap-2 ${list.length > 3 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}
      >
        {list.map((x, i) => (
          <button
            key={x.pick}
            type="button"
            className="call-opt"
            onClick={() => onPick(boost ? `${x.pick}+boost` : x.pick)}
          >
            <span className="label">
              <span className="mr-1.5 text-[var(--muted)]">{i + 1}</span>
              {x.label}
            </span>
            <span className="text-[11px] text-[var(--muted)]">{x.tag}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={boost}
          disabled={!canBoost}
          onClick={() => setBoost(!boost)}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-bold ${
            boost
              ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_20%,transparent)]'
              : 'border-[var(--glass-edge)]'
          } disabled:opacity-40`}
        >
          Boost {boost ? 'on' : 'off'} · {boosts} left
        </button>
        <span className="text-[12px] text-[var(--muted)]">
          Blind: {theirName} can’t see your pick. No pick: your driver chooses.
        </span>
      </div>
    </Plate>
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
    <section className="flex flex-col gap-2 rounded-lg border border-[var(--glass-edge)] bg-[var(--glass)] p-3">
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
  run,
  moment,
  until,
  me,
  them,
  theirName,
  model,
  lapsLeft,
  onAnswer,
}: {
  run: VersusRun;
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
  const gap = them.totalTime - me.totalTime; // > 0: we lead
  const t = model.track;
  const tyre = (c: string) => TYRE_NAME[c]?.toLowerCase() ?? c;
  // Where a stop now would put you: the pit lane's cost (and the cold out-lap) against the gap.
  const rejoin = -gap + t.pitLoss + OUT_LAP_COST; // > 0: behind them after the stop
  const rejoinText =
    rejoin > 0 ? `about ${rejoin.toFixed(1)} s behind` : `about ${(-rejoin).toFixed(1)} s ahead`;
  // The undercut: what the best fresh tyre that lasts to the flag takes back on the out-lap
  // against theirs (and, covering, what theirs would take back on you).
  const best = (car: VersusCarState) =>
    TYRES.filter((c) => c !== car.compound && model.compounds[c])
      .filter((c) => lifeOf(model, c) >= lapsLeft - 1)
      .map((c) => ({ c, edge: undercutEdge(run, car.player, c) }))
      .sort((x, y) => y.edge - x.edge)[0] ?? { c: 'HARD', edge: 0 };
  const { c: fresh, edge } = best(me);
  const theirEdge = best(them).edge;
  const text =
    moment.kind === 'neutral'
      ? `The safety car is coming out. A stop under it costs about ${t.pitLossUnderSC.toFixed(0)} s instead of ${t.pitLoss.toFixed(0)} s. Box?`
      : moment.kind === 'restart'
        ? 'Safety car in this lap. Jump the restart (the stewards catch about one in three: 3 s penalty) or go normally?'
        : moment.kind === 'theyPitted'
          ? `${theirName} has pitted for ${tyre(them.compound)}. Box to answer (you'd rejoin ${rejoinText} of them, on fresh tyres too), or stay out and go long?`
          : moment.kind === 'undercut'
            ? `${(-gap).toFixed(1)} s behind ${theirName}. Undercut? Fresh ${tyre(fresh)} should be about ${edge.toFixed(1)} s quicker on the out-lap than their ${them.tyreAge}-lap-old ${tyre(them.compound)}: if they stop a lap after you, you come out about ${Math.abs(edge + gap).toFixed(1)} s ${edge + gap >= 0 ? 'ahead' : 'behind'}.`
            : moment.kind === 'cover'
              ? `${theirName} is ${gap.toFixed(1)} s behind on ${them.tyreAge}-lap-old ${tyre(them.compound)}. If they box first, fresh tyres take back about ${Math.max(0, theirEdge).toFixed(1)} s: ${theirEdge > gap ? 'enough to get by' : 'not quite enough'}. Box to cover it, or stay out and go long?`
              : me.stops === 0 && lapsLeft <= 2
                ? 'Last chance: the stop is still owed. Stay out now and you’re classified last.'
                : `These ${tyre(me.compound)} have about ${life} ${life === 1 ? 'lap' : 'laps'} left and there are ${lapsLeft} to go. They won’t make the flag. Box?`;
  const options = versusOptions(moment);
  const label = (o: string) =>
    o.startsWith('box-')
      ? `Box: ${TYRE_NAME[o.slice(4)]}`
      : o === 'stay'
        ? 'Stay out'
        : o === 'early'
          ? 'Jump the restart'
          : 'Go normally';
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
        No answer by then: {moment.kind === 'restart' ? 'go normally' : 'stay out'}. They can’t see
        your call.
      </p>
    </Plate>
  );
}

function Feed({ run, seat, upTo }: { run: VersusRun; seat: PlayerIndex; upTo: number }) {
  const names = run.setup.players.map((p) => p.name);
  const lines = run.state.notes
    .filter((n) => n.lap <= upTo && n.kind !== 'pass' && n.kind !== 'held')
    .slice(-6)
    .reverse()
    .map((n) => {
      const who = n.player === seat ? 'You' : names[n.player];
      const [atk, , outcome] = (n.detail ?? '').split('|');
      const text =
        n.kind === 'pit'
          ? `${who} pitted for ${TYRE_NAME[n.detail ?? '']?.toLowerCase() ?? n.detail}`
          : n.kind === 'battle'
            ? `${who} ${PICK_WORDS[atk ?? ''] ?? 'attacked'}: ${outcome === 'pass' ? 'through' : outcome === 'contact' ? 'contact' : 'no way by'}`
            : n.kind === 'gremlin'
              ? `${who === 'You' ? 'Your' : `${who}’s`} car: ${n.detail === 'ers' ? 'ERS fault' : n.detail === 'flatspot' ? 'flat-spotted tyres' : 'slow stop coming'}`
              : n.kind === 'penalty'
                ? `${who} jumped the restart: 3 s penalty`
                : n.kind === 'jump'
                  ? `${who} got a flying restart`
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
  model,
}: {
  outcome: VersusOutcome;
  seat: PlayerIndex | null;
  model: RaceModel | null;
}) {
  const names = outcome.players.map((p) => p.name);
  // The battles, from the race replayed with its calls: who won each (a pass for the attacker,
  // a hold for the defender).
  const battles = useMemo(() => {
    if (!model) return null;
    const { run } = simulateVersus(model, outcome.setup, outcome.calls);
    const notes = run.state.notes.filter((n) => n.kind === 'battle');
    const won: [number, number] = [0, 0];
    let contact = 0;
    for (const n of notes) {
      const r = n.detail?.split('|')[2];
      if (r === 'contact') contact++;
      else if (r === 'pass') won[n.player]++;
      else if (r === 'held') won[n.player === 0 ? 1 : 0]++;
    }
    return { total: notes.length, won, contact };
  }, [model, outcome]);
  const score = outcome.score;
  const winner: PlayerIndex | null =
    outcome.forfeit !== undefined ? (outcome.forfeit === 0 ? 1 : 0) : (score?.winner ?? null);
  const headline =
    winner === null ? 'Result' : winner === seat ? 'You win' : `${names[winner]} wins`;
  const by =
    outcome.forfeit !== undefined
      ? `${names[outcome.forfeit]} retired from the race.`
      : 'First past the flag.';
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
          {versusTrack(outcome.setup.track).name} · head to head
        </p>
        <h1 className="disp text-[40px] leading-tight">{headline}</h1>
        <p className="m-0 text-[14px] text-[var(--muted)]">{by}</p>
        {score && (
          <p className="m-0 text-[15px]">
            {names[score.road.order[0] as number]} by {score.road.gap.toFixed(1)} s
            {score.road.disqualified.length > 0 &&
              ` (${score.road.disqualified.map((p) => names[p]).join(' and ')} never stopped: classified last)`}
            .
          </p>
        )}
        {battles && battles.total > 0 && (
          <p className="m-0 text-[14px] text-[var(--muted)]">
            {battles.total} {battles.total === 1 ? 'battle' : 'battles'}: {names[0]} won{' '}
            {battles.won[0]}, {names[1]} won {battles.won[1]}
            {battles.contact > 0 && `, ${battles.contact} ended in contact`}.
          </p>
        )}
        {score && (
          <p className="m-0 text-[13px] text-[var(--muted)]">
            Strategy calls: {names[0]} {Math.round(score.scores[0].score)}, {names[1]}{' '}
            {Math.round(score.scores[1].score)}
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
  return 'Stayed out';
}
