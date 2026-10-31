// Decision moment overlay: the radio line and live facts (brief.ts), then the moment's options.
// Grading runs in a worker while the player reads; the grades appear on the results screen.

import type { DecisionMoment, RaceModel, RaceState } from '@boxthislap/sim';
import { useEffect, useRef } from 'react';
import { briefFor } from '../game/brief.js';

export function DecisionModal({
  moment,
  race,
  model,
  onChoose,
}: {
  moment: DecisionMoment;
  race: RaceState;
  model: RaceModel;
  onChoose: (optionId: string) => void;
}) {
  const brief = briefFor(moment, race, model);
  const first = useRef<HTMLButtonElement>(null);
  // Focus the first option when the modal opens (RaceScreen keys it by moment, so each moment
  // mounts a fresh one).
  useEffect(() => first.current?.focus(), []);

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="decision-headline"
      className="fixed inset-0 z-10 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center bg-black/70 p-4 text-neutral-100 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-orange-400">
          📻 Lap {moment.lap} · your call
        </p>
        <p id="decision-headline" className="mb-3 text-lg font-semibold leading-snug">
          {brief.headline}
        </p>
        <ul className="mb-4 flex flex-col gap-0.5 font-mono text-xs text-neutral-400">
          {brief.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {moment.options.map((o, i) => (
            <button
              key={o.id}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onChoose(o.id)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-left font-medium hover:border-sky-400 hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
