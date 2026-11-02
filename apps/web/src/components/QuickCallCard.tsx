// A quick call (crew-chief spec D3): the engineer or driver asks; you have a few seconds while
// the race runs on. Number keys answer. No answer means no change.

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

  return (
    <section
      aria-label="Quick call"
      className="quick-call card flex flex-col gap-3 border-[var(--you)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow !text-[var(--you)]">
          📻 {call.from === 'Engineer' ? 'Engineer' : `${call.from} on the radio`} · quick call
        </span>
        <span className="eyebrow">Lap {call.lap + 1}</span>
      </div>
      <p className="m-0 text-[15px] font-semibold leading-snug">{call.text}</p>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--card-2)]">
        <div
          className="quick-timer h-full bg-[var(--you)]"
          style={{ animationDuration: `${ms}ms` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {call.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onAnswer(o.id)}
            className="relative min-h-[48px] rounded-lg border-2 border-transparent bg-[var(--ink)] px-3 py-2 text-center font-bold text-[var(--paper)] hover:border-[var(--you)] focus-visible:border-[var(--you)] focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className="mono absolute left-2.5 top-1.5 text-[10px] opacity-60"
            >
              {i + 1}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
