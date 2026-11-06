// The leaders as the TV shows them, over the map in focus view. The top
// ten, then your car and the rival below a line if they're further back. Team sliver, code,
// gap to the leader ("PIT" in the lane), live from the map's standings.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { TEAM_COLOR } from '../game/teamTheme.js';
import type { LiveStanding } from '../track/motion.js';

const TOP = 10;

export function LeadersTower({
  race,
  model,
  userSide,
  rival,
  live,
  onPick,
}: {
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  live: LiveStanding[] | null;
  onPick: (code: string) => void;
}) {
  const leader = race.cars[race.order[0] ?? ''];
  const rows: Array<{ code: string; gap: number | null; pit: boolean; out: boolean }> = live
    ? live.map((l) => ({ code: l.code, gap: l.gap, pit: l.pit, out: false }))
    : race.order.map((code) => {
        const c = race.cars[code];
        return {
          code,
          gap: c && leader && !c.retired ? c.totalTime - leader.totalTime : null,
          pit: false,
          out: !!c?.retired,
        };
      });
  const top = rows.slice(0, TOP);
  const extra = rows
    .map((r, i) => ({ ...r, pos: i + 1 }))
    .filter((r) => r.pos > TOP && (r.code === userSide || r.code === rival));
  const team = (code: string) =>
    TEAM_COLOR[model.drivers.find((d) => d.code === code)?.team ?? ''] ?? '#8A938F';

  const row = (r: (typeof rows)[number], pos: number) => {
    const mine = r.code === userSide;
    const theirs = r.code === rival;
    return (
      <li key={r.code}>
        <button
          type="button"
          onClick={() => onPick(r.code)}
          className={`grid w-full grid-cols-[18px_4px_38px_1fr] items-center gap-2 px-2.5 py-[5px] text-left ${
            mine
              ? 'bg-[color-mix(in_srgb,var(--you)_30%,#0B0E0D)]'
              : theirs
                ? 'bg-[color-mix(in_srgb,var(--rival)_18%,#0B0E0D)]'
                : 'hover:bg-white/5'
          }`}
        >
          <span className="mono text-[12px] text-[#9AA39F]">{pos}</span>
          <span className="h-3.5 -skew-x-12" style={{ background: team(r.code) }} />
          <span className="mono text-[13px] font-bold">{r.code}</span>
          <span className="mono text-right text-[12px] text-[#C9CFCC]">
            {r.out
              ? 'OUT'
              : r.pit
                ? 'PIT'
                : pos === 1
                  ? 'Leader'
                  : r.gap === null
                    ? ''
                    : `+${r.gap.toFixed(1)}`}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section
      aria-label="Leaders"
      className="w-[168px] overflow-hidden rounded bg-[#0B0E0D]/88 shadow-xl backdrop-blur-sm"
    >
      <div className="flex items-center justify-between bg-[#EEF1EF] px-2.5 py-1 text-[#0B0E0D]">
        <span className="disp text-[11px]">Lap {race.lap}</span>
        <span className="mono text-[10px] font-bold">/{model.race.laps}</span>
      </div>
      <ol className="m-0 list-none p-0">{top.map((r, i) => row(r, i + 1))}</ol>
      {extra.length > 0 && (
        <ol className="m-0 list-none border-t border-white/15 p-0">
          {extra.map((r) => row(r, r.pos))}
        </ol>
      )}
    </section>
  );
}
