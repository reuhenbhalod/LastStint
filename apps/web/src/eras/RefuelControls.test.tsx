// @vitest-environment jsdom
// The refuelling controls (RefuelControls.tsx): the fill choice (short, standard, long; none
// picked until the player taps one; all off while disabled) and the fuel gauge.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FuelFillChoice, FuelGauge } from './RefuelControls.js';
import type { FuelFill, RefuelReading } from './refuel.js';

const reading = (over: Partial<RefuelReading> = {}): RefuelReading => ({
  lapsOfFuel: 12.6,
  nextStopLap: 40,
  level: 0.456,
  // Out of order on purpose: the choice lists short, standard, long.
  fills: [
    { fill: 'long', laps: 30, seconds: 11.04 },
    { fill: 'short', laps: 10, seconds: 4.5 },
    { fill: 'standard', laps: 20, seconds: 7.75 },
  ],
  ...over,
});

describe('FuelFillChoice', () => {
  it('lists the fills short first, with laps and seconds, none picked', () => {
    render(<FuelFillChoice reading={reading()} value={null} disabled={false} onPick={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Fuel fill' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Short10 laps · 4.5s',
      'Standard20 laps · 7.8s',
      'Long30 laps · 11.0s',
    ]);
    for (const b of buttons) expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it('each fill calls onPick with its own fill', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<FuelFillChoice reading={reading()} value={null} disabled={false} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /^Short/ }));
    await user.click(screen.getByRole('button', { name: /^Standard/ }));
    await user.click(screen.getByRole('button', { name: /^Long/ }));
    expect(onPick.mock.calls).toEqual([['short'], ['standard'], ['long']]);
  });

  it('marks the picked fill pressed (one at a time) as the parent sets it', async () => {
    function Host() {
      const [v, setV] = useState<FuelFill | null>(null);
      return <FuelFillChoice reading={reading()} value={v} disabled={false} onPick={setV} />;
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: /^Long/ }));
    expect(screen.getByRole('button', { name: /^Long/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /^Short/ }));
    expect(screen.getByRole('button', { name: /^Short/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Long/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disabled: every fill is off and a tap does nothing', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<FuelFillChoice reading={reading()} value="standard" disabled onPick={onPick} />);
    for (const b of screen.getAllByRole('button')) {
      expect(b).toBeDisabled();
      await user.click(b);
    }
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows only the fills the reading has, and nothing with none', () => {
    const { rerender } = render(
      <FuelFillChoice
        reading={reading({ fills: [{ fill: 'standard', laps: 18, seconds: 6 }] })}
        value={null}
        disabled={false}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    rerender(
      <FuelFillChoice
        reading={reading({ fills: [] })}
        value={null}
        disabled={false}
        onPick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group')).toBeNull();
  });
});

describe('FuelGauge', () => {
  it('reads the fuel to the next stop as a meter', () => {
    render(<FuelGauge reading={reading()} />);
    const meter = screen.getByRole('meter', { name: 'Fuel to lap 40' });
    expect(meter).toHaveAttribute('aria-valuenow', '46');
    expect(screen.getByText('12 laps · to lap 40')).toBeInTheDocument();
  });

  it('to the flag, clamped to 0-100', () => {
    const { rerender } = render(<FuelGauge reading={reading({ nextStopLap: null, level: 1.4 })} />);
    expect(screen.getByRole('meter', { name: 'Fuel to the flag' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    rerender(<FuelGauge reading={reading({ level: -0.2 })} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });
});
