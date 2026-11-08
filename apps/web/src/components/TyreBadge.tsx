// Tyre compound as a coloured ring with a letter (so colour is never the only signal), plus
// its age in laps. By era (eras build plan 8.5, from the race's rules through RaceEraContext):
// a race with no compound rule shows its dry tyre as one "D" (Dry), and a race without tyre
// changes adds a padlock to the dry set. Outside Eras it reads as it always has.

import { isWetTyre } from '@laststint/sim';
import { useRaceEra } from '../eras/RaceEraContext.js';
import { TyreLockMark } from '../eras/TyreLock.js';

const LETTER: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
};

export function TyreBadge({ compound, age }: { compound: string; age: number }) {
  const era = useRaceEra();
  const dry = !isWetTyre(compound);
  const single = era.tyres === 'single-dry' && dry;
  return (
    <span className="inline-flex items-center gap-1.5">
      {single ? (
        <span className="tyre DRY" title="Dry">
          D
        </span>
      ) : (
        <span className={`tyre ${compound}`}>{LETTER[compound] ?? compound[0] ?? '?'}</span>
      )}
      {era.lockedTyre !== null && dry && <TyreLockMark />}
      <span className="mono text-[11px] text-[var(--muted)]">{age}</span>
    </span>
  );
}
