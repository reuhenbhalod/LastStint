import type { Speed } from '../state/machine.js';

export function SpeedControl({ speed, onChange }: { speed: Speed; onChange: (s: Speed) => void }) {
  return (
    <div className="flex overflow-hidden rounded-full border border-neutral-700 text-xs font-bold">
      {([1, 2] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={speed === s}
          onClick={() => onChange(s)}
          className={`px-3 py-1 ${speed === s ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400'}`}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}
