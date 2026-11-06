// Who's on a ticket (the Tickets tab): an avatar, and a menu to assign it to an admin or to
// nobody. A native select, so it's keyboard- and screen-reader-friendly and opens the phone's
// own picker.

import { assigneeLabel, initials } from './tickets.js';

export function Avatar({ email, me }: { email: string; me: string }) {
  if (!email) {
    return (
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-[var(--muted)] text-[11px] text-[var(--muted)]"
      >
        ?
      </span>
    );
  }
  const mine = email === me;
  return (
    <span
      aria-hidden="true"
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
        mine ? 'bg-[var(--you)] text-[var(--you-ink)]' : 'bg-[var(--flag)] text-[var(--rival-ink)]'
      }`}
    >
      {initials(email)}
    </span>
  );
}

export function AssigneeSelect({
  ticketId,
  assignee,
  admins,
  me,
  disabled,
  onChange,
}: {
  ticketId: number;
  assignee: string;
  admins: readonly string[];
  me: string;
  disabled: boolean;
  onChange: (assignee: string) => void;
}) {
  // An assignee who's since left ADMIN_EMAILS still shows, so the menu never lies.
  const people = admins.includes(assignee) || !assignee ? admins : [...admins, assignee];
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      <Avatar email={assignee} me={me} />
      <span className="sr-only">Assignee for #{ticketId}</span>
      <select
        value={assignee}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`min-w-0 cursor-pointer rounded-md border border-transparent bg-transparent py-1 pr-1 pl-0.5 text-[13px] font-semibold hover:border-[var(--rule)] hover:bg-[var(--card-2)] focus:outline-2 focus:outline-[var(--you)] disabled:cursor-default disabled:opacity-40 ${
          assignee ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
        }`}
      >
        <option value="">Unassigned</option>
        {people.map((p) => (
          <option key={p} value={p}>
            {assigneeLabel(p, me)}
          </option>
        ))}
      </select>
    </label>
  );
}
