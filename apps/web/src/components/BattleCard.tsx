// A battle (battles and trust spec): the fight named by its corner, a bar for your car closing
// on the braking zone (the race stops there and waits for your call), and the moves as
// numbered buttons in the colours of their lines on the map, each with its odds. Then the
// call, and the result at the corner. Number keys answer. In Eras (`eras`, eras spec §7) the
// wait at the braking zone runs on the era's decision timer, shown in place of the short bar;
// the race screen makes the driver's own move when it runs out. Without it, exactly as before.

import { type ReactNode, useEffect, useState } from 'react';
import { named, surname } from '../data/names.js';
import type { QuickCall } from '../game/quickCalls.js';
import { type LapClock, clockProgress } from '../game/useGame.js';
import { LINE_COLOR } from '../track/battle.js';
import { OvertakeIcon } from './Icons.js';

export type BattleStage = 'approach' | 'waiting' | 'move' | 'done';

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function BattleCard({
  call,
  corner,
  stage,
  clock,
  fromP,
  brakeP,
  waitMs,
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
          <span className="text-[13px] font-semibold text-[#D5DAD7]">
            {who} · {(call.gap ?? 0).toFixed(1)} s
          </span>
        </span>
        <span
          className="call-tag"
          style={{ color: stage === 'waiting' ? 'var(--box-ink)' : '#8D9692' }}
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
          <span className="mr-1 font-semibold text-[#8D9692]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {/* The approach: your car closing on the braking zone; then the wait for your call. */}
      {!chosen && eras && stage === 'waiting' ? (
        eras.timer
      ) : !chosen ? (
        <div className="h-1 overflow-hidden bg-[#232927]">
          {stage === 'waiting' ? (
            <div
              className="quick-timer h-full"
              style={{ animationDuration: `${waitMs}ms`, background: 'var(--box)' }}
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
        <output className="flex items-center gap-2 rounded-md border border-[#2D3431] bg-[#181D1B] px-3 py-2 text-[14px] font-bold">
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
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-[#141716]"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  {o.label}
                </span>
                {o.note && <span className="note">{o.note}</span>}
                {o.odds && (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: pct(o.odds.good), background: 'var(--good)' }}
                      />
                    </span>
                    <span>
                      {pct(o.odds.good)} {o.odds.label}
                    </span>
                    <span className="text-[#ff8a80]">{pct(o.odds.contact)} hit</span>
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
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8D9692]">
                {s.label}
              </dt>
              <dd className="m-0 font-semibold text-[#D5DAD7]">{named(s.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
