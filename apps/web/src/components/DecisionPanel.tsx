// The decision card in the call column: the radio line, four stat tiles (gap, tyres, pit
// stop, laps left), then the options. Stops fold into one "Box" button followed by the tyre
// choice (game/choices.ts). Number keys pick options. On a phone it rises as a bottom sheet
// over the map so the call is always in reach.

import type { DecisionMoment, RaceModel, RaceState } from '@boxthislap/sim';
import { useEffect, useRef, useState } from 'react';
import { briefFor } from '../game/brief.js';
import { choicesFor, tyreName } from '../game/choices.js';

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

const optBtn =
  'relative flex min-h-[52px] items-end rounded-lg border-2 border-transparent bg-[var(--ink)] px-3 pb-2 pt-5 text-left text-[var(--paper)] disp text-[20px] leading-none md:min-h-[64px] md:pb-2.5 md:pt-6 md:text-[24px] hover:border-[var(--you)] focus-visible:border-[var(--you)] focus-visible:outline-none';

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
  const [picking, setPicking] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  // The top-level buttons, with Box in the stop options' place.
  const top: Array<{ id: string; label: string; act: () => void }> = c.direct.map((o) => ({
    id: o.id,
    label: o.label,
    act: () => onChoose(o.id),
  }));
  if (c.box) {
    const only = c.box.tyres.length === 1 ? c.box.tyres[0] : null;
    top.splice(c.boxIndex, 0, {
      id: 'box',
      label: 'Box',
      act: () => (only ? onChoose(only.option.id) : setPicking(true)),
    });
  }
  const tyreOpts = c.box?.tyres ?? [];

  // Focus the first button when the card or its tyre step opens (keyed by moment upstream).
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the step changes.
  useEffect(() => first.current?.focus(), [picking]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (e.key === 'Escape' && picking) setPicking(false);
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
      className="decision flex flex-col gap-2 rounded-xl border border-[var(--rule)] bg-[var(--card)] p-3 shadow-2xl md:gap-3 md:p-4"
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
      <div className="grid grid-cols-2 gap-2">
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
        <div className={`grid gap-2 ${top.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {top.map((t, i) => (
            <button
              key={t.id}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={t.act}
              className={`${optBtn} ${t.id === 'box' ? '!bg-[var(--box)] !text-white' : ''}`}
            >
              <span
                aria-hidden="true"
                className="mono absolute left-2.5 top-2 text-[10px] opacity-70"
              >
                {i + 1}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Box: which tyres?</p>
          <div className={`grid gap-2 ${tyreOpts.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {tyreOpts.map((t, i) => (
              <button
                key={t.option.id}
                ref={i === 0 ? first : undefined}
                type="button"
                onClick={() => onChoose(t.option.id)}
                className={`${optBtn} flex-col !items-start justify-end gap-2`}
                aria-label={tyreName(t.compound)}
              >
                <span
                  aria-hidden="true"
                  className="mono absolute left-2.5 top-2 text-[10px] opacity-70"
                >
                  {i + 1}
                </span>
                <span
                  className={`tyre ${t.compound} !border-[3px] bg-[var(--tarmac)] !text-[var(--ink)]`}
                >
                  {LETTER[t.compound] ?? t.compound[0]}
                </span>
                {tyreName(t.compound)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="self-start rounded-md px-2 py-1 text-[13px] text-[var(--muted)] underline"
          >
            Back
          </button>
        </div>
      )}
    </section>
  );
}
