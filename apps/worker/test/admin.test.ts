// Admin controls (src/admin.ts): Google sign-in plus the ADMIN_EMAILS list (vitest.config.ts
// lists admin@example.com), then scheduling, re-pinning and clearing your own runs.

import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays, todayUtc } from '../src/dates.js';

function b64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function idToken(claims: Record<string, unknown> = {}): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.TEST_GOOGLE_PRIVATE_JWK),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: env.GOOGLE_CLIENT_ID,
      sub: 'google-admin',
      email: 'admin@example.com',
      email_verified: true,
      name: 'Admin',
      exp: Math.floor(Date.now() / 1000) + 600,
      ...claims,
    }),
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

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
