// What the race screen shows at each Eras information level (eras spec §7, "Information
// levels"). Full is the race screen as it is for every other mode; each level below it takes
// something away, and each keeps everything the level above it hides:
//
// - Full: exact gaps, the gap trend graph, exact tyre ages for all cars, the rival's compound.
// - Reduced: no gap trend graph, and every other car's tyre age as a range on multiples of the
//   eras config's `tyreAgeRangeLaps` (5: "15–20 laps"; decided Nov 7).
// - Limited: as Reduced, plus the rival's fuel load hidden in refuelling eras, and gaps
//   rounded to 0.5 s.
// - Minimal: as Limited (decided Nov 7), plus gaps to the cars directly ahead and behind only,
//   updated once per lap.
//
// No level hides your own car's facts (its tyre age stays exact), the compounds, or the order.
// The race screen passes the view to every place a gap or a tyre age shows: the standings,
// the leaders, the driver card, the car stats, the big call and the engineer's radio. Without
// one (every mode but Eras) each shows exactly what it always has.

import { type InformationLevel, TYRE_AGE_RANGE_LAPS } from '@laststint/sim';

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
  /** Other cars' tyre ages show as ranges this many laps wide, or exact (null). */
  tyreAgeRange: number | null;
}

const VIEWS: Record<InformationLevel, InformationView> = {
  full: {
    level: 'full',
    gapTrace: true,
    gapStep: null,
    adjacentGapsOnly: false,
    liveStandings: true,
    rivalFuel: true,
    tyreAgeRange: null,
  },
  reduced: {
    level: 'reduced',
    gapTrace: false,
    gapStep: null,
    adjacentGapsOnly: false,
    liveStandings: true,
    rivalFuel: true,
    tyreAgeRange: TYRE_AGE_RANGE_LAPS,
  },
  limited: {
    level: 'limited',
    gapTrace: false,
    gapStep: GAP_STEP_SECONDS,
    adjacentGapsOnly: false,
    liveStandings: true,
    rivalFuel: false,
    tyreAgeRange: TYRE_AGE_RANGE_LAPS,
  },
  minimal: {
    level: 'minimal',
    gapTrace: false,
    gapStep: GAP_STEP_SECONDS,
    adjacentGapsOnly: true,
    liveStandings: false,
    rivalFuel: false,
    tyreAgeRange: TYRE_AGE_RANGE_LAPS,
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

/** A tyre age as the level shows it: exact for your own car (`own`) and at Full; otherwise
 * the range it falls in, on multiples of the range's width (5: 17 laps is "15–20"). */
export function tyreAgeText(view: InformationView, age: number, own: boolean): string {
  const w = view.tyreAgeRange;
  if (own || !w) return String(age);
  const lo = Math.floor(Math.max(0, age) / w) * w;
  return `${lo}–${lo + w}`;
}

/**
 * At Minimal, the one gap a car's row in the standings shows: your row, the gap to the car
 * directly ahead of you; the car directly behind, its gap to you (both as intervals, ≥ 0);
 * every other row none (null). Null too when either car's time isn't known (out of the race).
 */
export function intervalToYou(
  order: readonly string[],
  userSide: string,
  code: string,
  time: (code: string) => number | null,
): number | null {
  const { ahead, behind } = neighbours(order, userSide);
  const pair =
    code === userSide && ahead ? [ahead, userSide] : code === behind ? [userSide, code] : null;
  if (!pair) return null;
  const a = time(pair[0] as string);
  const b = time(pair[1] as string);
  return a === null || b === null ? null : b - a;
}
