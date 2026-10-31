// Lap counter + current flag.

import type { FlagState } from '@boxthislap/sim';

const FLAG: Record<FlagState, { label: string; cls: string }> = {
  green: { label: 'GREEN', cls: 'text-green-400' },
  sc: { label: 'SAFETY CAR', cls: 'text-yellow-300 animate-pulse' },
  vsc: { label: 'VSC', cls: 'text-yellow-300 animate-pulse' },
  red: { label: 'RED FLAG', cls: 'text-red-400 animate-pulse' },
};

export function LapClock({ lap, total, flag }: { lap: number; total: number; flag: FlagState }) {
  const f = FLAG[flag];
  return (
    <div className="flex items-baseline justify-between">
      <div className="font-mono">
        <span className="text-2xl font-bold">{lap}</span>
        <span className="text-neutral-500"> / {total}</span>
        <span className="ml-1 text-xs uppercase tracking-widest text-neutral-500">laps</span>
      </div>
      <div className={`font-mono text-xs font-bold uppercase tracking-widest ${f.cls}`}>
        {f.label}
      </div>
    </div>
  );
}
