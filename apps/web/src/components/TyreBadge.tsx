// Tyre compound as a coloured ring with a letter (so colour is never the only signal), plus
// its age in laps.

const LETTER: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
};

export function TyreBadge({ compound, age }: { compound: string; age: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`tyre ${compound}`}>{LETTER[compound] ?? compound[0] ?? '?'}</span>
      <span className="mono text-[11px] text-[var(--muted)]">{age}</span>
    </span>
  );
}
