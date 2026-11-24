// @vitest-environment jsdom
// The tutorial (Tutorial.tsx): its intro (Start, Skip), then a coach card over the race screen
// that steps through 15 cards as the race gets to each control ("Got it", "Skip tutorial",
// "Finish"), holding the race on some and fast-forwarding between them. The race and result
// screens are stand-ins here; this checks the tutorial's own controls and what they drive.

import canada2022 from '@data/races/canada-2022.json';
import type { RaceModel } from '@laststint/sim';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../game/useGame.js';
import type { GameState, Phase } from '../state/machine.js';
import type { TutorialCall } from './RaceScreen.js';
import { Tutorial, tutorialDone } from './Tutorial.js';

const MODEL = canada2022 as unknown as RaceModel; // Sainz chasing Verstappen

const fake = vi.hoisted(() => ({
  game: null as unknown as Game,
  onCall: null as null | ((c: unknown) => void),
}));

vi.mock('../game/useGame.js', () => ({ useGame: () => fake.game }));
vi.mock('../game/teamTheme.js', () => ({ useTeamTheme: () => {} }));
vi.mock('../components/GroundBackdrop.js', () => ({ GroundBackdrop: () => null }));
vi.mock('./RaceScreen.js', () => ({
  RaceScreen: (p: {
    tutorial: { quick: boolean; battle: boolean; onCall: (c: unknown) => void };
    onFinished: () => void;
    onHome: () => void;
  }) => {
    fake.onCall = p.tutorial.onCall;
    return (
      <div>
        <span>race screen</span>
        <span>{`quick hook ${p.tutorial.quick} · battle hook ${p.tutorial.battle}`}</span>
        {['map', 'leaders', 'score', 'call', 'radio', 'stats'].map((t) => (
          <div key={t} data-tour={t} data-testid={`tour-${t}`} />
        ))}
        <button type="button" onClick={p.onFinished}>
          stand-in: see how you did
        </button>
        <button type="button" onClick={p.onHome}>
          stand-in: home
        </button>
      </div>
    );
  },
}));
vi.mock('./ResultScreen.js', () => ({
  ResultScreen: (p: { onHome: () => void }) => (
    <button type="button" onClick={p.onHome}>
      stand-in: result home
    </button>
  ),
}));

const mkGame = (over: Partial<Game> = {}): Game =>
  ({
    state: null,
    model: MODEL,
    error: null,
    start: vi.fn(),
    setHold: vi.fn(),
    setFastForward: vi.fn(),
    ...over,
  }) as unknown as Game;

const at = (phase: Phase, lap = 20) => ({ phase, race: { lap } }) as unknown as GameState;

let loc: { href: string };

beforeEach(() => {
  localStorage.clear();
  fake.game = mkGame();
  fake.onCall = null;
  loc = { href: 'http://localhost/tutorial' };
  vi.stubGlobal('location', loc);
});
afterEach(() => vi.unstubAllGlobals());

const coachTitle = () =>
  screen.getByRole('complementary', { name: 'Tutorial' }).querySelector('h2')?.textContent;
const gotIt = () => screen.getByRole('button', { name: 'Got it' });

describe('Tutorial', () => {
  it('shows loading, then an error, before the race is ready', () => {
    fake.game = mkGame({ model: null });
    const { rerender } = render(<Tutorial />);
    expect(screen.getByText('Loading the tutorial…')).toBeInTheDocument();
    fake.game = mkGame({ error: 'No race' });
    rerender(<Tutorial />);
    expect(screen.getByText('No race')).toBeInTheDocument();
  });

  it('the intro: Start the tutorial starts the game', async () => {
    fake.game = mkGame({ state: at('intro') });
    const user = userEvent.setup();
    render(<Tutorial />);
    expect(screen.getByRole('heading', { name: 'Canada 2022' })).toBeInTheDocument();
    expect(screen.getByText(/last 53 laps/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start the tutorial' }));
    expect(fake.game.start).toHaveBeenCalledTimes(1);
    expect(tutorialDone()).toBe(false);
    expect(loc.href).toBe('http://localhost/tutorial');
  });

  it('the intro: Skip the tutorial marks it done and goes home', async () => {
    fake.game = mkGame({ state: at('intro') });
    const user = userEvent.setup();
    render(<Tutorial />);
    await user.click(screen.getByRole('button', { name: 'Skip the tutorial' }));
    expect(tutorialDone()).toBe(true);
    expect(loc.href).toBe('/');
    expect(fake.game.start).not.toHaveBeenCalled();
  });

  it('Skip tutorial on the coach card marks it done and goes home', async () => {
    fake.game = mkGame({ state: at('planning') });
    const user = userEvent.setup();
    render(<Tutorial />);
    expect(coachTitle()).toBe('Welcome to the pit wall');
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(tutorialDone()).toBe(true);
    expect(loc.href).toBe('/');
  });

  it('the race screen’s home also skips', async () => {
    fake.game = mkGame({ state: at('planning') });
    const user = userEvent.setup();
    render(<Tutorial />);
    await user.click(screen.getByRole('button', { name: 'stand-in: home' }));
    expect(tutorialDone()).toBe(true);
    expect(loc.href).toBe('/');
  });

  it('Got it walks all 15 cards as the race reaches them, holding and fast-forwarding, then Finish', async () => {
    const user = userEvent.setup();
    fake.game = mkGame({ state: at('planning') });
    const { rerender } = render(<Tutorial />);
    const set = (phase: Phase, lap = 20) => {
      fake.game = { ...fake.game, state: at(phase, lap) };
      rerender(<Tutorial />);
    };
    const call = (c: TutorialCall | null) => act(() => fake.onCall?.(c));

    // Planning: four cards, each lighting up its control.
    const planning: Array<[string, string]> = [
      ['Welcome to the pit wall', 'map'],
      ['The leaders', 'leaders'],
      ['The fight', 'score'],
      ['Pick a race plan', 'call'],
    ];
    for (const [i, [title, target]] of planning.entries()) {
      expect(coachTitle()).toBe(title);
      expect(screen.getByText(`Tutorial · ${i + 1} of 15`)).toBeInTheDocument();
      expect(screen.getByTestId(`tour-${target}`)).toHaveClass('tour-target');
      await user.click(gotIt());
      expect(screen.getByTestId(`tour-${target}`)).not.toHaveClass('tour-target');
    }
    expect(screen.queryByRole('complementary')).toBeNull(); // nothing more until it races

    // Racing: team radio and stats hold the race; after them it fast-forwards.
    set('racing');
    expect(coachTitle()).toBe('Team radio');
    expect(fake.game.setHold).toHaveBeenLastCalledWith(true);
    await user.click(gotIt());
    expect(coachTitle()).toBe('Show stats');
    expect(fake.game.setFastForward).toHaveBeenLastCalledWith(false);
    await user.click(gotIt());
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(fake.game.setHold).toHaveBeenLastCalledWith(false);
    expect(fake.game.setFastForward).toHaveBeenLastCalledWith(true);

    // A quick call and a battle: their cards hold the race, then the hooks turn off.
    expect(screen.getByText('quick hook true · battle hook true')).toBeInTheDocument();
    call({ kind: 'quick' });
    expect(coachTitle()).toBe('Quick calls');
    expect(fake.game.setHold).toHaveBeenLastCalledWith(true);
    expect(fake.game.setFastForward).toHaveBeenLastCalledWith(false);
    await user.click(gotIt());
    expect(screen.getByText('quick hook false · battle hook true')).toBeInTheDocument();
    call({ kind: 'quick' }); // seen: no card again
    expect(screen.queryByRole('complementary')).toBeNull();
    call({ kind: 'battle' });
    expect(coachTitle()).toBe('A battle');
    await user.click(gotIt());
    expect(screen.getByText('quick hook false · battle hook false')).toBeInTheDocument();

    // The big calls, each on its decision; the race is stopped for them already (no hold).
    for (const [trigger, title] of [
      ['VSC', 'A big call: virtual safety car'],
      ['cliff', 'Tyre calls'],
      ['rivalPit', 'The rival stops'],
      ['SC', 'Safety car'],
    ] as const) {
      set('decision');
      call({ kind: 'decision', trigger, lap: 30 });
      expect(coachTitle()).toBe(title);
      expect(fake.game.setHold).toHaveBeenLastCalledWith(false);
      await user.click(gotIt());
      call(null);
    }

    // Back to racing after the safety car: the rain tip.
    set('racing', 50);
    expect(coachTitle()).toBe('One more: rain');
    await user.click(gotIt());

    // The flag, then the results (after "See how you did").
    set('finished', 70);
    expect(coachTitle()).toBe('The flag');
    await user.click(gotIt());
    await user.click(screen.getByRole('button', { name: 'stand-in: see how you did' }));
    set('results', 70);
    expect(screen.getByRole('button', { name: 'stand-in: result home' })).toBeInTheDocument();
    expect(coachTitle()).toBe('How you did');
    expect(screen.getByText('Tutorial · 15 of 15')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
    expect(tutorialDone()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(tutorialDone()).toBe(true);
    expect(loc.href).toBe('/');
  });

  it('the result screen’s home skips too', async () => {
    const user = userEvent.setup();
    fake.game = mkGame({ state: at('finished') });
    const { rerender } = render(<Tutorial />);
    await user.click(screen.getByRole('button', { name: 'stand-in: see how you did' }));
    fake.game = { ...fake.game, state: at('results') };
    rerender(<Tutorial />);
    await user.click(screen.getByRole('button', { name: 'stand-in: result home' }));
    expect(tutorialDone()).toBe(true);
    expect(loc.href).toBe('/');
  });

  it('Got it works from the keyboard', async () => {
    fake.game = mkGame({ state: at('planning') });
    const user = userEvent.setup();
    render(<Tutorial />);
    gotIt().focus();
    await user.keyboard('{Enter}');
    expect(coachTitle()).toBe('The leaders');
  });
});
