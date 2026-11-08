// The big call, as a dark TV graphic under the map (the call-plate style in index.css): the radio line, a row of facts (gap,
// tyres, stop cost, laps left), then the options, each with one line on what it does
// (game/guide.ts). Stops fold into a "Box" button per timing (this lap, next lap) that opens
// the tyre choice in place, each compound with what it gains over the laps left. Same options
// the server grades (game/choices.ts); no chances shown (the grade comes after the call).
// Number keys pick options, Escape backs out of the tyre choice. In Eras mode (build plan 8.6)
// the gap follows the difficulty's information level and the decision timer sits by the tag.
// In Eras 1-2 (build plan 8.5, the race's era) the call reads as a pit-board message.

import { type DecisionMoment, type RaceModel, type RaceState, tyreLife } from '@laststint/sim';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { named, surname } from '../data/names.js';
import { PIT_BOARD_CLASS } from '../eras/PitBoard.js';
import { useRaceEra } from '../eras/RaceEraContext.js';
import {
  FULL_INFORMATION,
  type InformationView,
  gapShown,
  gapText,
  shownGap,
} from '../eras/difficulty/information.js';
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

export function BroadcastDecision({
  moment,
  race,
  model,
  onChoose,
  info = FULL_INFORMATION,
  timer,
}: {
  moment: DecisionMoment;
  race: RaceState;
  model: RaceModel;
  onChoose: (optionId: string) => void;
  /** What the Eras information level shows (everything, otherwise). */
  info?: InformationView;
  /** The Eras decision timer, shown by the tag. */
  timer?: ReactNode;
}) {
  const board = useRaceEra().prompts === 'board';
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
  if (brief.gap !== null && gapShown(info, race.order, model.userSide, model.rival))
    facts.push([
      'Gap',
      `${gapText(info, brief.gap)} ${shownGap(info, brief.gap) >= 0 ? `on ${surname(model.rival)}` : `to ${surname(model.rival)}`}`,
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
    <span aria-hidden="true" className="call-key hidden md:inline">
      {n}
    </span>
  );

  return (
    <section
      aria-label="Your call"
      className={board ? `decision call-plate ${PIT_BOARD_CLASS}` : 'decision call-plate'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
        <span role="alert" className="call-tag">
          {board ? 'Pit board · ' : 'Engineer · '}
          {brief.kind} · Lap {moment.lap}
        </span>
        {timer}
        <dl className="m-0 hidden flex-wrap gap-x-4 gap-y-1 md:flex">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-1.5 text-[12px]">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8D9692]">
                {k}
              </dt>
              <dd className="mono m-0 font-semibold text-[#D5DAD7]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <span
        className={
          board
            ? 'board-line text-[17px] font-bold leading-snug md:text-[20px]'
            : 'text-[17px] font-bold leading-snug text-white md:text-[20px]'
        }
      >
        {brief.headline}
      </span>
      {box ? (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[#D5DAD7]">
            {box.label}: which tyres?
            {(outlooks[0]?.greenLaps ?? 0) > 0 && (
              <span className="font-normal normal-case tracking-normal text-[#8D9692]">
                {' '}
                Gain is lap time over the {outlooks[0]?.greenLaps} green laps left, against staying
                out.
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
                  className="call-opt"
                  onClick={() => onChoose(t.option.id)}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className={`tyre ${t.compound}`}>
                      {LETTER[t.compound] ?? t.compound[0]}
                    </span>
                    <span className="label">{tyreName(t.compound)}</span>
                    {o?.gain != null && (
                      <span
                        className="mono ml-auto text-[14px] font-bold"
                        style={{ color: o.gain >= 0 ? 'var(--good)' : 'var(--box-ink)' }}
                      >
                        {o.gain >= 0 ? '+' : '−'}
                        {Math.abs(o.gain).toFixed(1)}s
                      </span>
                    )}
                    {key(i + 1)}
                  </span>
                  {o && (
                    <span className="note">
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
            className="self-start px-1 text-[13px] font-bold text-[#B7BEBA] underline hover:text-white"
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
              className={`call-opt ${t.box ? 'box' : ''}`}
              onClick={t.act}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="label">{t.label}</span>
                {key(i + 1)}
              </span>
              {t.note && <span className="note line-clamp-2">{t.note}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
