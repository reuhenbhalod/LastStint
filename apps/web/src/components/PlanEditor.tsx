// Build your own race plan (strategy planner spec): up to three stops, each a lap and a tyre,
// and a pace for every stint. The strip shows it as you go; the chance comes from the game's
// grading (null while it's worked out). A plan that breaks the two-compound rule says so, in a
// race that has the rule; a race without tyre changes offers only the tyres a stop may fit
// (eras build plan 8.5, eras/raceRules.ts).

import {
  type CarState,
  MAX_PLAN_STOPS,
  MIN_STINT,
  type PaceMode,
  type RaceModel,
  type RacePlan,
  ruleSatisfied,
} from '@laststint/sim';
import { pitCompounds } from '../eras/raceRules.js';
import { PACE_WORD, stintsOk, tyres } from '../game/plans.js';
import { PlanStrip } from './PlanStrip.js';

const DRY = ['SOFT', 'MEDIUM', 'HARD'];

export function PlanEditor({
  model,
  from,
  car,
  value,
  onChange,
  chance,
}: {
  model: RaceModel;
  /** The last lap whose calls are made: stops go after the lap after it. */
  from: number;
  car: { compound: string; compoundsUsed: string[] };
  value: RacePlan;
  onChange: (plan: RacePlan) => void;
  /** The plan's chance of beating the rival, 0-1, or null while it's worked out (omitted: not
   * shown, as when changing the plan during the race). */
  chance?: number | null;
}) {
  const laps = model.race.laps;
  const first = from + 1;
  const compounds = pitCompounds(model);
  const set = (plan: Partial<RacePlan>) => onChange({ ...value, ...plan });
  const legal = twoCompounds(car, value, model.rules);

  const moveStop = (i: number, lap: number) => {
    const prev = i === 0 ? first - 1 : (value.stops[i - 1]?.lap as number) + MIN_STINT - 1;
    const next =
      i + 1 < value.stops.length ? (value.stops[i + 1]?.lap as number) - MIN_STINT : laps - 1;
    const clamped = Math.max(prev + 1, Math.min(next, lap));
    set({ stops: value.stops.map((s, k) => (k === i ? { ...s, lap: clamped } : s)) });
  };
  const addStop = () => {
    // In the middle of the longest stint that has room.
    const starts = [first, ...value.stops.map((s) => s.lap + 1)];
    const ends = [...value.stops.map((s) => s.lap), laps - 1];
    let best = -1;
    let len = 0;
    starts.forEach((st, i) => {
      const l = (ends[i] as number) - st;
      if (l > len && l >= 2 * MIN_STINT) {
        best = i;
        len = l;
      }
    });
    if (best < 0) return;
    const lap = Math.round(((starts[best] as number) + (ends[best] as number)) / 2);
    const tyre =
      compounds.find((c) => !car.compoundsUsed.includes(c) && c !== car.compound) ??
      compounds.at(-1) ??
      'HARD';
    const stops = [...value.stops, { lap, compound: tyre }].sort((a, b) => a.lap - b.lap);
    const at = stops.findIndex((s) => s.lap === lap);
    const pace = [...value.pace];
    pace.splice(at + 1, 0, pace[at] ?? 'standard');
    set({ stops, pace });
  };
  const removeStop = (i: number) =>
    set({
      stops: value.stops.filter((_, k) => k !== i),
      pace: value.pace.filter((_, k) => k !== i + 1),
    });

  return (
    <div className="flex flex-col gap-2">
      <PlanStrip plan={value} from={from} laps={laps} compound={car.compound} />
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        <li className="flex flex-wrap items-center gap-2 px-2.5">
          <span className="text-[12px] text-[var(--muted)]">
            Now to {value.stops[0] ? `lap ${value.stops[0].lap}` : 'the flag'}, on{' '}
            {tyres(car.compound)}
          </span>
          <Pace
            value={value.pace[0] ?? 'standard'}
            onPace={(p) => set({ pace: value.pace.map((x, k) => (k === 0 ? p : x)) })}
          />
        </li>
        {value.stops.map((s, i) => (
          <li
            key={`${i}-${s.compound}`}
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg bg-[var(--card-2)] px-2.5 py-1.5"
          >
            <span className="eyebrow">Stop {i + 1}</span>
            <span className="flex items-center gap-1">
              <Step label="Earlier" onClick={() => moveStop(i, s.lap - 1)}>
                −
              </Step>
              <span className="mono min-w-[52px] text-center text-[13px] font-bold">
                lap {s.lap}
              </span>
              <Step label="Later" onClick={() => moveStop(i, s.lap + 1)}>
                +
              </Step>
            </span>
            <input
              type="range"
              aria-label={`Stop ${i + 1} lap`}
              min={first}
              max={laps - 1}
              value={s.lap}
              onChange={(e) => moveStop(i, Number(e.target.value))}
              className="min-w-[120px] flex-1 accent-[var(--you)]"
            />
            <span className="flex gap-1">
              {compounds.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={s.compound === c}
                  aria-label={tyres(c)}
                  onClick={() =>
                    set({
                      stops: value.stops.map((x, k) => (k === i ? { ...x, compound: c } : x)),
                    })
                  }
                  className={`tyre ${c} cursor-pointer ${s.compound === c ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--card-2)]' : 'opacity-50 hover:opacity-100'}`}
                >
                  {c[0]}
                </button>
              ))}
            </span>
            <Pace
              value={value.pace[i + 1] ?? 'standard'}
              onPace={(p) => set({ pace: value.pace.map((x, k) => (k === i + 1 ? p : x)) })}
            />
            <button
              type="button"
              onClick={() => removeStop(i)}
              className="text-[12px] font-semibold text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addStop}
          disabled={value.stops.length >= MAX_PLAN_STOPS || !stintsOk(value, first, laps)}
          className="rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)] disabled:opacity-40"
        >
          + Add a stop
        </button>
        <span className="text-[13px]">
          {!legal ? null : chance === undefined ? null : (
            <>
              Chance vs {model.rival}:{' '}
              <strong className="mono">
                {chance === null ? '…' : `${Math.round(chance * 100)}%`}
              </strong>
            </>
          )}
          {!legal && (
            <span className="text-[var(--box-ink)]">
              Two dry compounds are compulsory: add a stop on a different tyre.
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * True if the plan runs two dry compounds by the flag (or the car already has), or the race
 * has no such rule (`rules.twoCompound` false: before 2007). The sim's `ruleSatisfied` on the
 * dry compounds the plan runs (a dry placeholder as the car's tyre, so a wet tyre fitted now
 * doesn't waive it here, as before).
 */
export function twoCompounds(
  car: { compound: string; compoundsUsed: string[] },
  plan: RacePlan,
  rules?: RaceModel['rules'],
) {
  const used = [...car.compoundsUsed, car.compound, ...plan.stops.map((s) => s.compound)].filter(
    (c) => DRY.includes(c),
  );
  return ruleSatisfied({ compound: DRY[0], compoundsUsed: used } as CarState, rules);
}

/** A stint's pace: manage, standard or push. */
function Pace({ value, onPace }: { value: PaceMode; onPace: (p: PaceMode) => void }) {
  return (
    <span className="flex overflow-hidden rounded-md border border-[var(--rule)]">
      {(['manage', 'standard', 'push'] as PaceMode[]).map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onPace(p)}
          className={`px-2 py-0.5 text-[12px] font-semibold ${value === p ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-[var(--card-2)]'}`}
        >
          {PACE_WORD[p]}
        </button>
      ))}
    </span>
  );
}

function Step({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--rule)] text-[15px] font-bold hover:bg-[var(--card)]"
    >
      {children}
    </button>
  );
}
