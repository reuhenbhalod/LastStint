// BOX: always live. Press it, then pick the tyres; that books a stop at the end of this lap,
// shown straight away until the car comes in.

import { useState } from 'react';
import { tyreName } from '../game/choices.js';

const LETTER: Record<string, string> = { SOFT: 'S', MEDIUM: 'M', HARD: 'H' };

export function BoxButton({
  compounds,
  booked,
  disabled,
  onBox,
}: {
  compounds: string[];
  /** The compound of a stop booked for the end of this lap, if any. */
  booked?: string | null;
  disabled: boolean;
  onBox: (compound: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (booked) {
    return (
      <output className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--box)] py-3 font-bold text-[var(--ink)]">
        <span className={`tyre ${booked} bg-[var(--tarmac)]`}>{LETTER[booked] ?? booked[0]}</span>
        Boxing this lap · {tyreName(booked)}
      </output>
    );
  }

  if (open) {
    return (
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Box this lap: which tyres?</p>
        <div className="flex gap-2">
          {compounds.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onBox(c);
                setOpen(false);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--ink)] py-3 font-bold text-[var(--paper)] hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--you)]"
            >
              <span className={`tyre ${c} bg-[var(--tarmac)]`}>{LETTER[c] ?? c[0]}</span>
              {tyreName(c)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cancel"
            className="rounded-lg border border-[var(--rule)] px-3 text-[var(--muted)]"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className="disp wide w-full rounded-lg bg-[var(--box)] py-3 text-[22px] leading-none tracking-[0.12em] text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
    >
      Box
    </button>
  );
}
