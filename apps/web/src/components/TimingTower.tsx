// Standings: race order with each car's gap to the leader (or laps down), tyre and age. The
// user's car and the rival are tinted; tapping a driver calls them out on the track map.
// While the lap runs, the order and gaps are the map's (`live`): an overtake or a stop shows
// as it happens on track, not only when the lap is done.
// In Eras (`info`, eras spec §7) the gaps and the other cars' tyre ages follow the information
// level: gaps rounded at Limited; at Minimal only your interval to the car ahead and the car
// behind's to you, from the last lap (the race screen stops the live standings); tyre ages as
// ranges from Reduced down. Without it, exactly as before.

import type { RaceModel, RaceState } from '@laststint/sim';
import {
  FULL_INFORMATION,
  type InformationView,
  intervalToYou,
  shownGap,
  tyreAgeText,
} from '../eras/difficulty/information.js';
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
  info = FULL_INFORMATION,
}: {
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  onPick?: (code: string) => void;
  /** The map's standings while the lap runs (null: the last lap's). */
  live?: LiveStanding[] | null;
  /** What the Eras information level shows (everything, otherwise). */
  info?: InformationView;
}) {
  const leader = race.cars[race.order.find((c) => !race.cars[c]?.retired) ?? ''];
  const lap = lapTime(model, race.flag);
  const now = live?.length ? new Map(live.map((s) => [s.code, s])) : null;
  // The map's order first, then the cars it doesn't show running (stopped, retired).
  const order = now
    ? [...(live ?? []).map((s) => s.code), ...race.order.filter((c) => !now.has(c))]
    : race.order;
  // Minimal: the one interval a row shows, if any (from the last lap's times).
  const time = (c: string) => {
    const x = race.cars[c];
    return x && !x.retired ? x.totalTime : null;
  };
  const gapLabel = (code: string, gap: number) => {
    if (!info.adjacentGapsOnly) return `+${shownGap(info, gap).toFixed(1)}`;
    const interval = intervalToYou(order, userSide, code, time);
    return interval === null ? '' : `+${shownGap(info, interval).toFixed(1)}`;
  };
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
                : gapLabel(code, gap);
        const you = code === userSide;
        const isRival = code === rival;
        return (
          <li key={code}>
            <button
              type="button"
              onClick={() => onPick?.(code)}
              className={[
                'grid w-full grid-cols-[22px_4px_44px_1fr_auto] items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none',
                you ? 'bg-[color-mix(in_srgb,var(--you)_24%,transparent)]' : '',
                isRival ? 'bg-[color-mix(in_srgb,var(--rival)_18%,transparent)]' : '',
                out || down >= 1 ? 'opacity-55' : '',
              ].join(' ')}
            >
              <span className="mono text-right text-[12px] text-[var(--muted)]">{i + 1}</span>
              <span
                className="h-[14px] w-1 rounded-sm"
                style={{
                  background:
                    TEAM_COLOR[model.drivers.find((d) => d.code === code)?.team ?? ''] ??
                    'var(--rule)',
                }}
              />
              <span className="text-[14px] font-extrabold leading-none">{code}</span>
              <span>
                {!out && (
                  <TyreBadge
                    compound={car.compound}
                    age={car.tyreAge}
                    ageText={tyreAgeText(info, car.tyreAge, you)}
                  />
                )}
              </span>
              <span className="mono text-right text-[12px] text-[var(--muted)]">{text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
