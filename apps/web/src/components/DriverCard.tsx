// The driver card: tap a car on the map or in the standings. Name, team and number, place and
// gaps, tyres, stops this race, last lap, and (for your car) the headset modes, plus where
// they really finished.

import type { RaceModel, RaceState } from '@laststint/sim';
import { useEffect } from 'react';
import { driverInfo } from '../data/drivers.js';
import type { LapEvents } from '../game/raceLog.js';
import { lapTime } from '../track/geometry.js';
import { CloseIcon } from './Icons.js';
import { TyreBadge } from './TyreBadge.js';

const lapClock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="m-0 mono text-[14px] font-semibold">{children}</dd>
    </div>
  );
}

export function DriverCard({
  code,
  race,
  model,
  log,
  userSide,
  rival,
  onClose,
}: {
  code: string;
  race: RaceState;
  model: RaceModel;
  log: LapEvents[];
  userSide: string;
  rival: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const car = race.cars[code];
  if (!car) return null;
  const info = driverInfo(code);
  const pos = race.order.indexOf(code) + 1;
  const leader = race.cars[race.order[0] ?? ''];
  const me = race.cars[userSide];
  const lap = lapTime(model, race.flag);
  const toLeader = leader ? car.totalTime - leader.totalTime : 0;
  const down = Math.floor(toLeader / lap);
  const toYou = me && code !== userSide && !me.retired ? car.totalTime - me.totalTime : null;
  const stops = log.flatMap((l) => l.pits.filter((p) => p.code === code));
  const last = log.at(-1)?.lapTimes[code];
  const realPos = model.realResult.indexOf(code) + 1;
  const tag = code === userSide ? 'Your driver' : code === rival ? 'Rival' : null;
  const accent =
    code === userSide ? 'var(--you)' : code === rival ? 'var(--rival)' : 'var(--field)';

  return (
    <section
      aria-label={`${info?.name ?? code} details`}
      className="w-[min(320px,calc(100vw-2rem))] rounded-xl border border-[var(--rule)] bg-[var(--card)]/95 p-3 shadow-2xl backdrop-blur"
    >
      <header className="mb-2 flex items-start gap-2.5">
        <span className="mt-0.5 h-9 w-1.5 rounded-sm" style={{ background: accent }} />
        <div className="min-w-0 flex-1">
          <p className="m-0 disp text-[16px] leading-none">
            {info ? `${info.number} · ` : ''}
            {info?.name ?? code}
          </p>
          <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">
            {car.team}
            {tag ? ` · ${tag}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close driver details"
          className="rounded-md px-1.5 text-[18px] leading-none text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <CloseIcon size={18} />
        </button>
      </header>
      <dl className="m-0 grid grid-cols-3 gap-x-3 gap-y-2.5">
        <Stat label="Position">{car.retired ? 'OUT' : `P${pos}`}</Stat>
        <Stat label="To leader">
          {car.retired
            ? '-'
            : pos === 1
              ? 'Leader'
              : down >= 1
                ? `+${down} lap${down > 1 ? 's' : ''}`
                : `+${toLeader.toFixed(1)}s`}
        </Stat>
        <Stat label={code === userSide ? 'Real finish' : 'To you'}>
          {code === userSide
            ? realPos
              ? `P${realPos}`
              : '-'
            : toYou === null
              ? '-'
              : `${toYou >= 0 ? '+' : '−'}${Math.abs(toYou).toFixed(1)}s`}
        </Stat>
        <Stat label="Tyres">
          {car.retired ? '-' : <TyreBadge compound={car.compound} age={car.tyreAge} />}
        </Stat>
        <Stat label="Last lap">{last ? lapClock(last) : '-'}</Stat>
        <Stat label="Stops">
          {stops.length
            ? stops.map((s) => `L${s.lap - 1} ${s.compound[0]}`).join(', ')
            : 'None yet'}
        </Stat>
        {code === userSide && (
          <>
            <Stat label="Pace">{car.modes.pace}</Stat>
            <Stat label="Battle">{car.modes.battle}</Stat>
          </>
        )}
        {code !== userSide && realPos > 0 && <Stat label="Real finish">P{realPos}</Stat>}
      </dl>
    </section>
  );
}
