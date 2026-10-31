// The anonymous player ID (docs/api.md step 1): a UUID made on first visit and kept in
// localStorage. It is the player's only identity; storage being unavailable just means a new
// ID per visit.

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

/** The player's local calendar date (a daily changes at the player's own midnight). */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
