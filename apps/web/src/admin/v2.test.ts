import { describe, expect, it } from 'vitest';
import pools from '../../../../data/pools.json';
import { TABS, adminTab } from './AdminPage.js';
import {
  type Pools,
  type VersusMatch,
  checkText,
  eraStatusText,
  fitText,
  logSummary,
  matchResult,
  pct,
  poolsOf,
  releaseBlock,
  runsQuery,
} from './v2.js';

describe('admin tabs', () => {
  it('lists the nine tabs in the spec’s order', () => {
    expect(TABS.map((t) => t.label)).toEqual([
      'Today',
      'Schedule',
      'Eras',
      'Runs',
      'Players',
      'Versus',
      'Stats',
      'Tickets',
      'Log',
    ]);
  });

  it('routes /admin to Today and /admin/<tab> to its tab', () => {
    expect(adminTab('/admin')).toBe('today');
    expect(adminTab('/admin/')).toBe('today');
    expect(adminTab('/admin/schedule')).toBe('schedule');
    expect(adminTab('/admin/log/')).toBe('log');
    expect(adminTab('/admin/today')).toBe('today');
    expect(adminTab('/admin/nope')).toBe('today');
  });
});

describe('Eras release', () => {
  it('reads the release state', () => {
    expect(eraStatusText({ status: 'coming-soon', releasedAt: null })).toBe('Coming soon');
    expect(eraStatusText({ status: 'released', releasedAt: '2026-01-01T00:00:00.000Z' })).toBe(
      'Released',
    );
    expect(eraStatusText({ status: 'scheduled', releasedAt: '2027-03-12T00:00:00.000Z' })).toBe(
      'Releases on 12 Mar 2027',
    );
  });

  it('blocks a release under ten published races', () => {
    expect(releaseBlock({ published: 9 }, 10)).toBe('Needs 10 published races to release (9 now).');
    expect(releaseBlock({ published: 10 }, 10)).toBeNull();
  });
});

describe('Runs', () => {
  it('builds the search query', () => {
    expect(runsQuery({ date: '2026-11-11', player: '', mode: '' })).toBe('?date=2026-11-11');
    expect(runsQuery({ date: '', player: ' ann ', mode: 'eras' })).toBe(
      '?date=&player=ann&mode=eras',
    );
  });

  it('reads a run’s check', () => {
    expect(checkText({ verified: false, corrected: false })).toBe('Not checked yet');
    expect(checkText({ verified: true, corrected: false })).toBe('Verified');
    expect(checkText({ verified: true, corrected: true })).toBe('Corrected');
  });
});

describe('Versus', () => {
  const match = (m: Partial<VersusMatch>): VersusMatch => ({
    id: 1,
    code: 'ABCD',
    track: 'bahrain',
    players: ['Alex', 'Sam'],
    cars: [],
    winner: 0,
    gap: 1.42,
    forfeit: null,
    battles: 2,
    startedAt: '',
    finishedAt: '',
    ...m,
  });

  it('says who won and how', () => {
    expect(matchResult(match({}))).toBe('Alex won by 1.4 s');
    expect(matchResult(match({ winner: 1, forfeit: 0, gap: null }))).toBe('Sam won (Alex left)');
    expect(matchResult(match({ winner: null }))).toBe('No result');
  });
});

describe('Log', () => {
  it('sums up each change in a line', () => {
    expect(
      logSummary({ action: 'publish', detail: { raceId: 'monaco-1988', published: true } }),
    ).toBe('monaco-1988 published');
    expect(logSummary({ action: 'release', detail: { eraId: 2, to: null } })).toBe(
      'Era 2 back to Coming soon',
    );
    expect(logSummary({ action: 'reverify', detail: { date: '2026-11-11', marked: 4 } })).toBe(
      '4 marked for the nightly check (day 2026-11-11)',
    );
    expect(logSummary({ action: 'hide', detail: { id: 'p1', hidden: true } })).toBe(
      'p1 hidden from leaderboards',
    );
    expect(logSummary({ action: 'announcement', detail: { set: { text: 'Hi' } } })).toBe('Set: Hi');
    expect(logSummary({ action: 'announcement', detail: { cleared: 3 } })).toBe('Cleared');
    expect(logSummary({ action: 'player-name', detail: { id: 'p1', to: '' } })).toBe(
      'p1: name cleared',
    );
  });
});

describe('race preview', () => {
  it('names the pools a race is in', () => {
    const p = pools as unknown as Pools;
    const daily = p.daily[0] as string;
    expect(poolsOf(daily, p)).toContain('Daily');
    const gauntlet = Object.keys(p.survivor)[0] as string;
    expect(poolsOf(gauntlet, p)).toContain('Gauntlet');
    const [era, ids] = Object.entries(p.eras)[0] as [string, string[]];
    expect(poolsOf(ids[0] as string, p)).toContain(`Era ${era}`);
    expect(poolsOf('nowhere-1950', p)).toEqual([]);
  });

  it('reads the ground fit, with or without the tarmac share', () => {
    expect(fitText(null)).toBe('No ground fit yet.');
    expect(fitText({ err: 3.42 })).toBe('median 3.4 m from the real track');
    expect(fitText({ err: 3.42, cover: 0.913 })).toBe(
      'median 3.4 m from the real track, 91% on real tarmac',
    );
    expect(fitText({ err: 2, cover: 88 })).toBe(
      'median 2.0 m from the real track, 88% on real tarmac',
    );
    expect(pct(0.5)).toBe('50%');
  });
});
