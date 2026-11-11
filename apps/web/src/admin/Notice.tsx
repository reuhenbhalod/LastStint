// The admin tabs' shared bits: an error or note line, a stat tile, a section heading, and a
// hook that runs a change and reports how it went.

import { type ReactNode, useCallback, useState } from 'react';
import { errorText } from './tickets.js';

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="m-0 rounded-lg border border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_12%,transparent)] px-3 py-2 text-[14px]">
      {text}
    </p>
  );
}

export function NoteLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="m-0 rounded-lg border border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_12%,transparent)] px-3 py-2 text-[14px]">
      {text}
    </p>
  );
}

export function Tile({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className={`card flex flex-col gap-1 ${warn ? '!border-[var(--flag)]' : ''}`}>
      <dt className="text-[12px] text-[var(--muted)]">{label}</dt>
      <dd className={`disp m-0 text-[22px] leading-tight ${warn ? 'text-[var(--flag)]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

export function Heading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="disp m-0 text-[20px] leading-none">{children}</h2>
      {right}
    </div>
  );
}

/**
 * Run a change: busy while it runs, then its note (or the error), then `after` (a reload).
 * The change returns the note to show.
 */
export function useAction(after?: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (f: () => Promise<string>) => {
      setBusy(true);
      setNote(null);
      setError(null);
      try {
        setNote(await f());
        await after?.();
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    },
    [after],
  );
  return { busy, note, error, setError, run };
}
