// A call between the big moments (crew-chief spec D3, race engineer spec): the engineer or the
// driver asks, the race runs on in slow motion, and after a moment to read it you have a few
// seconds to answer. Number keys answer. No answer: no change, or the driver's own move.

import { useEffect, useRef } from 'react';
import { named, surname } from '../data/names.js';
import type { QuickCall } from '../game/quickCalls.js';
import { FlagIcon, HeadsetIcon, OvertakeIcon } from './Icons.js';

export function QuickCallCard({
  call,
  ms,
  read = 0,
  onAnswer,
  onTimeout,
}: {
  call: QuickCall;
  /** How long there is to answer, once the reading time is up. */
  ms: number;
  /** Time to read the call before its clock starts (the bar stays full). */
  read?: number;
  onAnswer: (optionId: string) => void;
  onTimeout: () => void;
}) {
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  useEffect(() => {
    const id = setTimeout(() => timeout.current(), read + ms);
    return () => clearTimeout(id);
  }, [ms, read]);
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
      className="quick-call call-plate"
      style={{ '--accent': battle ? 'var(--box-ink)' : accent } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="call-tag">
          <TagIcon size={14} /> {tag}
        </span>
        <span className="call-tag !text-[#8D9692]">Lap {call.lap + 1}</span>
      </div>
      <p className="m-0 text-[16px] font-bold leading-snug text-white md:text-[18px]">
        {call.from !== 'Engineer' && (
          <span className="mr-1 font-semibold text-[#8D9692]">{named(call.from)}:</span>
        )}
        {named(call.text)}
      </p>
      {call.stats && (
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
      <div className="h-1 overflow-hidden bg-[#232927]">
        <div
          className="quick-timer h-full"
          style={{ animationDuration: `${ms}ms`, animationDelay: `${read}ms`, background: accent }}
        />
      </div>
      <div
        className={`grid gap-2 ${call.options.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}
      >
        {call.options.map((o, i) => (
          <button key={o.id} type="button" onClick={() => onAnswer(o.id)} className="call-opt">
            <span className="flex w-full items-center justify-between gap-2">
              <span className="label">{named(o.label)}</span>
              <span aria-hidden="true" className="call-key">
                {i + 1}
              </span>
            </span>
            {o.note && <span className="note">{named(o.note)}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
