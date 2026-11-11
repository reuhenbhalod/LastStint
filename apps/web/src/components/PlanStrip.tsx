// A race plan drawn as its stints (strategy planner spec): a bar from the takeover to the flag,
// a segment per stint in its tyre's colour with the stint's pace, and the in-lap of each stop.
// During the race the laps already run are shaded and a marker shows where the race is.

import type { RacePlan } from '@boxthislap/sim';
import { stintStarts } from '@boxthislap/sim';

const LETTER: Record<string, string> = { push: 'Push', standard: '', manage: 'Manage' };
const TYRE_VAR: Record<string, string> = {
  SOFT: 'var(--soft)',
  MEDIUM: 'var(--medium)',
  HARD: 'var(--hard)',
};

export function PlanStrip({
  plan,
  from,
  laps,
  compound,
  now,
}: {
  plan: RacePlan;
  /** The last lap before the plan starts (the takeover lap). */
  from: number;
  laps: number;
  /** The tyres the car is on at `from`. */
  compound: string;
  /** The last lap run, in the race (shades what's done). */
  now?: number;
}) {
  const total = laps - from;
  const starts = stintStarts(plan, from);
  const stints = plan.pace.map((pace, i) => {
    const start = starts[i] as number;
    const end = i < plan.stops.length ? (plan.stops[i]?.lap as number) : laps;
    const tyre = i === 0 ? compound : (plan.stops[i - 1]?.compound as string);
    return { pace, start, end, tyre, laps: end - start + 1 };
  });
  const at = (lap: number) => (lap - from) / total;
  // The first and last laps are labelled unless a stop's label would sit on them.
  const clearStart = plan.stops.every((s) => at(s.lap) > 0.14);
  const clearEnd = plan.stops.every((s) => at(s.lap) < 0.86);
  const done = now === undefined ? 0 : Math.min(1, Math.max(0, (now - from) / total));
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="relative flex h-5 overflow-hidden rounded-md bg-[var(--card-2)]">
        {stints.map((s, i) => (
          <div
            key={`${s.start}-${s.tyre}`}
            className="flex items-center justify-center overflow-hidden text-[10px] font-bold uppercase tracking-wider text-[#151A1D]"
            style={{
              width: `${(s.laps / total) * 100}%`,
              background: TYRE_VAR[s.tyre] ?? 'var(--muted)',
              borderLeft: i > 0 ? '2px solid var(--card)' : undefined,
            }}
            title={`${s.tyre.toLowerCase()}, laps ${s.start}-${s.end}${s.pace === 'standard' ? '' : `, ${s.pace}`}`}
          >
            {s.laps / total > 0.18 ? LETTER[s.pace] : (LETTER[s.pace] ?? '').slice(0, 1)}
          </div>
        ))}
        {done > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--paper)_55%,transparent)]"
            style={{ width: `${done * 100}%` }}
          />
        )}
      </div>
      <div className="relative h-3.5 text-[10px] text-[var(--muted)]">
        {clearStart && <span className="mono absolute left-0">L{from + 1}</span>}
        {plan.stops.map((s) => (
          <span
            key={s.lap}
            className="mono absolute -translate-x-1/2 font-semibold text-[var(--ink)]"
            style={{ left: `${at(s.lap) * 100}%` }}
          >
            L{s.lap}
          </span>
        ))}
        {clearEnd && <span className="mono absolute right-0">L{laps}</span>}
      </div>
    </div>
  );
}
