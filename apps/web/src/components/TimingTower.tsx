// Live timing tower: race order with interval to the car ahead, tyre + age. The user's car
// and the direct rival are highlighted.

import type { RaceState } from '@boxthislap/sim';
import { TyreBadge } from './TyreBadge.js';

export function TimingTower({
  race,
  userSide,
  rival,
}: {
  race: RaceState;
  userSide: string;
  rival: string;
}) {
  let prevTime: number | null = null;
  return (
    <ol className="flex flex-col gap-0.5">
      {race.order.map((code, i) => {
        const car = race.cars[code];
        if (!car) return null;
        let gap: string;
        if (car.retired) {
          gap = 'OUT';
        } else if (prevTime === null) {
          gap = 'LEADER';
          prevTime = car.totalTime;
        } else {
          gap = `+${(car.totalTime - prevTime).toFixed(1)}`;
          prevTime = car.totalTime;
        }
        const you = code === userSide;
        const isRival = code === rival;
        return (
          <li
            key={code}
            className={[
              'flex items-center gap-2 rounded px-2 py-1 font-mono text-sm',
              you ? 'bg-sky-500/20 ring-1 ring-sky-400' : 'bg-neutral-900',
              isRival ? 'ring-1 ring-orange-400' : '',
              car.retired ? 'opacity-40' : '',
            ].join(' ')}
          >
            <span className="w-5 text-right text-neutral-500">{i + 1}</span>
            <span
              className={`w-10 font-bold ${you ? 'text-sky-300' : isRival ? 'text-orange-300' : ''}`}
            >
              {code}
            </span>
            <span className="flex-1">
              {!car.retired && <TyreBadge compound={car.compound} age={car.tyreAge} />}
            </span>
            <span
              className={`w-16 text-right ${car.retired ? 'text-neutral-600' : 'text-neutral-400'}`}
            >
              {gap}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
