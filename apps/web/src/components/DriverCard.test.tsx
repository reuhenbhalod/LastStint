// @vitest-environment jsdom
// The driver card (DriverCard.tsx): opened from the map or the standings. Its close button and
// the Escape key call `onClose`; it shows the car's place, gaps, tyres, stops and last lap, and
// for your car the headset modes and the real finish.

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { RaceModel, RaceState } from '@laststint/sim';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { informationView } from '../eras/difficulty/information.js';
import type { LapEvents } from '../game/raceLog.js';
import { DriverCard } from './DriverCard.js';

const MODEL = abuDhabi2021 as unknown as RaceModel;
const USER = MODEL.userSide; // HAM
const RIVAL = MODEL.rival; // VER

function race(): RaceState {
  const engine = new GameEngine(MODEL, MODEL.race.seed, { decisions: [] });
  engine.step();
  return structuredClone(engine.state);
}

const log: LapEvents[] = [
  {
    lap: 20,
    pits: [{ lap: 15, code: RIVAL, compound: 'HARD', cost: 21, from: 1, to: 3 }],
    lapTimes: {},
  },
  { lap: 35, pits: [], lapTimes: { [RIVAL]: 87.34, [USER]: 88 } },
];

/** A stat's value by its label (the card's description list). */
function stat(label: string): string {
  const dts = screen.getAllByText(label, { selector: 'dt' });
  return dts.map((dt) => dt.nextElementSibling?.textContent ?? '').join('|');
}

function card(code: string, r = race(), onClose = vi.fn(), extra = {}) {
  render(
    <DriverCard
      code={code}
      race={r}
      model={MODEL}
      log={log}
      userSide={USER}
      rival={RIVAL}
      onClose={onClose}
      {...extra}
    />,
  );
  return onClose;
}

describe('DriverCard', () => {
  it('Close driver details calls onClose, by pointer and keyboard', async () => {
    const user = userEvent.setup();
    const onClose = card(RIVAL);
    expect(screen.getByRole('region', { name: 'Max Verstappen details' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close driver details' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Close driver details' }).focus();
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Escape anywhere closes it; other keys do not; unmounting stops listening', () => {
    const onClose = vi.fn();
    render(
      <DriverCard
        code={RIVAL}
        race={race()}
        model={MODEL}
        log={log}
        userSide={USER}
        rival={RIVAL}
        onClose={onClose}
      />,
    ).unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    card(RIVAL, race(), onClose);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('for another car: place, gap to you, stops, last lap and real finish', () => {
    const r = race();
    card(RIVAL, r);
    const region = screen.getByRole('region', { name: 'Max Verstappen details' });
    expect(within(region).getByText(/Rival/)).toBeInTheDocument();
    expect(stat('Position')).toBe(`P${r.order.indexOf(RIVAL) + 1}`);
    const me = r.cars[USER]?.totalTime ?? 0;
    const them = r.cars[RIVAL]?.totalTime ?? 0;
    expect(stat('To you')).toBe(`${them - me >= 0 ? '+' : '−'}${Math.abs(them - me).toFixed(1)}s`);
    expect(stat('Stops')).toBe('L14 H');
    expect(stat('Last lap')).toBe('1:27.3');
    expect(stat('Real finish')).toBe('P1');
    expect(screen.queryByText('Pace')).toBeNull();
  });

  it('for your car: the headset modes and the real finish, no gap to you', () => {
    const r = race();
    card(USER, r);
    expect(screen.getByText(/Your driver/)).toBeInTheDocument();
    expect(stat('Pace')).toBe(r.cars[USER]?.modes.pace);
    expect(stat('Battle')).toBe(r.cars[USER]?.modes.battle);
    expect(stat('Real finish')).toBe('P2');
    expect(stat('Stops')).toBe('None yet');
    expect(screen.queryByText('To you')).toBeNull();
  });

  it('a retired car shows OUT and no tyres', () => {
    const r = race();
    const car = r.cars[RIVAL];
    if (car) car.retired = true;
    card(RIVAL, r);
    expect(stat('Position')).toBe('OUT');
    expect(stat('To leader')).toBe('-');
    expect(stat('Tyres')).toBe('-');
  });

  it('at Minimal: no gap to the leader, and none to you unless next to you', () => {
    const r = race();
    const far = r.order.find((c, i) => Math.abs(i - r.order.indexOf(USER)) > 2) as string;
    card(far, r, vi.fn(), { info: informationView('minimal') });
    expect(stat('To you')).toBe('-');
    expect(stat('To leader')).toMatch(/^(-|\+\d+ laps?)$/);
  });

  it('renders nothing for a car not in the race', () => {
    const { container } = render(
      <DriverCard
        code="XXX"
        race={race()}
        model={MODEL}
        log={log}
        userSide={USER}
        rival={RIVAL}
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
