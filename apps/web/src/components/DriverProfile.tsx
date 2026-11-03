// Your driver, in the stats column: who they are, how they take the wall's calls (attitude
// tier, how often they ignore a call and a real radio moment behind it, data/drivers.json),
// and where they stand: place, tyres, stops, headset modes.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { TIER_LABEL, driverInfo } from '../data/drivers.js';
import type { LapEvents } from '../game/raceLog.js';
import { TyreBadge } from './TyreBadge.js';

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
  const pos = race.order.indexOf(code) + 1;
  const stops = log.flatMap((l) => l.pits.filter((p) => p.code === code));
  const realPos = model.realResult.indexOf(code) + 1;
  return (
    <section aria-label="Your driver" className="card flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <span className="disp flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--you)] text-[19px] leading-none text-[#08231f]">
          {info?.number ?? code}
        </span>
        <span className="min-w-0">
          <span className="disp block truncate text-[18px] leading-none">{info?.name ?? code}</span>
          <span className="block truncate text-[13px] text-[var(--muted)]">
            {car?.team} · {code}
          </span>
        </span>
      </header>
      {info && (
        <div className="rounded-lg bg-[var(--card-2)] px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="eyebrow">On the radio</span>
            <span className="text-[13px] font-semibold">{TIER_LABEL[info.tier]}</span>
          </div>
          <p className="m-0 text-[13px] leading-snug">
            Ignores <span className="font-semibold">{info.ignores}%</span> of your live calls
          </p>
          {info.evidence[0] && (
            <p className="m-0 text-[12px] leading-snug text-[var(--muted)]">
              Real radio:{' '}
              <a
                href={info.evidence[0].source}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[var(--ink)]"
              >
                {info.evidence[0].note}
              </a>
            </p>
          )}
        </div>
      )}
      <dl className="m-0 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="eyebrow">Place</dt>
          <dd className="m-0 disp text-[16px] leading-none">{car?.retired ? 'OUT' : `P${pos}`}</dd>
        </div>
        <div>
          <dt className="eyebrow">Tyres</dt>
          <dd className="m-0 flex justify-center pt-0.5">
            {car && !car.retired ? <TyreBadge compound={car.compound} age={car.tyreAge} /> : '—'}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Stops</dt>
          <dd className="m-0 disp text-[16px] leading-none">{stops.length}</dd>
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
