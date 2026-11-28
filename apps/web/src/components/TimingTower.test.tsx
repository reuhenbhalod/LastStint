// @vitest-environment jsdom
// The timing tower (TimingTower.tsx): one row per car, in race order (the map's while the lap
// runs), each a button that calls the car out (`onPick` with its code). Gaps, PIT, OUT and laps
// down per row, and Minimal information showing only the intervals next to your car.

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { RaceModel, RaceState } from '@laststint/sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { informationView } from '../eras/difficulty/information.js';
import { TimingTower } from './TimingTower.js';

const MODEL = abuDhabi2021 as unknown as RaceModel;
const USER = MODEL.userSide;
const RIVAL = MODEL.rival;

/** The race at the takeover, a lap run: every car has a time. */
function race(): RaceState {
  const engine = new GameEngine(MODEL, MODEL.race.seed, { decisions: [] });
  engine.step();
  return structuredClone(engine.state);
}

const rows = () => within(screen.getByRole('list', { name: 'Standings' })).getAllByRole('button');
const row = (code: string) => screen.getByRole('button', { name: new RegExp(`^\\d+ ${code} `) });

describe('TimingTower', () => {
  it('names its list and shows a row per car, in race order', () => {
    const r = race();
    render(<TimingTower race={r} model={MODEL} userSide={USER} rival={RIVAL} />);
    const names = rows().map((b) => b.textContent ?? '');
    expect(names).toHaveLength(r.order.length);
    r.order.forEach((code, i) => expect(names[i]).toMatch(new RegExp(`^${i + 1}${code}`)));
    expect(names[0]).toMatch(/LEADER$/);
  });

  it('every row calls onPick with its car, by pointer and by keyboard', async () => {
    const r = race();
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<TimingTower race={r} model={MODEL} userSide={USER} rival={RIVAL} onPick={onPick} />);
    for (const code of r.order) await user.click(row(code));
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(r.order);

    onPick.mockClear();
    row(RIVAL).focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onPick.mock.calls).toEqual([[RIVAL], [RIVAL]]);
  });

  it('a row works with no onPick (nothing happens)', async () => {
    const user = userEvent.setup();
    render(<TimingTower race={race()} model={MODEL} userSide={USER} rival={RIVAL} />);
    await user.click(row(USER));
    expect(row(USER)).toBeInTheDocument();
  });

  it('tints your car and the rival', () => {
    render(<TimingTower race={race()} model={MODEL} userSide={USER} rival={RIVAL} />);
    expect(row(USER).className).toMatch(/var\(--you\)/);
    expect(row(RIVAL).className).toMatch(/var\(--rival\)/);
  });

  it('shows OUT for a retired car and laps down for a lapped one', () => {
    const r = race();
    const last = r.order.at(-1) as string;
    const second = r.order.at(-2) as string;
    const car = r.cars[last];
    const lapped = r.cars[second];
    if (!car || !lapped) throw new Error('cars');
    car.retired = true;
    const leader = r.cars[r.order[0] as string];
    if (!leader) throw new Error('leader');
    lapped.totalTime = leader.totalTime + 2.5 * 90;
    render(<TimingTower race={r} model={MODEL} userSide={USER} rival={RIVAL} />);
    expect(row(last)).toHaveTextContent(/OUT$/);
    expect(row(last).className).toMatch(/opacity-55/);
    expect(row(second)).toHaveTextContent(/\+2 LAPS$/);
  });

  it('follows the map while the lap runs: its order, gaps and PIT', () => {
    const r = race();
    const [a, b, ...rest] = r.order as [string, string, ...string[]];
    const live = [
      { code: b, gap: 0, pit: false },
      { code: a, gap: 1.25, pit: false },
      ...rest.slice(0, -1).map((code, i) => ({ code, gap: 3 + i, pit: i === 0 })),
    ];
    render(<TimingTower race={r} model={MODEL} userSide={USER} rival={RIVAL} live={live} />);
    const names = rows().map((x) => x.textContent ?? '');
    expect(names[0]).toMatch(new RegExp(`^1${b}.*LEADER$`));
    expect(names[1]).toMatch(new RegExp(`^2${a}.*\\+1\\.3$`));
    expect(names[2]).toMatch(/PIT$/);
    // A car the map doesn't show running is out, at the bottom.
    expect(names.at(-1)).toMatch(new RegExp(`${rest.at(-1)}.*OUT$`));
  });

  it('at Minimal shows only the intervals next to your car', () => {
    const r = race();
    render(
      <TimingTower
        race={r}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        info={informationView('minimal')}
      />,
    );
    const i = r.order.indexOf(USER);
    const names = rows().map((x) => x.textContent ?? '');
    const gapped = names.filter((n) => /\+\d+\.\d$/.test(n)).length;
    // At most the car behind you and you (to the car ahead), never the whole field.
    expect(gapped).toBeLessThanOrEqual(2);
    expect(gapped).toBeGreaterThan(0);
    const far = r.order.findIndex((_, j) => j > 0 && Math.abs(j - i) > 1);
    expect(names[far]).not.toMatch(/\+\d+\.\d$/);
  });
});
