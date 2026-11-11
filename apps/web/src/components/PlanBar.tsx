// The race plan during the race (strategy planner spec): the bar under the map (the plan, the
// next stop, its chance now), the heads-up the lap before a planned stop (D6), and the
// engineer's offer when another plan has pulled clear (D5).

import type { RaceModel, RacePlan } from '@laststint/sim';
import { useEffect, useState } from 'react';
import { surname } from '../data/names.js';
import { chanceOf, fillsMissing, paceLine, remainder, stopsWord, tyres } from '../game/plans.js';
import type { GameState } from '../state/machine.js';
import { HeadsetIcon } from './Icons.js';
import { PlanEditor, twoCompounds } from './PlanEditor.js';
import { PlanStrip } from './PlanStrip.js';

/** The planned stop on the coming lap's next one (the heads-up's lap), if any. */
export function headsUpStop(state: GameState) {
  const active = state.plan.active;
  return active?.stops.find((s) => s.lap === state.race.lap + 2) ?? null;
}

/** The engineer's better plan, if it beats yours by 8 points or more now. */
export function betterPlan(
  state: GameState,
): { plan: RacePlan; chance: number; mine: number } | null {
  const live = state.plan.live;
  if (!live?.best || live.lap !== state.race.lap) return null;
  return live.best.chance - live.mine >= 0.08 ? { ...live.best, mine: live.mine } : null;
}

export function PlanBar({
  state,
  model,
  onChange,
  editing,
  setEditing,
}: {
  state: GameState;
  model: RaceModel;
  /** Run to a new plan from here; false if it isn't a valid plan. */
  onChange: (plan: RacePlan) => boolean;
  /** The editor is open (the heads-up's "Change plan" opens it too). */
  editing: boolean;
  setEditing: (on: boolean) => void;
}) {
  const { active, live, picked } = state.plan;
  const { userSide, totalLaps, rival } = state.meta;
  const me = state.race.cars[userSide];
  const [draft, setDraft] = useState<RacePlan | null>(null);
  const lap = state.race.lap;
  // Opening the editor starts from the plan's rest (after the coming lap, whose calls are made).
  // biome-ignore lint/correctness/useExhaustiveDependencies: seeded once per opening.
  useEffect(() => {
    setDraft(editing && active ? { ...remainder(active, lap + 1), id: 'own' } : null);
  }, [editing]);
  if (!active || !me) return null;
  const rest = remainder(active, lap);
  const next = rest.stops[0];
  // The latest re-rank (none runs while a stop is booked: the last one stands).
  // Before the first re-rank, the plan's chance at takeover.
  const chance = live
    ? live.mine
    : picked && active === picked
      ? chanceOf(state.plan, picked.id)
      : null;
  // The tyres the next stint starts on: a stop booked or under way has them.
  const booked = state.decisions.find((d) => d.kind === 'pit' && d.lap > lap);
  const onNow =
    booked?.kind === 'pit'
      ? booked.compound
      : (me.strategy.find((s) => s.lap > lap)?.to ?? me.compound);
  const pace = paceLine(rest);
  // Editing from the lap after the coming one (its calls are made).
  const editFrom = lap + 1;
  // A refuelling race: every stop's fuel fill picked too (the sim refuses a plan without).
  const legal = draft ? twoCompounds(me, draft, model.rules) && !fillsMissing(model, draft) : false;
  return (
    <section aria-label="Race plan" className="card flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="eyebrow">
            Plan{picked?.id !== 'own' && picked === active ? ` ${picked.id.toUpperCase()}` : ''}
          </span>
          <span className="text-[14px] font-semibold">
            {next
              ? `Box lap ${next.lap} for ${tyres(next.compound)}${next.lap - lap - 1 > 0 ? ` (in ${next.lap - lap - 1})` : ' (this lap)'}`
              : `${stopsWord(rest) === 'No stop' ? 'No more stops' : stopsWord(rest)}: to the flag`}
          </span>
          {pace && <span className="text-[13px] text-[var(--muted)]">· {pace}</span>}
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--muted)]">
            vs {surname(rival)}{' '}
            <strong className="mono text-[var(--ink)]">
              {chance === null ? '…' : `${Math.round(chance * 100)}%`}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="rounded-lg border border-[var(--rule)] px-2.5 py-1 text-[12px] font-semibold hover:bg-[var(--card-2)]"
          >
            {editing ? 'Cancel' : 'Change'}
          </button>
        </span>
      </div>
      {draft ? (
        <>
          <PlanEditor model={model} from={editFrom} car={me} value={draft} onChange={setDraft} />
          <button
            type="button"
            disabled={!legal}
            onClick={() => {
              if (onChange(draft)) setEditing(false);
            }}
            className="self-end rounded-xl bg-[var(--you)] px-5 py-2.5 text-[14px] font-bold text-[var(--you-ink)] hover:brightness-110 disabled:opacity-50"
          >
            Run this plan
          </button>
        </>
      ) : (
        <PlanStrip plan={rest} from={lap} laps={totalLaps} compound={onNow} />
      )}
    </section>
  );
}

/** The lap before a planned stop: box as planned (the default), one more lap, or change it. */
export function PlanHeadsUp({
  stop,
  onBox,
  onLater,
  canLater,
  onChange,
}: {
  stop: { lap: number; compound: string };
  onBox: () => void;
  onLater: () => void;
  canLater: boolean;
  onChange: () => void;
}) {
  return (
    <section aria-label="Planned stop" className="quick-call call-plate">
      <span className="call-tag">
        <HeadsetIcon size={14} /> Engineer · the plan
      </span>
      <p className="m-0 text-[16px] font-bold leading-snug text-white md:text-[18px]">
        Box next lap for {tyres(stop.compound)}, as planned. Still good?
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Choice onClick={onBox} primary>
          Box as planned
        </Choice>
        <Choice onClick={onLater} disabled={!canLater}>
          One more lap
        </Choice>
        <Choice onClick={onChange}>Change plan</Choice>
      </div>
    </section>
  );
}

/** The engineer's better plan (spec D5): switch to it, or keep ours. */
export function ReplanOffer({
  offer,
  onSwitch,
  onKeep,
}: {
  offer: { plan: RacePlan; chance: number; mine: number };
  onSwitch: () => void;
  onKeep: () => void;
}) {
  const pace = paceLine(offer.plan);
  return (
    <section aria-label="New plan" className="quick-call call-plate">
      <span className="call-tag">
        <HeadsetIcon size={14} /> Engineer · new plan
      </span>
      <p className="m-0 text-[16px] font-bold leading-snug text-white md:text-[18px]">
        The race has moved. {stopsWord(offer.plan)}
        {offer.plan.stops.length
          ? `, ${offer.plan.stops.map((s) => `${tyres(s.compound)} on lap ${s.lap}`).join(', then ')}`
          : ''}
        {pace ? `, ${pace}` : ''} now looks better: {Math.round(offer.chance * 100)}% against our{' '}
        {Math.round(offer.mine * 100)}%.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Choice onClick={onSwitch} primary>
          Switch
        </Choice>
        <Choice onClick={onKeep}>Keep ours</Choice>
      </div>
    </section>
  );
}

function Choice({
  onClick,
  primary,
  disabled,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`call-opt items-center !text-center ${primary ? 'main' : ''}`}
    >
      <span className="label">{children}</span>
    </button>
  );
}
