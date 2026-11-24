// @vitest-environment jsdom
// The headset modes (HeadsetPanel.tsx): every mode button flips its row's mode with its value,
// shows what's set (aria-pressed), a call booked for the coming lap, the battery meter, the
// race without ERS, and the disabled state.

import type { Modes } from '@laststint/sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HeadsetPanel } from './HeadsetPanel.js';

const modes: Modes = { pace: 'standard', battle: 'hold', ers: 'balanced', fuel: 'normal' };

const ALL: Array<[keyof Modes, string, string]> = [
  ['pace', 'Pace', 'push'],
  ['pace', 'Pace', 'standard'],
  ['pace', 'Pace', 'manage'],
  ['battle', 'Battle', 'attack'],
  ['battle', 'Battle', 'hold'],
  ['battle', 'Battle', 'defend'],
  ['ers', 'ERS', 'harvest'],
  ['ers', 'ERS', 'balanced'],
  ['ers', 'ERS', 'deploy'],
  ['ers', 'ERS', 'overtake'],
  ['fuel', 'Fuel', 'normal'],
  ['fuel', 'Fuel', 'liftAndCoast'],
];
const NAME: Record<string, string> = { liftAndCoast: 'Lift & coast' };

const row = (label: string) => within(screen.getByRole('group', { name: label }));

describe('HeadsetPanel', () => {
  it.each(ALL)('%s → %s %s calls onFlip(key, value)', async (key, label, value) => {
    const onFlip = vi.fn();
    render(<HeadsetPanel modes={modes} disabled={false} onFlip={onFlip} />);
    await userEvent.click(row(label).getByRole('button', { name: NAME[value] ?? value }));
    expect(onFlip).toHaveBeenCalledTimes(1);
    expect(onFlip).toHaveBeenCalledWith(key, value);
  });

  it('marks the mode set on the car as pressed, one per row', () => {
    render(<HeadsetPanel modes={modes} disabled={false} onFlip={() => {}} />);
    for (const [label, value] of [
      ['Pace', 'standard'],
      ['Battle', 'hold'],
      ['ERS', 'balanced'],
      ['Fuel', 'normal'],
    ] as const) {
      const pressed = row(label)
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-pressed') === 'true');
      expect(pressed.map((b) => b.textContent)).toEqual([value]);
    }
  });

  it('a call booked for next lap shows as pressed at once, titled "Booked from next lap"', () => {
    render(
      <HeadsetPanel modes={modes} pending={{ pace: 'push' }} disabled={false} onFlip={() => {}} />,
    );
    const push = row('Pace').getByRole('button', { name: 'push' });
    expect(push).toHaveAttribute('aria-pressed', 'true');
    expect(push).toHaveAttribute('title', 'Booked from next lap');
    expect(row('Pace').getByRole('button', { name: 'standard' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('titles each button with what the mode does', () => {
    const describe = vi.fn((k: keyof Modes, v: string) => `${k}:${v}`);
    render(<HeadsetPanel modes={modes} describe={describe} disabled={false} onFlip={() => {}} />);
    expect(row('Pace').getByRole('button', { name: 'manage' })).toHaveAttribute(
      'title',
      'pace:manage',
    );
  });

  it('disabled: every button is disabled and a click calls nothing', async () => {
    const onFlip = vi.fn();
    render(<HeadsetPanel modes={modes} disabled onFlip={onFlip} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(12);
    for (const b of buttons) expect(b).toBeDisabled();
    await userEvent.click(row('Pace').getByRole('button', { name: 'push' }));
    expect(onFlip).not.toHaveBeenCalled();
  });

  it('keyboard: Tab reaches the first button and Enter/Space flip it', async () => {
    const onFlip = vi.fn();
    const user = userEvent.setup();
    render(<HeadsetPanel modes={modes} disabled={false} onFlip={onFlip} />);
    await user.tab();
    expect(row('Pace').getByRole('button', { name: 'push' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.keyboard(' ');
    expect(onFlip.mock.calls).toEqual([
      ['pace', 'push'],
      ['pace', 'standard'],
    ]);
  });

  it('shows the battery meter, and hides the ERS row and battery without ERS', () => {
    const { rerender } = render(
      <HeadsetPanel modes={modes} battery={42.4} disabled={false} onFlip={() => {}} />,
    );
    expect(screen.getByRole('meter', { name: 'Battery' })).toHaveAttribute('aria-valuenow', '42');
    rerender(
      <HeadsetPanel modes={modes} battery={42.4} disabled={false} onFlip={() => {}} ers={false} />,
    );
    expect(screen.queryByRole('group', { name: 'ERS' })).toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });
});
