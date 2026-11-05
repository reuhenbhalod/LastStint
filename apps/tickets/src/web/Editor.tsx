// The new-ticket and edit form, in a modal dialog over the list. Escape or Cancel closes it.

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
  type TicketInput,
} from '../shared/tickets.js';
import { btn, primary } from './ui.js';

export function Editor({
  ticket,
  defaultCategory,
  saving,
  error,
  onSave,
  onClose,
}: {
  /** The ticket to edit; null for a new one. */
  ticket: Ticket | null;
  defaultCategory: Category;
  saving: boolean;
  error: string | null;
  onSave: (fields: Omit<TicketInput, 'source'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [description, setDescription] = useState(ticket?.description ?? '');
  const [category, setCategory] = useState<Category>(ticket?.category ?? defaultCategory);
  const [status, setStatus] = useState<Status>(ticket?.status ?? 'open');
  const [notes, setNotes] = useState(ticket?.notes ?? '');

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description, category, status, notes });
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="editor-title"
      // Escape: let the parent close it (and unmount), rather than the browser.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border border-[var(--rule)] bg-[var(--card)] p-0 text-[var(--ink)] backdrop:bg-black/60"
    >
      <form onSubmit={submit} className="space-y-3 p-4">
        <h2 id="editor-title" className="disp text-[18px]">
          {ticket ? `Edit #${ticket.id}` : 'New ticket'}
        </h2>
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-[var(--muted)]">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.title}
            required
            // biome-ignore lint/a11y/noAutofocus: the form opens to be typed in
            autoFocus
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-[12px] font-semibold text-[var(--muted)]">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-semibold text-[var(--muted)]">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-[var(--muted)]">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.description}
            rows={5}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] font-semibold text-[var(--muted)]">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={LIMITS.notes}
            rows={3}
          />
        </label>
        {ticket?.source && (
          <p className="text-[12px] text-[var(--muted)]">Source: {ticket.source}</p>
        )}
        {error && <p className="text-[13px] text-[var(--box-ink)]">{error}</p>}
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
