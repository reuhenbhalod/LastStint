// Tickets in D1. Every query is parameterised; the only SQL built at run time is the SET list
// of an update, and its column names come from a fixed list, never from the request.

import type { Category, Status, Ticket, TicketInput } from '../shared/tickets.js';

interface Row {
  id: number;
  title: string;
  description: string;
  category: Category;
  status: Status;
  notes: string;
  source: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

function toTicket(r: Row): Ticket {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    notes: r.notes,
    source: r.source,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}

/** Every ticket, newest first (the app groups and filters them). */
export async function listTickets(db: D1Database): Promise<Ticket[]> {
  const { results } = await db
    .prepare('SELECT * FROM tickets ORDER BY created_at DESC, id DESC')
    .all<Row>();
  return results.map(toTicket);
}

export async function createTicket(
  db: D1Database,
  input: Pick<TicketInput, 'title' | 'category'> & Partial<TicketInput>,
  now: number,
): Promise<Ticket> {
  const status = input.status ?? 'open';
  // created_by keeps its '' default: there's no sign-in yet to fill it.
  const row = await db
    .prepare(
      `INSERT INTO tickets (title, description, category, status, notes, source,
                            created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      input.title,
      input.description ?? '',
      input.category,
      status,
      input.notes ?? '',
      input.source ?? '',
      now,
      now,
      status === 'done' ? now : null,
    )
    .first<Row>();
  if (!row) throw new Error('insert returned no row');
  return toTicket(row);
}

const COLUMNS = ['title', 'description', 'category', 'status', 'notes', 'source'] as const;

/**
 * Change some of a ticket's fields; null if there's no such ticket. A status change to done
 * stamps completed_at (kept if it was already done); any other status clears it.
 */
export async function updateTicket(
  db: D1Database,
  id: number,
  changes: Partial<TicketInput>,
  now: number,
): Promise<Ticket | null> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const col of COLUMNS) {
    const v = changes[col];
    if (v === undefined) continue;
    sets.push(`${col} = ?`);
    values.push(v);
  }
  if (changes.status !== undefined) {
    sets.push(
      "completed_at = CASE WHEN ? = 'done' THEN CASE WHEN status = 'done' THEN completed_at ELSE ? END ELSE NULL END",
    );
    values.push(changes.status, now);
  }
  sets.push('updated_at = ?');
  values.push(now);
  const row = await db
    .prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values, id)
    .first<Row>();
  return row ? toTicket(row) : null;
}

/** Delete a ticket; false if there was no such ticket. */
export async function deleteTicket(db: D1Database, id: number): Promise<boolean> {
  const res = await db.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
  return res.meta.changes > 0;
}
