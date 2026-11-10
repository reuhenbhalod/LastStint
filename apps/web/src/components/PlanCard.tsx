// The race plan at takeover (strategy planner spec D1-D4): the engineer brings up to three
// plans, each with its chance of beating the rival (blind playouts, no hindsight), and marks
// the best. Pick one, or build your own from any of them. The pick is graded like a call.

import type { PlanId, RaceModel, RacePlan } from '@boxthislap/sim';
import { useEffect, useRef, useState } from 'react';
import { surname } from '../data/names.js';
import { chanceOf, paceLine, samePlan, stopsLine, stopsWord, tyres } from '../game/plans.js';
import type { GameState } from '../state/machine.js';
import { HeadsetIcon } from './Icons.js';
import { PlanEditor, twoCompounds } from './PlanEditor.js';
import { PlanStrip } from './PlanStrip.js';

export function PlanCard({
  state,
  model,
  onBuild,
  onPick,
}: {
  state: GameState;
  model: RaceModel;
  /** Grade the player's own plan; false if it isn't a valid plan. */
  onBuild: (plan: RacePlan) => boolean;
  onPick: (id: PlanId) => void;
}) {
  const { plan } = state;
  const { userSide, rival, takeoverLap, totalLaps } = state.meta;
  const me = state.race.cars[userSide];
  const them = state.race.cars[rival];
  const [picked, setPicked] = useState<PlanId | null>(null);
  const [draft, setDraft] = useState<RacePlan | null>(null);

  // The engineer's pick: the best chance, once every plan has one.
  const chances = plan.offered.map((p) => chanceOf(plan, p.id));
  const graded = chances.every((c) => c !== null);
  const best = graded
    ? (plan.offered[chances.indexOf(Math.max(...(chances as number[])))]?.id ?? null)
    : null;
  // In the editor, the plan is your own.
  const selected: PlanId | null = draft ? 'own' : (picked ?? best ?? plan.offered[0]?.id ?? null);

  // The draft is graded a moment after the last change (once, and only if it's legal).
  const car = me ?? { compound: 'HARD', compoundsUsed: [] as string[] };
  const build = useRef(onBuild);
  build.current = onBuild;
  const own = plan.own;
  const legal = !!draft && twoCompounds(car, draft);
  useEffect(() => {
    if (!draft || !legal || (own && samePlan(own, draft))) return;
    const id = setTimeout(() => build.current(draft), 350);
    return () => clearTimeout(id);
  }, [draft, legal, own]);

  const ownChance = draft && plan.own && samePlan(plan.own, draft) ? chanceOf(plan, 'own') : null;
  const gap = me && them && !me.retired && !them.retired ? them.totalTime - me.totalTime : null;
  const lead =
    gap === null
      ? ''
      : gap >= 0
        ? ` · +${gap.toFixed(1)}s on ${surname(rival)}`
        : ` · ${surname(rival)} +${(-gap).toFixed(1)}s`;
  const headline = `${totalLaps - takeoverLap} laps to go${lead}${me ? ` · ${me.tyreAge}-lap-old ${tyres(me.compound)}` : ''}`;

  const pickable = draft ? legal && ownChance !== null : selected !== null;
  const goLabel =
    selected === 'own' ? 'Go with your plan' : `Go with plan ${selected?.toUpperCase() ?? ''}`;

  return (
    <section aria-label="Race plan" className="call-plate !gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="call-tag">
          <HeadsetIcon size={14} /> Race plan · lap {takeoverLap + 1} of {totalLaps}
        </span>
        <span className="text-[12px] text-[var(--muted)]">{headline}</span>
      </div>

      {draft ? (
        <PlanEditor
          model={model}
          from={takeoverLap}
          car={car}
          value={draft}
          onChange={setDraft}
          chance={ownChance}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {plan.offered.map((p, i) => {
            const c = chances[i] ?? null;
            const on = selected === p.id;
            const pace = paceLine(p);
            const line = `${stopsLine(p)}${pace ? ` · ${pace}` : ''}`;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(p.id)}
                className={`flex min-w-0 flex-col items-stretch gap-1.5 rounded-md border px-2.5 py-2 text-left transition-colors ${on ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_14%,#192024)]' : 'border-[#2E373B] bg-[#192024] hover:border-[#6E7A75]'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="disp shrink-0 text-[14px] leading-none">
                      {p.id.toUpperCase()} · {stopsWord(p)}
                    </span>
                    {best === p.id && (
                      <span className="truncate rounded-full bg-[var(--you)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--you-ink)]">
                        Engineer’s pick
                      </span>
                    )}
                  </span>
                  <span className="mono shrink-0 text-[16px] font-bold leading-none">
                    {c === null ? '…' : `${Math.round(c * 100)}%`}
                  </span>
                </span>
                <span className="truncate text-[12px] text-[var(--muted)]" title={line}>
                  {line}
                </span>
                <span className="hidden sm:block">
                  <PlanStrip plan={p} from={takeoverLap} laps={totalLaps} compound={car.compound} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (draft) {
                setDraft(null);
                setPicked(null);
                return;
              }
              const base = plan.offered.find((p) => p.id === selected) ?? plan.offered[0];
              if (base) setDraft({ ...base, id: 'own' });
            }}
            className="rounded-lg border border-[var(--rule)] px-3 py-2 text-[13px] font-semibold hover:bg-[var(--card-2)]"
          >
            {draft ? 'The engineer’s plans' : 'Build your own'}
          </button>
          <span className="hidden text-[12px] text-[var(--muted)] md:inline">
            % = chance to beat {rival} · change it any time
          </span>
        </span>
        <button
          type="button"
          disabled={!pickable}
          onClick={() => selected && onPick(selected)}
          className="rounded-lg bg-[var(--you)] px-5 py-2 text-[14px] font-bold text-[var(--you-ink)] hover:brightness-110 disabled:opacity-50"
        >
          {goLabel}
        </button>
      </div>
    </section>
  );
}
