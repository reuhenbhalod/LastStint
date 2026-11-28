// @vitest-environment jsdom
// The daily card (IntroCard.tsx): Start (or "Back to the race" mid-race), the tutorial link,
// How to play (opens the walkthrough) and How it works (not in the Gauntlet); the walkthrough
// opens on its own for a signed-out player and once for a new account, never mid-race.

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import { type RaceModel, initRun } from '@laststint/sim';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markHowToPending } from '../account/howTo.js';
import type { AccountState } from '../account/useAccount.js';
import { NO_PLAN } from '../game/plans.js';
import type { GameMeta, GameState } from '../state/machine.js';
import { IntroCard } from './IntroCard.js';

// Without an account prop the top bar mounts its own (SiteAccount): a signed-out stub here.
vi.mock('../account/useAccount.js', () => ({
  SIGN_IN: 'auth0',
  useAccount: () => ({
    player: null,
    loaded: false,
    busy: false,
    error: null,
    startSignIn: () => {},
    setProfileOpen: () => {},
    profileOpen: false,
  }),
}));

// Abu Dhabi 2021: HAM (Mercedes) against VER, takeover on lap 34 of 58.
const MODEL = abuDhabi2021 as unknown as RaceModel;
const RACE = initRun(MODEL, 1).state;

function game(meta: Partial<GameMeta> = {}): GameState {
  return {
    phase: 'intro',
    speed: 1,
    race: RACE,
    moments: [],
    currentMoment: null,
    resolved: [],
    decisions: [],
    result: null,
    grades: {},
    submission: { status: 'none' },
    meta: {
      raceId: 'abu-dhabi-2021',
      number: 12,
      source: 'live',
      date: '2026-11-24',
      totalLaps: 58,
      takeoverLap: 34,
      userSide: 'HAM',
      rival: 'VER',
      ...meta,
    },
    radio: [],
    plan: NO_PLAN,
  };
}

function account(over: Partial<AccountState> = {}): AccountState {
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

const signedIn = (playerId: string) =>
  account({
    player: {
      account: { playerId, name: 'Ada', email: 'a@x.com', displayName: 'Ada' },
      streak: { current: 1, best: 1, days: 1 },
    },
  });

class NoResize {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoResize);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ announcement: null }))),
  );
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const walkthrough = () => screen.queryByRole('dialog', { name: /race engineer/ });

describe('IntroCard', () => {
  it('Start takes the pit wall (named for the team), by click and keyboard', async () => {
    const onStart = vi.fn();
    const onHelp = vi.fn();
    const user = userEvent.setup();
    render(
      <IntroCard
        state={game()}
        model={MODEL}
        onStart={onStart}
        onHelp={onHelp}
        account={account({ loaded: false })}
      />,
    );
    // #58: the Daily shows no number.
    expect(screen.getByText(/Daily race · lap/)).toBeInTheDocument();
    expect(screen.queryByText(/#12/)).not.toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Take the Mercedes pit wall' });
    await user.click(start);
    start.focus();
    await user.keyboard('{Enter}');
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onHelp).not.toHaveBeenCalled();
  });

  it('mid-race, Start is the resume label and the walkthrough stays shut', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <IntroCard
        state={game()}
        model={MODEL}
        onStart={onStart}
        onHelp={vi.fn()}
        account={account()}
        resume="Back to the race"
      />,
    );
    expect(walkthrough()).toBeNull();
    expect(screen.queryByRole('button', { name: /pit wall/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back to the race' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('How it works calls onHelp; the tutorial link goes to /tutorial', async () => {
    const onHelp = vi.fn();
    const user = userEvent.setup();
    render(
      <IntroCard
        state={game()}
        model={MODEL}
        onStart={vi.fn()}
        onHelp={onHelp}
        account={account({ loaded: false })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'How it works' }));
    expect(onHelp).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /Play the tutorial race/ })).toHaveAttribute(
      'href',
      '/tutorial',
    );
  });

  it('How to play opens the walkthrough; Skip closes it and the card stays', async () => {
    const user = userEvent.setup();
    render(
      <IntroCard
        state={game()}
        model={MODEL}
        onStart={vi.fn()}
        onHelp={vi.fn()}
        account={account({ loaded: false })}
      />,
    );
    expect(walkthrough()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'How to play' }));
    expect(walkthrough()).toBeInTheDocument();
    expect(screen.getByText(/Your goal: finish ahead of Verstappen/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(walkthrough()).toBeNull();
    expect(screen.getByRole('button', { name: 'Take the Mercedes pit wall' })).toBeInTheDocument();
  });

  it('the Gauntlet has no How it works, and names the round', () => {
    render(
      <IntroCard
        state={game({ source: 'survivor', number: 3 })}
        model={MODEL}
        onStart={vi.fn()}
        onHelp={vi.fn()}
        account={account({ loaded: false })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'How it works' })).toBeNull();
    expect(screen.getByRole('button', { name: 'How to play' })).toBeInTheDocument();
    expect(screen.getByText(/Gauntlet · round 3/)).toBeInTheDocument();
  });

  it('practice shows its reason', () => {
    render(
      <IntroCard
        state={game({ source: 'practice', practiceReason: 'Offline' })}
        model={MODEL}
        onStart={vi.fn()}
        onHelp={vi.fn()}
        account={account({ loaded: false })}
      />,
    );
    expect(screen.getByText(/Offline · not submitted/)).toBeInTheDocument();
  });

  it('the walkthrough opens on its own: without accounts, and once loaded signed out', () => {
    const { unmount } = render(
      <IntroCard state={game()} model={MODEL} onStart={vi.fn()} onHelp={vi.fn()} />,
    );
    expect(walkthrough()).toBeInTheDocument();
    unmount();

    const props = { state: game(), model: MODEL, onStart: vi.fn(), onHelp: vi.fn() };
    const { rerender } = render(<IntroCard {...props} account={account({ loaded: false })} />);
    expect(walkthrough()).toBeNull(); // waits for the lookup
    rerender(<IntroCard {...props} account={account()} />);
    expect(walkthrough()).toBeInTheDocument();
  });

  it('signed in: only for a new account (its pending mark), once', () => {
    const props = { state: game(), model: MODEL, onStart: vi.fn(), onHelp: vi.fn() };
    const { unmount } = render(<IntroCard {...props} account={signedIn('old')} />);
    expect(walkthrough()).toBeNull();
    unmount();

    markHowToPending('new');
    const r = render(<IntroCard {...props} account={signedIn('new')} />);
    expect(walkthrough()).toBeInTheDocument();
    r.unmount();
    render(<IntroCard {...props} account={signedIn('new')} />);
    expect(walkthrough()).toBeNull();
  });

  it('the top bar carries the account bar (Sign in)', async () => {
    const a = account({ loaded: false });
    const user = userEvent.setup();
    render(
      <IntroCard state={game()} model={MODEL} onStart={vi.fn()} onHelp={vi.fn()} account={a} />,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(a.startSignIn).toHaveBeenCalledTimes(1);
  });
});
