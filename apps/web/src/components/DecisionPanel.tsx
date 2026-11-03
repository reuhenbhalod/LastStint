// The decision card, under the map (a wide strip on a laptop: tiles in one row, options in
// one row): the radio line, four stat tiles (gap, tyres, pit
// stop, laps left), then the options, each with a line on what it does. Stops fold into a
// "Box" button per timing (this lap, next lap) followed by the tyre choice (game/choices.ts), where each compound shows its
// pace, drop-off, whether it reaches the flag and what it gains over the laps left
// (game/guide.ts). Number keys pick options. On a phone it rises as a bottom sheet over the
// map so the call is always in reach.

import type { DecisionMoment, RaceModel, RaceState } from '@boxthislap/sim';
import { Fragment, useEffect, useRef, useState } from 'react';
import { briefFor } from '../game/brief.js';
import { choicesFor, tyreName } from '../game/choices.js';
import { type Fact, modeFacts, tyreOutlooks } from '../game/guide.js';

const LETTER: Record<string, string> = { SOFT: 'S', MEDIUM: 'M', HARD: 'H' };

function Tyre({ compound, age }: { compound: string; age: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`tyre ${compound}`} title={tyreName(compound)}>
        {LETTER[compound] ?? compound[0]}
      </span>
      <span className="mono text-[13px]">{age}</span>
    </span>
  );
}

function Tile({
  label,
  children,
  note,
}: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-[var(--card-2)] px-2.5 py-1.5 md:gap-1 md:px-3 md:py-2.5">
      <span className="eyebrow">{label}</span>
      <span className="flex min-h-[24px] flex-wrap items-center gap-x-3 gap-y-1">{children}</span>
      {note && <span className="hidden text-[12px] text-[var(--muted)] md:block">{note}</span>}
    </div>
  );
}

// Option buttons, all laid out the same: the call, then the same four facts for every option
// (pace, tyres, racing, risk; game/guide.ts), so a row of options compares straight across.
// Each button spans two rows of the options grid (a subgrid): the facts start on one line.
const optBtn =
  'relative row-span-2 grid grid-rows-subgrid gap-y-2 rounded-lg border-2 border-transparent bg-[var(--ink)] p-3 text-left text-[var(--paper)] hover:border-[var(--you)] focus-visible:border-[var(--you)] focus-visible:outline-none';

/** Options side by side on a wide screen. */
const WIDE: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

export function DecisionPanel({
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
  const b = briefFor(moment, race, model);
  const c = choicesFor(moment);
  // The Box button whose tyre step is open.
  const [picking, setPicking] = useState<'now' | 'next' | null>(null);
  const first = useRef<HTMLButtonElement>(null);

  // The top-level buttons, with Box in the stop options' place.
  const me = race.cars[model.userSide];
  const oldTyres = me
    ? `${me.tyreAge}-lap-old ${tyreName(me.compound).toLowerCase()}`
    : 'Current set';
  const worn = !!me && me.tyreWear >= (model.compounds[me.compound]?.cliffLap ?? 99);
  const top: Array<{
    id: string;
    label: string;
    note: string | null;
    facts: Fact[];
    act: () => void;
  }> = c.direct.map((o) => {
    const calls = o.decisions.flatMap((d) =>
      d.kind === 'mode' ? [{ key: d.key, value: d.value }] : [],
    );
    const facts: Fact[] = calls.length
      ? modeFacts(model, calls)
      : moment.trigger === 'takeover'
        ? [
            { label: 'Pace', value: 'Standard', tone: 'neutral' },
            { label: 'Tyres', value: 'Normal wear', tone: 'neutral' },
            { label: 'Racing', value: 'Adapt', tone: 'neutral' },
            { label: 'Risk', value: 'Normal', tone: 'neutral' },
          ]
        : [
            { label: 'Pace', value: 'Same', tone: 'neutral' },
            { label: 'Tyres', value: oldTyres, tone: worn ? 'bad' : 'neutral' },
            { label: 'Racing', value: 'Keep track position', tone: 'good' },
            {
              label: 'Risk',
              value: worn ? 'Worn tyres' : 'Normal',
              tone: worn ? 'bad' : 'neutral',
            },
          ];
    return {
      id: o.id,
      // "Stay out — keep the lead": the facts carry the detail.
      label: o.decisions.length === 0 ? (o.label.split(' — ')[0] ?? o.label) : o.label,
      note: facts.map((f) => `${f.label}: ${f.value}`).join(' · '),
      facts,
      act: () => onChoose(o.id),
    };
  });
  c.boxes.forEach((box, i) => {
    const only = box.tyres.length === 1 ? box.tyres[0] : null;
    const stop = b.stop ? `−${b.stop.now.toFixed(0)}s in the pits` : 'Pit stop';
    const facts: Fact[] = [
      {
        label: 'Pace',
        value: box.key === 'now' ? 'Fresh tyres' : 'One lap, then fresh',
        tone: 'good',
      },
      {
        label: 'Tyres',
        value: only ? `New ${tyreName(only.compound).toLowerCase()}` : 'New set',
        tone: 'good',
      },
      { label: 'Racing', value: stop, tone: 'bad' },
      { label: 'Risk', value: 'Normal', tone: 'neutral' },
    ];
    top.splice(c.boxIndex + i, 0, {
      id: `box-${box.key}`,
      label: box.label,
      note: facts.map((f) => `${f.label}: ${f.value}`).join(' · '),
      facts,
      act: () => (only ? onChoose(only.option.id) : setPicking(box.key)),
    });
  });
  const box = c.boxes.find((x) => x.key === picking) ?? null;
  const tyreOpts = box?.tyres ?? [];
  const outlooks = tyreOutlooks(
    model,
    me,
    box?.lap ?? moment.lap,
    tyreOpts.map((t) => t.compound),
  );

  // Focus the first button when the card or its tyre step opens (keyed by moment upstream).
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the step changes.
  useEffect(() => first.current?.focus(), [picking]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (e.key === 'Escape' && picking) setPicking(null);
      if (!Number.isInteger(n) || n < 1) return;
      if (picking)
        tyreOpts[n - 1] && onChoose((tyreOpts[n - 1] as (typeof tyreOpts)[number]).option.id);
      else top[n - 1]?.act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const gap = b.gap;
  return (
    <section
      aria-labelledby="decision-headline"
      className="decision card flex flex-col gap-2 shadow-2xl md:gap-3"
    >
      <p className="eyebrow !text-[var(--rival)]">
        📻 Lap {moment.lap} · {b.kind}
      </p>
      <p
        id="decision-headline"
        className="m-0 text-[15px] font-semibold leading-snug md:text-[17px]"
      >
        {b.headline}
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile
          label="Gap"
          note={
            gap === null
              ? undefined
              : gap >= 0
                ? `${model.rival} behind us`
                : `${model.rival} ahead of us`
          }
        >
          <span className="mono text-[17px] font-semibold md:text-[20px]">
            {gap === null ? '—' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}s`}
          </span>
        </Tile>
        <Tile label="Laps left">
          <span className="mono text-[17px] font-semibold md:text-[20px]">{b.lapsLeft}</span>
        </Tile>
        <Tile label="Tyres">
          {b.us && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-[var(--you)]">{b.us.code}</span>
              <Tyre compound={b.us.compound} age={b.us.age} />
            </span>
          )}
          {b.rival && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-[var(--rival)]">{b.rival.code}</span>
              <Tyre compound={b.rival.compound} age={b.rival.age} />
            </span>
          )}
        </Tile>
        {b.stop ? (
          <Tile
            label="Pit stop"
            note={
              b.stop.now < b.stop.green - 0.5
                ? `${b.stop.green.toFixed(0)}s under green`
                : undefined
            }
          >
            <span className="mono text-[17px] font-semibold md:text-[20px]">
              {b.stop.now.toFixed(0)}s
            </span>
          </Tile>
        ) : (
          <Tile label="Flag">
            <span className="mono text-[15px] font-semibold uppercase">
              {race.flag === 'green' ? 'Green' : race.flag}
            </span>
          </Tile>
        )}
      </div>

      {!picking ? (
        <div
          className={`grid gap-x-2 gap-y-2 ${top.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${WIDE[top.length] ?? ''}`}
        >
          {top.map((t, i) => {
            const box = t.id.startsWith('box-');
            return (
              <button
                key={t.id}
                ref={i === 0 ? first : undefined}
                type="button"
                onClick={t.act}
                aria-label={t.label}
                title={t.note ?? undefined}
                className={`${optBtn} ${box ? '!bg-[var(--box)] !text-white' : ''}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="disp text-[15px] leading-[1.15]">{t.label}</span>
                  <span aria-hidden="true" className="mono pt-0.5 text-[10px] opacity-50">
                    {i + 1}
                  </span>
                </span>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px] leading-snug">
                  {t.facts.map((f) => (
                    <Fragment key={f.label}>
                      <dt className="opacity-55">{f.label}</dt>
                      <dd
                        className={`m-0 font-semibold ${box ? '' : f.tone === 'good' ? 'text-[#0d8a7c]' : f.tone === 'bad' ? 'text-[#c0392b]' : ''}`}
                      >
                        {f.value}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{box?.label ?? 'Box'}: which tyres?</p>
          <p className="m-0 text-[12px] leading-snug text-[var(--muted)]">
            {b.stop ? `The stop costs ~${b.stop.now.toFixed(0)} s. ` : ''}
            {(outlooks[0]?.greenLaps ?? 0) > 0
              ? `“Gain” is lap time over the ${outlooks[0]?.greenLaps} green lap${outlooks[0]?.greenLaps === 1 ? '' : 's'} left, against staying out (no traffic or passing).`
              : 'No green laps left: fresh tyres only help at a restart.'}
          </p>
          <div className={`grid gap-2 ${WIDE[tyreOpts.length] ?? ''}`}>
            {tyreOpts.map((t, i) => {
              const o = outlooks[i];
              return (
                <button
                  key={t.option.id}
                  ref={i === 0 ? first : undefined}
                  type="button"
                  onClick={() => onChoose(t.option.id)}
                  className="relative flex flex-col gap-2.5 rounded-lg border-2 border-transparent bg-[var(--card-2)] p-3 text-left hover:border-[var(--you)] focus-visible:border-[var(--you)] focus-visible:outline-none"
                  aria-label={tyreName(t.compound)}
                >
                  {/* Head: the tyre, its name, and what it gains. */}
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`tyre ${t.compound} !h-8 !w-8 !border-[4px] bg-[var(--tarmac)] !text-[12px]`}
                    >
                      {LETTER[t.compound] ?? t.compound[0]}
                    </span>
                    <span className="disp flex-1 text-[17px] leading-none">
                      <span aria-hidden="true" className="mono mr-1.5 text-[10px] opacity-60">
                        {i + 1}
                      </span>
                      {tyreName(t.compound)}
                    </span>
                    {o?.gain != null && (
                      <span className="ml-auto text-right">
                        <span className="eyebrow block">Gain</span>
                        <span className="mono block text-[17px] font-semibold leading-tight">
                          {o.gain >= 0 ? '+' : '−'}
                          {Math.abs(o.gain).toFixed(1)}s
                        </span>
                      </span>
                    )}
                  </span>
                  {o && (
                    <>
                      {/* The facts, as chips. */}
                      <span className="flex flex-wrap gap-1.5 text-[12px]">
                        <span className="rounded bg-[var(--card)] px-1.5 py-0.5">
                          {o.newPace < 0.005
                            ? 'Fastest when new'
                            : `+${o.newPace.toFixed(2)}s/lap vs softs`}
                        </span>
                        <span className="rounded bg-[var(--card)] px-1.5 py-0.5">
                          Drops off ~{o.dropOff} laps
                        </span>
                        <span
                          className={`rounded bg-[var(--card)] px-1.5 py-0.5 ${o.toFlag ? 'text-[var(--you)]' : 'text-[var(--box)]'}`}
                        >
                          {o.toFlag ? 'Lasts to the flag' : `Won’t last ${b.lapsLeft} laps`}
                        </span>
                      </span>
                      <span className="flex flex-col gap-1 text-[12.5px] leading-snug">
                        <span>
                          <span className="font-semibold text-[var(--you)]">Good </span>
                          {o.good}
                        </span>
                        <span className="text-[var(--muted)]">
                          <span className="font-semibold text-[var(--box)]">Bad </span>
                          {o.bad}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPicking(null)}
            className="self-start rounded-md px-2 py-1 text-[13px] text-[var(--muted)] underline"
          >
            Back
          </button>
        </div>
      )}
    </section>
  );
}
