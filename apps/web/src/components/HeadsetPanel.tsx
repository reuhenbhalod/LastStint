// Standing headset modes, always live: pace, battle, ERS (the hybrid battery, with its charge)
// and fuel. Flipping one books a `mode` call for the next lap. The current setting is read
// from the user's car, so it shows what the sim is applying; a call booked for the coming lap
// shows at once, outlined, until the lap ticks over.

import type { Modes } from '@boxthislap/sim';

type ModeKey = keyof Modes;

const ROWS: { key: ModeKey; label: string; values: string[] }[] = [
  { key: 'pace', label: 'Pace', values: ['push', 'standard', 'manage'] },
  { key: 'battle', label: 'Battle', values: ['attack', 'hold', 'defend'] },
  { key: 'ers', label: 'ERS', values: ['harvest', 'balanced', 'deploy', 'overtake'] },
  { key: 'fuel', label: 'Fuel', values: ['normal', 'liftAndCoast'] },
];

const NAME: Record<string, string> = { liftAndCoast: 'Lift & coast' };

const COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

export function HeadsetPanel({
  modes,
  pending = {},
  battery,
  describe,
  disabled,
  onFlip,
}: {
  /** The hybrid battery's charge, 0-100, if the car has one. */
  battery?: number;
  /** What a mode does (tooltip). */
  describe?: (key: ModeKey, value: string) => string | null;
  modes: Modes;
  /** Mode calls booked for the coming lap. */
  pending?: Partial<Modes>;
  disabled: boolean;
  onFlip: (key: ModeKey, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((row) => (
        <div key={row.key} className="grid grid-cols-[58px_1fr] items-center gap-2">
          <span className="eyebrow">{row.label}</span>
          <fieldset
            className={`m-0 grid ${COLS[row.values.length] ?? 'grid-cols-3'} ${row.values.length === 2 ? 'w-1/2' : ''} overflow-hidden rounded-lg border border-[var(--rule)] p-0`}
            aria-label={row.label}
          >
            {row.values.map((v) => {
              const booked = pending[row.key];
              const active = (booked ?? modes[row.key]) === v;
              const soon = active && booked !== undefined && booked !== modes[row.key];
              return (
                <button
                  key={v}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  title={[soon ? 'Booked from next lap' : null, describe?.(row.key, v)]
                    .filter(Boolean)
                    .join(' · ')}
                  onClick={() => onFlip(row.key, v)}
                  className={`py-1.5 ${row.values.length > 3 ? 'text-[12px]' : 'text-[13px]'} font-semibold capitalize transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--you)] ${
                    soon
                      ? 'bg-[color-mix(in_srgb,var(--you)_22%,transparent)] text-[var(--you)] shadow-[inset_0_0_0_2px_var(--you)]'
                      : active
                        ? 'bg-[var(--you)] text-[#08231f]'
                        : 'bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  {NAME[v] ?? v}
                </button>
              );
            })}
          </fieldset>
        </div>
      ))}
      {battery !== undefined && (
        <div className="grid grid-cols-[58px_1fr_auto] items-center gap-2">
          <span className="eyebrow">Battery</span>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--card-2)]"
            role="meter"
            aria-label="Battery"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(battery)}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.round(battery)}%`,
                background: battery <= 15 ? 'var(--box)' : 'var(--you)',
              }}
            />
          </div>
          <span className="mono w-10 text-right text-[12px]">{Math.round(battery)}%</span>
        </div>
      )}
    </div>
  );
}
