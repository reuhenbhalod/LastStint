// @vitest-environment jsdom
// The quick call card (QuickCallCard.tsx): each answer button and its number key answer with
// the option's id; the card's own timer times out after the reading time plus `ms` (not in
// Eras, where the era's timer takes over); in a refuelling race an answer that boxes waits for
// a fuel fill and then carries it; and the pit-board look in Eras 1-2.

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaceEraContext, TODAY_LOOK } from '../eras/RaceEraContext.js';
import type { RefuelReading } from '../eras/refuel.js';
import type { QuickCall, QuickOption } from '../game/quickCalls.js';
import { QuickCallCard, answerBoxes } from './QuickCallCard.js';

const call: QuickCall = {
  lap: 20,
  from: 'Engineer',
  kind: 'quick',
  text: 'VER is closing. Push now?',
  options: [
    {
      id: 'push',
      label: 'Push',
      note: 'Faster, more wear',
      call: { lap: 21, kind: 'mode', key: 'pace', value: 'push' },
    },
    { id: 'stay', label: 'Stay as we are', call: null },
    {
      id: 'box',
      label: 'Box now',
      note: 'Fresh tyres',
      call: { lap: 21, kind: 'pit', compound: 'HARD' },
    },
  ],
  stats: [{ label: 'Gap', value: '1.2 s to VER' }],
};

const fuel: RefuelReading = {
  lapsOfFuel: 12,
  nextStopLap: 32,
  level: 0.4,
  fills: [
    { fill: 'short', laps: 10, seconds: 4 },
    { fill: 'standard', laps: 20, seconds: 7 },
    { fill: 'long', laps: 30, seconds: 10.5 },
  ],
};

function setup(props: Partial<Parameters<typeof QuickCallCard>[0]> = {}) {
  const onAnswer = vi.fn();
  const onTimeout = vi.fn();
  const utils = render(
    <QuickCallCard call={call} ms={5000} onAnswer={onAnswer} onTimeout={onTimeout} {...props} />,
  );
  return { onAnswer, onTimeout, ...utils };
}

afterEach(() => vi.useRealTimers());

describe('QuickCallCard', () => {
  it('names each answer by its label, its note as the description', () => {
    setup();
    const push = screen.getByRole('button', { name: 'Push' });
    expect(push).toHaveAccessibleDescription('Faster, more wear');
    expect(screen.getByRole('button', { name: 'Stay as we are' })).not.toHaveAttribute(
      'aria-describedby',
    );
    expect(screen.getByRole('button', { name: 'Box now' })).toHaveAccessibleDescription(
      'Fresh tyres',
    );
    expect(screen.getByRole('region', { name: 'Quick call' })).toHaveTextContent(
      'Verstappen is closing. Push now?',
    );
  });

  it.each([
    ['Push', 'push'],
    ['Stay as we are', 'stay'],
    ['Box now', 'box'],
  ])('a tap on "%s" answers %s (no fill outside a refuelling race)', async (name, id) => {
    const { onAnswer } = setup();
    await userEvent.click(screen.getByRole('button', { name }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(id);
  });

  it('number keys answer: 1, 2, 3; other keys do nothing', async () => {
    const { onAnswer } = setup();
    await userEvent.keyboard('2');
    await userEvent.keyboard('9');
    await userEvent.keyboard('a');
    await userEvent.keyboard('3');
    await userEvent.keyboard('1');
    expect(onAnswer.mock.calls).toEqual([['stay'], ['box'], ['push']]);
  });

  it('stops listening for keys once unmounted', async () => {
    const { onAnswer, unmount } = setup();
    unmount();
    await userEvent.keyboard('1');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('its own timer: times out after read + ms, not before, and only once', () => {
    vi.useFakeTimers();
    const { onTimeout, onAnswer } = setup({ ms: 5000, read: 1500 });
    act(() => vi.advanceTimersByTime(6499));
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onTimeout).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(20_000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('the latest onTimeout runs (a re-render with a new handler keeps the clock)', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <QuickCallCard call={call} ms={1000} onAnswer={() => {}} onTimeout={first} />,
    );
    act(() => vi.advanceTimersByTime(500));
    rerender(<QuickCallCard call={call} ms={1000} onAnswer={() => {}} onTimeout={second} />);
    act(() => vi.advanceTimersByTime(500));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unmounting before the time is up cancels the timeout', () => {
    vi.useFakeTimers();
    const { onTimeout, unmount } = setup({ ms: 1000 });
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('in Eras the era timer shows instead and the card never times out itself', () => {
    vi.useFakeTimers();
    const { onTimeout } = setup({ ms: 1000, eras: { timer: <span>era timer 30s</span> } });
    expect(screen.getByText('era timer 30s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  describe('a refuelling race', () => {
    it('the box answer waits for a fill: disabled, titled, and its key does nothing', async () => {
      const { onAnswer } = setup({ fuel });
      const box = screen.getByRole('button', { name: 'Box now' });
      expect(box).toBeDisabled();
      expect(box).toHaveAttribute('title', 'Pick a fuel fill first');
      // Answers that don't box are live.
      expect(screen.getByRole('button', { name: 'Push' })).toBeEnabled();
      await userEvent.keyboard('3');
      expect(onAnswer).not.toHaveBeenCalled();
      const fills = within(screen.getByRole('group', { name: 'Fuel fill' }));
      for (const b of fills.getAllByRole('button'))
        expect(b).toHaveAttribute('aria-pressed', 'false');
    });

    it('a fill picked: the box answer carries it; others go without', async () => {
      const { onAnswer } = setup({ fuel });
      const fills = within(screen.getByRole('group', { name: 'Fuel fill' }));
      await userEvent.click(fills.getByRole('button', { name: /^Long/ }));
      expect(fills.getByRole('button', { name: /^Long/ })).toHaveAttribute('aria-pressed', 'true');
      const box = screen.getByRole('button', { name: 'Box now' });
      expect(box).toBeEnabled();
      expect(box).not.toHaveAttribute('title');
      await userEvent.click(box);
      await userEvent.click(screen.getByRole('button', { name: 'Push' }));
      await userEvent.keyboard('3');
      expect(onAnswer.mock.calls).toEqual([['box', 'long'], ['push'], ['box', 'long']]);
    });

    it('picking another fill replaces the first', async () => {
      const { onAnswer } = setup({ fuel });
      const fills = within(screen.getByRole('group', { name: 'Fuel fill' }));
      await userEvent.click(fills.getByRole('button', { name: /^Short/ }));
      await userEvent.click(fills.getByRole('button', { name: /^Standard/ }));
      expect(fills.getByRole('button', { name: /^Short/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Box now' }));
      expect(onAnswer).toHaveBeenCalledWith('box', 'standard');
    });

    it('a call with no answer that boxes shows no fill choice', () => {
      setup({ fuel, call: { ...call, options: call.options.slice(0, 2) } });
      expect(screen.queryByRole('group', { name: 'Fuel fill' })).toBeNull();
    });

    it('the timer running out still times out (stay out) with no fill picked', () => {
      vi.useFakeTimers();
      const { onTimeout, onAnswer } = setup({ fuel, ms: 1000 });
      act(() => vi.advanceTimersByTime(1000));
      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(onAnswer).not.toHaveBeenCalled();
    });
  });

  it('answerBoxes: a pit order, or a pit among the orders it also gives', () => {
    expect(answerBoxes(call.options[2] as QuickOption)).toBe(true);
    expect(answerBoxes(call.options[0] as QuickOption)).toBe(false);
    expect(
      answerBoxes({
        id: 'y',
        label: 'Yes',
        call: null,
        also: [{ lap: 3, kind: 'pit', compound: 'SOFT' }],
      }),
    ).toBe(true);
  });

  it('tags the call by kind, and as a pit board in Eras 1-2', () => {
    const battle: QuickCall = { ...call, kind: 'battle', other: 'VER', from: 'HAM' };
    const { rerender } = setup({ call: battle });
    expect(screen.getByRole('region', { name: 'Battle call' })).toHaveTextContent(
      'Battle with Verstappen · slow motion',
    );
    rerender(
      <RaceEraContext.Provider value={{ ...TODAY_LOOK, prompts: 'board' }}>
        <QuickCallCard call={battle} ms={5000} onAnswer={() => {}} onTimeout={() => {}} />
      </RaceEraContext.Provider>,
    );
    expect(screen.getByRole('region', { name: 'Battle call' })).toHaveTextContent(
      'Pit board · battle with Verstappen',
    );
    expect(screen.getByRole('region', { name: 'Battle call' })).toHaveClass('pit-board');
  });
});
