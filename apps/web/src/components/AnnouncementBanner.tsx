// The announcement under the top bar (docs/admin-v2-spec.md A8), set on the admin page's Today
// tab. Fetched once after the page loads, so nothing renders on the server or the first render;
// a failed fetch shows nothing. Dismissing it hides it in this browser for good.

import { useEffect, useState } from 'react';
import {
  type Announcement,
  dismiss,
  fetchAnnouncement,
  readDismissed,
  shouldShow,
} from './announcement.js';

export function AnnouncementBanner() {
  const [a, setA] = useState<Announcement | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAnnouncement().then((got) => {
      if (alive && shouldShow(got, readDismissed(), Date.now())) setA(got);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!a) return null;
  const warn = a.tone === 'warning';
  return (
    <div
      role={warn ? 'alert' : 'status'}
      className={`relative z-10 border-b ${
        warn
          ? 'border-[var(--flag)] bg-[color-mix(in_srgb,var(--flag)_18%,var(--paper))]'
          : 'border-[var(--glass-edge)] bg-[var(--glass)] backdrop-blur'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2 text-[14px] sm:px-6">
        <p className="m-0 min-w-0 flex-1 break-words">{a.text}</p>
        <button
          type="button"
          onClick={() => {
            dismiss(a.id);
            setA(null);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          aria-label="Dismiss announcement"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
