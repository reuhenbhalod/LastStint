// The admin page's Tickets tab (/admin/tickets): open and in-progress tickets grouped by
// category, then a collapsible Completed section. Filter by owner (everyone, mine,
// unassigned) and category, search the text, switch a ticket's status or assignee in place,
// pick up an unassigned ticket, and add, edit or delete tickets. AdminPage only renders this for
// a signed-in admin; every call is checked again by the Worker (apps/worker/src/tickets.ts).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketCard } from './TicketCard.js';
import { TicketEditor } from './TicketEditor.js';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Owner,
  type Status,
  type Ticket,
  type TicketFields,
  arrange,
  createTicket,
  deleteTicket,
  errorText,
  listTickets,
  updateTicket,
} from './tickets.js';
import { btn, field, primary } from './ui.js';

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [admins, setAdmins] = useState<string[]>([]);
  const [me, setMe] = useState('');
  const [owner, setOwner] = useState<Owner>('all');
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
      const list = await listTickets();
      setAdmins(list.admins);
      setMe(list.me);
      setTickets(list.tickets);
    } catch (e) {
      setLoadError(errorText(e));
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
      setError(errorText(e));
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  };

  const setStatus = (t: Ticket, status: Status) =>
    withTicket(t.id, async () => replace(await updateTicket(t.id, { status })));

  const assign = (t: Ticket, assignee: string) =>
    withTicket(t.id, async () => replace(await updateTicket(t.id, { assignee })));

  /** Take an unassigned ticket: it's yours, and an open one is now in progress. */
  const pickUp = (t: Ticket) =>
    withTicket(t.id, async () =>
      replace(
        await updateTicket(t.id, {
          assignee: me,
          ...(t.status === 'open' ? { status: 'in_progress' as const } : {}),
        }),
      ),
    );

  const remove = (t: Ticket) =>
    withTicket(t.id, async () => {
      await deleteTicket(t.id);
      setTickets((all) => (all ?? []).filter((x) => x.id !== t.id));
    });

  const closeEditor = useCallback(() => {
    setEditing(null);
    setEditError(null);
  }, []);

  const save = async (fields: TicketFields) => {
    setSaving(true);
    setEditError(null);
    try {
      if (editing === 'new') {
        const t = await createTicket(fields);
        setTickets((all) => [t, ...(all ?? [])]);
      } else if (editing) {
        replace(await updateTicket(editing.id, fields));
      }
      setEditing(null);
    } catch (e) {
      setEditError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const { groups, done } = useMemo(
    () => arrange(tickets ?? [], category, query, owner, me),
    [tickets, category, query, owner, me],
  );
  const filtering = category !== 'all' || owner !== 'all' || query.trim() !== '';
  const openTickets = (tickets ?? []).filter((t) => t.status !== 'done');
  const ownerCounts: Record<Owner, number> = {
    all: openTickets.length,
    mine: openTickets.filter((t) => t.assignee === me).length,
    unassigned: openTickets.filter((t) => !t.assignee).length,
  };
  const OWNER_LABELS: Record<Owner, string> = {
    all: 'Everyone',
    mine: 'Assigned to me',
    unassigned: 'Unassigned',
  };

  const card = (t: Ticket, showCategory: boolean) => (
    <TicketCard
      key={t.id}
      ticket={t}
      showCategory={showCategory}
      busy={busy.has(t.id)}
      admins={admins}
      me={me}
      onStatus={(s) => setStatus(t, s)}
      onAssign={(a) => assign(t, a)}
      onPickUp={() => pickUp(t)}
      onEdit={() => setEditing(t)}
      onDelete={() => remove(t)}
    />
  );

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="disp m-0 text-[20px] leading-none">Tickets</h1>
        <button
          type="button"
          className={primary}
          onClick={() => setEditing('new')}
          disabled={!tickets}
        >
          New ticket
        </button>
      </div>

      <input
        type="search"
        placeholder="Search tickets"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search tickets"
        className={field}
      />
      <fieldset className="m-0 flex w-full overflow-hidden rounded-lg border border-[var(--rule)] p-0 sm:w-auto sm:self-start">
        <legend className="sr-only">Whose tickets</legend>
        {(['all', 'mine', 'unassigned'] as const).map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={owner === o}
            onClick={() => setOwner(o)}
            className={`flex-1 px-3 py-1.5 text-[13px] font-semibold sm:flex-none ${
              owner === o
                ? 'bg-[var(--card-2)] text-[var(--ink)]'
                : 'text-[var(--muted)] hover:bg-[var(--card-2)]'
            }`}
          >
            {o === 'mine' ? (
              <>
                <span className="sm:hidden">Mine</span>
                <span className="hidden sm:inline">{OWNER_LABELS[o]}</span>
              </>
            ) : (
              OWNER_LABELS[o]
            )}
            {tickets && (
              <span className="ml-1.5 font-normal text-[var(--muted)]">{ownerCounts[o]}</span>
            )}
          </button>
        ))}
      </fieldset>
      <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
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

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_12%,transparent)] px-3 py-2 text-[14px]">
          <span>{error}</span>
          <button type="button" className="shrink-0 font-semibold" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loadError ? (
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <p className="m-0 text-[var(--box-ink)]">Couldn’t load the tickets: {loadError}</p>
          <button type="button" className={btn} onClick={load}>
            Try again
          </button>
        </div>
      ) : !tickets ? (
        <p className="m-0 mt-4 text-center text-[14px] text-[var(--muted)]">Loading tickets…</p>
      ) : (
        <>
          {groups.length === 0 && (
            <p className="m-0 mt-4 text-center text-[14px] text-[var(--muted)]">
              {owner === 'mine' && category === 'all' && !query.trim()
                ? 'Nothing assigned to you. Pick up a ticket from Unassigned.'
                : filtering
                  ? 'No open tickets match.'
                  : 'No open tickets.'}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.category} className="flex flex-col gap-2">
              <h2 className="eyebrow m-0">
                {CATEGORY_LABELS[g.category]} ({g.tickets.length})
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {g.tickets.map((t) => card(t, false))}
              </ul>
            </section>
          ))}

          <section className="mt-4 border-t border-[var(--rule)] pt-4">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone((s) => !s)}
              className="eyebrow flex w-full items-center justify-between hover:text-[var(--ink)]"
            >
              <span>Completed ({done.length})</span>
              <span aria-hidden="true" className="text-[16px]">
                {showDone ? '−' : '+'}
              </span>
            </button>
            {showDone &&
              (done.length > 0 ? (
                <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                  {done.map((t) => card(t, true))}
                </ul>
              ) : (
                <p className="m-0 mt-3 text-[13px] text-[var(--muted)]">Nothing completed yet.</p>
              ))}
          </section>
        </>
      )}

      {editing && (
        <TicketEditor
          ticket={editing === 'new' ? null : editing}
          defaultCategory={category === 'all' ? 'bug' : category}
          admins={admins}
          me={me}
          saving={saving}
          error={editError}
          onSave={save}
          onClose={closeEditor}
        />
      )}
    </section>
  );
}
