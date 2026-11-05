// A battle (battles and trust spec): the fight named by its corner, a bar for your car closing
// on the braking zone (the race stops there and waits for your call), and the moves as
// numbered buttons in the colours of their lines on the map, each with its odds. Then the
// call, and the result at the corner. Number keys answer.

import { useEffect, useState } from 'react';
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
      className="quick-call card flex flex-col gap-3"
      style={{ borderColor: 'var(--box)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-[var(--box)] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-white">
            <OvertakeIcon size={13} /> Battle · T{corner}
          </span>
          <span className="text-[13px] font-semibold">
            {who} · {(call.gap ?? 0).toFixed(1)} s
          </span>
        </span>
        <span
          className="eyebrow"
          style={{ color: stage === 'waiting' ? 'var(--box-ink)' : undefined }}
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
      <p className="m-0 text-[15px] font-semibold leading-snug">
        {call.from !== 'Engineer' && (
          <span className="mr-1 text-[var(--muted)]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {/* The approach: your car closing on the braking zone; then the wait for your call. */}
      {!chosen && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--card-2)]">
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
      )}
      {result ? (
        <output
          className="rounded-lg px-3 py-2 text-center text-[18px] font-extrabold uppercase tracking-wide"
          style={{
            background: result.good ? 'var(--good)' : 'var(--box)',
            color: result.good ? '#08231f' : '#ffffff',
          }}
        >
          {result.text}
        </output>
      ) : picked ? (
        <output className="flex items-center gap-2 rounded-lg bg-[var(--card-2)] px-3 py-2 text-[14px] font-bold">
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
                className="flex min-h-[64px] flex-col gap-1 rounded-lg border-2 bg-[var(--ink)] px-2.5 py-2 text-left text-[var(--paper)] hover:brightness-110 focus-visible:outline-none"
                style={{ borderColor: color }}
              >
                <span className="flex items-center gap-1.5 text-[14px] font-bold leading-tight">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-[#141716]"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  {o.label}
                </span>
                {o.note && <span className="text-[11px] opacity-70">{o.note}</span>}
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
              <dt className="eyebrow">{s.label}</dt>
              <dd className="m-0 font-semibold">{named(s.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
