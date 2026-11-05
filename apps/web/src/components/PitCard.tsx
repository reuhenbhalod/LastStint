// A stop, called out on the map while the car drives the pit lane: who, onto what, what it
// cost, places lost, and how the tyres now stack up against the other car in the fight.

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
      className="pit-card flex flex-col gap-1 rounded-lg border-l-4 bg-black/75 px-3 py-2 text-white shadow-xl"
      style={{ borderColor: you ? 'var(--you)' : 'var(--rival)' }}
    >
      <p className="m-0 disp text-[13px] leading-none">
        {surname(stop.code)} boxes · {tyreName(stop.compound)}
      </p>
      <p className="m-0 mono text-[12px] text-[#cfd6d3]">
        {stop.cost !== null ? `Stop ${stop.cost.toFixed(1)}s · ` : ''}P{stop.from} → P{stop.to}
        {lost > 0 ? ` (−${lost})` : ' (no places lost)'}
      </p>
      {other && !other.retired && (
        <p className="m-0 flex items-center gap-1.5 text-[12px] text-[#cfd6d3]">
          {otherCode} on <TyreBadge compound={other.compound} age={other.tyreAge} />
        </p>
      )}
    </output>
  );
}
