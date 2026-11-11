// A battle (battles and trust spec): the fight named by its corner, a meter for how it stands
// (hold vs he gets by, or pass vs stay behind, round 3 R2), a bar for your car closing on the
// braking zone (the race stops there and waits for your call), and the moves as numbered
// buttons in the colours of their lines on the map, each tagged Safer, Balanced or Risky (not
// its odds). Then the call, and the result at the corner. Number keys answer. In Eras (`eras`,
// eras spec §7) the wait at the braking zone runs on the era's decision timer, shown in place
// of the short bar; the race screen makes the driver's own move when it runs out. Without it,
// exactly as before.

import { type ReactNode, useEffect, useState } from 'react';
import { named, surname } from '../data/names.js';
import type { BattleTag, QuickCall } from '../game/quickCalls.js';
import { type LapClock, clockProgress } from '../game/useGame.js';
import { LINE_COLOR } from '../track/battle.js';
import { OvertakeIcon } from './Icons.js';

export type BattleStage = 'approach' | 'waiting' | 'move' | 'done';

const TAG_COLOR: Record<BattleTag, string> = {
  Safer: '#4ade80',
  Balanced: '#facc15',
  Risky: '#f87171',
  'Gives way': '#9AA5A0',
};

/** The fight as it stands: hold vs he gets by (defending), or pass vs stay behind. */
function FightMeter({ call }: { call: QuickCall }) {
  const good = call.meter ?? 0;
  const other = surname(call.other ?? '');
  const [yes, no] = call.attacking ? ['Pass', 'Stay behind'] : ['Hold', `${other} gets by`];
  return (
    <div className="flex flex-col gap-1.5" aria-label="How the fight stands">
      <div className="flex justify-between text-[12px] font-bold">
        <span style={{ color: 'var(--you)' }}>
          {yes} {pct(good)}
        </span>
        <span style={{ color: 'var(--rival)' }}>
          {no} {pct(1 - good)}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden bg-[#252D31]">
        <span className="h-full" style={{ width: pct(good), background: 'var(--you)' }} />
        <span className="h-full flex-1" style={{ background: 'var(--rival)', opacity: 0.85 }} />
      </div>
    </div>
  );
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function BattleCard({
  call,
  corner,
  stage,
  clock,
  fromP,
  brakeP,
  waitMs,
  readMs = 0,
  chosen,
  result,
  onAnswer,
  eras,
}: {
  call: QuickCall;
  corner: number;
  stage: BattleStage;
  clock: LapClock | null;
  /** Tick progress when the call came, and when your car reaches the braking zone. */
  fromP: number;
  brakeP: number;
  /** How long the race waits at the braking zone. */
  waitMs: number;
  /** Time to read the moves before the wait's clock starts. */
  readMs?: number;
  /** The option called (by you or, with no call, the driver). */
  chosen: string | null;
  result: { text: string; good: boolean } | null;
  onAnswer: (optionId: string) => void;
  /** An Eras race: the era's decision timer for the wait at the braking zone (null with the
   * timer turned off: the race waits for the call). `waitMs` then isn't shown. */
  eras?: { timer: ReactNode };
}) {
  // The bar to the braking zone, from the lap clock.
  const [closing, setClosing] = useState(0);
  useEffect(() => {
    if (stage !== 'approach' || !clock) return;
    let raf = 0;
    const frame = () => {
      const p = clockProgress(clock);
      setClosing(Math.min(1, Math.max(0, (p - fromP) / Math.max(0.01, brakeP - fromP))));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stage, clock, fromP, brakeP]);
  useEffect(() => {
    if (chosen) return;
    const onKey = (e: KeyboardEvent) => {
      const o = call.options[Number(e.key) - 1];
      if (o) onAnswer(o.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call, chosen, onAnswer]);

  const picked = call.options.find((o) => o.id === chosen);
  const other = surname(call.other ?? '');
  const who = call.attacking ? `Attacking ${other}` : `Defending from ${other}`;
  return (
    <section
      aria-label="Battle call"
      className="quick-call call-plate"
      style={{ '--accent': 'var(--box)' } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex -skew-x-6 items-center gap-1.5 bg-[var(--box)] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white">
            <OvertakeIcon size={13} /> Battle · T{corner}
          </span>
          <span className="text-[13px] font-semibold text-[#D5DBD7]">
            {who} · {(call.gap ?? 0).toFixed(1)} s
          </span>
        </span>
        <span
          className="call-tag"
          style={{ color: stage === 'waiting' ? 'var(--box-ink)' : '#9AA5A0' }}
        >
          {stage === 'approach' && !chosen
            ? 'Braking zone ahead'
            : stage === 'waiting'
              ? 'Your call: he’s on the brakes'
              : result
                ? 'Result'
                : 'Into the corner'}
        </span>
      </div>
      <p className="m-0 text-[16px] font-bold leading-snug text-white md:text-[18px]">
        {call.from !== 'Engineer' && (
          <span className="mr-1 font-semibold text-[#9AA5A0]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {/* How the fight stands with no special move (round 3 R2): the moves only say how risky. */}
      {call.meter !== undefined && !result && <FightMeter call={call} />}
      {/* The approach: your car closing on the braking zone; then the wait for your call. */}
      {!chosen && eras && stage === 'waiting' ? (
        eras.timer
      ) : !chosen ? (
        <div className="h-1 overflow-hidden bg-[#252D31]">
          {stage === 'waiting' ? (
            <div
              className="quick-timer h-full"
              style={{
                animationDuration: `${waitMs}ms`,
                animationDelay: `${readMs}ms`,
                background: 'var(--box)',
              }}
            />
          ) : (
            <div
              className="h-full bg-[var(--flag)]"
              style={{ width: `${(closing * 100).toFixed(1)}%` }}
            />
          )}
        </div>
      ) : null}
      {result ? (
        <output
          className="rounded-lg px-3 py-2 text-center text-[18px] font-extrabold uppercase tracking-wide"
          style={{
            background: result.good ? 'var(--good)' : 'var(--box)',
            color: result.good ? 'var(--good-ink)' : '#ffffff',
          }}
        >
          {result.text}
        </output>
      ) : picked ? (
        <output className="flex items-center gap-2 rounded-md border border-[#2E373B] bg-[#192024] px-3 py-2 text-[14px] font-bold">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: LINE_COLOR[picked.line ?? 'wait'] }}
          />
          {picked.label}
          <span className="font-normal text-[var(--muted)]">· watch the corner</span>
        </output>
      ) : (
        <div
          className={`grid gap-2 ${call.options.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}
        >
          {call.options.map((o, i) => {
            const color = LINE_COLOR[o.line ?? 'wait'];
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onAnswer(o.id)}
                className="call-opt min-h-[64px] !justify-start !gap-1"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <span className="label flex items-center gap-1.5">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-[#151A1D]"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  {o.label}
                </span>
                {o.note && <span className="note">{o.note}</span>}
                {o.tag && (
                  <span
                    className="w-fit text-[10px] font-extrabold uppercase tracking-[0.12em]"
                    style={{ color: TAG_COLOR[o.tag] }}
                  >
                    {o.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {call.stats && !chosen && (
        <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {call.stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9AA5A0]">
                {s.label}
              </dt>
              <dd className="m-0 font-semibold text-[#D5DBD7]">{named(s.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
