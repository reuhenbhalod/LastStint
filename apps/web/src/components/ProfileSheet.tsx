// The player's profile (docs/auth0-spec.md A4): a display name for the leaderboards and a
// favourite team, whose colour themes the home page. Asked after a first sign-in, and from
// "Edit profile" in the account bar.

import { useEffect, useRef, useState } from 'react';
import type { AccountState } from '../account/useAccount.js';
import { TEAM_COLOR } from '../game/teamTheme.js';

/** The current grid's teams, as the game names them. */
export const GRID_TEAMS = [
  'McLaren',
  'Ferrari',
  'Red Bull Racing',
  'Mercedes',
  'Aston Martin',
  'Alpine',
  'Williams',
  'Racing Bulls',
  'Kick Sauber',
  'Haas F1 Team',
];

export function ProfileSheet({ account }: { account: AccountState }) {
  const a = account.player?.account;
  const [name, setName] = useState(a?.displayName || '');
  const [team, setTeam] = useState(a?.favouriteTeam || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const first = !a?.displayName;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(await account.saveProfile(name, team));
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <dialog
        open
        aria-labelledby="profile-title"
        className="relative m-0 w-full max-w-[460px] bg-transparent p-0 text-[var(--ink)]"
      >
        <form onSubmit={save} className="call-plate !gap-4 rounded-b-none !p-5 sm:rounded-lg">
          <div className="flex flex-col gap-1">
            <span className="call-tag">{first ? 'Welcome to the pit wall' : 'Your profile'}</span>
            <h2 id="profile-title" className="disp m-0 text-[22px] leading-none">
              {first ? 'Set up your profile' : 'Edit your profile'}
            </h2>
            <p className="m-0 text-[13px] text-[#9AA5A0]">
              Your name shows on the leaderboards. Your team’s colour themes the home page.
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
              Display name
            </span>
            <input
              ref={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="e.g. Box Box Box"
              className="rounded-md border border-[#2E373B] bg-[#192024] px-3 py-2.5 text-[15px] text-white outline-none focus:border-[var(--you)]"
            />
          </label>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
              Favourite team
            </legend>
            <div className="grid grid-cols-2 gap-1.5">
              {GRID_TEAMS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={team === t}
                  onClick={() => setTeam(team === t ? '' : t)}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[13px] font-semibold ${
                    team === t
                      ? 'border-[var(--you)] bg-[color-mix(in_srgb,var(--you)_14%,#192024)]'
                      : 'border-[#2E373B] bg-[#192024] hover:border-[#6E7A75]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-1.5 shrink-0 -skew-x-12"
                    style={{ background: TEAM_COLOR[t] }}
                  />
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p className="m-0 text-[13px] text-[var(--box-ink)]">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => account.setProfileOpen(false)}
              className="rounded-md px-3 py-2.5 text-[13px] font-semibold text-[#B9C2BD] hover:text-white"
            >
              {first ? 'Later' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving || name.trim().length < 3}
              className="disp rounded-md bg-[var(--you)] px-5 py-2.5 text-[14px] tracking-wide text-[var(--you-ink)] hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
