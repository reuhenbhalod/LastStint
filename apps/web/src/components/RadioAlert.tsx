// The race has stopped for a call: a radio banner across the top of the map, so the moment
// can't be missed (feedback spec S2). The decision card itself sits in the call column (a
// bottom sheet on a phone). On a phone the banner is a compact strip, since the card below
// carries the same question.

import type { DecisionMoment, RaceModel, RaceState } from '@boxthislap/sim';
import { briefFor } from '../game/brief.js';

export function RadioAlert({
  moment,
  race,
  model,
}: {
  moment: DecisionMoment;
  race: RaceState;
  model: RaceModel;
}) {
  const b = briefFor(moment, race, model);
  return (
    <div
      role="alert"
      className="radio-alert pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 mx-auto flex max-w-[560px] items-center gap-3 rounded-xl border-2 border-[var(--flag)] bg-[#141716]/90 px-3 py-2 text-white shadow-2xl md:bottom-auto md:top-12 md:px-4 md:py-3"
    >
      <span className="radio-dot grid h-8 w-8 shrink-0 md:h-10 md:w-10 place-items-center rounded-full bg-[var(--flag)] text-[20px] text-[#141716]">
        📻
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--flag)]">
          Radio · Lap {moment.lap} · {b.kind} · Your call
        </span>
        <span className="hidden text-[17px] font-semibold leading-snug md:block">{b.headline}</span>
      </span>
    </div>
  );
}
