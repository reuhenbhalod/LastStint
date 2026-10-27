// The day boundary (Phase 4 spec B1): each player's local midnight, as in Wordle. A date is
// playable while it is "today" somewhere on Earth, from UTC+14 (first) to UTC-12 (last).

const HOUR = 3_600_000;
/** A run may be submitted this long after its date stops being today everywhere. */
export const SUBMIT_GRACE_HOURS = 6;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The dates that are "today" somewhere right now: [earliest, latest]. */
export function playableDates(now: number): { first: string; last: string } {
  return { first: utcDate(now - 12 * HOUR), last: utcDate(now + 14 * HOUR) };
}

export function isPlayable(date: string, now: number): boolean {
  const { first, last } = playableDates(now);
  return date >= first && date <= last;
}

/** Playable, or ended within the submission grace period (a race finished after midnight). */
export function isSubmittable(date: string, now: number): boolean {
  return isPlayable(date, now) || isPlayable(date, now - SUBMIT_GRACE_HOURS * HOUR);
}

export function addDays(date: string, days: number): string {
  return utcDate(new Date(`${date}T00:00:00Z`).getTime() + days * 24 * HOUR);
}

export function todayUtc(now: number): string {
  return utcDate(now);
}
