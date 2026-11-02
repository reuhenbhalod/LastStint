// Standing headset modes, always live. Flipping one books a `mode` call for the next lap. The
// current setting is read from the user's car, so it shows what the sim is applying; a call
// booked for the coming lap shows at once, outlined, until the lap ticks over.

import type { Modes } from '@boxthislap/sim';

type ModeKey = keyof Modes;

const ROWS: { key: ModeKey; label: string; values: string[] }[] = [
  { key: 'pace', label: 'Pace', values: ['push', 'standard', 'manage'] },
  { key: 'battle', label: 'Battle', values: ['attack', 'hold', 'defend'] },
];

export function HeadsetPanel({
  modes,
  pending = {},
  disabled,
  onFlip,
}: {
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
            className="m-0 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--rule)] p-0"
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
                  title={soon ? 'Booked from next lap' : undefined}
                  onClick={() => onFlip(row.key, v)}
                  className={`py-1.5 text-[13px] font-semibold capitalize transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--you)] ${
                    soon
                      ? 'bg-[color-mix(in_srgb,var(--you)_22%,transparent)] text-[var(--you)] shadow-[inset_0_0_0_2px_var(--you)]'
                      : active
                        ? 'bg-[var(--you)] text-[#08231f]'
                        : 'bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </fieldset>
        </div>
      ))}
    </div>
  );
}
