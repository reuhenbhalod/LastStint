// The driver's replies to your live calls: "Copy" or a refusal (game/refusal.ts). Newest first.

import { named } from '../data/names.js';
import type { RadioMessage } from '../state/machine.js';

export function RadioLog({ messages, max = 3 }: { messages: RadioMessage[]; max?: number }) {
  if (!messages.length) return null;
  return (
    <ul aria-live="polite" className="m-0 flex list-none flex-col p-0">
      {[...messages]
        .reverse()
        .slice(0, max)
        .map((m, i) => (
          <li
            key={`${m.lap}-${m.text}-${messages.length - i}`}
            className={`flex flex-col gap-0.5 border-l-[3px] py-1.5 pl-2.5 text-[13px] leading-snug ${
              m.refused
                ? 'border-[var(--box)]'
                : i === 0
                  ? 'border-[var(--you)]'
                  : 'border-[#2A302E]'
            } ${i > 0 ? 'text-[#B7BEBA]' : ''}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8D9692]">
              <span className="mono">L{m.lap}</span> · {named(m.from)}
              {m.refused && <span className="text-[var(--box-ink)]"> · refused</span>}
            </span>
            <span>“{named(m.text)}”</span>
          </li>
        ))}
    </ul>
  );
}
