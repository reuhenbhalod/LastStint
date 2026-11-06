// Your calls, graded as you go: each big call you've answered, its band (best call, close,
// costly, big miss) and your chance against the best option's, from the grade the game works
// out while you read the call (engine/grading.ts). Calls still to come stay hidden; a call
// whose grade is still running says so. The running score is the same average the results
// screen shows.

import { BAND_POINTS, type Band } from '@boxthislap/sim';
import { autoStay } from '../game/autoStay.js';
import { planGrade, stopsWord } from '../game/plans.js';
import type { GameState } from '../state/machine.js';
import { Panel } from './Panel.js';

const BAND: Record<Band, { label: string; color: string }> = {
  green: { label: 'Best call', color: '#4ade80' },
  yellow: { label: 'Close', color: '#facc15' },
  orange: { label: 'Costly', color: '#fb923c' },
  red: { label: 'Big miss', color: '#f87171' },
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
        label: (m.options.find((o) => o.id === chosen)?.label ?? chosen ?? '').split(', ')[0],
        auto: !!chosen && autoStay(m, state.decisions) === chosen,
        mine,
        best,
      };
    });
  // The race plan picked at takeover is graded like a call (strategy planner spec D7).
  const picked = state.plan.picked;
  if (picked) {
    const grade = planGrade(state.plan, state.meta.takeoverLap);
    rows.unshift({
      id: 'plan',
      lap: state.meta.takeoverLap + 1,
      label: `Plan ${picked.id === 'own' ? '(yours)' : picked.id.toUpperCase()}: ${stopsWord(picked).toLowerCase()}`,
      auto: false,
      mine: grade?.options.find((o) => o.id === picked.id),
      best: grade?.options.find((o) => o.id === grade.best),
    });
  }
  const scored = rows.flatMap((r) => (r.mine ? [BAND_POINTS[r.mine.band]] : []));
  const score = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

  return (
    <Panel
      title="Your calls"
      right={
        <span className="mono text-[12px] font-bold text-[#B7BEBA]">
          {score === null
            ? `0 of ${state.moments.length + (state.plan.offered.length ? 1 : 0)}`
            : `Score ${Math.round(score)}`}
        </span>
      }
    >
      {rows.length === 0 ? (
        <p className="m-0 text-[12px] text-[#8D9692]">
          Each big call is graded here as you make it.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {[...rows].reverse().map((r) => {
            const band = r.mine ? BAND[r.mine.band] : null;
            return (
              <li
                key={r.id}
                className="grid grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-x-2.5 border-t border-[#1B201E] py-2 first:border-t-0 first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className="row-span-2 h-full min-h-[30px] -skew-x-12"
                  style={{ background: band?.color ?? '#333A37' }}
                />
                <span className="min-w-0 truncate text-[13px] font-semibold">
                  <span className="mono mr-1.5 text-[11px] font-normal text-[#8D9692]">
                    L{r.lap}
                  </span>
                  {r.label}
                  {r.auto && (
                    <span className="ml-1.5 text-[11px] font-normal text-[#8D9692]">Auto</span>
                  )}
                </span>
                <span
                  className="text-[11px] font-extrabold uppercase tracking-wider"
                  style={{ color: band?.color ?? '#8D9692' }}
                >
                  {band ? band.label : 'Grading…'}
                </span>
                <span className="col-span-2 text-[11.5px] text-[#8D9692]">
                  {r.mine && r.best
                    ? `${pct(r.mine.probability)} chance${r.mine.id === r.best.id ? ' · the best option' : ` · best ${pct(r.best.probability)}`}`
                    : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
