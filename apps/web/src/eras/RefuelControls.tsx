// The refuelling controls (eras build plan 8.5): the fill choice on the pit stop and the gauge
// of fuel to the next stop. Shown only with a refuelling reading (refuel.ts), so only in a
// race that refuels, once the refuelling model is connected. The fill is required (owner
// decision, Nov 7 2026): nothing is chosen until the player picks, and no box call goes
// without one.

import { FUEL_FILLS, type FuelFill, type RefuelReading } from './refuel.js';

const FILL_NAME: Record<FuelFill, string> = { short: 'Short', standard: 'Standard', long: 'Long' };

/** The fill a stop takes: each with the laps it lasts and the seconds it costs. `value`
 * null: none picked yet (the box call waits for one). */
export function FuelFillChoice({
  reading,
  value,
  disabled,
  onPick,
}: {
  reading: RefuelReading;
  value: FuelFill | null;
  disabled: boolean;
  onPick: (fill: FuelFill) => void;
}) {
  const fills = FUEL_FILLS.flatMap((f) => reading.fills.filter((o) => o.fill === f));
  if (!fills.length) return null;
  return (
    <fieldset
      aria-label="Fuel fill"
      className="m-0 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--rule)] p-0"
    >
      {fills.map((o) => (
        <button
          key={o.fill}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.fill}
          onClick={() => onPick(o.fill)}
          className={`flex flex-col items-center px-1 py-1 text-[12px] font-semibold disabled:opacity-40 ${
            value === o.fill
              ? 'bg-[var(--you)] text-[var(--you-ink)]'
              : 'bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--card-2)]'
          }`}
        >
          <span>{FILL_NAME[o.fill]}</span>
          <span className="mono text-[11px] font-normal">
            {o.laps} laps · {o.seconds.toFixed(1)}s
          </span>
        </button>
      ))}
    </fieldset>
  );
}

/** Fuel on board, to the next stop (or the flag). */
export function FuelGauge({ reading }: { reading: RefuelReading }) {
  const pct = Math.round(Math.max(0, Math.min(1, reading.level)) * 100);
  const to = reading.nextStopLap === null ? 'the flag' : `lap ${reading.nextStopLap}`;
  return (
    <div className="grid grid-cols-[58px_1fr_auto] items-center gap-2">
      <span className="eyebrow">Fuel</span>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--card-2)]"
        role="meter"
        aria-label={`Fuel to ${to}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: reading.lapsOfFuel <= 2 ? 'var(--box)' : 'var(--good)',
          }}
        />
      </div>
      <span className="mono text-right text-[12px]">
        {Math.floor(reading.lapsOfFuel)} laps · to {to}
      </span>
    </div>
  );
}
