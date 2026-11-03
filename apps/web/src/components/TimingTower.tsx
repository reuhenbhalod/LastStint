// Standings: race order with each car's gap to the leader (or laps down), tyre and age. The
// user's car and the rival are tinted; tapping a driver calls them out on the track map.

import type { RaceModel, RaceState } from '@boxthislap/sim';
import { lapTime } from '../track/geometry.js';
import { TyreBadge } from './TyreBadge.js';

export function TimingTower({
  race,
  model,
  userSide,
  rival,
  onPick,
}: {
  race: RaceState;
  model: RaceModel;
  userSide: string;
  rival: string;
  onPick?: (code: string) => void;
}) {
  const leader = race.cars[race.order.find((c) => !race.cars[c]?.retired) ?? ''];
  const lap = lapTime(model, race.flag);
  return (
    <ol className="m-0 flex flex-1 list-none flex-col justify-around p-1">
      {race.order.map((code, i) => {
        const car = race.cars[code];
        if (!car) return null;
        const gap = leader ? car.totalTime - leader.totalTime : 0;
        const down = Math.floor(gap / lap);
        const text = car.retired
          ? 'OUT'
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
                'grid w-full grid-cols-[22px_4px_44px_1fr_auto] items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[var(--card-2)] focus-visible:bg-[var(--card-2)] focus-visible:outline-none',
                you ? 'bg-[color-mix(in_srgb,var(--you)_16%,transparent)]' : '',
                isRival ? 'bg-[color-mix(in_srgb,var(--rival)_16%,transparent)]' : '',
                car.retired || down >= 1 ? 'opacity-55' : '',
              ].join(' ')}
            >
              <span className="mono text-right text-[12px] text-[var(--muted)]">{i + 1}</span>
              <span
                className="h-[18px] w-1 rounded-sm"
                style={{
                  background: you ? 'var(--you)' : isRival ? 'var(--rival)' : 'var(--rule)',
                }}
              />
              <span className="disp text-[14px] leading-none">{code}</span>
              <span>{!car.retired && <TyreBadge compound={car.compound} age={car.tyreAge} />}</span>
              <span className="mono text-right text-[12px] text-[var(--muted)]">{text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
