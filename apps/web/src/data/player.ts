// The player ID (docs/api.md step 1): a UUID made on first visit and kept in localStorage.
// Signing in with Google swaps it for the account's player ID, so every signed-in browser plays
// as the same player (feedback spec D3); signing out starts a fresh anonymous ID. Storage being
// unavailable just means a new ID per visit.

const KEY = 'pitwall:anonId';

export function anonId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Play as the signed-in account from now on. */
export function adoptPlayerId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: the account applies to this page only
  }
}

/** Sign out: forget the account's ID and start a new anonymous one. */
export function resetPlayerId(): void {
  try {
    localStorage.setItem(KEY, crypto.randomUUID());
  } catch {
    // nothing stored to forget
  }
}

/** The player's local calendar date (a daily changes at the player's own midnight). */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
