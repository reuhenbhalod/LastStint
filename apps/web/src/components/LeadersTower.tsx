// The leaders as the TV shows them, over the map in focus view. The top
// ten, then your car and the rival below a line if they're further back. Team sliver, code,
// gap to the leader ("PIT" in the lane), live from the map's standings. In Eras (`info`, eras
// spec §7) the gaps follow the information level: rounded at Limited; at Minimal only your
// interval to the car ahead and the car behind's to you. Without it, exactly as before.

import type { RaceModel, RaceState } from '@laststint/sim';
import {
  FULL_INFORMATION,
  type InformationView,
  intervalToYou,
  shownGap,
} from '../eras/difficulty/information.js';
import { TEAM_COLOR } from '../game/teamTheme.js';
import type { LiveStanding } from '../track/motion.js';
import { TimingMark } from './Marks.js';

const TOP = 10;

export function LeadersTower({
  race,
  model,
  userSide,
  rival,
  live,
  onPick,
  info = FULL_INFORMATION,
}: {
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  live: LiveStanding[] | null;
  onPick: (code: string) => void;
  /** What the Eras information level shows (everything, otherwise). */
  info?: InformationView;
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
  // Minimal: the one interval a row shows, if any (from the last lap's times).
  const order = rows.map((r) => r.code);
  const time = (code: string) => {
    const c = race.cars[code];
    return c && !c.retired ? c.totalTime : null;
  };
  const gapLabel = (r: (typeof rows)[number]) => {
    if (r.gap === null) return '';
    if (!info.adjacentGapsOnly) return `+${shownGap(info, r.gap).toFixed(1)}`;
    const interval = intervalToYou(order, userSide, r.code, time);
    return interval === null ? '' : `+${shownGap(info, interval).toFixed(1)}`;
  };
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
          className={`grid w-full grid-cols-[18px_4px_38px_1fr] items-center gap-2 rounded-md px-2 py-[5px] text-left ${
            mine
              ? 'bg-[color-mix(in_srgb,var(--you)_24%,transparent)]'
              : theirs
                ? 'bg-[color-mix(in_srgb,var(--rival)_18%,transparent)]'
                : 'hover:bg-white/5'
          }`}
        >
          <span className="mono text-[12px] text-[#9AA5A0]">{pos}</span>
          <span className="h-3.5 rounded-sm" style={{ background: team(r.code) }} />
          <span className="text-[13px] font-extrabold">{r.code}</span>
          <span className="mono text-right text-[12px] text-[#C9CFCC]">
            {r.out ? 'OUT' : r.pit ? 'PIT' : pos === 1 ? 'Leader' : gapLabel(r)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section aria-label="Leaders" className="glass w-[180px] overflow-hidden p-1.5 shadow-xl">
      <div className="flex items-baseline justify-between px-2 pb-1 pt-0.5">
        <span className="eyebrow flex items-center gap-1">
          <TimingMark size={11} className="text-[var(--you)]" />
          Lap {race.lap}
        </span>
        <span className="mono text-[11px] font-semibold text-[var(--muted)]">
          /{model.race.laps}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-px p-0">{top.map((r, i) => row(r, i + 1))}</ol>
      {extra.length > 0 && (
        <ol className="m-0 list-none border-t border-white/15 p-0">
          {extra.map((r) => row(r, r.pos))}
        </ol>
      )}
    </section>
  );
}
