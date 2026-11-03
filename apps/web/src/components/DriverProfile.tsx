// Your driver, on the left of the race screen: who they are, how they take the wall's calls
// (their attitude, data/drivers.ts), and where they stand: place, tyres, stops, headset modes.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { ATTITUDE_LABEL, attitudeOf, driverInfo } from '../data/drivers.js';
import type { LapEvents } from '../game/raceLog.js';
import { TyreBadge } from './TyreBadge.js';

const ATTITUDE_NOTE = {
  always: 'Does every call you make.',
  questions: 'Asks “are you sure?” on some calls. Confirm or drop them. Rarely says no.',
  sometimes: 'Refuses about one call in four.',
} as const;

export function DriverProfile({
  code,
  race,
  model,
  log,
}: {
  code: string;
  race: RaceState;
  model: RaceModel;
  log: LapEvents[];
}) {
  const car = race.cars[code];
  const info = driverInfo(code);
  const attitude = attitudeOf(code);
  const pos = race.order.indexOf(code) + 1;
  const stops = log.flatMap((l) => l.pits.filter((p) => p.code === code));
  const realPos = model.realResult.indexOf(code) + 1;
  return (
    <section aria-label="Your driver" className="card flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <span className="disp flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--you)] text-[26px] leading-none text-[#08231f]">
          {info?.number ?? code}
        </span>
        <span className="min-w-0">
          <span className="disp block truncate text-[24px] leading-none">{info?.name ?? code}</span>
          <span className="block truncate text-[13px] text-[var(--muted)]">
            {car?.team} · {code}
          </span>
        </span>
      </header>
      <div className="rounded-lg bg-[var(--card-2)] px-3 py-2">
        <span className="eyebrow">On the radio</span>
        <p className="m-0 text-[14px] font-semibold">{ATTITUDE_LABEL[attitude]}</p>
        <p className="m-0 text-[12px] leading-snug text-[var(--muted)]">
          {ATTITUDE_NOTE[attitude]}
        </p>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="eyebrow">Place</dt>
          <dd className="m-0 disp text-[22px] leading-none">{car?.retired ? 'OUT' : `P${pos}`}</dd>
        </div>
        <div>
          <dt className="eyebrow">Tyres</dt>
          <dd className="m-0 flex justify-center pt-0.5">
            {car && !car.retired ? <TyreBadge compound={car.compound} age={car.tyreAge} /> : '—'}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Stops</dt>
          <dd className="m-0 disp text-[22px] leading-none">{stops.length}</dd>
        </div>
        <div>
          <dt className="eyebrow">Pace</dt>
          <dd className="m-0 text-[13px] font-semibold capitalize">{car?.modes.pace ?? '—'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Battle</dt>
          <dd className="m-0 text-[13px] font-semibold capitalize">{car?.modes.battle ?? '—'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Real</dt>
          <dd className="m-0 text-[13px] font-semibold">{realPos ? `P${realPos}` : '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
