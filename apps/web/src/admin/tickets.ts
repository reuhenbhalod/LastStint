// The admin ticket tracker's data (TicketsPage.tsx): what a ticket is, the admin API calls
// (apps/worker/src/tickets.ts, through adminCall), and how the page groups and filters them.
// The enums and limits copy apps/worker/src/ticketFields.ts; keep the two in step.

import { ApiError } from '../api.js';
import { adminCall } from './session.js';

export const CATEGORIES = ['bug', 'feature', 'ui', 'content', 'question', 'other'] as const;
export const STATUSES = ['open', 'in_progress', 'done'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  bug: 'Bug',
  feature: 'Feature',
  ui: 'UI',
  content: 'Content',
  question: 'Question',
  other: 'Other',
};

export const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
};

/** Longest accepted value of each text field (characters). */
export const LIMITS = { title: 200, description: 10_000, notes: 10_000, source: 500 } as const;

/** A ticket as the API returns it. Times are Unix milliseconds. */
export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: Category;
  status: Status;
  notes: string;
  source: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/** The fields the page sets (source comes from the seed file and isn't edited here). */
export type TicketFields = Pick<Ticket, 'title' | 'description' | 'category' | 'status' | 'notes'>;

export async function listTickets(): Promise<Ticket[]> {
  return (await adminCall<{ tickets: Ticket[] }>('/api/admin/tickets')).tickets;
}

export async function createTicket(fields: TicketFields): Promise<Ticket> {
  return (await adminCall<{ ticket: Ticket }>('/api/admin/tickets', fields)).ticket;
}

export async function updateTicket(id: number, changes: Partial<TicketFields>): Promise<Ticket> {
  return (await adminCall<{ ticket: Ticket }>(`/api/admin/tickets/${id}`, changes, 'PATCH')).ticket;
}

export async function deleteTicket(id: number): Promise<void> {
  await adminCall<{ ok: true }>(`/api/admin/tickets/${id}`, undefined, 'DELETE');
}

/** A failed call, for the page's banner. */
export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return String((e as Error)?.message ?? e);
  if (e.status === 0) return 'Couldn’t reach the server. Check your connection.';
  if (e.status === 401) return 'Your sign-in has expired. Sign out and sign in again.';
  if (e.status === 404 && e.code === 'not-found') {
    return 'That ticket is gone (deleted elsewhere?). Reload to refresh the list.';
  }
  return e.detail ? `${e.detail} (${e.status})` : `The server said ${e.code} (${e.status}).`;
}

/** Does the ticket match the search (title, description, notes, source or #id)? */
export function matches(t: Ticket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [t.title, t.description, t.notes, t.source, `#${t.id}`].some((s) =>
    s.toLowerCase().includes(q),
  );
}

const STATUS_ORDER: Record<Status, number> = { in_progress: 0, open: 1, done: 2 };

/**
 * The tickets the page shows: those in `category` (or all) matching `query`. Open and
 * in-progress ones grouped by category (in CATEGORIES order, empty groups left out; in
 * progress first, then newest), and the done ones, most recently completed first.
 */
export function arrange(
  tickets: readonly Ticket[],
  category: Category | 'all',
  query: string,
): { groups: Array<{ category: Category; tickets: Ticket[] }>; done: Ticket[] } {
  const shown = tickets.filter(
    (t) => (category === 'all' || t.category === category) && matches(t, query),
  );
  const groups = CATEGORIES.map((c) => ({
    category: c,
    tickets: shown
      .filter((t) => t.category === c && t.status !== 'done')
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt - a.createdAt),
  })).filter((g) => g.tickets.length > 0);
  const done = shown
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return { groups, done };
}
