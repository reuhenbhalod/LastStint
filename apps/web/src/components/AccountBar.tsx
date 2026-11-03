// Streak and sign-in, on the daily card and the results (feedback spec D3). The streak shows
// signed in or not; "Sign in with Google" keeps it across devices. Without a Google client ID
// configured, only the streak shows.

import { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID, loadGoogle } from '../account/google.js';
import type { AccountState } from '../account/useAccount.js';

function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  useEffect(() => {
    let alive = true;
    loadGoogle().then(
      (g) => {
        if (!alive || !el.current) return;
        g.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => cb.current(r.credential) });
        g.renderButton(el.current, {
          theme: 'filled_black',
          size: 'medium',
          shape: 'pill',
          text: 'signin_with',
        });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  return <div ref={el} className="gsi-button min-h-[32px]" />;
}

export function AccountBar({
  account,
  compact = false,
}: {
  account: AccountState;
  /** One line for a top bar: the streak as a chip, then sign-in. */
  compact?: boolean;
}) {
  const p = account.player;
  const streak = p?.streak;
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border border-[var(--rule)] px-3 py-1 text-[13px] font-semibold"
          title={
            streak && streak.days > 0
              ? `Best ${streak.best} · ${streak.days} race${streak.days === 1 ? '' : 's'} played`
              : 'Play every day to build it'
          }
        >
          <span aria-hidden="true">🔥</span>
          {streak ? `${streak.current}-day streak` : 'Daily streak'}
        </span>
        {p?.account ? (
          <span className="flex items-center gap-2 text-[13px]">
            <span
              className="hidden max-w-[160px] truncate text-[var(--muted)] sm:inline"
              title={p.account.email}
            >
              {p.account.name || p.account.email}
            </span>
            <button
              type="button"
              onClick={account.signOut}
              className="rounded-full border border-[var(--rule)] px-3 py-1 text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Sign out
            </button>
          </span>
        ) : GOOGLE_CLIENT_ID ? (
          account.busy ? (
            <span className="text-[13px] text-[var(--muted)]">Signing in…</span>
          ) : (
            <GoogleButton onCredential={account.signIn} />
          )
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--card)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[20px]">
          🔥
        </span>
        <span>
          <span className="block disp text-[16px] leading-none">
            {streak ? `${streak.current}-day streak` : 'Daily streak'}
          </span>
          <span className="block text-[12px] text-[var(--muted)]">
            {streak && streak.days > 0
              ? `Best ${streak.best} · ${streak.days} race${streak.days === 1 ? '' : 's'} played`
              : 'Play every day to build it'}
          </span>
        </span>
      </div>
      {p?.account ? (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="max-w-[160px] truncate text-[var(--muted)]" title={p.account.email}>
            {p.account.name || p.account.email}
          </span>
          <button
            type="button"
            onClick={account.signOut}
            className="rounded-md border border-[var(--rule)] px-2 py-1 text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Sign out
          </button>
        </div>
      ) : GOOGLE_CLIENT_ID ? (
        <div className="flex flex-col items-end gap-1">
          {account.busy ? (
            <span className="text-[13px] text-[var(--muted)]">Signing in…</span>
          ) : (
            <GoogleButton onCredential={account.signIn} />
          )}
          {account.error && (
            <span className="text-[12px] text-[var(--box-ink)]">{account.error}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
