// Your calls, graded as you go: each big call you've answered, its band (best call, close,
// costly, big miss) and your chance against the best option's, from the grade the game works
// out while you read the call (engine/grading.ts). Calls still to come stay hidden; a call
// whose grade is still running says so. The running score is the same average the results
// screen shows.

import { BAND_POINTS, type Band } from '@boxthislap/sim';
import { autoStay } from '../game/autoStay.js';
import type { GameState } from '../state/machine.js';

const BAND: Record<Band, { label: string; cls: string }> = {
  green: { label: 'Best call', cls: 'bg-green-500/20 text-green-300' },
  yellow: { label: 'Close', cls: 'bg-yellow-500/20 text-yellow-200' },
  orange: { label: 'Costly', cls: 'bg-orange-500/20 text-orange-200' },
  red: { label: 'Big miss', cls: 'bg-red-500/20 text-red-300' },
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function LiveGrades({ state }: { state: GameState }) {
  const rows = state.moments
    .filter((m) => state.resolved.includes(m.id))
    .map((m) => {
      const answer = state.decisions.find((d) => d.kind === 'radio' && d.momentId === m.id);
      const chosen = answer?.kind === 'radio' ? answer.optionId : null;
      const graded = state.grades[m.id]?.grade;
      const mine = graded?.options.find((o) => o.id === chosen);
      const best = graded?.options.find((o) => o.id === graded.best);
      return {
        id: m.id,
        lap: m.lap,
        label: (m.options.find((o) => o.id === chosen)?.label ?? chosen ?? '').split(' — ')[0],
        auto: !!chosen && autoStay(m, state.decisions) === chosen,
        mine,
        best,
      };
    });
  const scored = rows.flatMap((r) => (r.mine ? [BAND_POINTS[r.mine.band]] : []));
  const score = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

  return (
    <section aria-label="Your calls" className="card flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Your calls</span>
        <span className="text-[12px] text-[var(--muted)]">
          {score === null ? `0 of ${state.moments.length}` : `Score ${Math.round(score)}`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-[var(--muted)]">
          Each big call is graded here as you make it.
        </p>
      ) : (
        <ul className="m-0 flex min-h-0 list-none flex-col gap-1.5 overflow-y-auto p-0">
          {[...rows].reverse().map((r) => (
            <li key={r.id} className="rounded-lg bg-[var(--card-2)] px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-semibold">
                  <span className="mono mr-1.5 text-[11px] font-normal text-[var(--muted)]">
                    L{r.lap}
                  </span>
                  {r.label}
                  {r.auto && (
                    <span className="ml-1.5 text-[11px] font-normal text-[var(--muted)]">Auto</span>
                  )}
                </span>
                {r.mine ? (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${BAND[r.mine.band].cls}`}
                  >
                    {BAND[r.mine.band].label}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] text-[var(--muted)]">Grading…</span>
                )}
              </div>
              {r.mine && r.best && (
                <p className="m-0 text-[12px] text-[var(--muted)]">
                  {pct(r.mine.probability)} to beat the rival
                  {r.mine.id === r.best.id
                    ? ' · the best option'
                    : ` · best ${pct(r.best.probability)}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
