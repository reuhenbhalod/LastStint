// @vitest-environment jsdom
// The profile sheet (ProfileSheet.tsx): the display name (3-20 characters), a favourite team
// (tap again to clear), Save (disabled while too short or saving; shows the server's error) and
// Later/Cancel.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AccountState } from '../account/useAccount.js';
import type { Account } from '../data/api.js';
import { GRID_TEAMS, ProfileSheet } from './ProfileSheet.js';

function state(acc: Partial<Account> | null, over: Partial<AccountState> = {}): AccountState {
  return {
    player: acc
      ? {
          account: { playerId: 'p1', name: 'Ada', email: 'a@x.com', ...acc },
          streak: { current: 0, best: 0, days: 0 },
        }
      : null,
    loaded: true,
    busy: false,
    error: null,
    signIn: vi.fn(async () => {}),
    startSignIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    profileOpen: true,
    setProfileOpen: vi.fn(),
    saveProfile: vi.fn(async () => null),
    ...over,
  };
}

const nameBox = () => screen.getByRole('textbox', { name: 'Display name' });
const save = () => screen.getByRole('button', { name: 'Save' });

describe('ProfileSheet', () => {
  it('a first profile: titled "Set up", the name focused, Save off until 3 characters', async () => {
    const user = userEvent.setup();
    render(<ProfileSheet account={state({ displayName: '' })} />);
    expect(screen.getByRole('dialog', { name: 'Set up your profile' })).toBeInTheDocument();
    expect(nameBox()).toHaveFocus();
    expect(nameBox()).toHaveAttribute('maxLength', '20');
    expect(save()).toBeDisabled();
    await user.type(nameBox(), 'Ab');
    expect(save()).toBeDisabled();
    await user.type(nameBox(), '   ');
    expect(save()).toBeDisabled(); // spaces don't count
    await user.clear(nameBox());
    await user.type(nameBox(), 'Abc');
    expect(save()).toBeEnabled();
  });

  it('Later on a first profile closes the sheet without saving', async () => {
    const s = state({ displayName: '' });
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(s.setProfileOpen).toHaveBeenCalledWith(false);
    expect(s.saveProfile).not.toHaveBeenCalled();
  });

  it('an edit: prefilled name and team, Cancel closes', async () => {
    const s = state({ displayName: 'Boxer', favouriteTeam: 'Ferrari' });
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    expect(screen.getByRole('dialog', { name: 'Edit your profile' })).toBeInTheDocument();
    expect(nameBox()).toHaveValue('Boxer');
    expect(screen.getByRole('button', { name: 'Ferrari' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(s.setProfileOpen).toHaveBeenCalledWith(false);
  });

  it('every team button picks that team (one at a time); a second tap clears it', async () => {
    const s = state({ displayName: 'Boxer' });
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    expect(GRID_TEAMS).toHaveLength(10);
    for (const t of GRID_TEAMS) {
      await user.click(screen.getByRole('button', { name: t }));
      const pressed = screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent);
      expect(pressed).toEqual([t]);
    }
    await user.click(screen.getByRole('button', { name: 'Haas F1 Team' }));
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    await user.click(save());
    expect(s.saveProfile).toHaveBeenCalledWith('Boxer', '');
  });

  it('Save sends the name and team, shows "Saving…" (disabled) meanwhile, and keeps the sheet', async () => {
    let finish: (v: string | null) => void = () => {};
    const s = state(
      { displayName: '' },
      {
        saveProfile: vi.fn(
          () =>
            new Promise<string | null>((r) => {
              finish = r;
            }),
        ),
      },
    );
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    await user.type(nameBox(), 'Pit Wall');
    await user.click(screen.getByRole('button', { name: 'McLaren' }));
    await user.click(save());
    expect(s.saveProfile).toHaveBeenCalledWith('Pit Wall', 'McLaren');
    const busy = screen.getByRole('button', { name: 'Saving…' });
    expect(busy).toBeDisabled();
    finish(null);
    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getAllByRole('paragraph')).toHaveLength(1); // the intro only, no error
  });

  it('a save error from the server shows in the sheet', async () => {
    const s = state(
      { displayName: 'Boxer' },
      { saveProfile: vi.fn(async () => 'That name is taken') },
    );
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    await user.click(save());
    expect(await screen.findByText('That name is taken')).toBeInTheDocument();
  });

  it('Enter in the name field submits the form', async () => {
    const s = state({ displayName: 'Boxer' });
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    await user.type(nameBox(), '{Enter}');
    expect(s.saveProfile).toHaveBeenCalledWith('Boxer', '');
  });

  it('Enter with a too-short name does not submit', async () => {
    const s = state({ displayName: '' });
    const user = userEvent.setup();
    render(<ProfileSheet account={s} />);
    await user.type(nameBox(), 'ab{Enter}');
    expect(s.saveProfile).not.toHaveBeenCalled();
  });
});
