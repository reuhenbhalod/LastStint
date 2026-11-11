// Your car's numbers, on the right of the race screen: tyre life to the drop-off, the last lap
// against the rival's, the pace trend over the last laps, and the gap. All from the race state
// and the lap log (game/raceLog.ts); the tyre life from the race model's compound fit. In Eras
// (`info`, eras spec §7) the gap follows the information level: rounded at Limited, and at
// Minimal shown only when the rival is directly ahead or behind. Your own tyres stay exact.
// Without it, exactly as before.

import { type RaceModel, type RaceState, tyreLife } from '@laststint/sim';
import { surname } from '../data/names.js';
import {
  FULL_INFORMATION,
  type InformationView,
  gapShown,
  gapText,
  shownGap,
} from '../eras/difficulty/information.js';
import { tyreName } from '../game/choices.js';
import { FUEL_SHORT, fuelReading, liftText, marginText } from '../game/fuel.js';
import type { LapEvents } from '../game/raceLog.js';
import { Bar, Panel, Stat, Stats } from './Panel.js';
import { TyreBadge } from './TyreBadge.js';

const lapClock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const secs = (s: number) => `${Math.abs(s).toFixed(2)}s`;

export function CarStats({
  race,
  model,
  log,
  userSide,
  rival,
  info = FULL_INFORMATION,
}: {
  race: RaceState;
  model: RaceModel;
  log: LapEvents[];
  userSide: string;
  rival: string;
  /** What the Eras information level shows (everything, otherwise). */
  info?: InformationView;
}) {
  const me = race.cars[userSide];
  const them = race.cars[rival];
  if (!me || me.retired) {
    return (
      <Panel label="Car stats" title="Car">
        <p className="m-0 text-[13px] text-[#9AA5A0]">{surname(userSide)} is out of the race.</p>
      </Panel>
    );
  }
  const compound = model.compounds[me.compound];
  // Its usable life (sim tyreLife): laps until it's 2 s a lap slower than new.
  const cliff = compound ? tyreLife(compound) : 40;
  const left = Math.max(0, Math.round(cliff - me.tyreWear));
  const used = Math.min(1, me.tyreWear / Math.max(1, cliff));
  const tone = left <= 2 ? 'var(--box)' : left <= 6 ? 'var(--flag)' : 'var(--good)';

  // Last lap, and the average difference to the rival over the last 3 green laps.
  const last = log.at(-1);
  const mine = last?.lapTimes[userSide];
  const theirs = last?.lapTimes[rival];
  // (Laps either car stopped on don't count: a stop isn't pace.)
  const recent = log
    .filter((l) => !l.pits.some((p) => p.code === userSide || p.code === rival))
    .slice(-3)
    .map((l) => [l.lapTimes[userSide], l.lapTimes[rival]] as const)
    .filter(([a, b]) => a !== undefined && b !== undefined) as Array<[number, number]>;
  const trend = recent.length ? recent.reduce((t, [a, b]) => t + (a - b), 0) / recent.length : null;
  const gap =
    them && !them.retired && gapShown(info, race.order, userSide, rival)
      ? shownGap(info, them.totalTime - me.totalTime)
      : null;

  const fuel = fuelReading(race, model);
  const gapTone = gap === null ? undefined : gap >= 0 ? 'var(--you)' : 'var(--rival)';
  return (
    <Panel label="Car stats" title="Car">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <TyreBadge compound={me.compound} age={me.tyreAge} />
            {tyreName(me.compound)}
          </span>
          <span className="mono text-[12px] font-semibold" style={{ color: tone }}>
            {left > 0 ? `${left} laps to the drop-off` : 'Past the drop-off'}
          </span>
        </div>
        <Bar value={used} color={tone} />
      </div>
      <Stats>
        <Stat label={`${userSide} last`}>
          <span className="mono text-[15px]">{mine ? lapClock(mine) : '-'}</span>
        </Stat>
        <Stat label={`${rival} last`}>
          <span className="mono text-[15px]">{theirs ? lapClock(theirs) : '-'}</span>
        </Stat>
        <Stat label="Gap" tone={gapTone}>
          <span className="mono text-[15px]">{gapText(info, gap)}</span>
        </Stat>
      </Stats>
      {me.battery !== undefined && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
              Battery
            </span>
            <span className="mono text-[12px] font-semibold capitalize">
              {Math.round(me.battery)}% · {me.modes.ers}
            </span>
          </div>
          <Bar value={me.battery / 100} color={me.battery <= 15 ? 'var(--box)' : 'var(--good)'} />
        </div>
      )}
      {fuel && (
        <div className="flex flex-col gap-1.5" aria-label="Fuel">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
              Fuel
            </span>
            <span className="mono text-[12px] font-semibold">
              {fuel.empty ? (
                <span className="text-[var(--box-ink)]">Empty: lifting everywhere</span>
              ) : (
                <>
                  {fuel.kg.toFixed(1)} kg ·{' '}
                  <span
                    style={{
                      color:
                        fuel.margin < FUEL_SHORT
                          ? 'var(--box-ink)'
                          : fuel.margin < 0
                            ? 'var(--flag)'
                            : 'var(--good)',
                    }}
                  >
                    {marginText(fuel.margin)}
                  </span>
                </>
              )}
            </span>
          </div>
          <Bar
            value={fuel.level}
            color={
              fuel.margin < FUEL_SHORT
                ? 'var(--box)'
                : fuel.margin < 0
                  ? 'var(--flag)'
                  : 'var(--good)'
            }
          />
          {fuel.savePerLap > 0 && !fuel.empty && (
            <span className="text-[11.5px] text-[#9AA5A0]">
              {me.modes.fuel === 'liftAndCoast'
                ? `Lifting and coasting · ${liftText(fuel.liftLaps)} to go`
                : `To make it up: ${liftText(fuel.liftLaps)}`}
            </span>
          )}
        </div>
      )}
      {trend !== null && (
        <p className="m-0 border-t border-[#252D31] pt-2.5 text-[12px] text-[#B9C2BD]">
          {Math.abs(trend) < 0.05
            ? `Same pace as ${surname(rival)} over the last laps`
            : trend < 0
              ? `${secs(trend)} a lap quicker than ${surname(rival)} lately`
              : `${secs(trend)} a lap slower than ${surname(rival)} lately`}
        </p>
      )}
    </Panel>
  );
}
