// Decision moment overlay. The sim supplies the options (label + calls); the prompt is
// generated from the trigger for now (authored radio prose arrives in Phase 5). No grading
// here yet — that lands in 3.4.

import type { DecisionMoment } from '@boxthislap/sim';

function promptFor(moment: DecisionMoment, rival: string): string {
  switch (moment.trigger) {
    case 'SC':
      return 'Safety car is out. What’s the call?';
    case 'VSC':
      return 'Virtual safety car. What’s the call?';
    case 'rivalPit':
      return `${rival} has boxed. Do you cover?`;
    case 'undercut':
      return 'Undercut window — box now, or stay out?';
    case 'cliff':
      return 'Your tyres are going off. Manage them, or push on?';
    default:
      return 'Make the call.';
  }
}

export function DecisionModal({
  moment,
  rival,
  onChoose,
}: {
  moment: DecisionMoment;
  rival: string;
  onChoose: (optionId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-orange-400">
          Lap {moment.lap - 1} · decision
        </p>
        <p className="mb-4 text-lg font-semibold">{promptFor(moment, rival)}</p>
        <div className="flex flex-col gap-2">
          {moment.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChoose(o.id)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-left font-medium hover:border-sky-400 hover:bg-neutral-700"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
