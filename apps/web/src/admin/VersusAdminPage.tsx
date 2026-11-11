// The admin page's Versus tab (/admin/versus, docs/admin-v2-spec.md A7): the rooms open now
// (code, phase, players, lap) and the recent finished matches. Both are written by the rooms
// themselves (apps/worker/src/versus.ts); this only reads them.

import { useCallback, useEffect, useState } from 'react';
import { ErrorLine, Heading } from './Notice.js';
import { errorText } from './tickets.js';
import { btn } from './ui.js';
import {
  type LiveRoom,
  type VersusMatch,
  carName,
  getVersus,
  matchResult,
  phaseText,
  trackName,
} from './v2.js';

const time = (iso: string) => iso.replace('T', ' ').slice(0, 16);

export function VersusAdminPage() {
  const [data, setData] = useState<{ matches: VersusMatch[]; rooms: LiveRoom[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getVersus());
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="flex flex-col gap-4">
      <Heading
        right={
          <button type="button" className={btn} onClick={load}>
            Refresh
          </button>
        }
      >
        Versus
      </Heading>
      <ErrorLine text={error} />
      {!data && !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading…</p>}
      {data && (
        <>
          <h3 className="m-0 text-[15px] font-semibold">Live rooms ({data.rooms.length})</h3>
          {data.rooms.length === 0 ? (
            <p className="m-0 text-[14px] text-[var(--muted)]">No rooms open now.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--rule)]">
              <table className="w-full min-w-[36rem] text-left text-[13px]">
                <thead className="text-[var(--muted)]">
                  <tr className="border-b border-[var(--rule)]">
                    <th className="px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">Track</th>
                    <th className="px-3 py-2 font-semibold">Phase</th>
                    <th className="px-3 py-2 font-semibold">Players</th>
                    <th className="px-3 py-2 text-right font-semibold">Lap</th>
                    <th className="px-3 py-2 font-semibold">Opened (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rooms.map((r) => (
                    <tr key={r.code} className="border-b border-[var(--rule)] last:border-b-0">
                      <td className="px-3 py-2 font-semibold">{r.code}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{trackName(r.track)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{phaseText(r.phase)}</td>
                      <td className="px-3 py-2">{r.players.join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.lap}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{time(r.openedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="m-0 text-[15px] font-semibold">Recent matches</h3>
          {data.matches.length === 0 ? (
            <p className="m-0 text-[14px] text-[var(--muted)]">No finished matches yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--rule)]">
              <table className="w-full min-w-[44rem] text-left text-[13px]">
                <thead className="text-[var(--muted)]">
                  <tr className="border-b border-[var(--rule)]">
                    <th className="px-3 py-2 font-semibold">Finished (UTC)</th>
                    <th className="px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">Track</th>
                    <th className="px-3 py-2 font-semibold">Players and cars</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                    <th className="px-3 py-2 text-right font-semibold">Battles</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--rule)] last:border-b-0">
                      <td className="px-3 py-2 whitespace-nowrap">{time(m.finishedAt)}</td>
                      <td className="px-3 py-2 font-semibold">{m.code}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{trackName(m.track)}</td>
                      <td className="min-w-[14rem] px-3 py-2">
                        {m.players
                          .map((p, i) => {
                            const car = m.cars[i];
                            return car
                              ? `${p} (${carName(car.car)}, ${car.startTyre.toLowerCase()})`
                              : p;
                          })
                          .join(' vs ')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{matchResult(m)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.battles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
