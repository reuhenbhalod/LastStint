// Standings: race order with each car's gap to the leader (or laps down), tyre and age. The
// user's car and the rival are tinted; tapping a driver calls them out on the track map.
// While the lap runs, the order and gaps are the map's (`live`): an overtake or a stop shows
// as it happens on track, not only when the lap is done.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { TEAM_COLOR } from '../game/teamTheme.js';
import { lapTime } from '../track/geometry.js';
import type { LiveStanding } from '../track/motion.js';
import { TyreBadge } from './TyreBadge.js';

export function TimingTower({
  race,
  model,
  userSide,
  rival,
  onPick,
  live = null,
}: {
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  onPick?: (code: string) => void;
  /** The map's standings while the lap runs (null: the last lap's). */
  live?: LiveStanding[] | null;
}) {
  const leader = race.cars[race.order.find((c) => !race.cars[c]?.retired) ?? ''];
  const lap = lapTime(model, race.flag);
  const now = live?.length ? new Map(live.map((s) => [s.code, s])) : null;
  // The map's order first, then the cars it doesn't show running (stopped, retired).
  const order = now
    ? [...(live ?? []).map((s) => s.code), ...race.order.filter((c) => !now.has(c))]
    : race.order;
  return (
    <ol className="m-0 flex min-h-full list-none flex-col justify-around p-1">
      {order.map((code, i) => {
        const car = race.cars[code];
        if (!car) return null;
        const shown = now?.get(code);
        const out = car.retired || (now !== null && !shown);
        const gap = shown ? shown.gap : leader ? car.totalTime - leader.totalTime : 0;
        const down = Math.floor(gap / lap);
        const text = out
          ? 'OUT'
          : shown?.pit
            ? 'PIT'
            : i === 0
              ? 'LEADER'
              : down >= 1
                ? `+${down} LAP${down > 1 ? 'S' : ''}`
                : `+${gap.toFixed(1)}`;
        const you = code === userSide;
        const isRival = code === rival;
        return (
          <li key={code}>
            <button
              type="button"
              onClick={() => onPick?.(code)}
              className={[
                'grid w-full grid-cols-[22px_4px_44px_1fr_auto] items-center gap-2 px-2 py-1 text-left hover:bg-[var(--card-2)] focus-visible:bg-[var(--card-2)] focus-visible:outline-none',
                you ? 'bg-[color-mix(in_srgb,var(--you)_30%,#12171A)]' : '',
                isRival ? 'bg-[color-mix(in_srgb,var(--rival)_18%,#12171A)]' : '',
                out || down >= 1 ? 'opacity-55' : '',
              ].join(' ')}
            >
              <span className="mono text-right text-[12px] text-[var(--muted)]">{i + 1}</span>
              <span
                className="h-[16px] w-1 -skew-x-12"
                style={{
                  background:
                    TEAM_COLOR[model.drivers.find((d) => d.code === code)?.team ?? ''] ??
                    'var(--rule)',
                }}
              />
              <span className="disp text-[14px] leading-none">{code}</span>
              <span>{!out && <TyreBadge compound={car.compound} age={car.tyreAge} />}</span>
              <span className="mono text-right text-[12px] text-[var(--muted)]">{text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
