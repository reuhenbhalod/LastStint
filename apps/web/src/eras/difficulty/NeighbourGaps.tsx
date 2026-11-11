// Minimal information (eras spec §7): the only gaps shown are to the cars directly ahead and
// behind, from the last completed lap (they change once per lap), rounded as the level says.

import type { RaceState } from '@laststint/sim';
import { surname } from '../../data/names.js';
import { type InformationView, gapText, neighbours } from './information.js';

export function NeighbourGaps({
  race,
  userSide,
  info,
}: {
  race: RaceState;
  userSide: string;
  info: InformationView;
}) {
  const me = race.cars[userSide];
  const { ahead, behind } = neighbours(race.order, userSide);
  const row = (label: string, code: string | null) => {
    const car = code ? race.cars[code] : undefined;
    const gap = me && car && !me.retired && !car.retired ? car.totalTime - me.totalTime : null;
    return (
      <div key={label} className="flex items-baseline justify-between gap-2 text-[12px]">
        <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8D9692]">
          {label}
          {code ? ` · ${surname(code)}` : ''}
        </dt>
        <dd className="mono m-0 font-semibold text-[#D5DAD7]">{code ? gapText(info, gap) : '-'}</dd>
      </div>
    );
  };
  return (
    <dl className="m-0 flex flex-col gap-1">
      {row('Ahead', ahead)}
      {row('Behind', behind)}
      <p className="m-0 text-[11px] text-[#8D9692]">
        Only the cars either side of you are timed, once a lap.
      </p>
    </dl>
  );
}
