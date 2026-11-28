// The admin page's Today tab (/admin, docs/admin-v2-spec.md A2): the health check (today's and
// tomorrow's race, the queue, stale days, today's runs) and the announcement banner (A8).

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../api.js';
import { ErrorLine, Heading, NoteLine, Tile, useAction } from './Notice.js';
import { errorText } from './tickets.js';
import { btn, danger, field, inlineField, primary } from './ui.js';
import {
  type AdminToday,
  type Announcement,
  type TodayDay,
  clearAnnouncement,
  getToday,
  repinDays,
  setAnnouncement,
  utcInput,
  utcText,
} from './v2.js';

function DayCard({ label, day }: { label: string; day: TodayDay | null }) {
  return (
    <div className={`card flex flex-col gap-1 ${day ? '' : '!border-[var(--box)]'}`}>
      <span className="text-[12px] text-[var(--muted)]">{label}</span>
      {day ? (
        <>
          <span className="disp text-[18px] leading-tight">{day.name}</span>
          <span className="text-[13px] text-[var(--muted)]">
            #{day.number} · {day.date} · {day.runs} runs
            {day.current ? '' : ' · stale'}
          </span>
        </>
      ) : (
        <span className="disp text-[18px] text-[var(--box)]">Not scheduled</span>
      )}
    </div>
  );
}

function AnnouncementForm() {
  const [current, setCurrent] = useState<Announcement | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [tone, setTone] = useState<'info' | 'warning'>('info');
  const [ends, setEnds] = useState('');
  const load = useCallback(async () => {
    const r = await apiGet<{ announcement: Announcement | null }>('/api/announcement');
    setCurrent(r.announcement);
  }, []);
  const { busy, note, error, setError, run } = useAction(load);
  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load, setError]);

  return (
    <section className="flex flex-col gap-3">
      <Heading>Announcement</Heading>
      <p className="m-0 text-[13px] text-[var(--muted)]">
        One banner at a time, under the top bar on every page. Players can dismiss it.
      </p>
      <ErrorLine text={error} />
      <NoteLine text={note} />
      <div className="card flex flex-col gap-2">
        <span className="text-[12px] text-[var(--muted)]">Showing now</span>
        {current === undefined ? (
          <span className="text-[14px] text-[var(--muted)]">Loading…</span>
        ) : current ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px]">
              {current.text}{' '}
              <span className="text-[var(--muted)]">
                ({current.tone === 'warning' ? 'warning' : 'info'}
                {current.endsAt ? `, until ${utcText(current.endsAt)}` : ''})
              </span>
            </span>
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await clearAnnouncement();
                  return 'Announcement cleared.';
                })
              }
            >
              Clear
            </button>
          </div>
        ) : (
          <span className="text-[14px] text-[var(--muted)]">No announcement.</span>
        )}
      </div>
      <form
        className="card flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await setAnnouncement({
              text,
              tone,
              endsAt: ends ? utcInput(ends) : null,
            });
            setText('');
            setEnds('');
            return 'Announcement set.';
          });
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
          New announcement
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            rows={2}
            className={field}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
            Tone
            <select
              aria-label="Tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as 'info' | 'warning')}
              className={inlineField}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
            Ends (UTC, optional)
            <input
              type="datetime-local"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className={inlineField}
            />
          </label>
          <button type="submit" className={primary} disabled={busy || !text.trim()}>
            Set announcement
          </button>
        </div>
      </form>
    </section>
  );
}

export function TodayPage() {
  const [data, setData] = useState<AdminToday | null>(null);
  const load = useCallback(async () => setData(await getToday()), []);
  const { busy, note, error, setError, run } = useAction(load);
  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load, setError]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Heading
          right={
            <button
              type="button"
              className={btn}
              onClick={() => load().catch((e) => setError(errorText(e)))}
            >
              Refresh
            </button>
          }
        >
          Today
        </Heading>
        <ErrorLine text={error} />
        <NoteLine text={note} />
        {!data ? (
          !error && <p className="m-0 text-[14px] text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <DayCard label={`Today (${data.today})`} day={data.days.today} />
              <DayCard label="Tomorrow" day={data.days.tomorrow} />
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Tile
                label={`Days queued (warn under ${data.queue.warnUnder})`}
                value={data.queue.days}
                warn={data.queue.low}
              />
              <Tile label="Runs today" value={data.runs.total} />
              <Tile label="Verified" value={data.runs.verified} />
              <Tile label="Corrected" value={data.runs.corrected} warn={data.runs.corrected > 0} />
              <Tile label="Not verified yet" value={data.runs.unverified} />
            </dl>
            {data.queue.low && (
              <p className="m-0 text-[14px] text-[var(--flag)]">
                The queue is low. Schedule more days on the Schedule tab.
              </p>
            )}
          </>
        )}
      </section>

      {data && (
        <section className="flex flex-col gap-3">
          <Heading
            right={
              <button
                type="button"
                className={btn}
                disabled={busy || data.stale.length === 0}
                onClick={() =>
                  run(async () => {
                    const r = await repinDays();
                    return `Re-pinned ${r.repinned.length} day(s)${r.skipped.length ? `; ${r.skipped.length} with runs left as they were` : ''}.`;
                  })
                }
              >
                Re-pin stale days
              </button>
            }
          >
            Stale days
          </Heading>
          {data.stale.length === 0 ? (
            <p className="m-0 text-[14px] text-[var(--muted)]">
              Every scheduled day pins its race file’s current version.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
              {data.stale.map((d) => (
                <li key={d.date}>
                  {d.date} · {d.name}
                  {d.runs > 0 ? ` · ${d.runs} runs (kept as it is)` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AnnouncementForm />
    </div>
  );
}
