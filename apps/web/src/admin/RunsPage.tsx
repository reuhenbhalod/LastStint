// The admin page's Runs tab (/admin/runs, docs/admin-v2-spec.md A3): search runs by date,
// player or mode; open one to see its calls and grades; mark one run (or every run on the day,
// in the searched mode) for the nightly check; delete a daily run. RunsTable and RunPanel are
// shared with a player's page.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorLine, Heading, NoteLine, useAction } from './Notice.js';
import { errorText } from './tickets.js';
import { btn, danger, field, primary } from './ui.js';
import {
  type AdminRun,
  MODE_LABELS,
  type RunDetail,
  type RunMode,
  type RunSearch,
  checkText,
  deleteRun,
  getRun,
  reverifyDay,
  reverifyRun,
  searchRuns,
} from './v2.js';

const BAND_COLOURS: Record<string, string> = {
  green: 'var(--you)',
  yellow: 'var(--flag)',
  orange: 'var(--flag)',
  red: 'var(--box)',
};

export const utcToday = () => new Date().toISOString().slice(0, 10);

export function RunsTable({
  runs,
  open,
  onOpen,
  hidePlayer = false,
}: {
  runs: AdminRun[];
  open?: string | null;
  onOpen?: (r: AdminRun) => void;
  /** On a player's own page, where every row is the same player. */
  hidePlayer?: boolean;
}) {
  if (runs.length === 0) return <p className="m-0 text-[14px] text-[var(--muted)]">No runs.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--rule)]">
      <table
        className={`w-full ${hidePlayer ? 'min-w-[32rem]' : 'min-w-[44rem]'} text-left text-[13px]`}
      >
        <thead className="text-[var(--muted)]">
          <tr className="border-b border-[var(--rule)]">
            <th className="whitespace-nowrap px-3 py-2 font-semibold">When</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Mode</th>
            {!hidePlayer && <th className="whitespace-nowrap px-3 py-2 font-semibold">Player</th>}
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Race</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Score</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Result</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Check</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr
              key={`${r.mode}-${r.id}`}
              className={`border-b border-[var(--rule)] last:border-b-0 ${open === r.id ? 'bg-[var(--card-2)]' : ''}`}
            >
              <td className="px-3 py-2 whitespace-nowrap">
                {r.date}
                <div className="text-[11px] text-[var(--muted)]">{r.at.slice(11, 16)} UTC</div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{MODE_LABELS[r.mode]}</td>
              {!hidePlayer && (
                <td className="px-3 py-2">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {r.player ? r.player.email || r.player.name : 'not signed in'}
                  </div>
                </td>
              )}
              <td className="min-w-[10rem] px-3 py-2">{r.raceName || '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.score === null ? '—' : Math.round(r.score * 10) / 10}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{r.result}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {onOpen ? (
                  <button
                    type="button"
                    className="underline"
                    aria-label={`Open ${MODE_LABELS[r.mode]} run by ${r.name}`}
                    onClick={() => onOpen(r)}
                  >
                    {checkText(r)}
                  </button>
                ) : (
                  checkText(r)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A call or option id in words: "sc-stop" -> "SC stop", "box-HARD" -> "Box: hards",
 * "stay" -> "Stay out". */
export function callWords(id: string): string {
  if (id === 'stay') return 'Stay out';
  const box = /^box-([A-Z]+)$/.exec(id);
  if (box) return `Box: ${(box[1] as string).toLowerCase()}s`;
  const words = id
    .split('-')
    .map((w) => (/^(sc|vsc|drs|ers)$/i.test(w) ? w.toUpperCase() : w))
    .join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Calls({ calls }: { calls: RunDetail['calls'] }) {
  if (calls.length === 0) return <p className="m-0 text-[13px] text-[var(--muted)]">No calls.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-[13px]">
        <thead className="text-[var(--muted)]">
          <tr className="border-b border-[var(--rule)]">
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Lap</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Call</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Chose</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Grade</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Best</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Real</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.momentId} className="border-b border-[var(--rule)] last:border-b-0">
              <td className="px-2 py-1.5 tabular-nums">{c.lap}</td>
              <td className="px-2 py-1.5" title={c.momentId}>
                {callWords(c.momentId)}
              </td>
              <td className="px-2 py-1.5">{callWords(c.chosen)}</td>
              <td className="px-2 py-1.5 font-semibold" style={{ color: BAND_COLOURS[c.band] }}>
                {c.band}
              </td>
              <td className="px-2 py-1.5">{callWords(c.best)}</td>
              <td className="px-2 py-1.5">
                {c.real ? callWords(c.real) : '—'}
                {c.matchedReal ? ' (matched)' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RunPanel({
  mode,
  id,
  onChanged,
  onClose,
}: {
  mode: RunMode;
  id: string;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  // Once the run is deleted there's nothing to reload: the panel says so and offers Close.
  const [deleted, setDeleted] = useState(false);
  const gone = useRef(false);
  const load = useCallback(async () => setDetail(await getRun(mode, id)), [mode, id]);
  const after = useCallback(async () => {
    await onChanged();
    if (!gone.current) await load().catch(() => setDetail(null));
  }, [onChanged, load]);
  const { busy, note, error, setError, run } = useAction(after);
  useEffect(() => {
    setDetail(null);
    load().catch((e) => setError(errorText(e)));
  }, [load, setError]);
  const r = detail?.run;
  return (
    <section className="card flex flex-col gap-3" aria-label="Run">
      <div className="flex items-start justify-between gap-3">
        <h2 className="disp m-0 text-[20px] leading-tight">Run</h2>
        <button type="button" className={btn} onClick={onClose}>
          Close
        </button>
      </div>
      <ErrorLine text={error} />
      <NoteLine text={note} />
      {deleted ? (
        <p className="m-0 text-[14px] text-[var(--muted)]">This run was deleted.</p>
      ) : !r ? (
        !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading the run…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="disp m-0 text-[18px] leading-tight">
              {MODE_LABELS[r.mode]}: {r.raceName || r.raceId}
            </h3>
            <span className="text-[13px] text-[var(--muted)]">
              {r.name} · {r.at.replace('T', ' ').slice(0, 16)} UTC · {checkText(r)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const m = await reverifyRun(r.mode, r.id);
                  return `Marked ${m.marked} for the nightly check.`;
                })
              }
            >
              Re-verify
            </button>
            {r.mode === 'daily' && (
              <button
                type="button"
                className={danger}
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(`Delete this daily run by ${r.name} on ${r.date}? It can’t be undone.`)
                  )
                    return;
                  run(async () => {
                    await deleteRun(r.id);
                    gone.current = true;
                    setDeleted(true);
                    return 'Run deleted.';
                  });
                }}
              >
                Delete run
              </button>
            )}
          </div>
          {detail.rounds ? (
            detail.rounds.map((x) => (
              <div key={x.round} className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold">
                  Round {x.round}: {x.raceName} ·{' '}
                  {x.won === null ? 'not finished' : x.won ? 'won' : 'lost'}
                  {x.score === null ? '' : ` · ${x.score}`}
                  {x.corrected ? ' · corrected' : ''}
                </span>
                <Calls calls={x.calls} />
              </div>
            ))
          ) : (
            <Calls calls={detail.calls} />
          )}
        </>
      )}
    </section>
  );
}

export function RunsPage() {
  const [q, setQ] = useState<RunSearch>({ date: utcToday(), player: '', mode: '' });
  // The search behind the list on screen (q is the form, which may have changed since).
  const [shown, setShown] = useState<RunSearch>(q);
  const [runs, setRuns] = useState<AdminRun[] | null>(null);
  const [limit, setLimit] = useState(200);
  const [open, setOpen] = useState<AdminRun | null>(null);
  const search = useCallback(async (s: RunSearch) => {
    const r = await searchRuns(s);
    setRuns(r.runs);
    setLimit(r.limit);
    setShown(s);
  }, []);
  const load = useCallback(() => search(shown), [search, shown]);
  const { busy, note, error, setError, run } = useAction(load);
  // The first search; later ones run from the Search button.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on opening the tab
  useEffect(() => {
    search(q).catch((e) => setError(errorText(e)));
  }, []);
  const dayModes = shown.mode ? `${MODE_LABELS[shown.mode]} ` : '';

  return (
    <section className="flex flex-col gap-4">
      <Heading>Runs</Heading>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(null);
          search(q).catch((err) => setError(errorText(err)));
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
          Date (UTC)
          <input
            type="date"
            value={q.date}
            onChange={(e) => setQ({ ...q, date: e.target.value })}
            className={`${field} sm:w-auto`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[13px] text-[var(--muted)]">
          Player
          <input
            type="search"
            placeholder="Name, email or ID"
            value={q.player}
            onChange={(e) => setQ({ ...q, player: e.target.value })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
          Mode
          <select
            value={q.mode}
            onChange={(e) => setQ({ ...q, mode: e.target.value as RunSearch['mode'] })}
            className={`${field} sm:w-auto`}
          >
            <option value="">All modes</option>
            {(Object.keys(MODE_LABELS) as RunMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={primary}>
          Search
        </button>
      </form>
      <p className="m-0 text-[12px] text-[var(--muted)]">
        Clear the date to search every day (with a player). Newest first, {limit} at most.
      </p>
      <ErrorLine text={error} />
      <NoteLine text={note} />
      {shown.date && (
        <div>
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() => {
              const { date, mode } = shown;
              if (!confirm(`Mark every ${dayModes}run on ${date} for the nightly check?`)) return;
              run(async () => {
                const m = await reverifyDay(date, mode || undefined);
                return `Marked ${m.marked} ${dayModes}runs on ${date} for the nightly check.`;
              });
            }}
          >
            Re-verify every {dayModes}run on {shown.date}
          </button>
        </div>
      )}
      {open && (
        <RunPanel
          key={`${open.mode}-${open.id}`}
          mode={open.mode}
          id={open.id}
          onChanged={load}
          onClose={() => setOpen(null)}
        />
      )}
      {runs ? (
        <RunsTable runs={runs} open={open?.id} onOpen={setOpen} />
      ) : (
        !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading runs…</p>
      )}
    </section>
  );
}
