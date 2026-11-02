// The race view, after the track-view mockup: standings on the left, the scoreboard and the
// circuit with a dot per car in the middle, and the call column on the right (the decision
// card when the game pauses, otherwise the headset and BOX). On a phone it stacks, and the
// decision card rises as a bottom sheet. You run the team's pit wall: when the race stops for
// a call, a radio banner drops over the map (and chirps, if sound is on). Tap any car, on the
// map or in the standings, for its card; a stop by your car or the rival is called out while
// it drives the pit lane.

import type { Modes, RaceModel } from '@boxthislap/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BoxButton } from '../components/BoxButton.js';
import { DecisionPanel } from '../components/DecisionPanel.js';
import { DriverCard } from '../components/DriverCard.js';
import { GapTrace } from '../components/GapTrace.js';
import { HeadsetPanel } from '../components/HeadsetPanel.js';
import { PitCard } from '../components/PitCard.js';
import { RadioAlert } from '../components/RadioAlert.js';
import { RadioLog } from '../components/RadioLog.js';
import { TimingTower } from '../components/TimingTower.js';
import { TrackMap } from '../components/TrackMap.js';
import { TyreBadge } from '../components/TyreBadge.js';
import { modeLine } from '../game/guide.js';
import { useRaceLog } from '../game/raceLog.js';
import { radioChirp, setSoundOn, soundOn } from '../game/sound.js';
import type { Game } from '../game/useGame.js';
import type { GameState } from '../state/machine.js';
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
}: { game: Game; state: GameState; model: RaceModel }) {
  const { userSide, rival, totalLaps, number, source } = state.meta;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const paused = state.phase === 'decision';
  const outline = outlineFor(model.race.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [sound, setSound] = useState(soundOn);
  const log = useRaceLog(state.race);
  const team = model.drivers.find((d) => d.code === userSide)?.team;
  const flag = FLAG[state.race.flag];
  const lapsLeft = totalLaps - state.race.lap;
  const gap = me && them && !me.retired && !them.retired ? them.totalTime - me.totalTime : null;

  // Gap history for the trace (> 0: we're ahead), from the laps this screen has seen.
  const trace = useRef(new Map<number, number>());
  if (gap !== null) trace.current.set(state.race.lap, gap);
  const points = [...trace.current.entries()].sort((a, b) => a[0] - b[0]).slice(-15);

  const select = useCallback((code: string) => setSelected((c) => (c === code ? null : code)), []);
  const close = useCallback(() => setSelected(null), []);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-[1320px] flex-col gap-3 px-4 pb-6 pt-3">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--rule)] pb-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="disp shrink-0 text-[24px] leading-none">Pit Wall</span>
          {team && (
            <span className="eyebrow hidden truncate !text-[var(--you)] sm:inline">
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
              Practice · not saved
            </span>
          )}
          <span className="eyebrow min-w-0 truncate">
            {number ? `Daily #${number}` : (state.meta.practiceReason ?? 'Practice')} ·{' '}
            {model.race.name ?? model.race.id}
          </span>
        </span>
      </header>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        {/* Standings: left on wide screens, under the race otherwise. */}
        <aside
          aria-label="Standings"
          className="order-3 overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--card)] md:col-span-2 xl:order-1 xl:col-span-1"
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
        </aside>

        {/* The race: scoreboard over the circuit. */}
        <section aria-label="Race" className="order-1 min-w-0 xl:order-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-t-xl border border-b-0 border-[var(--rule)] bg-[var(--card)] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-7 w-1.5 rounded-sm bg-[var(--you)]" />
              <span className="disp text-[24px] leading-none">{userSide}</span>
              <span className="eyebrow hidden sm:inline">Your driver</span>
              {me && !me.retired && <TyreBadge compound={me.compound} age={me.tyreAge} />}
            </div>
            <div className="text-center">
              <div className="disp text-[32px] leading-none">
                {state.race.lap}
                <span className="text-[18px] text-[var(--muted)]"> / {totalLaps}</span>
              </div>
              <div className="mono text-[12px] text-[var(--muted)]">
                {gap === null
                  ? ''
                  : gap >= 0
                    ? `${rival} +${gap.toFixed(1)}s behind`
                    : `${rival} ${(-gap).toFixed(1)}s ahead`}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              {them && !them.retired && <TyreBadge compound={them.compound} age={them.tyreAge} />}
              <span className="eyebrow hidden sm:inline">Rival</span>
              <span className="disp text-[24px] leading-none">{rival}</span>
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
              />
            ) : (
              <p className="p-8 text-center text-[var(--muted)]">No track map for this race yet.</p>
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
            {paused && state.currentMoment && (
              <RadioAlert moment={state.currentMoment} race={state.race} model={model} />
            )}
            {stop && (
              <div className="absolute right-2.5 top-12 z-10">
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
              <div className="absolute bottom-2.5 right-2.5 z-10">
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
            <div className="absolute right-2.5 top-2.5 flex gap-1.5">
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
                className="rounded-md border border-white/20 bg-black/55 px-2 py-1 text-[12px] font-semibold text-white"
              >
                {sound ? '🔊' : '🔇'}
              </button>
              {source !== 'live' && (
                <button
                  type="button"
                  onClick={game.reset}
                  aria-label="Restart the race"
                  className="rounded-md border border-white/20 bg-black/55 px-2 py-1 text-[12px] font-semibold text-white"
                >
                  ↺
                </button>
              )}
              {([1, 2] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={state.speed === s}
                  onClick={() => game.setSpeed(s)}
                  className={`rounded-md border border-white/20 px-2 py-1 text-[12px] font-semibold ${
                    state.speed === s ? 'bg-white text-[#141716]' : 'bg-black/55 text-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
            <div
              className={`absolute bottom-2.5 left-2.5 flex-wrap gap-3 rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold text-[#cfd6d3] ${selected ? 'hidden md:flex' : 'flex'}`}
            >
              <span>
                <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--you)]" />
                You
              </span>
              <span>
                <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--rival)]" />
                Rival
              </span>
              <span>
                <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--field)]" />
                Field
              </span>
              <span>
                <i className="mr-1 inline-block h-2 w-2 rounded-full border border-dashed border-[var(--field)]" />
                Lapped
              </span>
              <span className="hidden sm:inline">Ring = tyre · tap a car</span>
            </div>
          </div>
        </section>

        {/* The call column. */}
        <aside aria-label="Your call" className="order-2 flex flex-col gap-3 xl:order-3">
          <h2 className="disp m-0 text-[26px] leading-none">Your call</h2>
          {paused && state.currentMoment ? (
            <div className="fixed inset-x-0 bottom-0 z-20 max-h-[75vh] overflow-y-auto p-3 md:static md:max-h-none md:p-0">
              <DecisionPanel
                key={state.currentMoment.id}
                moment={state.currentMoment}
                race={state.race}
                model={model}
                onChoose={game.choose}
              />
            </div>
          ) : (
            <p className="m-0 text-[14px] text-[var(--muted)]">
              The race stops for the big calls. BOX and the headset are always live, but your driver
              doesn’t always listen.
            </p>
          )}
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--rule)] bg-[var(--card)] p-3">
            <GapTrace points={points} rival={rival} />
            <RadioLog messages={state.radio} />
            {me && (
              <HeadsetPanel
                modes={me.modes}
                pending={pending}
                describe={(key, value) => modeLine(model, key, value)}
                disabled={paused}
                onFlip={(key, value) =>
                  game.call({ lap: state.race.lap + 1, kind: 'mode', key, value })
                }
              />
            )}
            <BoxButton
              compounds={Object.keys(model.compounds)}
              booked={boxing}
              disabled={paused}
              onBox={(compound) => game.call({ lap: state.race.lap + 1, kind: 'pit', compound })}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
