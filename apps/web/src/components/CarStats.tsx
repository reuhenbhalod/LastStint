// Your car's numbers, on the right of the race screen: tyre life to the drop-off, the last lap
// against the rival's, the pace trend over the last laps, and the gap. All from the race state
// and the lap log (game/raceLog.ts); the tyre life from the race model's compound fit.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { tyreName } from '../game/choices.js';
import type { LapEvents } from '../game/raceLog.js';

const lapClock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const secs = (s: number) => `${Math.abs(s).toFixed(2)}s`;

export function CarStats({
  race,
  model,
  log,
  userSide,
  rival,
}: {
  race: RaceState;
  model: RaceModel;
  log: LapEvents[];
  userSide: string;
  rival: string;
}) {
  const me = race.cars[userSide];
  const them = race.cars[rival];
  if (!me || me.retired) {
    return (
      <section aria-label="Car stats" className="card">
        <span className="eyebrow">Car</span>
        <p className="m-0 text-[14px] text-[var(--muted)]">{userSide} is out of the race.</p>
      </section>
    );
  }
  const compound = model.compounds[me.compound];
  const cliff = compound?.cliffLap ?? 40;
  const left = Math.max(0, Math.round(cliff - me.tyreWear));
  const used = Math.min(1, me.tyreWear / Math.max(1, cliff));
  const tone = left <= 2 ? 'var(--box)' : left <= 6 ? 'var(--flag)' : 'var(--you)';

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
  const gap = them && !them.retired ? them.totalTime - me.totalTime : null;

  return (
    <section aria-label="Car stats" className="card flex flex-col gap-3">
      <span className="eyebrow">Car · {userSide}</span>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold">
            {tyreName(me.compound)} · {me.tyreAge} laps
          </span>
          <span className="mono text-[12px]" style={{ color: tone }}>
            {left > 0 ? `${left} laps to the drop-off` : 'Past the drop-off'}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--card-2)]" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.round(used * 100)}%`, background: tone }}
          />
        </div>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="eyebrow">Last lap</dt>
          <dd className="m-0 mono text-[14px] font-semibold">{mine ? lapClock(mine) : '-'}</dd>
        </div>
        <div>
          <dt className="eyebrow">{rival} last</dt>
          <dd className="m-0 mono text-[14px] font-semibold">{theirs ? lapClock(theirs) : '-'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Gap</dt>
          <dd
            className={`m-0 mono text-[14px] font-semibold ${gap === null ? '' : gap >= 0 ? 'text-[var(--you)]' : 'text-[var(--rival)]'}`}
          >
            {gap === null ? '-' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}s`}
          </dd>
        </div>
      </dl>
      {me.battery !== undefined && (
        <div className="flex items-center gap-2">
          <span className="eyebrow w-14">Battery</span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--card-2)]"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.round(me.battery)}%`,
                background: me.battery <= 15 ? 'var(--box)' : 'var(--you)',
              }}
            />
          </div>
          <span className="mono whitespace-nowrap text-right text-[12px] capitalize">
            {Math.round(me.battery)}% · {me.modes.ers}
          </span>
        </div>
      )}
      {trend !== null && (
        <p className="m-0 text-center text-[13px] text-[var(--muted)]">
          {Math.abs(trend) < 0.05
            ? `Same pace as ${rival} over the last laps`
            : trend < 0
              ? `${secs(trend)} a lap quicker than ${rival} lately`
              : `${secs(trend)} a lap slower than ${rival} lately`}
        </p>
      )}
    </section>
  );
}
