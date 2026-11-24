// @vitest-environment jsdom
// The announcement banner (AnnouncementBanner.tsx): fetched once after mount, shown as a status
// (info) or an alert (warning), and its Dismiss button hides it for good in this browser.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementBanner } from './AnnouncementBanner.js';
import type { Announcement } from './announcement.js';

const KEY = 'laststint:announcements-dismissed';

function serve(announcement: Announcement | null) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ announcement })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const info: Announcement = { id: 7, text: 'New races this week', tone: 'info', endsAt: null };

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('AnnouncementBanner', () => {
  it('fetches the announcement once and shows an info one as a status', async () => {
    const fetchMock = serve(info);
    render(<AnnouncementBanner />);
    expect(await screen.findByRole('status')).toHaveTextContent('New races this week');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/announcement$/);
  });

  it('shows a warning as an alert', async () => {
    serve({ ...info, tone: 'warning', text: 'Maintenance tonight' });
    render(<AnnouncementBanner />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Maintenance tonight');
  });

  it('Dismiss hides it and remembers its id, so a remount shows nothing', async () => {
    serve(info);
    const user = userEvent.setup();
    const { unmount } = render(<AnnouncementBanner />);
    await user.click(await screen.findByRole('button', { name: 'Dismiss announcement' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual([7]);
    unmount();

    const again = serve(info);
    render(<AnnouncementBanner />);
    await waitFor(() => expect(again).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss announcement' })).toBeNull();
  });

  it('Dismiss works with the keyboard (Tab to it, Enter)', async () => {
    serve(info);
    const user = userEvent.setup();
    render(<AnnouncementBanner />);
    await screen.findByRole('status');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss announcement' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows nothing for no announcement, an ended one, or a failed fetch', async () => {
    const none = serve(null);
    const { unmount } = render(<AnnouncementBanner />);
    await waitFor(() => expect(none).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
    unmount();

    const ended = serve({ ...info, endsAt: '2000-01-01T00:00:00Z' });
    const r2 = render(<AnnouncementBanner />);
    await waitFor(() => expect(ended).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
    r2.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    render(<AnnouncementBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
