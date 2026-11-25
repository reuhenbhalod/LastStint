// @vitest-environment jsdom
// The account bar (AccountBar.tsx): the streak, the way in (Auth0's Sign in button, the Google
// button, or nothing), and signed in the name (Edit profile), Sign out and Admin. Compact (the
// top bar) puts the signed-in controls in a menu that closes on Escape or a click outside.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState } from '../account/useAccount.js';
import type { Account } from '../data/api.js';
import { AccountBar } from './AccountBar.js';

const mode = vi.hoisted(() => ({
  signIn: 'auth0' as 'auth0' | 'google' | null,
  clientId: 'client-1',
}));
const google = vi.hoisted(() => ({
  initialize: vi.fn(),
  renderButton: vi.fn(),
  disableAutoSelect: vi.fn(),
}));

vi.mock('../account/useAccount.js', () => ({
  get SIGN_IN() {
    return mode.signIn;
  },
}));
vi.mock('../account/google.js', () => ({
  get GOOGLE_CLIENT_ID() {
    return mode.clientId;
  },
  loadGoogle: vi.fn(async () => google),
}));

function state(over: Partial<AccountState> = {}): AccountState {
  return {
    player: null,
    loaded: true,
    busy: false,
    error: null,
    signIn: vi.fn(async () => {}),
    startSignIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    profileOpen: false,
    setProfileOpen: vi.fn(),
    saveProfile: vi.fn(async () => null),
    ...over,
  };
}

const account = (over: Partial<Account> = {}): Account => ({
  playerId: 'p1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  displayName: 'BoxBoxAda',
  ...over,
});

const signedIn = (over: Partial<Account> = {}, streak = { current: 4, best: 9, days: 12 }) =>
  state({ player: { account: account(over), streak } });

beforeEach(() => {
  mode.signIn = 'auth0';
  mode.clientId = 'client-1';
  vi.clearAllMocks();
});

describe('AccountBar (full)', () => {
  it('signed out with Auth0: Sign in starts the login, by click and by keyboard', async () => {
    const s = state({ player: { account: null, streak: { current: 2, best: 5, days: 1 } } });
    const user = userEvent.setup();
    render(<AccountBar account={s} />);
    expect(screen.getByText('2-day streak')).toBeInTheDocument();
    expect(screen.getByText('Best 5 · 1 race played')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Sign in' });
    await user.click(btn);
    expect(s.startSignIn).toHaveBeenCalledTimes(1);
    btn.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(s.startSignIn).toHaveBeenCalledTimes(3);
  });

  it('shows the sign-in error under the button, and "Signing in…" instead of it while busy', () => {
    const { rerender } = render(<AccountBar account={state({ error: 'Sign-in failed' })} />);
    expect(screen.getByText('Sign-in failed')).toBeInTheDocument();
    expect(screen.getByText('Daily streak')).toBeInTheDocument();
    expect(screen.getByText('Play every day to build it')).toBeInTheDocument();
    rerender(<AccountBar account={state({ busy: true })} />);
    expect(screen.getByText('Signing in…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('with Google: renders the Google button and hands its credential to signIn', async () => {
    mode.signIn = 'google';
    const s = state();
    render(<AccountBar account={s} />);
    await vi.waitFor(() => expect(google.renderButton).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    expect(google.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-1' }),
    );
    const { callback } = google.initialize.mock.calls[0]?.[0] as {
      callback: (r: { credential: string }) => void;
    };
    callback({ credential: 'jwt-123' });
    expect(s.signIn).toHaveBeenCalledWith('jwt-123');
  });

  it('with no sign-in configured (or Google without a client id), only the streak shows', () => {
    mode.signIn = null;
    const { rerender } = render(<AccountBar account={state()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    mode.signIn = 'google';
    mode.clientId = '';
    rerender(<AccountBar account={state({ refresh: vi.fn() })} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('signed in: the name opens the profile, Sign out signs out, no Admin for a player', async () => {
    const s = signedIn();
    const user = userEvent.setup();
    render(<AccountBar account={s} />);
    expect(screen.getByText('4-day streak')).toBeInTheDocument();
    expect(screen.getByText('Best 9 · 12 races played')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'BoxBoxAda' }));
    expect(s.setProfileOpen).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(s.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('the name falls back to the account name, then the email', () => {
    const { rerender } = render(<AccountBar account={signedIn({ displayName: '' })} />);
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    rerender(<AccountBar account={signedIn({ displayName: '', name: '' })} />);
    expect(screen.getByRole('button', { name: 'ada@example.com' })).toBeInTheDocument();
  });

  it('an admin gets the Admin link to /admin', () => {
    render(<AccountBar account={signedIn({ admin: true })} />);
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});

describe('AccountBar (compact)', () => {
  it('signed out: the streak chip and Sign in', async () => {
    const s = state({ player: { account: null, streak: { current: 3, best: 3, days: 3 } } });
    const user = userEvent.setup();
    render(<AccountBar account={s} compact />);
    expect(screen.getByTitle('Daily streak · best 3 · 3 races played')).toHaveTextContent(
      '3day streak',
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(s.startSignIn).toHaveBeenCalledTimes(1);
  });

  it('with no streak the chip reads 0', () => {
    render(<AccountBar account={state()} compact />);
    expect(screen.getByTitle('Daily streak: play every day to build it')).toHaveTextContent(
      '0day streak',
    );
  });

  it('the menu button toggles the menu; Edit profile opens the profile and closes the menu', async () => {
    const s = signedIn();
    const user = userEvent.setup();
    render(<AccountBar account={s} compact />);
    const toggle = screen.getByRole('button', { name: /BoxBoxAda/ });
    expect(toggle).toHaveAttribute('aria-haspopup', 'menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('B');
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Admin' })).toBeNull();
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit profile' }));
    expect(s.setProfileOpen).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(toggle);
    await user.click(toggle);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(s.signOut).not.toHaveBeenCalled();
  });

  it('Sign out in the menu signs out and closes it', async () => {
    const s = signedIn();
    const user = userEvent.setup();
    render(<AccountBar account={s} compact />);
    await user.click(screen.getByRole('button', { name: /BoxBoxAda/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(s.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('an admin sees Admin in the menu, linking to /admin', async () => {
    const user = userEvent.setup();
    render(<AccountBar account={signedIn({ admin: true })} compact />);
    await user.click(screen.getByRole('button', { name: /BoxBoxAda/ }));
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('Escape and a click outside close the menu; a click inside does not', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>outside</p>
        <AccountBar account={signedIn()} compact />
      </div>,
    );
    const toggle = screen.getByRole('button', { name: /BoxBoxAda/ });
    await user.click(toggle);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(toggle);
    act(() => {
      fireEvent.mouseDown(screen.getByRole('menu'));
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('a');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('the initial and name fall back to "Account" with no name or email', () => {
    render(<AccountBar account={signedIn({ displayName: '', name: '', email: '' })} compact />);
    expect(screen.getByRole('button', { name: /Account/ })).toHaveTextContent('AAccount');
  });
});
