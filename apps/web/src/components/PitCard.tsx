// A stop, called out in the strip over the map while the car drives the pit lane, on one line:
// who, onto what, what it cost, places lost, and the other car in the fight's tyres.

import type { RaceState } from '@boxthislap/sim';
import { surname } from '../data/names.js';
import { tyreName } from '../game/choices.js';
import type { PitEvent } from '../game/raceLog.js';
import { TyreBadge } from './TyreBadge.js';

export function PitCard({
  stop,
  race,
  userSide,
  rival,
}: {
  stop: PitEvent;
  race: RaceState;
  userSide: string;
  rival: string;
}) {
  const you = stop.code === userSide;
  const other = race.cars[you ? rival : userSide];
  const otherCode = you ? rival : userSide;
  const lost = stop.to - stop.from;
  return (
    <output
      className="pit-card flex min-w-0 items-center gap-2 rounded-lg border border-[var(--glass-edge)] border-l-4 bg-[var(--glass-strong)] px-3 py-1.5 text-[12px] text-white backdrop-blur-[14px]"
      style={{ borderColor: you ? 'var(--you)' : 'var(--rival)' }}
    >
      <span className="disp shrink-0 text-[12px] leading-none">
        {surname(stop.code)} boxes · {tyreName(stop.compound)}
      </span>
      <span className="mono truncate text-[#CFD7D3]">
        {stop.cost !== null ? `${stop.cost.toFixed(1)}s · ` : ''}P{stop.from} → P{stop.to}
        {lost > 0 ? ` (−${lost})` : ''}
      </span>
      {other && !other.retired && (
        <span className="hidden shrink-0 items-center gap-1.5 text-[#CFD7D3] lg:flex">
          {otherCode} on <TyreBadge compound={other.compound} age={other.tyreAge} />
        </span>
      )}
    </output>
  );
}
