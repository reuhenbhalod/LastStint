// What the race screen shows at each Eras information level (eras spec §7, "Information
// levels"). Full is the race screen as it is for every other mode; each level below it takes
// something away:
//
// - Full: exact gaps, the gap trend graph, exact tyre ages for all cars, the rival's compound.
// - Reduced: no gap trend graph. TODO(eras 8.6): the rival's tyre age as a range ("15–20
//   laps") isn't built: the spec doesn't give the range's width or say which cars it covers,
//   and the width is a tunable that belongs in the eras config (packages/sim).
// - Limited: as Reduced, plus the rival's fuel load hidden in refuelling eras, and gaps
//   rounded to 0.5 s.
// - Minimal: gaps to the cars directly ahead and behind only, updated once per lap. Taken as
//   Limited plus that (the spec doesn't say "as Limited"; difficulty only rises with play
//   order, so nothing Limited hides comes back).
//
// No level hides your own car's facts, the rival's compound, or the order.

import type { InformationLevel } from '@laststint/sim';

/** Limited and Minimal round gaps to this many seconds. */
export const GAP_STEP_SECONDS = 0.5;

export interface InformationView {
  level: InformationLevel;
  /** The gap trend graph. */
  gapTrace: boolean;
  /** Gaps are rounded to this many seconds, or exact (null). */
  gapStep: number | null;
  /** Only the gaps to the cars directly ahead and behind are shown. */
  adjacentGapsOnly: boolean;
  /** The standings follow the map while the lap runs (otherwise they change once per lap). */
  liveStandings: boolean;
  /** The rival's fuel load (refuelling eras; the fuel gauge comes in build plan 8.5). */
  rivalFuel: boolean;
}

const VIEWS: Record<InformationLevel, InformationView> = {
  full: {
    level: 'full',
    gapTrace: true,
    gapStep: null,
    adjacentGapsOnly: false,
    liveStandings: true,
    rivalFuel: true,
  },
  reduced: {
    level: 'reduced',
    gapTrace: false,
    gapStep: null,
    adjacentGapsOnly: false,
    liveStandings: true,
    rivalFuel: true,
  },
  limited: {
    level: 'limited',
    gapTrace: false,
    gapStep: GAP_STEP_SECONDS,
    adjacentGapsOnly: false,
    liveStandings: true,
    rivalFuel: false,
  },
  minimal: {
    level: 'minimal',
    gapTrace: false,
    gapStep: GAP_STEP_SECONDS,
    adjacentGapsOnly: true,
    liveStandings: false,
    rivalFuel: false,
  },
};

/** Everything shown: every mode but Eras, and Eras at Full. */
export const FULL_INFORMATION: InformationView = VIEWS.full;

/** The view for a level; no level (not an Eras race) is Full. */
export function informationView(level?: InformationLevel): InformationView {
  return level ? VIEWS[level] : FULL_INFORMATION;
}

/** A gap as the level shows it (rounded at Limited and below). */
export function shownGap(view: InformationView, gap: number): number {
  const step = view.gapStep;
  return step ? Math.round(gap / step) * step : gap;
}

/** The cars directly ahead of and behind `code` in the race order. */
export function neighbours(
  order: readonly string[],
  code: string,
): { ahead: string | null; behind: string | null } {
  const i = order.indexOf(code);
  if (i < 0) return { ahead: null, behind: null };
  return { ahead: order[i - 1] ?? null, behind: order[i + 1] ?? null };
}

/** Whether the gap between your car and `other` is shown (at Minimal, only to the cars
 * either side of yours). */
export function gapShown(
  view: InformationView,
  order: readonly string[],
  userSide: string,
  other: string,
): boolean {
  if (!view.adjacentGapsOnly) return true;
  const n = neighbours(order, userSide);
  return other === n.ahead || other === n.behind;
}

/** A gap as text, signed (> 0: we're ahead), e.g. "+1.5s"; "-" for none. `unit` adds the "s". */
export function gapText(view: InformationView, gap: number | null, unit = true): string {
  if (gap === null) return '-';
  const g = shownGap(view, gap);
  return `${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(1)}${unit ? 's' : ''}`;
}
