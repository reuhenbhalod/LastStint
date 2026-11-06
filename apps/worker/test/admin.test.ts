// Admin controls (src/admin.ts): Google sign-in plus the ADMIN_EMAILS list (vitest.config.ts
// lists admin@example.com), then scheduling, re-pinning and clearing your own runs.

import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { todayUtc } from '../src/dates.js';
import { idToken } from './helpers.js';

async function admin(path: string, body?: unknown, token?: string) {
  const t = token ?? (await idToken());
  return SELF.fetch(`https://api.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const today = todayUtc(Date.now());

describe('admin access', () => {
  it('needs a Google sign-in from a listed, verified email', async () => {
    expect((await SELF.fetch('https://api.test/api/admin/me')).status).toBe(401);
    expect((await admin('/api/admin/me', undefined, 'not-a-token')).status).toBe(401);
    const stranger = await admin(
      '/api/admin/me',
      undefined,
      await idToken({ email: 'x@example.com' }),
    );
    expect(stranger.status).toBe(403);
    const unverified = await admin(
      '/api/admin/me',
      undefined,
      await idToken({ email_verified: false }),
    );
    expect(unverified.status).toBe(403);
    const ok = await admin('/api/admin/me');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ admin: true, email: 'admin@example.com' });
  });

  it('marks an admin account at sign-in and on the player (for the Admin button)', async () => {
    const signIn = (credential: string, anonId: string) =>
      SELF.fetch('https://api.test/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, anonId }),
      });
    const adminId = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
    const otherId = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const res = await signIn(await idToken(), adminId);
    expect(await res.json()).toMatchObject({ email: 'admin@example.com', admin: true });
    const me = await (
      await SELF.fetch(`https://api.test/api/players/${adminId}?today=${today}`)
    ).json();
    expect(me).toMatchObject({ account: { admin: true } });

    const other = await signIn(await idToken({ sub: 'google-x', email: 'x@example.com' }), otherId);
    expect(await other.json()).toMatchObject({ admin: false });
    const them = await (
      await SELF.fetch(`https://api.test/api/players/${otherId}?today=${today}`)
    ).json();
    expect(them).toMatchObject({ account: { admin: false } });
  });
});

describe('admin controls', () => {
  it('lists the playable races', async () => {
    const { races } = (await (await admin('/api/admin/races')).json()) as {
      races: Array<{ id: string; moments: number }>;
    };
    expect(races.length).toBeGreaterThanOrEqual(11);
    expect(races.every((r) => r.moments > 0)).toBe(true);
    expect(races.map((r) => r.id)).toContain('abu-dhabi-2021');
  });

  it('schedules days rotating the races, keeps scheduled days, and re-pins stale ones', async () => {
    const res = await admin('/api/admin/schedule', { from: today, days: 3 });
    const { added } = (await res.json()) as { added: Array<{ raceId: string; number: number }> };
    expect(added).toHaveLength(3);
    expect(new Set(added.map((a) => a.raceId)).size).toBe(3);
    expect(added.map((a) => a.number)).toEqual([1, 2, 3]);
    // Scheduled days are kept.
    const again = (await (await admin('/api/admin/schedule', { from: today, days: 3 })).json()) as {
      added: unknown[];
    };
    expect(again.added).toEqual([]);

    // Set one day to a race; a stale pin is re-pinned.
    const day = today; // the daily is served for today
    expect((await admin('/api/admin/day', { date: day, raceId: 'canada-2022' })).status).toBe(200);
    await env.DB.prepare("UPDATE daily SET model_hash = 'old' WHERE date = ?").bind(day).run();
    let { days } = (await (await admin('/api/admin/schedule')).json()) as {
      days: Array<{ date: string; raceId: string; current: boolean }>;
    };
    expect(days.find((d) => d.date === day)).toMatchObject({
      raceId: 'canada-2022',
      current: false,
    });
    const pinned = (await (await admin('/api/admin/repin', {})).json()) as { repinned: string[] };
    expect(pinned.repinned).toContain(day);
    days = ((await (await admin('/api/admin/schedule')).json()) as { days: typeof days }).days;
    expect(days.every((d) => d.current)).toBe(true);

    // The daily now serves that race.
    const daily = (await (await SELF.fetch(`https://api.test/api/daily?date=${day}`)).json()) as {
      raceId: string;
    };
    expect(daily.raceId).toBe('canada-2022');
  });

  it('refuses races that are not playable, and clears your own runs', async () => {
    expect((await admin('/api/admin/day', { date: today, raceId: 'japan-2023' })).status).toBe(400);
    const cleared = (await (await admin('/api/admin/runs/clear', { date: today })).json()) as {
      cleared: number;
    };
    expect(cleared.cleared).toBe(0);
  });
});
