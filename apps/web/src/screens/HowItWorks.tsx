// Rules, grading, data sources and the disclaimer (product doc "How it works"; plan 6.5).

export function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-6 text-neutral-300">
      <header className="flex items-center justify-between">
        <h1 className="disp text-[24px] leading-none text-[var(--ink)]">How it works</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--rule)] px-3 py-1 text-sm"
          aria-label="Close How it works"
        >
          Back
        </button>
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-100">The race</h2>
        <p>
          Every day everyone gets the same real race: the real running order, gaps and tyres, and
          the safety cars and retirements when they really happened. You run one team’s pit wall for
          the deciding laps.
        </p>
        <p>
          Laps tick by on their own. BOX and the headset (pace, battle stance) are always live. The
          race pauses for the big calls; pick one and it carries on.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-100">Grading</h2>
        <p>
          At each call, a race simulator plays every option a few hundred times and measures its
          chance of beating your rival. Your call is graded against the best option, not on how the
          race turned out: a good call that didn’t pay off is still a good call.
        </p>
        <ul className="flex flex-col gap-1 font-mono text-sm">
          <li>🟩 Best call, or within half a point of it</li>
          <li>🟨 Close (within 5 points)</li>
          <li>🟧 Costly (within 15 points)</li>
          <li>🟥 A big miss</li>
        </ul>
        <p>
          You also see what the real team did and how that call grades. One run per day; the server
          replays every run to check it.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-100">Data</h2>
        <p>
          Race models are fitted from public timing data via FastF1 (and Jolpica-F1). The simulator
          is our own; it’s an estimate, not a replay.
        </p>
      </section>
      <p className="text-xs text-neutral-500">
        Not affiliated with Formula 1, the FIA or any team. No team names, logos or liveries are
        used as trademarks.
      </p>
    </main>
  );
}
