// The announcement banner's data (docs/admin-v2-spec.md A8): the current one from
// GET /api/announcement, and which ones this browser has dismissed (their ids, in localStorage).

import { apiGet } from '../api.js';

export interface Announcement {
  id: number;
  text: string;
  tone: 'info' | 'warning';
  endsAt: string | null;
}

const KEY = 'laststint:announcements-dismissed';
/** Only the most recent dismissals are kept. */
const KEEP = 20;

/** The current announcement, or null (none, or the server couldn't be reached). */
export async function fetchAnnouncement(): Promise<Announcement | null> {
  try {
    const r = await apiGet<{ announcement: Announcement | null }>('/api/announcement');
    return r.announcement ?? null;
  } catch {
    return null;
  }
}

/** The ids this browser has dismissed. */
export function dismissedIds(raw: string | null): number[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** The list after dismissing `id` (newest last, at most KEEP). */
export function withDismissed(ids: number[], id: number): number[] {
  return [...ids.filter((n) => n !== id), id].slice(-KEEP);
}

/** Show it: it exists, hasn't ended, and wasn't dismissed here. */
export function shouldShow(a: Announcement | null, dismissed: number[], now: number): boolean {
  if (!a) return false;
  if (a.endsAt && Date.parse(a.endsAt) <= now) return false;
  return !dismissed.includes(a.id);
}

export function readDismissed(): number[] {
  try {
    return dismissedIds(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function dismiss(id: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(withDismissed(readDismissed(), id)));
  } catch {
    // storage blocked: it stays hidden for this page only
  }
}
