// The admin page's Players tab (/admin/players): every account that has signed up, with a
// summary, a search and a choice of order. Open a player for their page (PlayerPanel.tsx:
// runs, streak, name edit, hide). AdminPage only renders this for a signed-in admin; the Worker
// checks every call again (apps/worker/src/adminPlayers.ts).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayerPanel } from './PlayerPanel.js';
import {
  type PlayerList,
  type PlayerSort,
  SORT_LABELS,
  arrangePlayers,
  listPlayers,
  providerLabel,
  shortDate,
  summarise,
} from './players.js';
import { errorText } from './tickets.js';
import { btn, field } from './ui.js';

export function PlayersPage() {
  const [list, setList] = useState<PlayerList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PlayerSort>('newest');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setList(await listPlayers());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => arrangePlayers(list?.players ?? [], query, sort),
    [list, query, sort],
  );
  const summary = list && summarise(list, Date.now());

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="disp m-0 text-[20px] leading-none">Players</h1>
        <button type="button" className={btn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="m-0 rounded-lg border border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_12%,transparent)] px-3 py-2 text-[14px]">
          {error}
        </p>
      )}

      {summary && (
        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['Accounts', summary.total],
              ['New in the last 7 days', summary.lastWeek],
              ['Leaderboard name set', summary.withProfile],
              ['Have played', summary.played],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="card flex flex-col gap-1">
              <dt className="text-[12px] text-[var(--muted)]">{label}</dt>
              <dd className="disp m-0 text-[24px] leading-none">{n}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search name, email or team"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search players"
          className={field}
        />
        <label className="flex items-center gap-2 text-[13px] text-[var(--muted)] sm:shrink-0">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as PlayerSort)}
            className={`${field} sm:w-auto`}
          >
            {(Object.keys(SORT_LABELS) as PlayerSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {open && (
        <PlayerPanel
          key={open}
          id={open}
          onChanged={async () => setList(await listPlayers())}
          onClose={() => setOpen(null)}
        />
      )}

      {list && list.players.length < list.total && (
        <p className="m-0 text-[13px] text-[var(--muted)]">
          Showing the newest {list.players.length} of {list.total} accounts.
        </p>
      )}

      {!list && !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading players…</p>}
      {list && shown.length === 0 && (
        <p className="m-0 text-[14px] text-[var(--muted)]">
          {list.players.length === 0 ? 'No accounts yet.' : 'No players match the search.'}
        </p>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--rule)]">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--rule)]">
                <th className="px-3 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 font-semibold">Sign-in</th>
                <th className="px-3 py-2 font-semibold">Team</th>
                <th className="px-3 py-2 font-semibold">Joined</th>
                <th className="px-3 py-2 text-right font-semibold">Devices</th>
                <th className="px-3 py-2 text-right font-semibold">Daily</th>
                <th className="px-3 py-2 text-right font-semibold">Gauntlet</th>
                <th className="px-3 py-2 font-semibold">Last played</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-b border-[var(--rule)] last:border-b-0">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-left font-semibold underline-offset-2 hover:underline"
                      onClick={() => setOpen(p.id)}
                    >
                      {p.displayName || (
                        <span className="text-[var(--muted)]">{p.name || 'No name'}</span>
                      )}
                      {p.hidden && (
                        <span className="ml-1.5 text-[11px] font-bold text-[var(--flag)]">
                          Hidden
                        </span>
                      )}
                    </button>
                    <div className="text-[12px] text-[var(--muted)]">
                      {p.displayName && p.name ? `${p.name} · ` : ''}
                      {p.email || 'no email'}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{providerLabel(p.provider)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.favouriteTeam || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{shortDate(p.createdAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.devices}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.dailyRuns}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.gauntletRuns}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{shortDate(p.lastPlayed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
