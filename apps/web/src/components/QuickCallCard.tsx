// A call between the big moments (crew-chief spec D3, race engineer spec): the engineer or the
// driver asks; you have a few seconds while the race runs on. A battle is red and runs the lap
// in slow motion. Number keys answer. No answer: no change, or the driver's own move.

import { useEffect, useRef } from 'react';
import { named, surname } from '../data/names.js';
import type { QuickCall } from '../game/quickCalls.js';
import { FlagIcon, HeadsetIcon, OvertakeIcon } from './Icons.js';

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
    ? `Battle${call.other ? ` with ${surname(call.other)}` : ''} · slow motion`
    : call.kind === 'trouble'
      ? 'Trouble'
      : call.kind === 'request'
        ? `${named(call.from)} is asking`
        : `${call.from === 'Engineer' ? 'Engineer' : `${named(call.from)} on the radio`} · quick call`;
  const TagIcon = battle ? OvertakeIcon : call.kind === 'trouble' ? FlagIcon : HeadsetIcon;
  return (
    <section
      aria-label={battle ? 'Battle call' : 'Quick call'}
      className="quick-call card flex flex-col gap-3"
      style={{ borderColor: accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="eyebrow flex items-center gap-1.5"
          style={{ color: battle ? 'var(--box-ink)' : accent }}
        >
          <TagIcon size={14} /> {tag}
        </span>
        <span className="eyebrow">Lap {call.lap + 1}</span>
      </div>
      <p className="m-0 text-[15px] font-semibold leading-snug">
        {call.from !== 'Engineer' && (
          <span className="mr-1 text-[var(--muted)]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {call.stats && (
        <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {call.stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="eyebrow">{s.label}</dt>
              <dd className="m-0 font-semibold">{named(s.value)}</dd>
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
            <span>{named(o.label)}</span>
            {o.note && <span className="text-[11px] font-medium opacity-70">{named(o.note)}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
