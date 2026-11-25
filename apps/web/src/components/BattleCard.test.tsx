// @vitest-environment jsdom
// The battle card (BattleCard.tsx): each move's button (named by its label, described by its
// note and risk tag) and its number key answer with the move's id until a move is chosen;
// then the pick, then the result. The stage line, the fight meter, the closing bar to the
// braking zone, and the era timer in place of the wait bar.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuickCall } from '../game/quickCalls.js';
import { BattleCard } from './BattleCard.js';

const call: QuickCall = {
  lap: 40,
  from: 'HAM',
  kind: 'battle',
  text: 'He is right with me into the hairpin.',
  other: 'VER',
  corner: 6,
  attacking: false,
  meter: 0.62,
  gap: 0.4,
  options: [
    {
      id: 'cover',
      label: 'Cover the inside',
      note: 'Block the lunge',
      tag: 'Safer',
      line: 'inside',
      call: null,
    },
    {
      id: 'late',
      label: 'Late-brake up the inside',
      note: 'Classic hairpin lunge',
      tag: 'Risky',
      line: 'hard',
      call: null,
    },
    { id: 'wait', label: 'Hold your line', tag: 'Balanced', line: 'wait', call: null },
    { id: 'let', label: 'Let him by', line: 'let', call: null },
  ],
  stats: [{ label: 'DRS', value: 'VER has it' }],
};

type Props = Parameters<typeof BattleCard>[0];
function setup(props: Partial<Props> = {}) {
  const onAnswer = vi.fn();
  const utils = render(
    <BattleCard
      call={call}
      corner={6}
      stage="waiting"
      clock={null}
      fromP={0}
      brakeP={1}
      waitMs={4000}
      chosen={null}
      result={null}
      onAnswer={onAnswer}
      {...props}
    />,
  );
  const rerender = (more: Partial<Props>) =>
    utils.rerender(
      <BattleCard
        call={call}
        corner={6}
        stage="waiting"
        clock={null}
        fromP={0}
        brakeP={1}
        waitMs={4000}
        chosen={null}
        result={null}
        onAnswer={onAnswer}
        {...props}
        {...more}
      />,
    );
  return { onAnswer, rerender, unmount: utils.unmount };
}

describe('BattleCard', () => {
  it('names each move by its label alone; the note and the risk tag describe it', () => {
    setup();
    expect(
      screen.getByRole('button', { name: 'Late-brake up the inside' }),
    ).toHaveAccessibleDescription('Classic hairpin lunge Risky');
    expect(screen.getByRole('button', { name: 'Cover the inside' })).toHaveAccessibleDescription(
      'Block the lunge Safer',
    );
    expect(screen.getByRole('button', { name: 'Hold your line' })).toHaveAccessibleDescription(
      'Balanced',
    );
    expect(screen.getByRole('button', { name: 'Let him by' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it.each([
    ['Cover the inside', 'cover'],
    ['Late-brake up the inside', 'late'],
    ['Hold your line', 'wait'],
    ['Let him by', 'let'],
  ])('a tap on "%s" answers %s', async (name, id) => {
    const { onAnswer } = setup();
    await userEvent.click(screen.getByRole('button', { name }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(id);
  });

  it('number keys 1-4 answer; 5 and letters do nothing', async () => {
    const { onAnswer } = setup();
    for (const k of ['4', '5', 'x', '2', '1', '3']) await userEvent.keyboard(k);
    expect(onAnswer.mock.calls).toEqual([['let'], ['late'], ['cover'], ['wait']]);
  });

  it('keys answer on the approach too, before the braking zone', async () => {
    const { onAnswer } = setup({ stage: 'approach' });
    expect(screen.getByText('Braking zone ahead')).toBeInTheDocument();
    await userEvent.keyboard('1');
    expect(onAnswer).toHaveBeenCalledWith('cover');
  });

  it('once a move is chosen: the buttons go, the pick shows, keys stop answering', async () => {
    const { onAnswer, rerender } = setup();
    rerender({ chosen: 'late', stage: 'move' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Late-brake up the inside');
    expect(screen.getByText('Into the corner')).toBeInTheDocument();
    // The stats go with the buttons.
    expect(screen.queryByText('DRS')).toBeNull();
    await userEvent.keyboard('1');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('the result at the corner replaces the pick and the meter', () => {
    const { rerender } = setup();
    expect(screen.getByLabelText('How the fight stands')).toHaveTextContent('Hold 62%');
    expect(screen.getByLabelText('How the fight stands')).toHaveTextContent(
      'Verstappen gets by 38%',
    );
    rerender({ chosen: 'cover', stage: 'done', result: { text: 'Held him off', good: true } });
    expect(screen.getByRole('status')).toHaveTextContent('Held him off');
    expect(screen.getByText('Result')).toBeInTheDocument();
    expect(screen.queryByLabelText('How the fight stands')).toBeNull();
  });

  it('tells the stage and who is fighting whom', () => {
    const { rerender } = setup();
    expect(screen.getByText('Your call: he’s on the brakes')).toBeInTheDocument();
    expect(screen.getByText(/Defending from Verstappen · 0\.4 s/)).toBeInTheDocument();
    expect(screen.getByText(/Battle · T6/)).toBeInTheDocument();
    rerender({ call: { ...call, attacking: true } });
    expect(screen.getByText(/Attacking Verstappen/)).toBeInTheDocument();
    expect(screen.getByLabelText('How the fight stands')).toHaveTextContent('Pass 62%');
    expect(screen.getByLabelText('How the fight stands')).toHaveTextContent('Stay behind 38%');
  });

  it('the approach bar follows the lap clock toward the braking zone', async () => {
    const { rerender } = setup({
      stage: 'approach',
      clock: { start: 0, ms: 1000, frozen: 0.5 },
      fromP: 0.25,
      brakeP: 0.75,
    });
    const bar = () => document.querySelector('.bg-\\[var\\(--flag\\)\\]') as HTMLElement;
    await waitFor(() => expect(bar().style.width).toBe('50%'));
    rerender({ clock: { start: 0, ms: 1000, frozen: 0.9 } });
    await waitFor(() => expect(bar().style.width).toBe('100%'));
  });

  it('the wait bar runs for waitMs after the reading time', () => {
    setup({ waitMs: 4000, readMs: 1200 });
    const t = document.querySelector('.quick-timer') as HTMLElement;
    expect(t.style.animationDuration).toBe('4000ms');
    expect(t.style.animationDelay).toBe('1200ms');
  });

  it('in Eras the era timer stands in for the wait bar; the moves still answer', async () => {
    const { onAnswer } = setup({ eras: { timer: <span>era timer</span> } });
    expect(screen.getByText('era timer')).toBeInTheDocument();
    expect(document.querySelector('.quick-timer')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Hold your line' }));
    expect(onAnswer).toHaveBeenCalledWith('wait');
  });

  it('stops listening for keys once unmounted', async () => {
    const { onAnswer, unmount } = setup();
    unmount();
    await userEvent.keyboard('1');
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
