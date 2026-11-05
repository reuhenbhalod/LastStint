// Calls to the tickets API (same origin; in dev Vite forwards /api to the local Worker).

import type { Ticket, TicketInput } from '../shared/tickets.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ? `${detail} (${status})` : `The server said ${code} (${status}).`);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', 'Couldn’t reach the server. Check your connection');
  }
  if (res.ok) return res.json() as Promise<T>;
  let code = 'http-error';
  let detail: string | undefined;
  try {
    const err = (await res.json()) as { error?: string; detail?: string };
    code = err.error ?? code;
    detail = err.detail;
  } catch {
    // not JSON
  }
  throw new ApiError(res.status, code, detail);
}

export async function listTickets(): Promise<Ticket[]> {
  return (await call<{ tickets: Ticket[] }>('GET', '/api/tickets')).tickets;
}

export async function createTicket(input: Partial<TicketInput>): Promise<Ticket> {
  return (await call<{ ticket: Ticket }>('POST', '/api/tickets', input)).ticket;
}

export async function updateTicket(id: number, changes: Partial<TicketInput>): Promise<Ticket> {
  return (await call<{ ticket: Ticket }>('PATCH', `/api/tickets/${id}`, changes)).ticket;
}

export async function deleteTicket(id: number): Promise<void> {
  await call<{ ok: true }>('DELETE', `/api/tickets/${id}`);
}
