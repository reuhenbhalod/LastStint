// A call between the big moments (crew-chief spec D3, race engineer spec): the engineer or the
// driver asks; you have a few seconds while the race runs on. A battle is red and runs the lap
// in slow motion. Number keys answer. No answer: no change, or the driver's own move.

import { useEffect, useRef } from 'react';
import type { QuickCall } from '../game/quickCalls.js';

export function QuickCallCard({
  call,
  ms,
  onAnswer,
  onTimeout,
}: {
  call: QuickCall;
  /** How long there is to answer. */
  ms: number;
  onAnswer: (optionId: string) => void;
  onTimeout: () => void;
}) {
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  useEffect(() => {
    const id = setTimeout(() => timeout.current(), ms);
    return () => clearTimeout(id);
  }, [ms]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = call.options[Number(e.key) - 1];
      if (o) onAnswer(o.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call, onAnswer]);

  const battle = call.kind === 'battle';
  const accent = battle ? 'var(--box)' : 'var(--you)';
  const tag = battle
    ? `⚔️ Battle${call.other ? ` with ${call.other}` : ''} · slow motion`
    : call.kind === 'trouble'
      ? '⚠️ Trouble'
      : call.kind === 'request'
        ? `📻 ${call.from} is asking`
        : `📻 ${call.from === 'Engineer' ? 'Engineer' : `${call.from} on the radio`} · quick call`;
  return (
    <section
      aria-label={battle ? 'Battle call' : 'Quick call'}
      className="quick-call card flex flex-col gap-3"
      style={{ borderColor: accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow" style={{ color: battle ? 'var(--box-ink)' : accent }}>
          {tag}
        </span>
        <span className="eyebrow">Lap {call.lap + 1}</span>
      </div>
      <p className="m-0 text-[15px] font-semibold leading-snug">
        {call.from !== 'Engineer' && <span className="mr-1 text-[var(--muted)]">{call.from}:</span>}
        {call.text}
      </p>
      {call.stats && (
        <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {call.stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="eyebrow">{s.label}</dt>
              <dd className="m-0 font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="h-1 overflow-hidden rounded-full bg-[var(--card-2)]">
        <div
          className="quick-timer h-full"
          style={{ animationDuration: `${ms}ms`, background: accent }}
        />
      </div>
      <div
        className={`grid gap-2 ${call.options.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}
      >
        {call.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onAnswer(o.id)}
            className="relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-transparent bg-[var(--ink)] px-3 py-2 text-center font-bold leading-tight text-[var(--paper)] hover:border-[var(--you)] focus-visible:border-[var(--you)] focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className="mono absolute left-2.5 top-1.5 text-[10px] opacity-60"
            >
              {i + 1}
            </span>
            <span>{o.label}</span>
            {o.note && <span className="text-[11px] font-medium opacity-70">{o.note}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
