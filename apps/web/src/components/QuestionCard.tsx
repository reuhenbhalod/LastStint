// The driver questions a live call ("Box now? Are you sure?"; game/refusal.ts). The wall
// confirms it, and it's done next lap, or drops it.

export function QuestionCard({
  from,
  text,
  onConfirm,
  onDrop,
}: {
  from: string;
  text: string;
  onConfirm: () => void;
  onDrop: () => void;
}) {
  return (
    <section
      aria-label={`${from} asks`}
      className="card radio-alert flex flex-col gap-3 border-2 border-[var(--flag)]"
    >
      <span className="eyebrow text-[var(--flag)]">{from} on the radio</span>
      <p className="m-0 text-center text-[17px] font-semibold leading-snug">“{text}”</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-[var(--ink)] py-2.5 font-bold text-[var(--paper)] hover:opacity-90"
        >
          Yes, do it
        </button>
        <button
          type="button"
          onClick={onDrop}
          className="rounded-lg border border-[var(--rule)] py-2.5 font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          No, forget it
        </button>
      </div>
    </section>
  );
}
