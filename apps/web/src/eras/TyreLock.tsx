// The 2005 tyre lock (`rules.tyreChanges` false): a small padlock by a tyre badge, and the line
// the pit stop section shows. A stop keeps the dry set; only damage or the weather changes it.

import { tyreName } from '../game/choices.js';

/** A padlock drawn in the text colour (no emoji), labelled for screen readers. */
export function TyreLockMark({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Tyres locked: no tyre changes"
      className="inline-block shrink-0 text-[var(--muted)]"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** The pit section's notice: what a stop does in a race without tyre changes. */
export function TyreLockNotice({ locked }: { locked: string }) {
  return (
    <p
      role="note"
      className="m-0 flex items-center gap-1.5 text-[12px] leading-snug text-[var(--muted)]"
    >
      <TyreLockMark />
      No tyre changes this year: a stop keeps the {tyreName(locked).toLowerCase()}. Only damage or
      the weather changes them.
    </p>
  );
}
