// @vitest-environment jsdom
// The leaders over the map (LeadersTower.tsx): the top ten, then your car and the rival below a
// line when they're further back; every row a button that calls the car out (`onPick`).

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { RaceModel, RaceState } from '@laststint/sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { informationView } from '../eras/difficulty/information.js';
import { LeadersTower } from './LeadersTower.js';

const MODEL = abuDhabi2021 as unknown as RaceModel;
const USER = MODEL.userSide;
const RIVAL = MODEL.rival;

function race(): RaceState {
  const engine = new GameEngine(MODEL, MODEL.race.seed, { decisions: [] });
  engine.step();
  return structuredClone(engine.state);
}

const panel = () => screen.getByRole('region', { name: 'Leaders' });
const row = (code: string) =>
  within(panel()).getByRole('button', { name: new RegExp(`^\\d+ ${code}( |$)`) });

/** The race with your car and the rival moved to the back (P15 and P16). */
function atTheBack(): RaceState {
  const r = race();
  r.order = [...r.order.filter((c) => c !== USER && c !== RIVAL), RIVAL, USER];
  return r;
}

describe('LeadersTower', () => {
  it('shows the lap and the top ten, leader first', () => {
    const r = atTheBack();
    render(
      <LeadersTower
        race={r}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={null}
        onPick={vi.fn()}
      />,
    );
    expect(panel()).toHaveTextContent(`Lap ${r.lap}/${MODEL.race.laps}`);
    const lists = within(panel()).getAllByRole('list');
    expect(within(lists[0] as HTMLElement).getAllByRole('button')).toHaveLength(10);
    expect(row(r.order[0] as string)).toHaveTextContent(/Leader$/);
  });

  it('every row calls onPick with its car, the cars below the line too', async () => {
    const r = atTheBack();
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <LeadersTower
        race={r}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={null}
        onPick={onPick}
      />,
    );
    const lists = within(panel()).getAllByRole('list');
    expect(lists).toHaveLength(2);
    const below = within(lists[1] as HTMLElement).getAllByRole('button');
    expect(below.map((b) => b.textContent)).toEqual([
      expect.stringMatching(new RegExp(`^15${RIVAL}`)),
      expect.stringMatching(new RegExp(`^16${USER}`)),
    ]);
    const shown = [...r.order.slice(0, 10), RIVAL, USER];
    for (const code of shown) await user.click(row(code));
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(shown);
    // A car outside the top ten that isn't yours or the rival's has no row.
    expect(
      within(panel()).queryByRole('button', { name: new RegExp(` ${r.order[11]} `) }),
    ).toBeNull();
  });

  it('a row works from the keyboard', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <LeadersTower
        race={race()}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={null}
        onPick={onPick}
      />,
    );
    row(USER).focus();
    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith(USER);
  });

  it('with your car in the top ten, no line below', () => {
    const r = race();
    expect(r.order.slice(0, 10)).toContain(USER);
    render(
      <LeadersTower
        race={r}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={null}
        onPick={vi.fn()}
      />,
    );
    expect(within(panel()).getAllByRole('list')).toHaveLength(1);
    expect(row(USER).className).toMatch(/var\(--you\)/);
    expect(row(RIVAL).className).toMatch(/var\(--rival\)/);
  });

  it('follows the live standings (PIT in the lane) and shows OUT for a retired car', () => {
    const r = race();
    const [a, b, c] = r.order as [string, string, string];
    const live = [
      { code: b, gap: 0, pit: false },
      { code: a, gap: 0.94, pit: false },
      { code: c, gap: 20, pit: true },
    ];
    const { unmount } = render(
      <LeadersTower
        race={r}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={live}
        onPick={vi.fn()}
      />,
    );
    const names = within(panel())
      .getAllByRole('button')
      .map((x) => x.textContent);
    expect(names).toEqual([`1${b}Leader`, `2${a}+0.9`, `3${c}PIT`]);
    unmount();

    const out = race();
    const last = out.order[2] as string;
    const car = out.cars[last];
    if (car) car.retired = true;
    render(
      <LeadersTower
        race={out}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={null}
        onPick={vi.fn()}
      />,
    );
    expect(row(last)).toHaveTextContent(/OUT$/);
  });

  it('at Minimal shows only the intervals next to your car', () => {
    render(
      <LeadersTower
        race={race()}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        live={null}
        onPick={vi.fn()}
        info={informationView('minimal')}
      />,
    );
    const gapped = within(panel())
      .getAllByRole('button')
      .filter((x) => /\+\d+\.\d$/.test(x.textContent ?? ''));
    expect(gapped.length).toBeGreaterThan(0);
    expect(gapped.length).toBeLessThanOrEqual(2);
  });
});
