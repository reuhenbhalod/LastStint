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
        ? ` We lead ${surname(rival)} by ${gap.toFixed(1)} s.`
        : ` ${surname(rival)} leads us by ${(-gap).toFixed(1)} s.`;
  const headline = `You have the pit wall, ${totalLaps - takeoverLap} laps to go.${lead}${me ? ` We're on ${me.tyreAge}-lap-old ${tyres(me.compound)}.` : ''}`;

  const pickable = draft ? legal && ownChance !== null : selected !== null;
  const goLabel =
    selected === 'own' ? 'Go with your plan' : `Go with plan ${selected?.toUpperCase() ?? ''}`;

  return (
    <section
      aria-label="Race plan"
      className="card flex flex-col gap-4"
      style={{ borderColor: 'var(--you)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow flex items-center gap-1.5 !text-[var(--you)]">
          <HeadsetIcon size={14} /> Race plan
        </span>
        <span className="eyebrow">
          Lap {takeoverLap + 1} of {totalLaps}
        </span>
      </div>
      <p className="m-0 text-[15px] font-semibold leading-snug">
        {headline} Pick the plan; I’ll call it lap by lap. You can change it any time.
      </p>

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
        <div className="flex flex-col gap-2">
          {plan.offered.map((p, i) => {
            const c = chances[i] ?? null;
            const on = selected === p.id;
            const pace = paceLine(p);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(p.id)}
                className={`flex flex-col items-stretch gap-2 rounded-xl border-2 p-3 text-left transition-colors ${on ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_8%,transparent)]' : 'border-[var(--rule)] hover:border-[var(--muted)]'}`}
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="disp text-[16px] leading-none">
                        {p.id.toUpperCase()} · {stopsWord(p)}
                      </span>
                      {best === p.id && (
                        <span className="rounded-full bg-[var(--you)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--you-ink)]">
                          Engineer’s pick
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] text-[var(--muted)]">
                      {stopsLine(p)}
                      {pace ? ` · ${pace}` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="mono text-[20px] font-bold leading-none">
                      {c === null ? '…' : `${Math.round(c * 100)}%`}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">vs {rival}</span>
                  </span>
                </span>
                <PlanStrip plan={p} from={takeoverLap} laps={totalLaps} compound={car.compound} />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
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
          {draft ? '← The engineer’s plans' : 'Build your own'}
        </button>
        <button
          type="button"
          disabled={!pickable}
          onClick={() => selected && onPick(selected)}
          className="rounded-xl bg-[var(--you)] px-6 py-3 text-[15px] font-bold text-[var(--you-ink)] hover:brightness-110 disabled:opacity-50"
        >
          {goLabel} →
        </button>
      </div>
    </section>
  );
}
