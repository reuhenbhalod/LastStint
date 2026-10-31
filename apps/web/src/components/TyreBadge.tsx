// Tyre compound shown as a coloured ring with a letter (so colour is never the only signal)
// plus its age in laps.

const COMPOUND: Record<string, { letter: string; ring: string; text: string }> = {
  SOFT: { letter: 'S', ring: 'border-red-500', text: 'text-red-400' },
  MEDIUM: { letter: 'M', ring: 'border-yellow-400', text: 'text-yellow-300' },
  HARD: { letter: 'H', ring: 'border-neutral-300', text: 'text-neutral-100' },
  INTERMEDIATE: { letter: 'I', ring: 'border-green-500', text: 'text-green-400' },
  WET: { letter: 'W', ring: 'border-blue-500', text: 'text-blue-400' },
};

export function TyreBadge({ compound, age }: { compound: string; age: number }) {
  const c = COMPOUND[compound] ?? {
    letter: compound[0] ?? '?',
    ring: 'border-neutral-500',
    text: 'text-neutral-300',
  };
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${c.ring} ${c.text} font-bold`}
      >
        {c.letter}
      </span>
      <span className="text-neutral-400">{age}</span>
    </span>
  );
}
