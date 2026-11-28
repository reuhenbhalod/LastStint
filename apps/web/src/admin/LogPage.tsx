// The admin page's Log tab (/admin/log, docs/admin-v2-spec.md A9): every change made on the
// admin page, newest first, filterable by action, 200 at a time.

import { useCallback, useEffect, useState } from 'react';
import { ErrorLine, Heading } from './Notice.js';
import { errorText } from './tickets.js';
import { btn, inlineField } from './ui.js';
import { ACTION_LABELS, type LogEntry, getLog, logSummary } from './v2.js';

const PAGE = 200;

export function LogPage() {
  const [action, setAction] = useState('');
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before?: number) => {
      setError(null);
      try {
        const r = await getLog(action, before);
        setEntries((old) => (before ? [...(old ?? []), ...r.entries] : r.entries));
        setMore(r.entries.length === PAGE);
      } catch (e) {
        setError(errorText(e));
      }
    },
    [action],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="flex flex-col gap-4">
      <Heading
        right={
          <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            Action
            <select
              aria-label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={inlineField}
            >
              <option value="">All</option>
              {Object.entries(ACTION_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        }
      >
        Log
      </Heading>
      <ErrorLine text={error} />
      {!entries && !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading…</p>}
      {entries && entries.length === 0 && (
        <p className="m-0 text-[14px] text-[var(--muted)]">No changes logged yet.</p>
      )}
      {entries && entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--rule)]">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--rule)]">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">When (UTC)</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Who</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Action</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">What</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[var(--rule)] last:border-b-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.at.replace('T', ' ').slice(0, 19)}
                    {/* On a phone the email sits under the time, so Action and What stay in view. */}
                    <div className="max-w-[9rem] truncate text-[11px] text-[var(--muted)] sm:hidden">
                      {e.email}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">{e.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </td>
                  <td className="min-w-[12rem] px-3 py-2 break-words">{logSummary(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {more && entries && (
        <div>
          <button type="button" className={btn} onClick={() => load(entries.at(-1)?.id)}>
            Load older
          </button>
        </div>
      )}
    </section>
  );
}
