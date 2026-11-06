// One ticket on the Tickets tab: its title, a status switch, and (opened) its description and
// notes, with Edit and Delete. Delete asks first, in the card.

import { useState } from 'react';
import { CATEGORY_LABELS, STATUSES, STATUS_LABELS, type Status, type Ticket } from './tickets.js';
import { btn, danger } from './ui.js';

function day(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TicketCard({
  ticket,
  showCategory,
  busy,
  onStatus,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  showCategory: boolean;
  busy: boolean;
  onStatus: (status: Status) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const t = ticket;
  return (
    <li className="card !p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span
            className={`block break-words text-[15px] font-semibold leading-snug ${t.status === 'done' ? 'text-[var(--muted)] line-through decoration-1' : ''}`}
          >
            {t.title}
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--muted)]">
            #{t.id}
            {showCategory ? ` · ${CATEGORY_LABELS[t.category]}` : ''}
            {t.source ? ` · ${t.source}` : ''}
            {' · '}
            {t.completedAt ? `done ${day(t.completedAt)}` : `added ${day(t.createdAt)}`}
          </span>
        </button>
        <fieldset
          className="flex shrink-0 self-start overflow-hidden rounded-lg border border-[var(--rule)]"
          disabled={busy}
        >
          <legend className="sr-only">Status of #{t.id}</legend>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={t.status === s}
              onClick={() => t.status !== s && onStatus(s)}
              className={`px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 ${
                t.status === s
                  ? s === 'done'
                    ? 'bg-[var(--you)] text-[var(--you-ink)]'
                    : s === 'in_progress'
                      ? 'bg-[var(--flag)] text-[var(--rival-ink)]'
                      : 'bg-[var(--card-2)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:bg-[var(--card-2)]'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </fieldset>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--rule)] pt-3 text-[14px]">
          {t.description ? (
            <p className="m-0 whitespace-pre-wrap break-words">{t.description}</p>
          ) : (
            <p className="m-0 text-[var(--muted)]">No description.</p>
          )}
          {t.notes && (
            <div>
              <div className="eyebrow">Notes</div>
              <p className="m-0 mt-1 whitespace-pre-wrap break-words">{t.notes}</p>
            </div>
          )}
          {t.createdBy && (
            <p className="m-0 text-[12px] text-[var(--muted)]">Added by {t.createdBy}</p>
          )}
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--card-2)] p-2">
              <span className="mr-auto text-[13px]">Delete this ticket? This can’t be undone.</span>
              <button type="button" className={btn} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={danger}
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={onEdit} disabled={busy}>
                Edit
              </button>
              <button
                type="button"
                className={`${btn} text-[var(--box-ink)]`}
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
