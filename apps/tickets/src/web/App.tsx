// The tracker: open and in-progress tickets grouped by category, then a collapsible Completed
// section. Filter by category, search the text, switch a ticket's status in place, and add,
// edit or delete tickets.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Status,
  type Ticket,
  type TicketInput,
} from '../shared/tickets.js';
import { Editor } from './Editor.js';
import { TicketCard } from './TicketCard.js';
import * as api from './api.js';
import { btn, primary } from './ui.js';

const STATUS_ORDER: Record<Status, number> = { in_progress: 0, open: 1, done: 2 };

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function matches(t: Ticket, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [t.title, t.description, t.notes, t.source, `#${t.id}`].some((s) =>
    s.toLowerCase().includes(q),
  );
}

export function App() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  // null: closed; 'new': a new ticket; a ticket: editing it.
  const [editing, setEditing] = useState<Ticket | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setTickets(await api.listTickets());
    } catch (e) {
      setLoadError(message(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (t: Ticket) =>
    setTickets((all) => (all ?? []).map((x) => (x.id === t.id ? t : x)));

  /** Run a change to one ticket, marking it busy and reporting a failure in the banner. */
  const withTicket = async (id: number, work: () => Promise<void>) => {
    setError(null);
    setBusy((b) => new Set(b).add(id));
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  };

  const setStatus = (t: Ticket, status: Status) =>
    withTicket(t.id, async () => replace(await api.updateTicket(t.id, { status })));

  const remove = (t: Ticket) =>
    withTicket(t.id, async () => {
      await api.deleteTicket(t.id);
      setTickets((all) => (all ?? []).filter((x) => x.id !== t.id));
    });

  const closeEditor = useCallback(() => {
    setEditing(null);
    setEditError(null);
  }, []);

  const save = async (fields: Omit<TicketInput, 'source'>) => {
    setSaving(true);
    setEditError(null);
    try {
      if (editing === 'new') {
        const t = await api.createTicket(fields);
        setTickets((all) => [t, ...(all ?? [])]);
      } else if (editing) {
        replace(await api.updateTicket(editing.id, fields));
      }
      setEditing(null);
    } catch (e) {
      setEditError(message(e));
    } finally {
      setSaving(false);
    }
  };

  const shown = useMemo(
    () =>
      (tickets ?? []).filter(
        (t) => (category === 'all' || t.category === category) && matches(t, query.trim()),
      ),
    [tickets, category, query],
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
  const filtering = category !== 'all' || query.trim() !== '';

  const card = (t: Ticket, showCategory: boolean) => (
    <TicketCard
      key={t.id}
      ticket={t}
      showCategory={showCategory}
      busy={busy.has(t.id)}
      onStatus={(s) => setStatus(t, s)}
      onEdit={() => setEditing(t)}
      onDelete={() => remove(t)}
    />
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="disp wide text-[22px] leading-none">
          BoxThisLap <span className="text-[var(--you)]">Tickets</span>
        </h1>
        <button
          type="button"
          className={primary}
          onClick={() => setEditing('new')}
          disabled={!tickets}
        >
          New ticket
        </button>
      </header>

      <div className="mt-4 space-y-3">
        <input
          type="search"
          placeholder="Search tickets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tickets"
        />
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Category</legend>
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
                category === c
                  ? 'border-[var(--you)] bg-[var(--you)] text-[var(--you-ink)]'
                  : 'border-[var(--rule)] text-[var(--muted)] hover:bg-[var(--card-2)]'
              }`}
            >
              {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </fieldset>
      </div>

      {error && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-[var(--box)] bg-[var(--card)] p-3 text-[13px] text-[var(--box-ink)]">
          <span>{error}</span>
          <button type="button" className="font-semibold" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loadError ? (
        <div className="mt-8 space-y-3 text-center">
          <p className="text-[var(--box-ink)]">Couldn’t load the tickets: {loadError}</p>
          <button type="button" className={btn} onClick={load}>
            Try again
          </button>
        </div>
      ) : !tickets ? (
        <p className="mt-8 text-center text-[var(--muted)]">Loading…</p>
      ) : (
        <>
          {groups.length === 0 && (
            <p className="mt-8 text-center text-[var(--muted)]">
              {filtering ? 'No open tickets match.' : 'No open tickets.'}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.category} className="mt-6">
              <h2 className="disp mb-2 text-[14px] text-[var(--muted)]">
                {CATEGORY_LABELS[g.category]}{' '}
                <span className="font-semibold">({g.tickets.length})</span>
              </h2>
              <ul className="space-y-2">{g.tickets.map((t) => card(t, false))}</ul>
            </section>
          ))}

          <section className="mt-10 border-t border-[var(--rule)] pt-4">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone((s) => !s)}
              className="disp flex w-full items-center justify-between text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <span>Completed ({done.length})</span>
              <span aria-hidden="true">{showDone ? '−' : '+'}</span>
            </button>
            {showDone &&
              (done.length > 0 ? (
                <ul className="mt-3 space-y-2">{done.map((t) => card(t, true))}</ul>
              ) : (
                <p className="mt-3 text-[13px] text-[var(--muted)]">Nothing completed yet.</p>
              ))}
          </section>
        </>
      )}

      {editing && (
        <Editor
          ticket={editing === 'new' ? null : editing}
          defaultCategory={category === 'all' ? 'bug' : category}
          saving={saving}
          error={editError}
          onSave={save}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
