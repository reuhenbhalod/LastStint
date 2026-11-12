// A player's page on the Players tab (docs/admin-v2-spec.md A6): their runs in every mode,
// their streak and the days behind it (worked out from the days played, never stored), the
// browsers linked to the account, and the two actions: edit or clear the display name, and
// hide them from the leaderboards (they still play).

import { useCallback, useEffect, useState } from 'react';
import { ErrorLine, NoteLine, Tile, useAction } from './Notice.js';
import { RunPanel, RunsTable } from './RunsPage.js';
import { shortDate } from './players.js';
import { errorText } from './tickets.js';
import { btn, danger, field, primary } from './ui.js';
import {
  type AdminRun,
  type PlayerDetail,
  getPlayer,
  setPlayerHidden,
  setPlayerName,
} from './v2.js';

export function PlayerPanel({
  id,
  onChanged,
  onClose,
}: {
  id: string;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [p, setP] = useState<PlayerDetail | null>(null);
  const [name, setName] = useState('');
  const [open, setOpen] = useState<AdminRun | null>(null);
  const load = useCallback(async () => {
    const got = await getPlayer(id);
    setP(got);
    setName(got.player.displayName);
  }, [id]);
  const after = useCallback(async () => {
    await Promise.all([load(), onChanged()]);
  }, [load, onChanged]);
  const { busy, note, error, setError, run } = useAction(after);
  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load, setError]);

  const pl = p?.player;
  return (
    <section className="card flex flex-col gap-4" aria-label="Player">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="disp m-0 text-[20px] leading-tight">
            {pl ? pl.displayName || pl.name || 'No name' : 'Player'}
            {pl?.hidden && (
              <span className="ml-2 rounded-full bg-[var(--card-2)] px-2 py-0.5 align-middle text-[12px] text-[var(--flag)]">
                Hidden
              </span>
            )}
          </h2>
          {pl && (
            <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">
              {pl.name} · {pl.email || 'no email'} · joined {shortDate(pl.createdAt)} · ID {pl.id}
            </p>
          )}
        </div>
        <button type="button" className={btn} onClick={onClose}>
          Close
        </button>
      </div>
      <ErrorLine text={error} />
      <NoteLine text={note} />
      {!p ? (
        !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading the player…</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-[13px] text-[var(--muted)]">
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className={field}
              />
            </label>
            <button
              type="button"
              className={primary}
              disabled={busy || name.trim() === p.player.displayName}
              onClick={() =>
                run(async () => {
                  await setPlayerName(p.player.id, name);
                  return name.trim()
                    ? `Display name set to ${name.trim()}.`
                    : 'Display name cleared.';
                })
              }
            >
              Save name
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy || !p.player.displayName}
              onClick={() =>
                run(async () => {
                  await setPlayerName(p.player.id, '');
                  return 'Display name cleared.';
                })
              }
            >
              Clear name
            </button>
            <button
              type="button"
              className={p.player.hidden ? btn : danger}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setPlayerHidden(p.player.id, !p.player.hidden);
                  return p.player.hidden
                    ? 'Shown on the leaderboards again.'
                    : 'Hidden from every leaderboard. They can still play.';
                })
              }
            >
              {p.player.hidden ? 'Show on leaderboards' : 'Hide from leaderboards'}
            </button>
          </div>

          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Current streak" value={p.streak.current} />
            <Tile label="Best streak" value={p.streak.best} />
            <Tile label="Days played" value={p.streak.days} />
            <Tile label="Browsers linked" value={p.browsers.length} />
          </dl>

          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-[14px] font-semibold">Days played (newest first)</h3>
            <p className="m-0 text-[13px] break-words text-[var(--muted)]">
              {p.days.length ? p.days.join(', ') : 'None yet.'}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-[14px] font-semibold">Linked browsers</h3>
            <ul className="m-0 list-none p-0 text-[13px] text-[var(--muted)]">
              {p.browsers.map((b) => (
                <li key={b.anonId}>
                  {b.anonId} · linked {shortDate(b.linkedAt)}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[14px] font-semibold">Runs</h3>
            {open && (
              <RunPanel
                key={`${open.mode}-${open.id}`}
                mode={open.mode}
                id={open.id}
                onChanged={after}
                onClose={() => setOpen(null)}
              />
            )}
            <RunsTable runs={p.runs} open={open?.id} onOpen={setOpen} hidePlayer />
          </div>
        </>
      )}
    </section>
  );
}
