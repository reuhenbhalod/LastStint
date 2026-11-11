import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnnouncementBanner } from './AnnouncementBanner.js';
import { type Announcement, dismissedIds, shouldShow, withDismissed } from './announcement.js';

const a: Announcement = { id: 7, text: 'Hi', tone: 'info', endsAt: null };

describe('announcement banner', () => {
  it('shows a current announcement unless it ended or was dismissed', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    expect(shouldShow(null, [], now)).toBe(false);
    expect(shouldShow(a, [], now)).toBe(true);
    expect(shouldShow(a, [7], now)).toBe(false);
    expect(shouldShow({ ...a, endsAt: '2026-11-11T11:00:00Z' }, [], now)).toBe(false);
    expect(shouldShow({ ...a, endsAt: '2026-11-11T13:00:00Z' }, [], now)).toBe(true);
  });

  it('remembers dismissed ids, tolerating bad storage', () => {
    expect(dismissedIds(null)).toEqual([]);
    expect(dismissedIds('not json')).toEqual([]);
    expect(dismissedIds('[1,"x",2]')).toEqual([1, 2]);
    expect(withDismissed([1, 2], 1)).toEqual([2, 1]);
    const many = Array.from({ length: 25 }, (_, i) => i);
    expect(withDismissed(many, 99)).toHaveLength(20);
    expect(withDismissed(many, 99).at(-1)).toBe(99);
  });

  it('renders nothing on the server (it loads after the page does)', () => {
    expect(renderToStaticMarkup(createElement(AnnouncementBanner))).toBe('');
  });
});
