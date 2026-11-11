// The admin page's Eras tab (/admin/eras, docs/admin-v2-spec.md A1): each era's races with a
// Draft/Published switch, attempts and players, and the era's release (now, on a date, or back
// to Coming soon). An era needs every race published before it can be released; the Worker
// enforces that too (apps/worker/src/adminEras.ts).

import { useCallback, useEffect, useState } from 'react';
import { ErrorLine, Heading, NoteLine, useAction } from './Notice.js';
import { errorText } from './tickets.js';
import { btn, danger, field, primary } from './ui.js';
import {
  type AdminEra,
  eraStatusText,
  getEras,
  publishRace,
  releaseBlock,
  releaseEra,
} from './v2.js';

function EraCard({
  era,
  needed,
  busy,
  run,
}: {
  era: AdminEra;
  needed: number;
  busy: boolean;
  run: (f: () => Promise<string>) => void;
}) {
  const [date, setDate] = useState('');
  const block = releaseBlock(era, needed);
  const released = era.status !== 'coming-soon';
  return (
    <article className="card flex flex-col gap-3" aria-label={`Era ${era.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="disp m-0 text-[18px] leading-tight">
          Era {era.id}: {era.name}{' '}
          <span className="text-[13px] font-normal text-[var(--muted)]">{era.years}</span>
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${
            era.status === 'released'
              ? 'bg-[color-mix(in_srgb,var(--you)_18%,transparent)] text-[var(--you)]'
              : 'bg-[var(--card-2)] text-[var(--muted)]'
          }`}
        >
          {eraStatusText(era)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-[var(--muted)]">
          {era.published} of {era.races.length} published
        </span>
        <button
          type="button"
          className={primary}
          disabled={busy || !!block || era.status === 'released'}
          onClick={() =>
            run(async () => {
              await releaseEra(era.id, 'now');
              return `Era ${era.id} is released.`;
            })
          }
        >
          Release now
        </button>
        <input
          type="date"
          aria-label={`Release date for era ${era.id}`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${field} w-auto`}
        />
        <button
          type="button"
          className={btn}
          disabled={busy || !!block || !date}
          onClick={() =>
            run(async () => {
              await releaseEra(era.id, date);
              return `Era ${era.id} releases on ${date}.`;
            })
          }
        >
          Set date
        </button>
        {released && (
          <button
            type="button"
            className={danger}
            disabled={busy}
            onClick={() => {
              if (!confirm(`Put era ${era.id} back to Coming soon? Players lose access to it.`))
                return;
              run(async () => {
                await releaseEra(era.id, null, true);
                return `Era ${era.id} is back to Coming soon.`;
              });
            }}
          >
            Clear release
          </button>
        )}
      </div>
      {block && <p className="m-0 text-[13px] text-[var(--flag)]">{block}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[var(--muted)]">
            <tr className="border-b border-[var(--rule)]">
              <th className="px-2 py-1.5 font-semibold">#</th>
              <th className="px-2 py-1.5 font-semibold">Race</th>
              <th className="px-2 py-1.5 font-semibold">State</th>
              <th className="px-2 py-1.5 text-right font-semibold">Attempts</th>
              <th className="px-2 py-1.5 text-right font-semibold">Players</th>
            </tr>
          </thead>
          <tbody>
            {era.races.map((r) => (
              <tr key={r.raceId} className="border-b border-[var(--rule)] last:border-b-0">
                <td className="px-2 py-1.5 tabular-nums">{r.position}</td>
                <td className="px-2 py-1.5">
                  {r.name}
                  {!r.file && <span className="text-[var(--flag)]"> · no race file</span>}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    aria-label={`${r.name}: ${r.published ? 'Published' : 'Draft'}`}
                    aria-pressed={r.published}
                    disabled={busy || (r.published && released)}
                    title={r.published && released ? 'Clear the era’s release first' : undefined}
                    className={r.published ? primary : btn}
                    onClick={() =>
                      run(async () => {
                        await publishRace(r.raceId, !r.published);
                        return `${r.name} is ${r.published ? 'back to Draft' : 'published'}.`;
                      })
                    }
                  >
                    {r.published ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.attempts}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.players}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function ErasAdminPage() {
  const [data, setData] = useState<{ eras: AdminEra[]; needed: number } | null>(null);
  const load = useCallback(async () => setData(await getEras()), []);
  const { busy, note, error, setError, run } = useAction(load);
  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load, setError]);

  return (
    <section className="flex flex-col gap-4">
      <Heading>Eras</Heading>
      <p className="m-0 text-[13px] text-[var(--muted)]">
        A race is Draft (test only) until published. An era shows as Coming soon until it is
        released, and needs all {data?.needed ?? 10} races published first.
      </p>
      <ErrorLine text={error} />
      <NoteLine text={note} />
      {!data && !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading eras…</p>}
      {data?.eras.map((e) => (
        <EraCard key={e.id} era={e} needed={data.needed} busy={busy} run={run} />
      ))}
    </section>
  );
}
