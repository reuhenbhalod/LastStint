// What a ticket is (the admin ticket tracker, src/tickets.ts), and the check every new or
// changed ticket goes through: the API's and the seed script's (scripts/tickets-seed-sql.ts).
// No Worker or Node APIs here, so both can use it. The enums match the CHECK constraints in
// migrations/0006_tickets.sql; the web app's copy is apps/web/src/admin/tickets.ts.

export const CATEGORIES = ['bug', 'feature', 'ui', 'content', 'question', 'other'] as const;
export const STATUSES = ['open', 'in_progress', 'done'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];

/** Longest accepted value of each text field (characters). */
export const LIMITS = {
  title: 200,
  description: 10_000,
  notes: 10_000,
  source: 500,
  assignee: 254,
} as const;

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

/** The fields a client can set (POST needs title and category; PATCH takes any of them). */
export interface TicketInput {
  title: string;
  description: string;
  category: Category;
  status: Status;
  notes: string;
  source: string;
  /** An admin's email, or '' to unassign. The API checks it against ADMIN_EMAILS. */
  assignee: string;
}

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

export function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

const FIELDS = [
  'title',
  'description',
  'category',
  'status',
  'notes',
  'source',
  'assignee',
] as const;

/**
 * Check a ticket body: an object with only known fields, each of the right type and length.
 * `full` (create): title and category are required. Returns the fields (title trimmed) or an
 * error message.
 */
export function parseTicketInput(
  body: unknown,
  full: boolean,
): { ok: true; value: Partial<TicketInput> } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const raw = body as Record<string, unknown>;
  const unknownKey = Object.keys(raw).find((k) => !(FIELDS as readonly string[]).includes(k));
  if (unknownKey) return { ok: false, error: `unknown field: ${unknownKey}` };

  const value: Partial<TicketInput> = {};
  for (const field of ['title', 'description', 'notes', 'source'] as const) {
    const v = raw[field];
    if (v === undefined) continue;
    if (typeof v !== 'string') return { ok: false, error: `${field} must be a string` };
    const s = field === 'title' ? v.trim() : v;
    if (s.length > LIMITS[field]) {
      return { ok: false, error: `${field} is longer than ${LIMITS[field]} characters` };
    }
    value[field] = s;
  }
  if (raw.assignee !== undefined) {
    if (typeof raw.assignee !== 'string') return { ok: false, error: 'assignee must be a string' };
    const a = raw.assignee.trim().toLowerCase();
    if (a.length > LIMITS.assignee) {
      return { ok: false, error: `assignee is longer than ${LIMITS.assignee} characters` };
    }
    value.assignee = a;
  }
  if (value.title !== undefined && value.title === '') {
    return { ok: false, error: 'title must not be empty' };
  }
  if (raw.category !== undefined) {
    if (!isCategory(raw.category)) {
      return { ok: false, error: `category must be one of ${CATEGORIES.join(', ')}` };
    }
    value.category = raw.category;
  }
  if (raw.status !== undefined) {
    if (!isStatus(raw.status)) {
      return { ok: false, error: `status must be one of ${STATUSES.join(', ')}` };
    }
    value.status = raw.status;
  }
  if (full) {
    if (value.title === undefined) return { ok: false, error: 'title is required' };
    if (value.category === undefined) return { ok: false, error: 'category is required' };
  } else if (Object.keys(value).length === 0) {
    return { ok: false, error: 'nothing to change' };
  }
  return { ok: true, value };
}
