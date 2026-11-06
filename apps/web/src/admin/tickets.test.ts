// How the Tickets tab groups, filters and reports (tickets.ts).

import { describe, expect, it } from 'vitest';
import { ApiError } from '../api.js';
import {
  type Ticket,
  arrange,
  assigneeLabel,
  errorText,
  initials,
  matches,
  personName,
} from './tickets.js';

let next = 1;
function ticket(over: Partial<Ticket> = {}): Ticket {
  const id = next++;
  return {
    id,
    title: `Ticket ${id}`,
    description: '',
    category: 'bug',
    status: 'open',
    notes: '',
    source: '',
    createdBy: '',
    assignee: '',
    createdAt: id * 1000,
    updatedAt: id * 1000,
    completedAt: null,
    ...over,
  };
}

describe('arrange', () => {
  const oldBug = ticket({ title: 'Old bug' });
  const newBug = ticket({ title: 'New bug' });
  const busyBug = ticket({ title: 'Busy bug', status: 'in_progress' });
  const ui = ticket({ title: 'Button colour', category: 'ui', notes: 'needs the team colour' });
  const doneEarly = ticket({ status: 'done', completedAt: 5_000 });
  const doneLate = ticket({ status: 'done', category: 'ui', completedAt: 9_000 });
  const all = [oldBug, doneEarly, ui, newBug, doneLate, busyBug];

  it('groups open work by category in order, in progress first then newest', () => {
    const { groups, done } = arrange(all, 'all', '');
    expect(groups.map((g) => g.category)).toEqual(['bug', 'ui']);
    expect(groups[0]?.tickets).toEqual([busyBug, newBug, oldBug]);
    expect(groups[1]?.tickets).toEqual([ui]);
    expect(done).toEqual([doneLate, doneEarly]);
  });

  it('filters by category and by search, done tickets included', () => {
    const byCat = arrange(all, 'ui', '');
    expect(byCat.groups.map((g) => g.category)).toEqual(['ui']);
    expect(byCat.done).toEqual([doneLate]);
    expect(arrange(all, 'all', '  TEAM colour ').groups.flatMap((g) => g.tickets)).toEqual([ui]);
    expect(arrange(all, 'feature', '').groups).toEqual([]);
  });

  it('matches on the text fields and #id', () => {
    const t = ticket({ title: 'Pit lane', description: 'Monaco', source: 'PDF p2' });
    expect(matches(t, 'monaco')).toBe(true);
    expect(matches(t, 'pdf')).toBe(true);
    expect(matches(t, `#${t.id}`)).toBe(true);
    expect(matches(t, 'silverstone')).toBe(false);
    expect(matches(t, '   ')).toBe(true);
  });
});

describe('errorText', () => {
  it("shows the server's detail, and plain words for the common failures", () => {
    expect(errorText(new ApiError(400, 'invalid', 'title must not be empty'))).toBe(
      'title must not be empty (400)',
    );
    expect(errorText(new ApiError(429, 'rate-limited'))).toBe(
      'The server said rate-limited (429).',
    );
    expect(errorText(new ApiError(0, 'offline'))).toMatch(/reach the server/);
    expect(errorText(new ApiError(401, 'bad-credential'))).toMatch(/sign in again/);
    expect(errorText(new ApiError(404, 'not-found', 'no ticket 3'))).toMatch(/gone/);
    expect(errorText(new Error('boom'))).toBe('boom');
  });
});

describe('assignees', () => {
  const me = 'reuhenbhalod@gmail.com';
  const other = 'purohit.abhiram@gmail.com';
  const mine = ticket({ title: 'Mine', assignee: me });
  const theirs = ticket({ title: 'Theirs', assignee: other });
  const nobody = ticket({ title: 'Nobody' });
  const all = [mine, theirs, nobody];
  const titles = (owner: 'all' | 'mine' | 'unassigned') =>
    arrange(all, 'all', '', owner, me).groups.flatMap((g) => g.tickets.map((t) => t.title));

  it('filters by owner', () => {
    expect(titles('mine')).toEqual(['Mine']);
    expect(titles('unassigned')).toEqual(['Nobody']);
    expect(titles('all').sort()).toEqual(['Mine', 'Nobody', 'Theirs']);
  });

  it('names people from their email', () => {
    expect(personName(other)).toBe('Purohit Abhiram');
    expect(initials(other)).toBe('PA');
    expect(initials(me)).toBe('RE');
    expect(assigneeLabel(me, me)).toBe('You');
    expect(assigneeLabel(other, me)).toBe('Purohit Abhiram');
    expect(assigneeLabel('', me)).toBe('Unassigned');
  });

  it('finds tickets by assignee in search', () => {
    expect(matches(theirs, 'abhiram')).toBe(true);
    expect(matches(nobody, 'abhiram')).toBe(false);
  });
});
