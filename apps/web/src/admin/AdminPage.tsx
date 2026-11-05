// The admin page (/admin): for the people running the game. Sign in with a Google account on
// the Worker's ADMIN_EMAILS list, then: play any race (practice, with any seed), and run the
// daily schedule (see it, set a day's race, schedule the next days, re-pin stale days, clear
// your own run to replay a day). On localhost the race list works without the admin API.

import type { RaceModel } from '@boxthislap/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, loadGoogle } from '../account/google.js';
import { ApiError } from '../api.js';
import { Brand } from '../components/Brand.js';
import { goalOf } from '../game/goal.js';
import { adminCall, adminToken, setAdminToken } from './session.js';

const RACE_FILES = import.meta.glob<{ default: RaceModel }>('../../../../data/races/*.json');

interface RaceCard {
  id: string;
  name: string;
  user: string;
  team: string;
  rival: string;
  goal: string;
  defend: boolean;
  calls: number;
  seed: number;
  laps: string;
}

interface Day {
  date: string;
  number: number;
  raceId: string;
  name: string;
  runs: number;
  current: boolean;
}

function useRaces(): RaceCard[] | null {
  const [races, setRaces] = useState<RaceCard[] | null>(null);
  useEffect(() => {
    // One file failing to load (a race file removed while the dev server ran) skips that race.
    Promise.allSettled(Object.values(RACE_FILES).map((load) => load())).then((mods) =>
      setRaces(
        mods
          .flatMap((m) => (m.status === 'fulfilled' ? [m.value.default] : []))
          .filter((m) => m.decisionMoments.length > 0)
          .map((m) => {
            const goal = goalOf(m);
            return {
              id: m.race.id,
              name: m.race.name ?? m.race.id,
              user: m.userSide,
              team: m.drivers.find((d) => d.code === m.userSide)?.team ?? '',
              rival: m.rival,
              goal: goal.short,
              defend: goal.kind === 'defend',
              calls: m.decisionMoments.length,
              seed: m.race.seed,
              laps: `${m.race.laps - m.race.takeoverLap} laps`,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );
  }, []);
  return races;
}

function SignIn({ onToken }: { onToken: (t: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  useEffect(() => {
    let alive = true;
    loadGoogle().then(
      (g) => {
        if (!alive || !el.current) return;
        g.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => cb.current(r.credential) });
        g.renderButton(el.current, { theme: 'filled_black', size: 'large', shape: 'pill' });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  return <div ref={el} className="gsi-button min-h-[40px]" />;
}

const btn =
  'rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)] disabled:opacity-40';
const primary =
  'rounded-lg bg-[var(--you)] px-3 py-1.5 text-[13px] font-bold text-[var(--you-ink)] hover:brightness-110 disabled:opacity-40';

export function AdminPage() {
  const races = useRaces();
  const [token, setToken] = useState(adminToken);
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [today, setToday] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<Record<string, string>>({});
  const [count, setCount] = useState('14');
  const [pick, setPick] = useState('');
  const local = import.meta.env.DEV;

  const say = useCallback(
    (e: unknown) =>
      setError(
        e instanceof ApiError
          ? e.code === 'not-admin'
            ? 'This Google account isn’t an admin. Add its email to ADMIN_EMAILS in apps/worker/wrangler.jsonc.'
            : e.status === 404
              ? 'The admin API isn’t on this server yet (it goes live with the next deploy).'
              : `The server said ${e.code} (${e.status}).`
          : String((e as Error)?.message ?? e),
      ),
    [],
  );

  const load = useCallback(async () => {
    try {
      const r = await adminCall<{ today: string; days: Day[] }>('/api/admin/schedule');
      setToday(r.today);
      setDays(r.days);
    } catch (e) {
      say(e);
    }
  }, [say]);

  // Check the token with the server.
  useEffect(() => {
    if (!token) return;
    setError(null);
    adminCall<{ email: string }>('/api/admin/me').then(
      (r) => {
        setMe(r);
        load();
      },
      (e) => {
        if (e instanceof ApiError && e.status === 401) {
          setAdminToken(null);
          setToken(null);
        }
        say(e);
      },
    );
  }, [token, load, say]);

  const act = async (f: () => Promise<string>) => {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      setNote(await f());
      await load();
    } catch (e) {
      say(e);
    } finally {
      setBusy(false);
    }
  };

  const signedIn = !!token && !!me;
  const showRaces = signedIn || local;
  const nameOf = (id: string) => races?.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <span className="flex items-baseline gap-2">
            <a href="/" className="disp wide text-[20px] leading-none">
              <Brand />
            </a>
            <span className="eyebrow">Admin</span>
          </span>
          <span className="flex items-center gap-2 text-[13px]">
            {me && <span className="text-[var(--muted)]">{me.email}</span>}
            {token && (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setAdminToken(null);
                  setToken(null);
                  setMe(null);
                  setDays(null);
                }}
              >
                Sign out
              </button>
            )}
            <a href="/" className={btn}>
              Back to the game
            </a>
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
        {!token && (
          <section className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="disp m-0 text-[22px] leading-none">Admin sign-in</h1>
              <p className="m-0 mt-1 text-[14px] text-[var(--muted)]">
                Sign in with a Google account on the admin list.
                {local ? ' On localhost you can play any race without signing in.' : ''}
              </p>
            </div>
            {GOOGLE_CLIENT_ID ? (
              <SignIn
                onToken={(t) => {
                  setAdminToken(t);
                  setToken(t);
                }}
              />
            ) : (
              <span className="text-[13px] text-[var(--muted)]">Google sign-in isn’t set up.</span>
            )}
          </section>
        )}
        {error && (
          <p className="m-0 rounded-lg border border-[var(--box)] bg-[color-mix(in_srgb,var(--box)_12%,transparent)] px-3 py-2 text-[14px]">
            {error}
          </p>
        )}
        {note && (
          <p className="m-0 rounded-lg border border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_12%,transparent)] px-3 py-2 text-[14px]">
            {note}
          </p>
        )}

        {showRaces && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="disp m-0 text-[20px] leading-none">Play any race</h2>
              <span className="text-[13px] text-[var(--muted)]">
                Practice runs: graded on this device, never submitted
              </span>
            </div>
            {!races ? (
              <p className="m-0 text-[14px] text-[var(--muted)]">Loading races…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {races.map((r) => (
                  <article key={r.id} className="card flex flex-col gap-2 !p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="disp text-[16px] leading-tight">{r.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.defend ? 'bg-[color-mix(in_srgb,var(--rival)_18%,transparent)] text-[var(--rival)]' : 'bg-[color-mix(in_srgb,var(--you)_18%,transparent)] text-[var(--you)]'}`}
                      >
                        {r.defend ? 'Defend' : 'Beat'}
                      </span>
                    </div>
                    <span className="text-[13px] text-[var(--muted)]">
                      {r.user} ({r.team}) · {r.goal} · {r.calls} calls · {r.laps}
                    </span>
                    <div className="mt-auto flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                        Seed
                        <input
                          value={seeds[r.id] ?? String(r.seed)}
                          onChange={(e) => setSeeds({ ...seeds, [r.id]: e.target.value })}
                          inputMode="numeric"
                          className="w-24 rounded-md border border-[var(--rule)] bg-[var(--card-2)] px-2 py-1 text-[13px] text-[var(--ink)]"
                        />
                      </label>
                      <a
                        className={`${primary} ml-auto`}
                        href={`/?race=${r.id}&seed=${encodeURIComponent(seeds[r.id] ?? String(r.seed))}`}
                      >
                        Play
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {signedIn && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="disp m-0 text-[20px] leading-none">Daily schedule</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                  Next
                  <input
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    inputMode="numeric"
                    className="w-14 rounded-md border border-[var(--rule)] bg-[var(--card-2)] px-2 py-1 text-[13px] text-[var(--ink)]"
                  />
                  days
                </label>
                <select
                  aria-label="Races to schedule"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  className="rounded-md border border-[var(--rule)] bg-[var(--card-2)] px-2 py-1.5 text-[13px]"
                >
                  <option value="">Rotate all races</option>
                  {races?.map((r) => (
                    <option key={r.id} value={r.id}>
                      Only {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  className={primary}
                  onClick={() =>
                    act(async () => {
                      const r = await adminCall<{ added: unknown[] }>('/api/admin/schedule', {
                        from: today,
                        days: Number(count),
                        raceId: pick || undefined,
                      });
                      return `Scheduled ${r.added.length} new day${r.added.length === 1 ? '' : 's'} (days already scheduled are kept).`;
                    })
                  }
                >
                  Schedule
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={btn}
                  onClick={() =>
                    act(async () => {
                      const r = await adminCall<{ repinned: string[]; skipped: string[] }>(
                        '/api/admin/repin',
                        {},
                      );
                      return `Re-pinned ${r.repinned.length} day(s) to the current race files${r.skipped.length ? `; ${r.skipped.length} with runs left as they were` : ''}.`;
                    })
                  }
                >
                  Re-pin stale days
                </button>
                <button
                  type="button"
                  disabled={busy || !today}
                  className={btn}
                  onClick={() =>
                    act(async () => {
                      const r = await adminCall<{ cleared: number }>('/api/admin/runs/clear', {
                        date: today,
                      });
                      try {
                        localStorage.removeItem('pitwall:run');
                      } catch {
                        // storage blocked
                      }
                      return r.cleared
                        ? `Cleared your run for ${today}: you can play it again.`
                        : `You have no run on ${today}.`;
                    })
                  }
                >
                  Clear my run today
                </button>
              </div>
            </div>
            <div className="card overflow-x-auto !p-0">
              <table className="w-full text-left text-[13px]">
                <thead className="eyebrow">
                  <tr className="border-b border-[var(--rule)]">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Race</th>
                    <th className="px-3 py-2">Runs</th>
                    <th className="px-3 py-2">Pinned</th>
                    <th className="px-3 py-2">Change race</th>
                  </tr>
                </thead>
                <tbody>
                  {(days ?? []).map((d) => (
                    <tr
                      key={d.date}
                      className={`border-b border-[var(--rule)] ${d.date === today ? 'bg-[color-mix(in_srgb,var(--you)_10%,transparent)]' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold">
                        {d.date}
                        {d.date === today ? ' · today' : ''}
                      </td>
                      <td className="px-3 py-2">{d.number}</td>
                      <td className="px-3 py-2">{nameOf(d.raceId)}</td>
                      <td className="px-3 py-2">{d.runs}</td>
                      <td className="px-3 py-2">
                        {d.current ? (
                          <span className="text-[var(--you)]">Current</span>
                        ) : (
                          <span className="text-[var(--flag)]">Stale: re-pin</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Race on ${d.date}`}
                          disabled={busy || d.runs > 0 || d.date < today}
                          value={d.raceId}
                          onChange={(e) =>
                            act(async () => {
                              await adminCall('/api/admin/day', {
                                date: d.date,
                                raceId: e.target.value,
                              });
                              return `${d.date} is now ${nameOf(e.target.value)}.`;
                            })
                          }
                          className="rounded-md border border-[var(--rule)] bg-[var(--card-2)] px-2 py-1 text-[13px] disabled:opacity-40"
                        >
                          {races?.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {days && days.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-[var(--muted)]">
                        Nothing scheduled around today. Use Schedule above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-[12px] text-[var(--muted)]">
              Admins are the emails in ADMIN_EMAILS (apps/worker/wrangler.jsonc). A day with runs
              can’t change race; past days are read-only.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
