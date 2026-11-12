// Admin page v2's data (docs/admin-v2-spec.md): the Today, Eras, Runs, Players, Versus, Stats and
// Log tabs' types and API calls (apps/worker/src/admin*.ts, through adminCall), and the small
// rules the tabs share: how an era's release reads, which pools a race is in, how a log entry
// reads. The types copy the Worker's; keep the two in step.

import { type MomentTrigger, VERSUS_CARS, VERSUS_TRACKS } from '@laststint/sim';
import { shortDate } from './players.js';
import { adminCall } from './session.js';

// ---- Today ---------------------------------------------------------------------------------

export interface TodayDay {
  date: string;
  number: number;
  raceId: string;
  name: string;
  runs: number;
  current: boolean;
}

export interface AdminToday {
  today: string;
  days: { today: TodayDay | null; tomorrow: TodayDay | null };
  queue: { days: number; low: boolean; warnUnder: number };
  stale: TodayDay[];
  runs: { total: number; verified: number; corrected: number; unverified: number };
}

export interface Announcement {
  id: number;
  text: string;
  tone: 'info' | 'warning';
  endsAt: string | null;
  createdAt: string;
}

export const getToday = () => adminCall<AdminToday>('/api/admin/today');

/** An ISO time as the rest of the admin page shows it: '2026-11-12 06:00 UTC'. */
export function utcText(iso: string): string {
  return `${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

/** A datetime-local value ('2026-11-12T06:00'), read as UTC, as an ISO time. */
export function utcInput(value: string): string {
  return new Date(`${value}:00Z`).toISOString();
}
export const repinDays = () =>
  adminCall<{ repinned: string[]; skipped: string[] }>('/api/admin/repin', {});
export const setAnnouncement = (a: { text: string; tone: string; endsAt: string | null }) =>
  adminCall<{ announcement: Announcement | null }>('/api/admin/announcement', a);
export const clearAnnouncement = () =>
  adminCall<{ announcement: null }>('/api/admin/announcement/clear', {});

// ---- Eras ----------------------------------------------------------------------------------

export interface AdminEraRace {
  raceId: string;
  name: string;
  position: number;
  published: boolean;
  file: boolean;
  attempts: number;
  players: number;
}

export interface AdminEra {
  id: number;
  name: string;
  years: string;
  playOrder: number;
  releasedAt: string | null;
  status: 'coming-soon' | 'scheduled' | 'released';
  published: number;
  races: AdminEraRace[];
}

export const getEras = () => adminCall<{ eras: AdminEra[]; needed: number }>('/api/admin/eras');
export const publishRace = (raceId: string, published: boolean) =>
  adminCall('/api/admin/eras/race', { raceId, published });
export const releaseEra = (eraId: number, at: string | null, confirm = false) =>
  adminCall('/api/admin/eras/release', { eraId, at, ...(confirm ? { confirm: true } : {}) });

/**
 * Whether setting `date` (YYYY-MM-DD, midnight UTC) would move an era that is out now to a later
 * day, taking it from players until then. The Worker asks for confirmation for this too.
 */
export function releaseMovesLater(
  era: Pick<AdminEra, 'status'>,
  date: string,
  now: number,
): boolean {
  return era.status === 'released' && Date.parse(`${date}T00:00:00Z`) > now;
}

/** "Coming soon", "Releases on 1 Jan 2027" or "Released". */
export function eraStatusText(era: Pick<AdminEra, 'status' | 'releasedAt'>): string {
  if (era.status === 'released') return 'Released';
  if (era.status === 'scheduled') return `Releases on ${shortDate(era.releasedAt)}`;
  return 'Coming soon';
}

/** Why an era can't be released yet, or null when it can (the server checks this too). */
export function releaseBlock(era: Pick<AdminEra, 'published'>, needed: number): string | null {
  return era.published >= needed
    ? null
    : `Needs ${needed} published races to release (${era.published} now).`;
}

// ---- Runs ----------------------------------------------------------------------------------

export type RunMode = 'daily' | 'gauntlet' | 'eras';

export const MODE_LABELS: Record<RunMode, string> = {
  daily: 'Daily',
  gauntlet: 'Gauntlet',
  eras: 'Eras',
};

export interface AdminRun {
  mode: RunMode;
  id: string;
  date: string;
  at: string;
  raceId: string;
  raceName: string;
  playerKey: string;
  player: { id: string; name: string; email: string } | null;
  name: string;
  score: number | null;
  result: string;
  verified: boolean;
  corrected: boolean;
  disqualified: boolean;
}

export interface AdminCall {
  momentId: string;
  lap: number;
  chosen: string;
  band: string;
  points: number | null;
  best: string;
  real: string | null;
  matchedReal: boolean;
}

export interface RunDetail {
  run: AdminRun;
  calls: AdminCall[];
  rounds?: Array<{
    round: number;
    raceId: string;
    raceName: string;
    score: number | null;
    won: boolean | null;
    verified: boolean;
    corrected: boolean;
    calls: AdminCall[];
  }>;
}

export interface RunSearch {
  date: string;
  player: string;
  mode: RunMode | '';
}

/** The search's query string: an empty date means every date (with a player). */
export function runsQuery(q: RunSearch): string {
  const p = new URLSearchParams();
  p.set('date', q.date);
  if (q.player.trim()) p.set('player', q.player.trim());
  if (q.mode) p.set('mode', q.mode);
  return `?${p.toString()}`;
}

export const searchRuns = (q: RunSearch) =>
  adminCall<{ runs: AdminRun[]; limit: number }>(`/api/admin/runs${runsQuery(q)}`);
export const getRun = (mode: RunMode, id: string) =>
  adminCall<RunDetail>(`/api/admin/runs/${mode}/${encodeURIComponent(id)}`);
export const reverifyRun = (mode: RunMode, id: string) =>
  adminCall<{ marked: number }>('/api/admin/runs/reverify', { mode, id });
/** Every run submitted on the day (UTC), in every mode or just `mode`. */
export const reverifyDay = (date: string, mode?: RunMode) =>
  adminCall<{ marked: number }>('/api/admin/runs/reverify', { date, ...(mode ? { mode } : {}) });
export const deleteRun = (id: string) => adminCall('/api/admin/runs/delete', { id });

/** How a run's check reads: corrected, checked, or waiting for the nightly check. */
export function checkText(r: Pick<AdminRun, 'verified' | 'corrected'>): string {
  if (r.corrected) return 'Corrected';
  return r.verified ? 'Verified' : 'Not checked yet';
}

// ---- Players -------------------------------------------------------------------------------

export interface PlayerDetail {
  player: import('./players.js').AdminPlayer;
  browsers: Array<{ anonId: string; linkedAt: string }>;
  streak: { current: number; best: number; days: number };
  days: string[];
  runs: AdminRun[];
}

export const getPlayer = (id: string) =>
  adminCall<PlayerDetail>(`/api/admin/players/${encodeURIComponent(id)}`);
export const setPlayerName = (id: string, displayName: string) =>
  adminCall(`/api/admin/players/${encodeURIComponent(id)}/name`, { displayName });
export const setPlayerHidden = (id: string, hidden: boolean) =>
  adminCall(`/api/admin/players/${encodeURIComponent(id)}/hide`, { hidden });

// ---- Versus --------------------------------------------------------------------------------

export interface VersusMatch {
  id: number;
  code: string;
  track: string;
  players: string[];
  cars: Array<{ car: string; startTyre: string }>;
  winner: number | null;
  gap: number | null;
  forfeit: number | null;
  battles: number;
  startedAt: string;
  finishedAt: string;
}

export interface LiveRoom {
  code: string;
  track: string;
  phase: string;
  players: string[];
  lap: number;
  openedAt: string;
  updatedAt: string;
}

export const getVersus = () =>
  adminCall<{ matches: VersusMatch[]; rooms: LiveRoom[] }>('/api/admin/versus');

/** A Versus track's or car's display name ('monza' reads Monza), or the id if it's unknown. */
export const trackName = (id: string) => VERSUS_TRACKS.find((t) => t.id === id)?.name ?? id;
export const carName = (id: string) => VERSUS_CARS.find((c) => c.id === id)?.name ?? id;

const PHASES: Record<string, string> = {
  lobby: 'Waiting for a player',
  pick: 'Picking cars',
  race: 'Racing',
  grading: 'Grading',
  done: 'Finished',
};
/** A live room's phase as words. */
export const phaseText = (phase: string) => PHASES[phase] ?? phase;

const TRIGGERS: Record<MomentTrigger, string> = {
  SC: 'Safety car',
  VSC: 'Virtual safety car',
  RED: 'Red flag',
  preRed: 'Before the red flag',
  rivalPit: 'Rival pits',
  undercut: 'Undercut window',
  cliff: 'Tyre cliff',
  rain: 'Rain',
  drying: 'Track drying',
  fault: 'Car fault',
  teamOrder: 'Team order',
};
/** What set off a decision moment, as words ('cliff' reads Tyre cliff). */
export const triggerText = (t: string) => TRIGGERS[t as MomentTrigger] ?? t;

/** "Alex won by 1.4 s", "Sam won (Alex left)", or "No result". */
export function matchResult(m: VersusMatch): string {
  if (m.winner === null) return 'No result';
  const name = (i: number) => m.players[i] || `Player ${i + 1}`;
  if (m.forfeit !== null) return `${name(m.winner)} won (${name(m.forfeit)} left)`;
  return m.gap === null
    ? `${name(m.winner)} won`
    : `${name(m.winner)} won by ${m.gap.toFixed(1)} s`;
}

// ---- Stats ---------------------------------------------------------------------------------

export interface AdminStats {
  from: string;
  to: string;
  daily: {
    days: Array<{ date: string; players: number; finished: number; meanScore: number }>;
    missed: Array<{
      date: string;
      raceId: string;
      raceName: string;
      momentId: string;
      lap: number | null;
      optionId: string;
      option: string;
      runs: number;
      share: number;
    }>;
  };
  gauntlet: {
    started: number;
    startedRecent: number;
    rounds: Array<{ rounds: number; runs: number }>;
    best: { name: string; rounds: number; meanScore: number; date: string } | null;
  };
  eras: {
    eras: Array<{ id: number; name: string; attempts: number; stars: number; players: number }>;
    playersWithStar: number;
  };
  versus: { days: Array<{ date: string; matches: number }>; total: number };
  accounts: {
    total: number;
    days: Array<{ date: string; signups: number }>;
    signedInShare: number;
    recentPlayers: number;
  };
}

export const getStats = () => adminCall<AdminStats>('/api/admin/stats');

/** A share (0-1) as a whole percentage. */
export function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

// ---- Log -----------------------------------------------------------------------------------

export interface LogEntry {
  id: number;
  at: string;
  email: string;
  action: string;
  detail: unknown;
}

export const getLog = (action: string, before?: number) => {
  const p = new URLSearchParams();
  if (action) p.set('action', action);
  if (before) p.set('before', String(before));
  const q = p.toString();
  return adminCall<{ entries: LogEntry[]; actions: string[] }>(`/api/admin/log${q ? `?${q}` : ''}`);
};

export const ACTION_LABELS: Record<string, string> = {
  schedule: 'Schedule',
  day: 'Set a day',
  repin: 'Re-pin',
  'clear-run': 'Clear own run',
  publish: 'Publish race',
  release: 'Release era',
  reverify: 'Re-verify',
  'delete-run': 'Delete run',
  'player-name': 'Player name',
  hide: 'Hide player',
  announcement: 'Announcement',
  'ticket-create': 'New ticket',
  'ticket-status': 'Ticket status',
  'ticket-delete': 'Delete ticket',
};

/** One line saying what a logged change did. */
export function logSummary(e: Pick<LogEntry, 'action' | 'detail'>): string {
  const d = (e.detail ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v === null || v === undefined || v === '' ? 'none' : String(v));
  switch (e.action) {
    case 'schedule':
      return `${Array.isArray(d.added) ? d.added.length : 0} days added from ${s(d.from)}`;
    case 'day':
      return `${s(d.date)} set to ${s(d.raceId)}`;
    case 'repin':
      return `${Array.isArray(d.repinned) ? d.repinned.length : 0} days re-pinned`;
    case 'clear-run':
      return `${s(d.cleared)} own runs cleared on ${s(d.date)}`;
    case 'publish':
      return `${s(d.raceId)} ${d.published ? 'published' : 'back to Draft'}`;
    case 'release':
      return d.to
        ? `Era ${s(d.eraId)} releases ${s(d.to)}`
        : `Era ${s(d.eraId)} back to Coming soon`;
    case 'reverify':
      return `${s(d.marked)} marked for the nightly check (${d.date ? `${d.mode ? `${s(d.mode)} runs, ` : ''}day ${s(d.date)}` : `${s(d.mode)} ${s(d.id)}`})`;
    case 'delete-run':
      return `Daily run ${s(d.id)} on ${s(d.date)} deleted`;
    case 'player-name':
      return d.to ? `${s(d.id)} renamed to ${s(d.to)}` : `${s(d.id)}: name cleared`;
    case 'hide':
      return `${s(d.id)} ${d.hidden ? 'hidden from' : 'shown on'} leaderboards`;
    case 'announcement': {
      const set = d.set as { text?: string } | undefined;
      return set ? `Set: ${s(set.text)}` : 'Cleared';
    }
    case 'ticket-create':
      return `#${s(d.id)} ${s(d.title)}`;
    case 'ticket-status':
      return `#${s(d.id)} ${s(d.from)} to ${s(d.to)}`;
    case 'ticket-delete':
      return `#${s(d.id)} deleted`;
    default:
      return JSON.stringify(e.detail);
  }
}

// ---- Race preview --------------------------------------------------------------------------

export interface Pools {
  daily: string[];
  survivor: Record<string, number[]>;
  eras: Record<string, string[]>;
}

/** The pools a race is in: "Daily", "Gauntlet", "Era 3". */
export function poolsOf(raceId: string, pools: Pools): string[] {
  const out: string[] = [];
  if (pools.daily.includes(raceId)) out.push('Daily');
  if (Object.hasOwn(pools.survivor, raceId)) out.push('Gauntlet');
  for (const [era, ids] of Object.entries(pools.eras)) {
    if (ids.includes(raceId)) out.push(`Era ${era}`);
  }
  return out;
}

/**
 * The race's fit on the real ground: the median distance from the real track. The share on real
 * tarmac the spec asks for isn't in the data yet (the scenery pipeline writes only the median).
 */
export function fitText(fit: { err?: number } | null): string {
  if (!fit || typeof fit.err !== 'number') return 'No ground fit yet.';
  return `median ${fit.err.toFixed(1)} m from the real track (tarmac share not in the data yet)`;
}
