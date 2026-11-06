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
  /** The admin working on it (their email), or '' when unassigned. */
  assignee: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/** The fields the page sets (source comes from the seed file and isn't edited here). */
export type TicketFields = Pick<
  Ticket,
  'title' | 'description' | 'category' | 'status' | 'notes' | 'assignee'
>;

/** The list, the admins a ticket can be assigned to, and the signed-in admin's email. */
export interface TicketList {
  tickets: Ticket[];
  admins: string[];
  me: string;
}

export async function listTickets(): Promise<TicketList> {
  return adminCall<TicketList>('/api/admin/tickets');
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

/** Whose tickets to show: everyone's, the signed-in admin's, or nobody's yet. */
export type Owner = 'all' | 'mine' | 'unassigned';

/** A readable name from an email: "purohit.abhiram@…" -> "Purohit Abhiram". */
export function personName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** One or two letters for an avatar. */
export function initials(email: string): string {
  const [first = '', second = ''] = personName(email).split(' ');
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}

/** "You" for the signed-in admin, their name for anyone else, "Unassigned" for nobody. */
export function assigneeLabel(assignee: string, me: string): string {
  if (!assignee) return 'Unassigned';
  return assignee === me ? 'You' : personName(assignee);
}

function ownedBy(t: Ticket, owner: Owner, me: string): boolean {
  if (owner === 'mine') return t.assignee === me;
  if (owner === 'unassigned') return t.assignee === '';
  return true;
}

/** Does the ticket match the search (title, description, notes, source or #id)? */
export function matches(t: Ticket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const who = t.assignee ? [t.assignee, personName(t.assignee)] : [];
  return [t.title, t.description, t.notes, t.source, `#${t.id}`, ...who].some((s) =>
    s.toLowerCase().includes(q),
  );
}

const STATUS_ORDER: Record<Status, number> = { in_progress: 0, open: 1, done: 2 };

/**
 * The tickets the page shows: those in `category` (or all), owned per `owner`, matching
 * `query`. Open and
 * in-progress ones grouped by category (in CATEGORIES order, empty groups left out; in
 * progress first, then newest), and the done ones, most recently completed first.
 */
export function arrange(
  tickets: readonly Ticket[],
  category: Category | 'all',
  query: string,
  owner: Owner = 'all',
  me = '',
): { groups: Array<{ category: Category; tickets: Ticket[] }>; done: Ticket[] } {
  const shown = tickets.filter(
    (t) =>
      (category === 'all' || t.category === category) && ownedBy(t, owner, me) && matches(t, query),
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
