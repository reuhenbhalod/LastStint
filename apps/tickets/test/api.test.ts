// The tickets API (src/worker/index.ts) against a local D1: CRUD, completed_at, validation,
// and the seed SQL (scripts/seedSql.ts).

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { seedSql, sqlString } from '../scripts/seedSql.js';
import type { Ticket } from '../src/shared/tickets.js';
import { api } from './helpers.js';

async function create(body: Record<string, unknown> = {}): Promise<Ticket> {
  const res = await api('POST', '/api/tickets', { title: 'A ticket', category: 'bug', ...body });
  expect(res.status).toBe(201);
  return ((await res.json()) as { ticket: Ticket }).ticket;
}

async function patch(id: number, body: unknown): Promise<Response> {
  return api('PATCH', `/api/tickets/${id}`, body);
}

/** PATCH that must succeed; the updated ticket. */
async function patched(id: number, body: unknown): Promise<Ticket> {
  const res = await patch(id, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { ticket: Ticket }).ticket;
}

async function list(): Promise<Ticket[]> {
  const res = await api('GET', '/api/tickets');
  expect(res.status).toBe(200);
  return ((await res.json()) as { tickets: Ticket[] }).tickets;
}

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
      createdBy: '',
      completedAt: null,
    });
    expect(t.id).toBeGreaterThan(0);
    expect(t.createdAt).toBeGreaterThanOrEqual(before);
    expect(t.updatedAt).toBe(t.createdAt);

    expect(await list()).toEqual([t]);

    const res = await patch(t.id, { title: 'Pit lane length', category: 'bug', notes: 'fixed' });
    expect(res.status).toBe(200);
    const edited = ((await res.json()) as { ticket: Ticket }).ticket;
    expect(edited).toMatchObject({
      id: t.id,
      title: 'Pit lane length',
      description: 'Monaco pit lane',
      category: 'bug',
      notes: 'fixed',
      source: 'playtest',
      createdAt: t.createdAt,
    });
    expect(edited.updatedAt).toBeGreaterThanOrEqual(t.updatedAt);
    expect(await list()).toEqual([edited]);

    const del = await api('DELETE', `/api/tickets/${t.id}`);
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
    expect(await list()).toEqual([]);
  });

  it('lists newest first', async () => {
    const a = await create({ title: 'first' });
    const b = await create({ title: 'second' });
    expect((await list()).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('404s on a ticket that does not exist', async () => {
    expect((await patch(999, { title: 'x' })).status).toBe(404);
    expect((await api('DELETE', '/api/tickets/999')).status).toBe(404);
    const t = await create();
    await api('DELETE', `/api/tickets/${t.id}`);
    expect((await api('DELETE', `/api/tickets/${t.id}`)).status).toBe(404);
  });

  it('404s as JSON on an unknown API route', async () => {
    const res = await api('GET', '/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
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
      const res = await api('POST', '/api/tickets', body);
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
    const badJson = await api('POST', '/api/tickets', '{not json');
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toMatchObject({ error: 'bad-json' });

    const text = await api('POST', '/api/tickets', undefined);
    expect(text.status).toBe(415);

    const big = await api('POST', '/api/tickets', {
      title: 'x',
      category: 'bug',
      description: 'd'.repeat(70_000),
    });
    expect(big.status).toBe(413);
  });

  it('rejects bad updates and bad ids', async () => {
    const t = await create();
    for (const body of [{}, { title: '' }, { status: 'closed' }, { category: 'x' }, { foo: 1 }]) {
      const res = await patch(t.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    for (const id of ['0', '-1', 'abc', '1.5', '01', '99999999999999999']) {
      expect((await api('PATCH', `/api/tickets/${id}`, { title: 'x' })).status, id).toBe(400);
      expect((await api('DELETE', `/api/tickets/${id}`)).status, id).toBe(400);
    }
    expect(await list()).toEqual([t]);
  });

  it('stores SQL-looking text as plain text', async () => {
    const title = "x'); DROP TABLE tickets; --";
    const t = await create({ title });
    expect((await list()).map((x) => x.title)).toEqual([t.title]);
    expect(t.title).toBe(title);
  });
});

describe('seed SQL', () => {
  it('escapes quotes and loads into D1', async () => {
    expect(sqlString("it's")).toBe("'it''s'");
    expect(sqlString('a\nb')).toBe("'a' || char(10) || 'b'");
    expect(() => sqlString('a\0b')).toThrow();
    const sql = seedSql(
      [
        { title: "O'Brien's bug", description: "line 1\nline 2 ''", category: 'bug' },
        {
          title: 'Done one',
          description: '',
          category: 'ui',
          status: 'done',
          notes: 'n',
          source: 's',
        },
      ],
      5000,
    );
    const statements = sql.split('\n').filter((l) => l.startsWith('INSERT'));
    expect(statements).toHaveLength(2);
    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }
    const tickets = await list();
    expect(tickets).toHaveLength(2);
    const byTitle = Object.fromEntries(tickets.map((t) => [t.title, t]));
    expect(byTitle["O'Brien's bug"]).toMatchObject({
      description: "line 1\nline 2 ''",
      status: 'open',
      completedAt: null,
      createdAt: 5000,
    });
    expect(byTitle['Done one']).toMatchObject({ status: 'done', completedAt: 5000, source: 's' });
  });

  it('refuses bad entries, naming them', () => {
    expect(() => seedSql({}, 0)).toThrow(/array/);
    expect(() => seedSql([{ title: 'ok', category: 'bug' }, { title: 'x' }], 0)).toThrow(
      /ticket 1: category is required/,
    );
  });
});
