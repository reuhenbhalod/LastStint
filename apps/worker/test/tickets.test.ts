// The admin ticket tracker (src/tickets.ts) against a local D1: admin-only access on every
// route, CRUD, created_by, completed_at, validation, and the seed SQL
// (scripts/tickets-seed-sql.ts). vitest.config.ts lists admin@ and other@example.com as admins.

import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { seedSql, sqlString } from '../scripts/tickets-seed-sql.js';
import type { Ticket } from '../src/ticketFields.js';
import { idToken } from './helpers.js';

/**
 * Call the API as an admin (or with `token`; null sends none). A string body is sent as is,
 * anything else as JSON; `contentType` overrides the JSON content type.
 */
async function api(
  method: string,
  path: string,
  body?: unknown,
  options: { token?: string | null; contentType?: string } = {},
): Promise<Response> {
  const token = options.token === undefined ? await idToken() : options.token;
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = options.contentType ?? 'application/json';
  return SELF.fetch(`https://api.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function create(body: Record<string, unknown> = {}, token?: string): Promise<Ticket> {
  const res = await api(
    'POST',
    '/api/admin/tickets',
    { title: 'A ticket', category: 'bug', ...body },
    { token },
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { ticket: Ticket }).ticket;
}

async function patch(id: number | string, body: unknown): Promise<Response> {
  return api('PATCH', `/api/admin/tickets/${id}`, body);
}

/** PATCH that must succeed; the updated ticket. */
async function patched(id: number, body: unknown): Promise<Ticket> {
  const res = await patch(id, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { ticket: Ticket }).ticket;
}

async function list(): Promise<Ticket[]> {
  const res = await api('GET', '/api/admin/tickets');
  expect(res.status).toBe(200);
  return ((await res.json()) as { tickets: Ticket[] }).tickets;
}

describe('ticket access', () => {
  const routes = (id: number): Array<[string, string, unknown]> => [
    ['GET', '/api/admin/tickets', undefined],
    ['POST', '/api/admin/tickets', { title: 'x', category: 'bug' }],
    ['PATCH', `/api/admin/tickets/${id}`, { title: 'y' }],
    ['DELETE', `/api/admin/tickets/${id}`, undefined],
  ];

  it('needs a token on every route (401), and changes nothing', async () => {
    const t = await create();
    for (const [method, path, body] of routes(t.id)) {
      const none = await api(method, path, body, { token: null });
      expect(none.status, `${method} ${path}`).toBe(401);
      expect(await none.json()).toMatchObject({ error: 'sign-in-required' });
      const bad = await api(method, path, body, { token: 'not-a-token' });
      expect(bad.status, `${method} ${path}`).toBe(401);
    }
    expect(await list()).toEqual([t]);
  });

  it('refuses a non-admin on every route (403), and changes nothing', async () => {
    const t = await create();
    const stranger = await idToken({ sub: 'google-x', email: 'x@example.com' });
    const unverified = await idToken({ email_verified: false });
    for (const [method, path, body] of routes(t.id)) {
      for (const token of [stranger, unverified]) {
        const res = await api(method, path, body, { token });
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(await res.json()).toMatchObject({ error: 'not-admin' });
      }
    }
    expect(await list()).toEqual([t]);
  });

  it('checks the admin before the body or the id', async () => {
    const res = await api('POST', '/api/admin/tickets', '{not json', { token: null });
    expect(res.status).toBe(401);
    expect((await api('DELETE', '/api/admin/tickets/abc', undefined, { token: null })).status).toBe(
      401,
    );
  });

  it('allows PATCH and DELETE from the website (CORS)', async () => {
    const res = await SELF.fetch('https://api.test/api/admin/tickets/1', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    const allowed = res.headers.get('Access-Control-Allow-Methods') ?? '';
    expect(allowed).toContain('PATCH');
    expect(allowed).toContain('DELETE');
  });
});

describe('tickets CRUD', () => {
  it('creates, lists, edits and deletes a ticket', async () => {
    expect(await list()).toEqual([]);

    const before = Date.now();
    const t = await create({
      title: '  Pit lane is too long  ',
      description: 'Monaco pit lane',
      category: 'content',
      notes: "it's 'quoted'",
      source: 'playtest',
    });
    expect(t).toMatchObject({
      title: 'Pit lane is too long',
      description: 'Monaco pit lane',
      category: 'content',
      status: 'open',
      notes: "it's 'quoted'",
      source: 'playtest',
      createdBy: 'admin@example.com',
      completedAt: null,
    });
    expect(t.id).toBeGreaterThan(0);
    expect(t.createdAt).toBeGreaterThanOrEqual(before);
    expect(t.updatedAt).toBe(t.createdAt);

    expect(await list()).toEqual([t]);

    const edited = await patched(t.id, { title: 'Pit lane length', category: 'bug', notes: 'n' });
    expect(edited).toMatchObject({
      id: t.id,
      title: 'Pit lane length',
      description: 'Monaco pit lane',
      category: 'bug',
      notes: 'n',
      source: 'playtest',
      createdBy: 'admin@example.com',
      createdAt: t.createdAt,
    });
    expect(edited.updatedAt).toBeGreaterThanOrEqual(t.updatedAt);
    expect(await list()).toEqual([edited]);

    const del = await api('DELETE', `/api/admin/tickets/${t.id}`);
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
    expect(await list()).toEqual([]);
  });

  it("records who created a ticket from the admin's token (lower-cased), not the body", async () => {
    const t = await create({}, await idToken({ sub: 'google-o', email: 'Other@Example.com' }));
    expect(t.createdBy).toBe('other@example.com');
    // Another admin editing it doesn't change who created it.
    expect((await patched(t.id, { notes: 'seen' })).createdBy).toBe('other@example.com');
  });

  it('lists newest first', async () => {
    const a = await create({ title: 'first' });
    const b = await create({ title: 'second' });
    expect((await list()).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('404s on a ticket that does not exist', async () => {
    expect((await patch(999, { title: 'x' })).status).toBe(404);
    expect((await api('DELETE', '/api/admin/tickets/999')).status).toBe(404);
    const t = await create();
    await api('DELETE', `/api/admin/tickets/${t.id}`);
    const again = await api('DELETE', `/api/admin/tickets/${t.id}`);
    expect(again.status).toBe(404);
    expect(await again.json()).toMatchObject({ error: 'not-found' });
  });
});

describe('completed_at', () => {
  it('is set when a ticket becomes done, kept while done, and cleared when it leaves', async () => {
    const t = await create();
    expect(t.completedAt).toBeNull();

    const prog = await patched(t.id, { status: 'in_progress' });
    expect(prog.status).toBe('in_progress');
    expect(prog.completedAt).toBeNull();

    const done = await patched(t.id, { status: 'done' });
    expect(done.status).toBe('done');
    expect(done.completedAt).toBeGreaterThanOrEqual(prog.updatedAt);

    // Pin the stamp in the past, so "kept" is distinguishable from "re-stamped".
    await env.DB.prepare('UPDATE tickets SET completed_at = 1000 WHERE id = ?').bind(t.id).run();
    const again = await patched(t.id, { status: 'done', notes: 'n' });
    expect(again.completedAt).toBe(1000);
    const edited = await patched(t.id, { title: 'renamed' });
    expect(edited.completedAt).toBe(1000);

    const reopened = await patched(t.id, { status: 'open' });
    expect(reopened.status).toBe('open');
    expect(reopened.completedAt).toBeNull();
  });

  it('is set on a ticket created as done', async () => {
    const t = await create({ status: 'done' });
    expect(t.completedAt).toBe(t.createdAt);
  });
});

describe('validation', () => {
  it('rejects bad create bodies', async () => {
    const bad: unknown[] = [
      {},
      { category: 'bug' },
      { title: 'x' },
      { title: '   ', category: 'bug' },
      { title: 'x', category: 'nope' },
      { title: 'x', category: 'bug', status: 'closed' },
      { title: 42, category: 'bug' },
      { title: 'x', category: 'bug', notes: null },
      { title: 'x'.repeat(201), category: 'bug' },
      { title: 'x', category: 'bug', description: 'd'.repeat(10_001) },
      { title: 'x', category: 'bug', notes: 'n'.repeat(10_001) },
      { title: 'x', category: 'bug', source: 's'.repeat(501) },
      { title: 'x', category: 'bug', createdBy: 'me' },
      { title: 'x', category: 'bug', id: 5 },
      [],
      'null',
      '"a string"',
    ];
    for (const body of bad) {
      const res = await api('POST', '/api/admin/tickets', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid' });
    }
    expect(await list()).toEqual([]);
  });

  it('accepts fields at their length limits', async () => {
    const t = await create({
      title: 'x'.repeat(200),
      description: 'd'.repeat(10_000),
      notes: 'n'.repeat(10_000),
      source: 's'.repeat(500),
    });
    expect(t.title).toHaveLength(200);
  });

  it('rejects bad JSON, the wrong content type and oversized bodies', async () => {
    const badJson = await api('POST', '/api/admin/tickets', '{not json');
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toMatchObject({ error: 'bad-json' });

    const text = await api('POST', '/api/admin/tickets', '{"title":"x","category":"bug"}', {
      contentType: 'text/plain',
    });
    expect(text.status).toBe(415);
    const none = await api('POST', '/api/admin/tickets');
    expect(none.status).toBe(415);

    const big = await api('POST', '/api/admin/tickets', {
      title: 'x',
      category: 'bug',
      description: 'd'.repeat(70_000),
    });
    expect(big.status).toBe(413);
    expect(await list()).toEqual([]);
  });

  it('rejects bad updates and bad ids', async () => {
    const t = await create();
    for (const body of [{}, { title: '' }, { status: 'closed' }, { category: 'x' }, { foo: 1 }]) {
      const res = await patch(t.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    for (const id of ['0', '-1', 'abc', '1.5', '01', '99999999999999999']) {
      expect((await patch(id, { title: 'x' })).status, id).toBe(400);
      expect((await api('DELETE', `/api/admin/tickets/${id}`)).status, id).toBe(400);
    }
    expect(await list()).toEqual([t]);
  });

  it('stores SQL-looking text as plain text', async () => {
    const title = "x'); DROP TABLE tickets; --";
    const t = await create({ title });
    expect(t.title).toBe(title);
    expect((await list()).map((x) => x.title)).toEqual([title]);
  });
});

describe('seed SQL', () => {
  const entries = [
    { title: "O'Brien's bug", description: "line 1\nline 2 ''", category: 'bug' },
    { title: 'Done one', description: '', category: 'ui', status: 'done', notes: 'n', source: 's' },
  ];

  async function runSql(sql: string) {
    for (const stmt of sql.split('\n').filter((l) => l.startsWith('INSERT'))) {
      await env.DB.prepare(stmt).run();
    }
  }

  it('escapes quotes and loads into D1', async () => {
    expect(sqlString("it's")).toBe("'it''s'");
    expect(sqlString('a\nb')).toBe("'a' || char(10) || 'b'");
    expect(() => sqlString('a\0b')).toThrow();
    const sql = seedSql(entries, 5000);
    expect(sql.split('\n').filter((l) => l.startsWith('INSERT'))).toHaveLength(2);
    await runSql(sql);
    const tickets = await list();
    expect(tickets).toHaveLength(2);
    const byTitle = Object.fromEntries(tickets.map((t) => [t.title, t]));
    expect(byTitle["O'Brien's bug"]).toMatchObject({
      description: "line 1\nline 2 ''",
      status: 'open',
      completedAt: null,
      createdAt: 5000,
      createdBy: '',
    });
    expect(byTitle['Done one']).toMatchObject({ status: 'done', completedAt: 5000, source: 's' });
  });

  it('adds nothing when run again, and only new titles to an edited set', async () => {
    await runSql(seedSql(entries, 5000));
    await runSql(seedSql(entries, 6000));
    expect(await list()).toHaveLength(2);
    // An admin's ticket and edits survive a re-seed; a new title in the file is added.
    const mine = await create({ title: 'Mine' });
    const done = (await list()).find((t) => t.title === 'Done one') as Ticket;
    await patched(done.id, { status: 'open' });
    await runSql(seedSql([...entries, { title: 'New one', category: 'other' }], 7000));
    const after = await list();
    expect(after.map((t) => t.title).sort()).toEqual(
      ["O'Brien's bug", 'Done one', 'Mine', 'New one'].sort(),
    );
    expect(after.find((t) => t.id === done.id)?.status).toBe('open');
    expect(after.find((t) => t.id === mine.id)).toEqual(mine);
  });

  it('seeds the real tickets file', async () => {
    const real = (await import('../data/tickets.json')).default as unknown[];
    await runSql(seedSql(real, 5000));
    await runSql(seedSql(real, 5000));
    expect(await list()).toHaveLength(real.length);
  });

  it('refuses bad entries, naming them', () => {
    expect(() => seedSql({}, 0)).toThrow(/array/);
    expect(() => seedSql([{ title: 'ok', category: 'bug' }, { title: 'x' }], 0)).toThrow(
      /ticket 1: category is required/,
    );
    expect(() =>
      seedSql(
        [
          { title: 'same', category: 'bug' },
          { title: ' same ', category: 'ui' },
        ],
        0,
      ),
    ).toThrow(/ticket 1: repeats the title/);
  });
});

describe('assignee', () => {
  it('starts unassigned, and the list says who can be assigned and who is asking', async () => {
    const t = await create();
    expect(t.assignee).toBe('');
    const res = await api('GET', '/api/admin/tickets', undefined, {
      token: await idToken({ email: 'other@example.com' }),
    });
    const body = (await res.json()) as { admins: string[]; me: string };
    expect(body.admins).toEqual(['admin@example.com', 'other@example.com']);
    expect(body.me).toBe('other@example.com');
  });

  it('picks up, reassigns to the other admin, and unassigns', async () => {
    const t = await create();
    const mine = await patched(t.id, { assignee: 'Admin@Example.com', status: 'in_progress' });
    expect(mine.assignee).toBe('admin@example.com');
    expect(mine.status).toBe('in_progress');
    expect((await patched(t.id, { assignee: 'other@example.com' })).assignee).toBe(
      'other@example.com',
    );
    const none = await patched(t.id, { assignee: '' });
    expect(none.assignee).toBe('');
    expect(none.status).toBe('in_progress');
  });

  it('can be set when a ticket is created', async () => {
    expect((await create({ assignee: 'other@example.com' })).assignee).toBe('other@example.com');
  });

  it('refuses anyone who is not an admin', async () => {
    const t = await create();
    for (const assignee of ['someone@example.com', 'admin@example', 42]) {
      expect((await patch(t.id, { assignee })).status).toBe(400);
    }
    const res = await api('POST', '/api/admin/tickets', {
      title: 'x',
      category: 'bug',
      assignee: 'someone@example.com',
    });
    expect(res.status).toBe(400);
    expect((await list()).find((x) => x.id === t.id)?.assignee).toBe('');
  });
});
