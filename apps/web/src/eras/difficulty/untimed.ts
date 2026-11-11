// The "untimed" mark on an Eras attempt (eras spec §7): an attempt that shows a decision with
// the timer turned off still earns its stars, marked untimed. The mark is kept per attempt in
// this browser, so a reload mid-race keeps it, and turning the timer back on never clears it.
// The attempt's submission (build plan 7.3) and its results (8.7) read it with
// `attemptUntimed`.

const key = (attemptId: string) => `pitwall:eras-untimed:${attemptId}`;

// Marks made this page, for when storage is blocked.
const marked = new Set<string>();

function check(attemptId: string): void {
  if (!attemptId) throw new Error('untimed: an attempt id is required');
}

/** Mark the attempt untimed (a decision was shown with the timer off). */
export function markUntimed(attemptId: string): void {
  check(attemptId);
  marked.add(attemptId);
  try {
    localStorage.setItem(key(attemptId), '1');
  } catch {
    // storage blocked: the mark lasts this page
  }
}

/** Whether the attempt was played untimed. */
export function attemptUntimed(attemptId: string): boolean {
  check(attemptId);
  if (marked.has(attemptId)) return true;
  try {
    return localStorage.getItem(key(attemptId)) === '1';
  } catch {
    return false;
  }
}

/** Forget the mark (the attempt was submitted, or expired). */
export function clearUntimed(attemptId: string): void {
  check(attemptId);
  marked.delete(attemptId);
  try {
    localStorage.removeItem(key(attemptId));
  } catch {
    // nothing stored
  }
}

/** A decision was shown on the attempt: with the timer off, the attempt becomes untimed.
 * True only when this call marked it (so the race screen tells its owner once). */
export function noteDecisionShown(attemptId: string, timed: boolean): boolean {
  if (timed || attemptUntimed(attemptId)) return false;
  markUntimed(attemptId);
  return true;
}
