// How to play opens on its own for a signed-out player every time, and for a signed-in one
// only once: the first time after the account is created (signing in again, or on another
// device, it doesn't; the How to play link is always there). The "show it once" mark is kept
// per account in this browser; storage can be missing (private mode), so every use is guarded.

const key = (playerId: string) => `pitwall:howto-pending:${playerId}`;

/** A new account: show how to play the next time the race card shows. */
export function markHowToPending(playerId: string): void {
  try {
    localStorage.setItem(key(playerId), '1');
  } catch {
    // no storage: the walkthrough just won't open on its own
  }
}

/** Whether the account still has its first walkthrough to see; seeing it clears the mark. */
export function takeHowToPending(playerId: string): boolean {
  try {
    const pending = localStorage.getItem(key(playerId)) === '1';
    if (pending) localStorage.removeItem(key(playerId));
    return pending;
  } catch {
    return false;
  }
}
