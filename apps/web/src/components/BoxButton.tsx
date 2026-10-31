// BOX: always live. Press to open a compound picker; picking books a pit for the next lap.

import { useState } from 'react';

export function BoxButton({
  compounds,
  disabled,
  onBox,
}: {
  compounds: string[];
  disabled: boolean;
  onBox: (compound: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="flex gap-2">
        {compounds.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onBox(c);
              setOpen(false);
            }}
            className="flex-1 rounded-lg bg-neutral-100 py-3 font-bold text-neutral-900"
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-neutral-700 px-3 text-neutral-400"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className="w-full rounded-lg bg-red-600 py-3 font-bold uppercase tracking-widest text-white disabled:opacity-40"
    >
      Box
    </button>
  );
}
