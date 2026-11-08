// Tyre compound as a coloured ring with a letter (so colour is never the only signal), plus
// its age in laps (or, in Eras below Full information, the range it's in: `ageText`).

const LETTER: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
};

export function TyreBadge({
  compound,
  age,
  ageText,
}: {
  compound: string;
  age: number;
  /** The age as the information level shows it ("15–20"); the exact age otherwise. */
  ageText?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`tyre ${compound}`}>{LETTER[compound] ?? compound[0] ?? '?'}</span>
      <span className="mono text-[11px] text-[var(--muted)]">{ageText ?? age}</span>
    </span>
  );
}
