// The big call, as a TV lower third under the map: the radio line, a row of facts (gap,
// tyres, stop cost, laps left), then the options, each with one line on what it does
// (game/guide.ts). Stops fold into a "Box" button per timing (this lap, next lap) that opens
// the tyre choice in place, each compound with what it gains over the laps left. Same options
// the server grades (game/choices.ts); no chances shown (the grade comes after the call).
// Number keys pick options, Escape backs out of the tyre choice.

import { type DecisionMoment, type RaceModel, type RaceState, tyreLife } from '@boxthislap/sim';
import { useEffect, useRef, useState } from 'react';
import { named, surname } from '../data/names.js';
import { briefFor } from '../game/brief.js';
import { choicesFor, tyreName } from '../game/choices.js';
import { type Fact, modeFacts, tyreOutlooks } from '../game/guide.js';

const LETTER: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
};

const btn =
  'flex min-h-[48px] min-w-0 flex-col items-start justify-center gap-0.5 rounded-md border-2 px-3 py-1.5 text-left hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--you)] md:min-h-[52px] md:px-4';
const plain = `${btn} border-[#0B0E0D] bg-transparent text-[#0B0E0D] hover:bg-[#0B0E0D] hover:text-white`;
const boxBtn = `${btn} border-[var(--box)] bg-[var(--box)] text-white`;

export function BroadcastDecision({
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
  const brief = briefFor(moment, race, model);
  const c = choicesFor(moment);
  const [picking, setPicking] = useState<'now' | 'next' | null>(null);
  const first = useRef<HTMLButtonElement>(null);

  // The top-level buttons, with Box in the stop options' place, each with its facts.
  const me = race.cars[model.userSide];
  const oldTyres = me
    ? `${me.tyreAge}-lap-old ${tyreName(me.compound).toLowerCase()}`
    : 'current set';
  const tyre = me ? model.compounds[me.compound] : undefined;
  const worn = !!me && !!tyre && me.tyreWear >= tyreLife(tyre);
  const line = (facts: Fact[]) =>
    facts
      .filter((f) => f.label !== 'Risk' || f.value !== 'Normal')
      .map((f) => f.value)
      .join(' · ');
  const top: Array<{ id: string; label: string; note: string; box: boolean; act: () => void }> =
    c.direct.map((o) => {
      const calls = o.decisions.flatMap((d) =>
        d.kind === 'mode' ? [{ key: d.key, value: d.value }] : [],
      );
      const facts: Fact[] = calls.length
        ? modeFacts(model, calls)
        : [
            { label: 'Tyres', value: `Keep the ${oldTyres}`, tone: 'neutral' },
            { label: 'Racing', value: 'Keep track position', tone: 'good' },
            { label: 'Risk', value: worn ? 'Worn tyres' : 'Normal', tone: 'neutral' },
          ];
      return {
        id: o.id,
        // "Stay out, keep the lead": the line under it carries the detail.
        label: named(o.decisions.length === 0 ? (o.label.split(', ')[0] ?? o.label) : o.label),
        note: line(facts),
        box: false,
        act: () => onChoose(o.id),
      };
    });
  c.boxes.forEach((b, i) => {
    const only = b.tyres.length === 1 ? b.tyres[0] : null;
    top.splice(c.boxIndex + i, 0, {
      id: `box-${b.key}`,
      label: only ? `${b.label}, ${tyreName(only.compound).toLowerCase()}` : b.label,
      note: `${b.key === 'now' ? 'Fresh tyres' : 'One lap, then fresh'}${brief.stop ? ` · −${brief.stop.now.toFixed(0)}s in the pits` : ''}`,
      box: true,
      act: () => (only ? onChoose(only.option.id) : setPicking(b.key)),
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
  useEffect(() => first.current?.focus({ preventScroll: true }), [picking]);
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

  const facts: Array<[string, string]> = [];
  if (brief.gap !== null)
    facts.push([
      'Gap',
      `${brief.gap >= 0 ? '+' : '−'}${Math.abs(brief.gap).toFixed(1)}s ${brief.gap >= 0 ? `on ${surname(model.rival)}` : `to ${surname(model.rival)}`}`,
    ]);
  if (brief.us) facts.push(['Tyres', `${tyreName(brief.us.compound)} · ${brief.us.age}`]);
  if (brief.rival)
    facts.push([
      surname(brief.rival.code),
      `${tyreName(brief.rival.compound)} · ${brief.rival.age}`,
    ]);
  if (brief.stop) facts.push(['Stop costs', `${Math.round(brief.stop.now)}s`]);
  facts.push(['Laps left', String(brief.lapsLeft)]);

  const key = (n: number) => (
    <span aria-hidden="true" className="mono hidden text-[10px] opacity-50 md:inline">
      {n}
    </span>
  );

  return (
    <section
      aria-label="Your call"
      className="decision flex items-stretch drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
    >
      <span
        aria-hidden="true"
        className="w-[14px] shrink-0 bg-[var(--you)]"
        style={{ clipPath: 'polygon(0 0, 100% 0, 60% 100%, 0 100%)' }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 bg-[#F4F6F5] px-3.5 py-3 text-[#0B0E0D] md:px-5">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span
            role="alert"
            className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9a3412]"
          >
            Engineer · {brief.kind} · Lap {moment.lap}
          </span>
          {facts.map(([k, v]) => (
            <span key={k} className="hidden text-[12px] text-[#39403D] md:inline">
              <span className="uppercase tracking-wider text-[#6B736F]">{k}</span>{' '}
              <b className="mono">{v}</b>
            </span>
          ))}
        </div>
        <span className="text-[16px] font-bold leading-snug md:text-[19px]">{brief.headline}</span>
        {box ? (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider">
              {box.label}: which tyres?
              {(outlooks[0]?.greenLaps ?? 0) > 0 && (
                <span className="font-normal normal-case tracking-normal text-[#39403D]">
                  {' '}
                  Gain is lap time over the {outlooks[0]?.greenLaps} green laps left, against
                  staying out.
                </span>
              )}
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {tyreOpts.map((t, i) => {
                const o = outlooks[i];
                return (
                  <button
                    key={t.option.id}
                    ref={i === 0 ? first : undefined}
                    type="button"
                    aria-label={tyreName(t.compound)}
                    title={o ? `Good: ${o.good}\nBad: ${o.bad}` : undefined}
                    className={plain}
                    onClick={() => onChoose(t.option.id)}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className={`tyre ${t.compound}`}>
                        {LETTER[t.compound] ?? t.compound[0]}
                      </span>
                      <span className="text-[14px] font-extrabold uppercase tracking-wide">
                        {tyreName(t.compound)}
                      </span>
                      {o?.gain != null && (
                        <span className="mono ml-auto text-[14px] font-bold">
                          {o.gain >= 0 ? '+' : '−'}
                          {Math.abs(o.gain).toFixed(1)}s
                        </span>
                      )}
                      {key(i + 1)}
                    </span>
                    {o && (
                      <span className="text-[11.5px] font-medium opacity-75">
                        Drops off ~{o.dropOff} laps ·{' '}
                        {o.toFlag ? 'lasts to the flag' : `won’t last ${brief.lapsLeft} laps`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPicking(null)}
              className="self-start px-1 text-[13px] font-bold text-[#39403D] underline"
            >
              Back
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 gap-2 ${top.length >= 4 ? 'md:grid-cols-4' : top.length === 3 ? 'md:grid-cols-3' : ''}`}
          >
            {top.map((t, i) => (
              <button
                key={t.id}
                ref={i === 0 ? first : undefined}
                type="button"
                aria-label={t.label}
                title={t.note}
                className={t.box ? boxBtn : plain}
                onClick={t.act}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-[13px] font-extrabold uppercase leading-tight tracking-wide md:text-[14px]">
                    {t.label}
                  </span>
                  {key(i + 1)}
                </span>
                {t.note && (
                  <span className="line-clamp-2 text-[11.5px] font-medium leading-snug opacity-75">
                    {t.note}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
