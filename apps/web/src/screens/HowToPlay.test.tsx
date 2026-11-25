// @vitest-environment jsdom
// How to play (HowToPlay.tsx): six steps; Next and Back walk them (Back off on the first), the
// last step's button is "Got it" and closes, with the tutorial link; Skip and Escape close.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HowToPlay } from './HowToPlay.js';

const TITLES = [
  'You’re Hamilton’s race engineer',
  'Watch the race',
  'Make the big calls',
  'Run the car, lap by lap',
  'Keep your driver on side',
  'How you’re graded',
];

function open(over: { realPos?: number } = {}) {
  const onClose = vi.fn();
  render(
    <HowToPlay
      team="Mercedes"
      user="HAM"
      rival="VER"
      realPos={over.realPos ?? 2}
      laps={24}
      goal="finish ahead of Verstappen"
      onClose={onClose}
    />,
  );
  return onClose;
}

const title = () => screen.getByRole('heading', { level: 2 }).textContent;

describe('HowToPlay', () => {
  it('opens on step 1 with the race filled in, Back disabled', () => {
    open();
    expect(screen.getByRole('dialog', { name: TITLES[0] })).toBeInTheDocument();
    expect(screen.getByText('How to play · 1 of 6')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your goal: finish ahead of Verstappen, and do better than the real Mercedes pit wall did (P2).',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /tutorial/ })).toBeNull();
  });

  it('leaves out the real result when there is none', () => {
    open({ realPos: 0 });
    expect(screen.getByText('Your goal: finish ahead of Verstappen.')).toBeInTheDocument();
  });

  it('Next walks every step, Back goes back one, and the last step offers the tutorial', async () => {
    const onClose = open();
    const user = userEvent.setup();
    for (let i = 1; i < TITLES.length; i++) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(title()).toBe(TITLES[i]);
      expect(screen.getByText(`How to play · ${i + 1} of 6`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
    }
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Play the tutorial race (5 min)' })).toHaveAttribute(
      'href',
      '/tutorial',
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(title()).toBe(TITLES[4]);
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('"Got it" on the last step closes it', async () => {
    const onClose = open();
    const user = userEvent.setup();
    for (let i = 1; i < TITLES.length; i++)
      await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Skip closes it from any step', async () => {
    const onClose = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes it; other keys do not', async () => {
    const onClose = open();
    const user = userEvent.setup();
    await user.keyboard('a{Enter}');
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the keyboard walks it: Tab to Next and Enter', async () => {
    open();
    const user = userEvent.setup();
    screen.getByRole('button', { name: 'Next' }).focus();
    await user.keyboard('{Enter}');
    expect(title()).toBe(TITLES[1]);
  });
});
