// The driver's replies to your live calls: "Copy" or a refusal (game/refusal.ts). Newest first.

import type { RadioMessage } from '../state/machine.js';

export function RadioLog({ messages, max = 3 }: { messages: RadioMessage[]; max?: number }) {
  if (!messages.length) return null;
  return (
    <ul aria-live="polite" className="m-0 flex list-none flex-col gap-1.5 p-0">
      {[...messages]
        .reverse()
        .slice(0, max)
        .map((m, i) => (
          <li
            key={`${m.lap}-${m.text}-${messages.length - i}`}
            className={`rounded-lg border-l-4 px-2.5 py-1.5 text-[13px] leading-snug ${
              m.refused
                ? 'border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_14%,transparent)]'
                : 'border-[var(--you)] bg-[var(--card-2)]'
            } ${i > 0 ? 'opacity-70' : ''}`}
          >
            <span className="mono mr-1.5 text-[11px] text-[var(--muted)]">
              L{m.lap} {m.from}
            </span>
            {m.refused && <strong className="mr-1 text-[var(--box)]">Refused:</strong>}“{m.text}”
          </li>
        ))}
    </ul>
  );
}
