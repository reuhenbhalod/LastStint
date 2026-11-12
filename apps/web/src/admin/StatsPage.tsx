// The admin page's Stats tab (/admin/stats, docs/admin-v2-spec.md A4): the daily, the Gauntlet,
// Eras, Versus and accounts, from data already stored (apps/worker/src/adminStats.ts). Days are
// UTC dates.

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ErrorLine, Heading, Tile } from './Notice.js';
import { errorText } from './tickets.js';
import { btn } from './ui.js';
import { type AdminStats, getStats, pct } from './v2.js';

/**
 * A stats table. The first column and the `text` columns (names, calls) are left-aligned and
 * keep a readable width, so on a phone the table scrolls sideways instead of crushing them; the
 * rest are numbers, right-aligned.
 */
function Table({
  head,
  rows,
  text = [],
}: {
  head: string[];
  rows: ReactNode[][];
  text?: number[];
}) {
  if (rows.length === 0) return <p className="m-0 text-[14px] text-[var(--muted)]">None yet.</p>;
  const align = (i: number) =>
    i === 0 ? 'whitespace-nowrap' : text.includes(i) ? 'min-w-[11rem]' : 'text-right tabular-nums';
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--rule)]">
      <table className="w-full text-left text-[13px]">
        <thead className="text-[var(--muted)]">
          <tr className="border-b border-[var(--rule)]">
            {head.map((h, i) => (
              <th
                key={h}
                className={`whitespace-nowrap px-3 py-2 font-semibold ${i > 0 && !text.includes(i) ? 'text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            // Rows are fixed for one response; the index is a stable key here.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <tr key={k} className="border-b border-[var(--rule)] last:border-b-0">
              {r.map((cell, i) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells of a fixed row
                  key={i}
                  className={`px-3 py-2 ${align(i)}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsPage() {
  const [s, setS] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setS(await getStats());
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="flex flex-col gap-5">
      <Heading
        right={
          <button type="button" className={btn} onClick={load}>
            Refresh
          </button>
        }
      >
        Stats
      </Heading>
      <ErrorLine text={error} />
      {!s && !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading…</p>}
      {s && (
        <>
          <p className="m-0 text-[13px] text-[var(--muted)]">
            {s.from} to {s.to} (UTC), from stored runs only.
          </p>

          <h3 className="m-0 text-[16px] font-semibold">Daily</h3>
          <Table
            head={['Date', 'Players', 'Finished', 'Mean score']}
            rows={[...s.daily.days]
              .reverse()
              .map((d) => [d.date, d.players, pct(d.finished), d.meanScore])}
          />
          <h4 className="m-0 text-[14px] font-semibold">
            Most-missed calls (orange or red, last 7 days)
          </h4>
          <Table
            head={['Date', 'Race', 'Lap', 'Call', 'Runs', 'Share']}
            text={[1, 3]}
            rows={s.daily.missed.map((m) => [
              m.date,
              m.raceName,
              m.lap ?? '—',
              m.option,
              m.runs,
              pct(m.share),
            ])}
          />

          <h3 className="m-0 text-[16px] font-semibold">Gauntlet</h3>
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Runs started" value={s.gauntlet.started} />
            <Tile label="Started in 30 days" value={s.gauntlet.startedRecent} />
            <Tile
              label="Best run"
              value={
                s.gauntlet.best
                  ? `${s.gauntlet.best.rounds} rounds, ${s.gauntlet.best.name}`
                  : 'None yet'
              }
            />
          </dl>
          <Table
            head={['Rounds survived', 'Runs']}
            rows={s.gauntlet.rounds.map((r) => [r.rounds, r.runs])}
          />

          <h3 className="m-0 text-[16px] font-semibold">Eras</h3>
          <p className="m-0 text-[13px] text-[var(--muted)]">
            {s.eras.playersWithStar} players have at least one normal star. Stars count normal runs
            only (Legend stars aren’t counted); attempts include Legend attempts.
          </p>
          <Table
            head={['Era', 'Attempts', 'Normal stars', 'Players with a normal star']}
            rows={s.eras.eras.map((e) => [`${e.id}: ${e.name}`, e.attempts, e.stars, e.players])}
          />

          <h3 className="m-0 text-[16px] font-semibold">Versus</h3>
          <p className="m-0 text-[13px] text-[var(--muted)]">{s.versus.total} matches stored.</p>
          <Table
            head={['Date', 'Matches']}
            rows={[...s.versus.days].reverse().map((d) => [d.date, d.matches])}
          />

          <h3 className="m-0 text-[16px] font-semibold">Accounts</h3>
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Accounts" value={s.accounts.total} />
            <Tile label="Daily players in 30 days" value={s.accounts.recentPlayers} />
            <Tile label="Of them signed in" value={pct(s.accounts.signedInShare)} />
          </dl>
          <Table
            head={['Date', 'Sign-ups']}
            rows={[...s.accounts.days].reverse().map((d) => [d.date, d.signups])}
          />
        </>
      )}
    </section>
  );
}
