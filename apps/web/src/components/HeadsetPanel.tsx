// Standing headset modes — always live. Flipping one books a `mode` decision on the next lap.
// Reads the current setting from the user's car so it reflects what the sim is applying.

import type { Modes } from '@boxthislap/sim';

type ModeKey = keyof Modes;

const ROWS: { key: ModeKey; label: string; values: string[] }[] = [
  { key: 'pace', label: 'Pace', values: ['push', 'standard', 'manage'] },
  { key: 'battle', label: 'Battle', values: ['attack', 'hold', 'defend'] },
];

export function HeadsetPanel({
  modes,
  disabled,
  onFlip,
}: {
  modes: Modes;
  disabled: boolean;
  onFlip: (key: ModeKey, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="w-14 text-xs uppercase tracking-wide text-neutral-500">{row.label}</span>
          <div className="flex flex-1 overflow-hidden rounded-lg border border-neutral-700 text-xs">
            {row.values.map((v) => {
              const active = modes[row.key] === v;
              return (
                <button
                  key={v}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onFlip(row.key, v)}
                  className={`flex-1 py-1.5 capitalize disabled:opacity-40 ${
                    active ? 'bg-sky-500/30 font-semibold text-sky-200' : 'text-neutral-400'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
