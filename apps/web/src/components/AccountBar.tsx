// Streak and sign-in, on the daily card and the results (feedback spec D3, docs/auth0-spec.md).
// The streak shows signed in or not; signing in keeps it across devices. "Sign in" opens
// Auth0's login page (or, without Auth0 set up, the Google button); with neither configured,
// only the streak shows. Signed in: the display name, Edit profile, and for admins an Admin
// button.

import { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID, loadGoogle } from '../account/google.js';
import { type AccountState, SIGN_IN } from '../account/useAccount.js';
import { StreakIcon } from './Icons.js';

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

/** The way in: Auth0's "Sign in" button, the Google button, or nothing. */
function SignInControl({ account, large = false }: { account: AccountState; large?: boolean }) {
  if (account.busy) return <span className="text-[13px] text-[var(--muted)]">Signing in…</span>;
  if (SIGN_IN === 'auth0') {
    return (
      <button
        type="button"
        onClick={account.startSignIn}
        className={`disp rounded-full bg-[#EEF1EE] text-[#0E1214] hover:bg-white ${large ? 'px-5 py-2 text-[14px]' : 'px-4 py-1.5 text-[12px]'}`}
      >
        Sign in
      </button>
    );
  }
  if (SIGN_IN === 'google' && GOOGLE_CLIENT_ID)
    return <GoogleButton onCredential={account.signIn} />;
  return null;
}

/** The signed-in player: their name (display name first), Edit profile, Sign out. */
function SignedIn({ account, compact }: { account: AccountState; compact: boolean }) {
  const a = account.player?.account;
  if (!a) return null;
  return (
    <span className="flex items-center gap-2 text-[13px]">
      {a.admin && <AdminLink top={compact} />}
      <button
        type="button"
        onClick={() => account.setProfileOpen(true)}
        title="Edit profile"
        className={`max-w-[160px] truncate font-semibold text-[var(--ink)] underline-offset-2 hover:underline ${compact ? 'hidden sm:inline' : ''}`}
      >
        {a.displayName || a.name || a.email}
      </button>
      <button
        type="button"
        onClick={account.signOut}
        className={
          compact
            ? 'rounded-full border border-[var(--fav,var(--rule))] bg-[color-mix(in_srgb,var(--fav,transparent)_12%,transparent)] px-3 py-1 text-[var(--muted)] hover:text-[var(--ink)]'
            : 'rounded-full border border-[var(--rule)] px-3 py-1 text-[var(--muted)] hover:text-[var(--ink)]'
        }
      >
        Sign out
      </button>
    </span>
  );
}

/**
 * Only for accounts on the admin list (the server says so; it checks every admin call too).
 * `top`: in the top bar, in the favourite team's colour.
 */
function AdminLink({ top }: { top: boolean }) {
  return (
    <a
      href="/admin"
      className={
        top
          ? 'rounded-full border border-[var(--fav,var(--you))] px-3 py-1 font-semibold text-[var(--fav,var(--you))] hover:bg-[color-mix(in_srgb,var(--fav,var(--you))_12%,transparent)]'
          : 'rounded-full border border-[var(--you)] px-3 py-1 font-semibold text-[var(--you)] hover:bg-[color-mix(in_srgb,var(--you)_12%,transparent)]'
      }
    >
      Admin
    </a>
  );
}

export function AccountBar({
  account,
  compact = false,
}: {
  account: AccountState;
  /**
   * One line for a top bar: the streak as a chip, then sign-in. Its buttons take the
   * favourite team's colour (`--fav`, game/teamTheme.ts), or their usual one without it.
   */
  compact?: boolean;
}) {
  const p = account.player;
  const streak = p?.streak;
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border border-[var(--fav,var(--rule))] bg-[color-mix(in_srgb,var(--fav,transparent)_12%,transparent)] px-3 py-1 text-[13px] font-semibold"
          title={
            streak && streak.days > 0
              ? `Best ${streak.best} · ${streak.days} race${streak.days === 1 ? '' : 's'} played`
              : 'Play every day to build it'
          }
        >
          <StreakIcon size={14} className="text-[var(--flag)]" />
          {streak ? `${streak.current}-day streak` : 'Daily streak'}
        </span>
        {p?.account ? <SignedIn account={account} compact /> : <SignInControl account={account} />}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--card)] px-3 py-2">
      <div className="flex items-center gap-2">
        <StreakIcon size={20} className="text-[var(--flag)]" />
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
        <SignedIn account={account} compact={false} />
      ) : (
        <div className="flex flex-col items-end gap-1">
          <SignInControl account={account} large />
          {account.error && (
            <span className="text-[12px] text-[var(--box-ink)]">{account.error}</span>
          )}
        </div>
      )}
    </div>
  );
}
