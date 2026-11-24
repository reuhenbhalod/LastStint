// The admin page (/admin): for the people running the game. Sign in with an account on the
// Worker's ADMIN_EMAILS list. The tabs (docs/admin-v2-spec.md), each shown only once the server
// has confirmed the sign-in is an admin's:
//   Today (/admin, TodayPage.tsx): the health check and the announcement banner.
//   Schedule (/admin/schedule, below): play any race (practice, with any seed) with a preview
//     (RacePreview.tsx), and run the daily schedule (see it, set a day's race, schedule the next
//     days, re-pin stale days, clear your own run to replay a day). On localhost the race list
//     works without the admin API.
//   Eras, Runs, Players, Versus, Stats, Tickets and Log: their own *Page.tsx files.

import type { RaceModel } from '@laststint/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH0_ENABLED, completeLogin, idToken, login } from '../account/auth0.js';
import { GOOGLE_CLIENT_ID, loadGoogle } from '../account/google.js';
import { ApiError } from '../api.js';
import { Brand } from '../components/Brand.js';
import { goalOf } from '../game/goal.js';
import { ErasAdminPage } from './ErasAdminPage.js';
import { LogPage } from './LogPage.js';
import { PlayersPage } from './PlayersPage.js';
import { RacePreview } from './RacePreview.js';
import { RunsPage } from './RunsPage.js';
import { StatsPage } from './StatsPage.js';
import { TicketsPage } from './TicketsPage.js';
import { TodayPage } from './TodayPage.js';
import { VersusAdminPage } from './VersusAdminPage.js';
import { adminCall, adminToken, setAdminToken } from './session.js';
import { btn, primary } from './ui.js';

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
  model: RaceModel;
}

interface Day {
  date: string;
  number: number;
  raceId: string;
  name: string;
  runs: number;
  current: boolean;
}

export type Tab =
  | 'today'
  | 'schedule'
  | 'eras'
  | 'runs'
  | 'players'
  | 'versus'
  | 'stats'
  | 'tickets'
  | 'log';

export const TABS: Array<{ id: Tab; label: string; href: string }> = [
  { id: 'today', label: 'Today', href: '/admin' },
  { id: 'schedule', label: 'Schedule', href: '/admin/schedule' },
  { id: 'eras', label: 'Eras', href: '/admin/eras' },
  { id: 'runs', label: 'Runs', href: '/admin/runs' },
  { id: 'players', label: 'Players', href: '/admin/players' },
  { id: 'versus', label: 'Versus', href: '/admin/versus' },
  { id: 'stats', label: 'Stats', href: '/admin/stats' },
  { id: 'tickets', label: 'Tickets', href: '/admin/tickets' },
  { id: 'log', label: 'Log', href: '/admin/log' },
];

/** The admin tab the URL asks for: /admin/<tab>, or Today. */
export function adminTab(pathname: string): Tab {
  const m = /^\/admin\/([a-z]+)\/?$/.exec(pathname);
  return TABS.find((t) => t.id === m?.[1] && t.id !== 'today')?.id ?? 'today';
}

/** The playable race files (not loaded until `enabled`: only the Schedule tab needs them). */
function useRaces(enabled: boolean): RaceCard[] | null {
  const [races, setRaces] = useState<RaceCard[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
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
              model: m,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );
  }, [enabled]);
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

export function AdminPage() {
  const tab = adminTab(location.pathname);
  const races = useRaces(tab === 'schedule');
  const [token, setToken] = useState(adminToken);
  // Auth0: back from its login page, or already signed in to it (another tab), the ID token
  // is the admin token (docs/auth0-spec.md).
  useEffect(() => {
    if (!AUTH0_ENABLED || token) return;
    let alive = true;
    (async () => (await completeLogin()) ?? (await idToken()))().then(
      (t) => {
        if (!alive || !t) return;
        setAdminToken(t);
        setToken(t);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [token]);
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [today, setToday] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<Record<string, string>>({});
  const [count, setCount] = useState('14');
  const [pick, setPick] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const local = import.meta.env.DEV;

  const say = useCallback(
    (e: unknown) =>
      setError(
        e instanceof ApiError
          ? e.code === 'not-admin'
            ? 'This account isn’t an admin. Add its email to ADMIN_EMAILS in apps/worker/wrangler.jsonc.'
            : e.status === 0
              ? 'Couldn’t reach the server. Check your connection.'
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
        if (tab === 'schedule') load();
      },
      (e) => {
        if (e instanceof ApiError && e.status === 401) {
          setAdminToken(null);
          setToken(null);
        }
        say(e);
      },
    );
  }, [token, load, say, tab]);

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
  const showRaces = tab === 'schedule' && (signedIn || local);
  const previewed = races?.find((r) => r.id === preview)?.model;
  // Keep the open tab in view in the tab bar (it scrolls sideways when the tabs don't fit).
  const showNav = signedIn || local;
  const nav = useRef<HTMLElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the open tab changes
  useEffect(() => {
    if (!showNav) return;
    const bar = nav.current;
    const on = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !on) return;
    if (
      on.offsetLeft < bar.scrollLeft ||
      on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth
    ) {
      bar.scrollLeft = on.offsetLeft - 16;
    }
  }, [tab, showNav]);
  const nameOf = (id: string) => races?.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
        {/* The tabs show once the server confirms an admin (on localhost, always, for the
            sign-in-free race list). On a phone they wrap onto two rows, so every tab, and the
            open one, stays in view. */}
        {showNav && (
          <nav
            ref={nav}
            aria-label="Admin"
            className="mx-auto flex max-w-6xl flex-wrap gap-x-1 px-4 sm:flex-nowrap sm:overflow-x-auto sm:px-6"
          >
            {TABS.map((t) => (
              <a
                key={t.id}
                href={t.href}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold ${
                  tab === t.id
                    ? 'border-[var(--you)] text-[var(--ink)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        {!token && (
          <section className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="disp m-0 text-[22px] leading-none">Admin sign-in</h1>
              <p className="m-0 mt-1 text-[14px] text-[var(--muted)]">
                Sign in with an account on the admin list.
                {local && tab === 'schedule'
                  ? ' On localhost you can play any race without signing in.'
                  : ''}
              </p>
            </div>
            {AUTH0_ENABLED ? (
              <button
                type="button"
                onClick={() => login()}
                className="disp rounded-full bg-[#EEF1EF] px-5 py-2 text-[14px] text-[#0B0E0D] hover:bg-white"
              >
                Sign in
              </button>
            ) : GOOGLE_CLIENT_ID ? (
              <SignIn
                onToken={(t) => {
                  setAdminToken(t);
                  setToken(t);
                }}
              />
            ) : (
              <span className="text-[13px] text-[var(--muted)]">Sign-in isn’t set up.</span>
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

        {tab !== 'schedule' && token && !me && !error && (
          <p className="m-0 text-[14px] text-[var(--muted)]">Checking your sign-in…</p>
        )}
        {signedIn && tab === 'today' && <TodayPage />}
        {signedIn && tab === 'eras' && <ErasAdminPage />}
        {signedIn && tab === 'runs' && <RunsPage />}
        {signedIn && tab === 'players' && <PlayersPage />}
        {signedIn && tab === 'versus' && <VersusAdminPage />}
        {signedIn && tab === 'stats' && <StatsPage />}
        {signedIn && tab === 'tickets' && <TicketsPage />}
        {signedIn && tab === 'log' && <LogPage />}

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
              <div
                className={`grid items-start gap-4 ${previewed ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : ''}`}
              >
                <div className={`grid gap-3 sm:grid-cols-2 ${previewed ? '' : 'lg:grid-cols-3'}`}>
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
                        <button
                          type="button"
                          className={`${btn} ml-auto`}
                          aria-pressed={preview === r.id}
                          onClick={() => setPreview(preview === r.id ? null : r.id)}
                        >
                          Preview
                        </button>
                        <a
                          className={primary}
                          href={`/?race=${r.id}&seed=${encodeURIComponent(seeds[r.id] ?? String(r.seed))}`}
                        >
                          Play
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
                {previewed && (
                  <>
                    {/* Below lg the preview is a sheet over the list, so it opens where the
                        Preview button was tapped; from lg it sits beside the list, no taller
                        than the window, and scrolls on its own. */}
                    <button
                      type="button"
                      aria-label="Close the preview"
                      className="fixed inset-0 z-30 bg-black/60 lg:hidden"
                      onClick={() => setPreview(null)}
                    />
                    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto p-3 lg:sticky lg:inset-x-auto lg:top-4 lg:bottom-auto lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:p-0">
                      <RacePreview model={previewed} onClose={() => setPreview(null)} />
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'schedule' && signedIn && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="disp m-0 text-[20px] leading-none">Daily schedule</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                  Next
                  <input
                    aria-label="Days to schedule"
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
                          onChange={(e) => {
                            // Read the pick now: the controlled select shows the day's race
                            // again until the reload, so e.target.value changes back.
                            const raceId = e.target.value;
                            act(async () => {
                              await adminCall('/api/admin/day', { date: d.date, raceId });
                              return `${d.date} is now ${nameOf(raceId)}.`;
                            });
                          }}
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
