// The race view: the standings on the left; in the middle the scoreboard and the circuit,
// with your calls under it (the big decision as a wide strip, or a quick call) and the team
// radio below (every order the wall can give: box, headset, team orders); on the right the
// stats (your driver, the car, the radio log). Speed, sound and restart sit in the header; the
// gap trace opens from a button on the map. On a phone it stacks, and the decision card
// rises as a bottom sheet. When the race stops for a call, a radio banner drops over the map
// (and chirps, if sound is on). Tap any car, on the map or in the standings, for its card; a
// stop by your car or the rival is called out while it drives the pit lane.

import { type Decision, type Modes, type RaceModel, engineerConfig } from '@boxthislap/sim';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CarStats } from '../components/CarStats.js';
import { DecisionPanel } from '../components/DecisionPanel.js';
import { DriverCard } from '../components/DriverCard.js';
import { DriverProfile } from '../components/DriverProfile.js';
import { GapTrace } from '../components/GapTrace.js';
import { LiveGrades } from '../components/LiveGrades.js';
import { PitCard } from '../components/PitCard.js';
import { QuickCallCard } from '../components/QuickCallCard.js';
import { RadioAlert } from '../components/RadioAlert.js';
import { RadioLog } from '../components/RadioLog.js';
import { TeamRadio } from '../components/TeamRadio.js';
import { TimingTower } from '../components/TimingTower.js';
import { TrackMap } from '../components/TrackMap.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { BATTLE_MS, CALL_MS, directorCall, infoLine, newMemory } from '../game/engineerCalls.js';
import { modeLine } from '../game/guide.js';
import { type QuickCall, quickCallLaps } from '../game/quickCalls.js';
import { useRaceLog } from '../game/raceLog.js';
import { radioChirp, setSoundOn, soundOn } from '../game/sound.js';
import { type Game, LAP_MS, SLOW_MOTION } from '../game/useGame.js';
import type { GameState } from '../state/machine.js';
import { overtakingCorners } from '../track/corners.js';
import { carsOnTrack, pitEntryAt, pitLane, polyline, quietCorner } from '../track/geometry.js';
import { outlineFor } from '../track/outlines.js';

const FLAG = {
  green: { text: 'Green', cls: 'bg-black/55 text-white' },
  sc: { text: 'Safety car', cls: 'bg-[var(--flag)] text-[#141716] animate-pulse' },
  vsc: { text: 'Virtual safety car', cls: 'bg-[var(--flag)] text-[#141716] animate-pulse' },
  red: { text: 'Red flag', cls: 'bg-red-600 text-white animate-pulse' },
} as const;

export function RaceScreen({
  game,
  state,
  model,
  onFinished,
}: {
  game: Game;
  state: GameState;
  model: RaceModel;
  /** The run to the flag is over (your car crossed the line): show the results. */
  onFinished?: () => void;
}) {
  const { userSide, rival, totalLaps, number, source } = state.meta;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const paused = state.phase === 'decision';
  const outline = outlineFor(model.race.id);
  const corner = useMemo(() => (outline ? quietCorner(outline) : 'left'), [outline]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sound, setSound] = useState(soundOn);
  // The map's pop-over: the gap trace.
  const [panel, setPanel] = useState<'gap' | null>(null);
  const toggle = (p: 'gap') => setPanel((c) => (c === p ? null : p));
  const log = useRaceLog(state.race);
  const team = model.drivers.find((d) => d.code === userSide)?.team;
  const flag = FLAG[state.race.flag];
  const lapsLeft = totalLaps - state.race.lap;
  const gap = me && them && !me.retired && !them.retired ? them.totalTime - me.totalTime : null;

  // Gap history for the trace (> 0: we're ahead), from the laps this screen has seen.
  const trace = useRef(new Map<number, number>());
  if (gap !== null) trace.current.set(state.race.lap, gap);
  const points = [...trace.current.entries()].sort((a, b) => a[0] - b[0]).slice(-15);

  // The flag: run the field to the line, then hold the chequered flag before the results.
  const finishing = state.phase === 'finished';
  const [crossed, setCrossed] = useState(false);
  const onCrossed = useCallback(() => setCrossed(true), []);
  useEffect(() => {
    if (!finishing) return;
    if (!outline) {
      onFinished?.();
      return;
    }
    if (!crossed) return;
    const id = setTimeout(() => onFinished?.(), 2600);
    return () => clearTimeout(id);
  }, [finishing, crossed, outline, onFinished]);
  const finishPos = state.race.order.indexOf(userSide) + 1;
  const finishMeta = useMemo(
    () => (finishing ? { lapMs: LAP_MS[state.speed], onCrossed } : null),
    [finishing, state.speed, onCrossed],
  );

  // The race engineer's radio (race engineer spec): after every lap the director picks the
  // most pressing call (a battle, trouble, the driver asking, the engineer's question); a quiet
  // lap gets an info line now and then. A battle runs the lap in slow motion until its result.
  const cfg = useMemo(() => engineerConfig(model), [model]);
  const corners = useMemo(() => overtakingCorners(outline), [outline]);
  const quickLaps = useMemo(() => new Set(quickCallLaps(model)), [model]);
  const memory = useRef(newMemory());
  const asked = useRef(new Set<number>());
  const [quick, setQuick] = useState<QuickCall | null>(null);
  // The battle this lap (from its call until the lap is run), and its result on the map.
  const [fight, setFight] = useState<{
    other: string;
    corner: number;
    attacking: boolean;
    gap: number;
  } | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean; corner: number } | null>(null);
  const raceLap = state.race.lap;
  const { setSlow } = game;
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once, when its lap completes.
  useEffect(() => {
    setSlow(false); // a battle's lap is over
    setQuick(null);
    setFight(null);
    if (state.phase !== 'racing' || asked.current.has(raceLap)) return;
    asked.current.add(raceLap);
    // The last lap's battle, at its corner.
    const corner = corners[0] ?? 1;
    const lapNotes = game.notes().filter((n) => n.lap === raceLap && n.driver === userSide);
    const contact = lapNotes.find((n) => n.kind === 'contact');
    const fought = lapNotes.find((n) => n.kind === 'battle');
    if (contact)
      setFlash({ text: contact.detail === 'spin' ? 'SPIN!' : 'CONTACT!', good: false, corner });
    else if (fought) {
      const good = fought.detail === 'passed' || fought.detail === 'held';
      const text =
        fought.detail === 'passed'
          ? `PAST ${fought.other}!`
          : fought.detail === 'held'
            ? 'HELD!'
            : fought.detail === 'lost'
              ? `${fought.other} THROUGH`
              : 'NO WAY BY';
      setFlash({ text, good, corner });
    }
    const call = directorCall(
      state.race,
      model,
      cfg,
      log,
      game.notes(),
      corners,
      memory.current,
      quickLaps.has(raceLap),
      state.decisions.some((d) => d.kind === 'pit' && d.lap > raceLap),
    );
    if (call) {
      setQuick(call);
      if (call.kind === 'battle') {
        setSlow(true);
        if (call.other)
          setFight({
            other: call.other,
            corner: call.corner ?? corner,
            attacking: !!call.attacking,
            gap: call.gap ?? 0,
          });
      }
      return;
    }
    // A quiet lap: the engineer's info, every other lap or so.
    const last = memory.current.last.info ?? -99;
    const neutral = state.race.nextFlag !== 'green' || state.race.flag !== 'green';
    if (raceLap - last >= (neutral ? 1 : 2)) {
      const line = infoLine(state.race, model, log);
      if (line) {
        memory.current.last.info = raceLap;
        game.radio(line);
      }
    }
  }, [raceLap, state.phase]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [flash]);
  // The lap a BOX call turns in at (pit fix): the end of the lap being shown, if your car can
  // still reach pit entry on it; otherwise the end of the next one. (Paused, the cars sit at the
  // line with the entry ahead.)
  const laneInfo = useMemo(
    () => (outline ? pitLane(outline, polyline(outline.points)) : null),
    [outline],
  );
  const boxLap = useCallback((): number => {
    const n = state.race.lap + 1;
    const clock = game.clock;
    if (!laneInfo || !clock) return n;
    const mine = carsOnTrack(state.race, model, state.race.nextFlag ?? 'green').find(
      (c) => c.code === userSide,
    );
    if (!mine) return n;
    const tIn = pitEntryAt(mine.behind, laneInfo);
    const progress = (performance.now() - clock.start) / clock.ms;
    return tIn === null || progress > tIn - 0.03 ? n + 1 : n;
  }, [laneInfo, game.clock, state.race, model, userSide]);
  const place = useCallback(
    <T extends Decision>(call: T): T => ({
      ...call,
      lap: call.kind === 'pit' ? boxLap() : state.race.lap + 1,
    }),
    [boxLap, state.race.lap],
  );
  const answerQuick = useCallback(
    (id: string) => {
      const o = quick?.options.find((x) => x.id === id);
      const asked = quick?.asked ?? true;
      if (o?.call) game.call(place(o.call), { asked });
      else game.radio('Copy. No change.');
      for (const c of o?.also ?? []) game.call(place(c), { asked: true });
      setQuick(null);
      setSlow(false); // answered: back to full speed, the move plays out this lap
    },
    [quick, game, place, setSlow],
  );
  const quickTimeout = useCallback(() => {
    if (quick?.driverChoice) {
      // No answer: the driver makes his own call (logged like any other).
      game.radio(`No call from the wall: ${userSide} makes his own move.`);
      game.call({ ...quick.driverChoice, lap: state.race.lap + 1 }, { quiet: true });
    } else game.radio('No answer from the wall. Sticking to the plan.');
    setQuick(null);
    setSlow(false);
  }, [game, quick, state.race, userSide, setSlow]);

  // A phone-sized screen (cards open under the map, not on it).
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const q = matchMedia('(max-width: 767px)');
    const on = () => setNarrow(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  const select = useCallback((code: string) => setSelected((c) => (c === code ? null : code)), []);
  const close = useCallback(() => setSelected(null), []);
  const driverCard = selected ? (
    <DriverCard
      code={selected}
      race={state.race}
      model={model}
      log={log}
      userSide={userSide}
      rival={rival}
      onClose={close}
    />
  ) : null;

  const momentIdFor = paused ? state.currentMoment?.id : undefined;
  // A big call scrolls into view under the map (on a laptop it can sit below the fold).
  const callRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (momentIdFor && typeof window !== 'undefined' && window.innerWidth >= 768)
      callRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [momentIdFor]);

  // Chirp when the race stops for a call.
  const momentId = paused ? state.currentMoment?.id : undefined;
  useEffect(() => {
    if (momentId && soundOn()) radioChirp();
  }, [momentId]);

  // Calls booked for the coming lap show at once (they act when it's run).
  const next = state.race.lap + 1;
  const pending: Partial<Modes> = {};
  for (const d of state.decisions) {
    if (d.lap === next && d.kind === 'mode') (pending as Record<string, string>)[d.key] = d.value;
  }
  // A stop under way (pit fix). The lap being shown is `next`: a stop called for it turns in at
  // the end of this lap; one called for the lap after, at the end of the next. Once the race
  // model has it (from the in-lap on), it's on the car's plan until the out-lap is run.
  const callPit = state.decisions.find((d) => d.kind === 'pit' && d.lap >= next);
  const planned = me?.strategy.find((s) => s.lap > state.race.lap);
  const boxing =
    callPit?.kind === 'pit'
      ? {
          compound: callPit.compound,
          when: callPit.lap === next ? 'boxing this lap' : 'boxing next lap',
        }
      : planned
        ? {
            compound: planned.to,
            when: planned.lap === next ? 'in the pits now' : 'boxing this lap',
          }
        : null;
  const userBoxing = callPit?.kind === 'pit' && callPit.lap === next;

  // A stop by your car or the rival on the lap just run, while the next lap animates.
  const latest = log.at(-1);
  const stop =
    state.phase === 'racing' && latest?.lap === state.race.lap
      ? latest.pits.find((p) => p.code === userSide || p.code === rival)
      : undefined;

  const gapText = gap === null ? '-' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}s`;
  const panelBody =
    panel === 'gap' ? (
      <section aria-label={`Gap to ${rival}`} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">Gap to {rival}</span>
          <span
            className={`mono text-[15px] font-semibold ${gap === null ? '' : gap >= 0 ? 'text-[var(--you)]' : 'text-[var(--rival)]'}`}
          >
            {gapText}
          </span>
        </div>
        {points.length >= 2 ? (
          <GapTrace points={points} rival={rival} />
        ) : (
          <p className="m-0 text-[13px] text-[var(--muted)]">The trace builds as laps go by.</p>
        )}
      </section>
    ) : null;

  const mapButton = (on: boolean) =>
    `rounded-md border px-2 py-1 text-[12px] font-semibold ${
      on ? 'border-white bg-white text-[#141716]' : 'border-white/20 bg-black/55 text-white'
    }`;

  return (
    <main className="mx-auto flex min-h-screen max-w-[1360px] flex-col gap-3 px-4 pb-6 pt-3 xl:h-screen xl:pb-3">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--rule)] pb-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="disp wide shrink-0 text-[18px] leading-none">Pit Wall</span>
          {team && (
            <span className="disp hidden truncate text-[18px] leading-none text-[var(--you)] sm:inline">
              {team} race engineer
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {source === 'practice' && (
            <span
              className="shrink-0 rounded-full bg-[var(--flag)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#141716]"
              title={state.meta.practiceReason ?? 'Practice run'}
            >
              Practice<span className="hidden sm:inline"> · not saved</span>
            </span>
          )}
          <span className="eyebrow hidden min-w-0 truncate 2xl:inline">
            {number ? `Daily #${number}` : (state.meta.practiceReason ?? 'Practice')} ·{' '}
            {model.race.name ?? model.race.id}
          </span>
          <div className="flex items-center gap-1.5">
            {([1, 2] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={state.speed === s}
                onClick={() => game.setSpeed(s)}
                className={`h-8 rounded-md border px-2.5 text-[12px] font-semibold ${
                  state.speed === s
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                    : 'border-[var(--rule)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {s}×
              </button>
            ))}
            <button
              type="button"
              aria-pressed={sound}
              aria-label={sound ? 'Radio sound on' : 'Radio sound off'}
              title="Radio chirp at decisions"
              onClick={() => {
                setSoundOn(!sound);
                setSound(!sound);
                if (!sound) radioChirp();
              }}
              className="h-8 rounded-md border border-[var(--rule)] px-3 text-[14px]"
            >
              {sound ? '🔊' : '🔇'}
            </button>
            {source !== 'live' && (
              <button
                type="button"
                onClick={game.reset}
                aria-label="Restart the race"
                title="Restart the race"
                className="h-8 rounded-md border border-[var(--rule)] px-3 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                ↺
              </button>
            )}
          </div>
        </span>
      </header>

      {/* On a laptop the race view fits the screen: each column scrolls inside itself. */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] xl:min-h-0 xl:flex-1 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        {/* Standings: left on wide screens, under the race otherwise. */}
        <section
          aria-label="Standings"
          className="order-3 flex flex-col overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--card)] md:col-span-2 xl:order-1 xl:col-span-1"
        >
          <div className="flex justify-between border-b border-[var(--rule)] px-3 py-2">
            <span className="eyebrow">Standings</span>
            <span className="eyebrow">Tyre · gap</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TimingTower
              race={state.race}
              model={model}
              userSide={userSide}
              rival={rival}
              onPick={select}
            />
          </div>
        </section>

        {/* The race: scoreboard over the circuit, the controls under it. */}
        <section
          aria-label="Race"
          className="order-1 flex min-w-0 flex-col gap-3 xl:order-2 xl:min-h-0 xl:overflow-y-auto"
        >
          {/* On a laptop the map takes all the height the calls and team radio leave. */}
          <div className="xl:flex xl:min-h-[380px] xl:flex-1 xl:flex-col">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-t-xl border border-b-0 border-[var(--rule)] bg-[var(--card)] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-7 w-1.5 rounded-sm bg-[var(--you)]" />
                <span className="disp wide text-[20px] leading-none">{userSide}</span>
                {me && !me.retired && <TyreBadge compound={me.compound} age={me.tyreAge} />}
              </div>
              <div className="text-center">
                <div className="disp wide text-[26px] leading-none">
                  {state.race.lap}
                  <span className="text-[18px] text-[var(--muted)]"> / {totalLaps}</span>
                </div>
                <div className="mono whitespace-nowrap text-[11px] text-[var(--muted)] sm:text-[12px]">
                  {gap === null
                    ? ''
                    : gap >= 0
                      ? `${rival} +${gap.toFixed(1)}s behind`
                      : `${rival} ${(-gap).toFixed(1)}s ahead`}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                {them && !them.retired && <TyreBadge compound={them.compound} age={them.tyreAge} />}
                <span className="disp wide text-[20px] leading-none">{rival}</span>
                <span className="h-7 w-1.5 rounded-sm bg-[var(--rival)]" />
              </div>
            </div>
            <div
              className={`flex flex-col overflow-hidden rounded-b-xl bg-[var(--tarmac)] xl:min-h-0 xl:flex-1 ${paused ? 'map-alert' : ''}`}
            >
              <div className="relative xl:min-h-0 xl:flex-1">
                {outline ? (
                  <TrackMap
                    outline={outline}
                    race={state.race}
                    model={model}
                    userSide={userSide}
                    rival={rival}
                    clock={game.clock}
                    selected={selected}
                    onSelect={select}
                    dim={paused}
                    finishing={finishMeta}
                    fight={fight}
                    flash={flash}
                    userBoxing={userBoxing}
                  />
                ) : (
                  <p className="p-8 text-center text-[var(--muted)]">
                    No track map for this race yet.
                  </p>
                )}
                <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
                  <span className="rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white">
                    Lap {state.race.lap} · {lapsLeft} to go
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${flag.cls}`}
                  >
                    {flag.text}
                  </span>
                </div>
                {finishing && crossed && (
                  <output className="radio-alert absolute inset-x-2.5 bottom-12 z-10 mx-auto flex max-w-[420px] items-center justify-center gap-3 rounded-xl border-2 border-white bg-[#141716]/90 px-4 py-3 text-white shadow-2xl">
                    <span aria-hidden="true" className="text-[26px]">
                      🏁
                    </span>
                    <span className="disp text-[19px] leading-none">
                      Chequered flag · {userSide} P{finishPos}
                    </span>
                  </output>
                )}
                {fight && !paused && (
                  <output
                    className="radio-alert absolute inset-x-2.5 top-12 z-10 mx-auto flex max-w-[460px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-white shadow-2xl"
                    style={{ borderColor: 'var(--box)', background: 'rgba(20,23,22,0.9)' }}
                  >
                    <span aria-hidden="true" className="text-[20px]">
                      ⚔️
                    </span>
                    <span className="text-[14px] font-semibold leading-snug">
                      {fight.attacking
                        ? `${userSide} attacks ${fight.other} (${fight.gap.toFixed(1)} s ahead)`
                        : `${fight.other} attacks ${userSide} (${fight.gap.toFixed(1)} s behind)`}
                      <span className="block text-[12px] font-normal text-[#cfd6d3]">
                        The move comes into Turn {fight.corner}, this lap
                        {quick?.kind === 'battle' ? ' · your call' : ''}
                      </span>
                    </span>
                  </output>
                )}
                {paused && state.currentMoment && (
                  <RadioAlert moment={state.currentMoment} race={state.race} model={model} />
                )}
                {stop && (
                  <div className="absolute right-2.5 top-2.5 z-10">
                    <PitCard
                      key={`${stop.code}-${stop.lap}`}
                      stop={stop}
                      race={state.race}
                      userSide={userSide}
                      rival={rival}
                    />
                  </div>
                )}
                {selected && !narrow && (
                  <div
                    className={`absolute bottom-2.5 z-10 ${corner === 'left' ? 'left-2.5' : 'right-2.5'}`}
                  >
                    {driverCard}
                  </div>
                )}
                {/* The map's pop-overs (under the map on a phone). */}
                {panel && (
                  <div
                    className={
                      'absolute bottom-2.5 right-2.5 z-20 hidden w-[380px] rounded-xl border border-[var(--rule)] bg-[var(--card)]/95 p-3 shadow-2xl backdrop-blur md:block'
                    }
                  >
                    {panelBody}
                  </div>
                )}
              </div>
              {/* Legend and the gap button, in a bar under the map: never on the circuit. */}
              <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2.5 py-1.5">
                <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-[#cfd6d3]">
                  <span>
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--you)]" />
                    {userSide}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--rival)]" />
                    {rival}
                  </span>
                  <span className="hidden sm:inline">
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--field)]" />
                    Field
                  </span>
                  <span className="hidden sm:inline">
                    <i className="mr-1 inline-block h-2 w-2 rounded-full border border-dashed border-[var(--field)]" />
                    Lapped
                  </span>
                  <span className="hidden lg:inline">Ring = tyre · tap a car</span>
                </div>
                <button
                  type="button"
                  aria-pressed={panel === 'gap'}
                  onClick={() => toggle('gap')}
                  className={mapButton(panel === 'gap')}
                >
                  Gap {gap === null ? '' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}`}
                </button>
              </div>
            </div>
          </div>

          {panel && <div className="card md:hidden">{panelBody}</div>}
          {/* On a phone the map is too small to hold a car's card: it opens under it. */}
          {selected && narrow && driverCard}

          {/* Your calls, under the map: the big decision, or a quick call. */}
          {paused && state.currentMoment ? (
            <div
              ref={callRef}
              className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto p-3 md:static md:max-h-none md:p-0"
            >
              <DecisionPanel
                key={state.currentMoment.id}
                moment={state.currentMoment}
                race={state.race}
                model={model}
                onChoose={game.choose}
              />
            </div>
          ) : quick && state.phase === 'racing' ? (
            <QuickCallCard
              key={quick.lap}
              call={quick}
              ms={
                quick.kind === 'battle'
                  ? Math.min(BATTLE_MS, LAP_MS[state.speed] * SLOW_MOTION * 0.85)
                  : Math.min(CALL_MS, LAP_MS[state.speed] * 0.9)
              }
              onAnswer={answerQuick}
              onTimeout={quickTimeout}
            />
          ) : null}

          {/* Team radio: every order, any time (hidden while a big call waits). */}
          {!paused && (
            <TeamRadio
              race={state.race}
              model={model}
              userSide={userSide}
              rival={rival}
              pending={pending}
              boxing={boxing}
              disabled={state.phase !== 'racing'}
              describe={(key, value) => modeLine(model, key, value)}
              onCall={(call) => game.call(place(call))}
            />
          )}
        </section>

        {/* Stats: your driver, the car, the radio. */}
        <aside aria-label="Stats" className="order-2 flex flex-col gap-3 xl:order-3 xl:min-h-0">
          <DriverProfile code={userSide} race={state.race} model={model} log={log} />
          <CarStats race={state.race} model={model} log={log} userSide={userSide} rival={rival} />
          {/* The rest of the column, in two halves: your calls graded, then the radio. */}
          <div className="flex min-h-[260px] flex-1 basis-0 flex-col gap-3 xl:min-h-0">
            <LiveGrades state={state} />
            <section aria-label="Radio" className="card flex min-h-0 flex-1 flex-col gap-2">
              <span className="eyebrow">Radio</span>
              {state.radio.length ? (
                <div className="min-h-0 overflow-y-auto">
                  <RadioLog messages={state.radio} max={8} />
                </div>
              ) : (
                <p className="m-0 text-[13px] text-[var(--muted)]">Quiet so far.</p>
              )}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
