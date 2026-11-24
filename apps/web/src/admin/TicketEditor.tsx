// The new-ticket and edit form on the Tickets tab, in a modal dialog over the list. Escape or
// Cancel closes it.

import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  LIMITS,
  STATUSES,
  STATUS_LABELS,
  type Status,
  type Ticket,
  type TicketFields,
  assigneeLabel,
} from './tickets.js';
import { btn, field, primary } from './ui.js';

const label = 'flex flex-col gap-1 text-[12px] font-semibold text-[var(--muted)]';

export function TicketEditor({
  ticket,
  defaultCategory,
  admins,
  me,
  saving,
  error,
  onSave,
  onClose,
}: {
  /** The ticket to edit; null for a new one. */
  ticket: Ticket | null;
  defaultCategory: Category;
  admins: readonly string[];
  me: string;
  saving: boolean;
  error: string | null;
  onSave: (fields: TicketFields) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [description, setDescription] = useState(ticket?.description ?? '');
  const [category, setCategory] = useState<Category>(ticket?.category ?? defaultCategory);
  const [status, setStatus] = useState<Status>(ticket?.status ?? 'open');
  const [notes, setNotes] = useState(ticket?.notes ?? '');
  const [assignee, setAssignee] = useState(ticket?.assignee ?? '');
  const people = !assignee || admins.includes(assignee) ? admins : [...admins, assignee];

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    onSave({ title: title.trim(), description, category, status, notes, assignee });
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="ticket-editor-title"
      // Escape: let the page close it (and unmount), rather than the browser.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border border-[var(--rule)] bg-[var(--card)] p-0 text-[var(--ink)] backdrop:bg-black/60"
    >
      <form onSubmit={submit} className="flex flex-col gap-3 p-4">
        <h2 id="ticket-editor-title" className="disp m-0 text-[18px] leading-none">
          {ticket ? `Edit #${ticket.id}` : 'New ticket'}
        </h2>
        <label className={label}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.title}
            required
            className={field}
            // biome-ignore lint/a11y/noAutofocus: the form opens to be typed in
            autoFocus
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={field}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Status
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className={field}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={label}>
          Assignee
          <select
            aria-label="Assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={field}
          >
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {assigneeLabel(p, me)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.description}
            rows={5}
            className={field}
          />
        </label>
        <label className={label}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={LIMITS.notes}
            rows={3}
            className={field}
          />
        </label>
        {ticket?.source && (
          <p className="m-0 text-[12px] text-[var(--muted)]">Source: {ticket.source}</p>
        )}
        {error && <p className="m-0 text-[13px] text-[var(--box-ink)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : ticket ? 'Save' : 'Add ticket'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
