// The race view: the standings on the left; in the middle the scoreboard and the circuit,
// with your calls under it (the big decision as a wide strip, or a quick call) and the team
// radio below (every order the wall can give: box, headset, team orders); on the right the
// stats (your driver, the car, the radio log). Speed, sound and restart sit in the header; the
// gap trace opens from a button on the map. On a phone it stacks, and the decision card
// rises as a bottom sheet. When the race stops for a call, a radio banner drops over the map
// (and chirps, if sound is on). Tap any car, on the map or in the standings, for its card; a
// stop by your car or the rival is called out while it drives the pit lane.

import type { Modes, RaceModel } from '@boxthislap/sim';
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
import { modeLine } from '../game/guide.js';
import { type QuickCall, quickCallAt, quickCallLaps, safetyCarCall } from '../game/quickCalls.js';
import { useRaceLog } from '../game/raceLog.js';
import { radioChirp, setSoundOn, soundOn } from '../game/sound.js';
import { type Game, LAP_MS } from '../game/useGame.js';
import type { GameState } from '../state/machine.js';
import { quietCorner } from '../track/geometry.js';
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

  // Quick calls between the big moments: asked once each, answered or timed out.
  const quickLaps = useMemo(() => new Set(quickCallLaps(model)), [model]);
  const asked = useRef(new Set<number>());
  const [quick, setQuick] = useState<QuickCall | null>(null);
  const raceLap = state.race.lap;
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once, when its lap completes.
  useEffect(() => {
    if (state.phase !== 'racing' || asked.current.has(raceLap)) return;
    // A crash's safety car is asked about at once; otherwise the regular quick calls.
    const sc = safetyCarCall(state.race, model);
    if (!sc && !quickLaps.has(raceLap)) return;
    asked.current.add(raceLap);
    setQuick(sc ?? quickCallAt(state.race, model, log));
  }, [raceLap, state.phase, quickLaps]);
  const answerQuick = useCallback(
    (id: string) => {
      const o = quick?.options.find((x) => x.id === id);
      if (o?.call) game.call({ ...o.call, lap: state.race.lap + 1 }, { asked: true });
      else game.radio('Copy. No change.');
      setQuick(null);
    },
    [quick, game, state.race],
  );
  const quickTimeout = useCallback(() => {
    game.radio('No answer from the wall. Sticking to the plan.');
    setQuick(null);
  }, [game]);

  const select = useCallback((code: string) => setSelected((c) => (c === code ? null : code)), []);
  const close = useCallback(() => setSelected(null), []);

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
  let boxing: string | null = null;
  for (const d of state.decisions) {
    if (d.lap !== next) continue;
    if (d.kind === 'mode') (pending as Record<string, string>)[d.key] = d.value;
    if (d.kind === 'pit') boxing = d.compound;
  }

  // A stop by your car or the rival on the lap just run, while the next lap animates.
  const latest = log.at(-1);
  const stop =
    state.phase === 'racing' && latest?.lap === state.race.lap
      ? latest.pits.find((p) => p.code === userSide || p.code === rival)
      : undefined;

  const gapText = gap === null ? '—' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}s`;
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
    <main className="mx-auto flex min-h-screen max-w-[1360px] flex-col gap-3 px-4 pb-6 pt-3">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--rule)] pb-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="disp wide shrink-0 text-[18px] leading-none">Pit Wall</span>
          {team && (
            <span className="disp hidden truncate text-[18px] leading-none text-[var(--you)] sm:inline">
              {team} team manager
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        {/* Standings: left on wide screens, under the race otherwise. */}
        <section
          aria-label="Standings"
          className="order-3 flex flex-col overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--card)] md:col-span-2 xl:order-1 xl:col-span-1"
        >
          <div className="flex justify-between border-b border-[var(--rule)] px-3 py-2">
            <span className="eyebrow">Standings</span>
            <span className="eyebrow">Tyre · gap</span>
          </div>
          <TimingTower
            race={state.race}
            model={model}
            userSide={userSide}
            rival={rival}
            onPick={select}
          />
        </section>

        {/* The race: scoreboard over the circuit, the controls under it. */}
        <section
          aria-label="Race"
          className="order-1 flex min-w-0 flex-col gap-3 self-start xl:order-2"
        >
          <div>
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
              className={`relative overflow-hidden rounded-b-xl bg-[var(--tarmac)] ${paused ? 'map-alert' : ''}`}
            >
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
              {selected && (
                <div
                  className={`absolute bottom-12 z-10 ${corner === 'left' ? 'left-2.5' : 'right-2.5'}`}
                >
                  <DriverCard
                    code={selected}
                    race={state.race}
                    model={model}
                    log={log}
                    userSide={userSide}
                    rival={rival}
                    onClose={close}
                  />
                </div>
              )}
              {/* The map's pop-overs (under the map on a phone). */}
              {panel && (
                <div
                  className={`absolute bottom-12 z-20 hidden w-[380px] ${corner === 'left' ? 'left-2.5' : 'right-2.5'} rounded-xl border border-[var(--rule)] bg-[var(--card)]/95 p-3 shadow-2xl backdrop-blur md:block`}
                >
                  {panelBody}
                </div>
              )}
              {/* Legend and the gap button, in the bottom corner the circuit leaves clear. */}
              <div
                className={`absolute bottom-2.5 z-20 flex items-center gap-1.5 ${corner === 'left' ? 'left-2.5' : 'right-2.5 flex-row-reverse'}`}
              >
                <button
                  type="button"
                  aria-pressed={panel === 'gap'}
                  onClick={() => toggle('gap')}
                  className={mapButton(panel === 'gap')}
                >
                  Gap {gap === null ? '' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}`}
                </button>
                {!selected && (
                  <div className="hidden flex-wrap gap-3 rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold text-[#cfd6d3] sm:flex">
                    <span>
                      <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--you)]" />
                      {userSide}
                    </span>
                    <span>
                      <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--rival)]" />
                      {rival}
                    </span>
                    <span>
                      <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--field)]" />
                      Field
                    </span>
                    <span>
                      <i className="mr-1 inline-block h-2 w-2 rounded-full border border-dashed border-[var(--field)]" />
                      Lapped
                    </span>
                    <span className="hidden lg:inline">Ring = tyre · tap a car</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {panel && <div className="card md:hidden">{panelBody}</div>}

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
              ms={Math.min(8000, LAP_MS[state.speed] * 0.9)}
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
              onCall={(call) => game.call(call)}
            />
          )}
        </section>

        {/* Stats: your driver, the car, the radio. */}
        <aside aria-label="Stats" className="order-2 flex flex-col gap-3 xl:order-3">
          <DriverProfile code={userSide} race={state.race} model={model} log={log} />
          <CarStats race={state.race} model={model} log={log} userSide={userSide} rival={rival} />
          {/* The rest of the column, in two halves: your calls graded, then the radio. */}
          <div className="flex min-h-[260px] flex-1 basis-0 flex-col gap-3">
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
