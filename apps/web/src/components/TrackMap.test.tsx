// @vitest-environment jsdom
// The track map's selection (TrackMap.tsx): every car on track is a button ("<code>: details")
// that selects it on a primary press (pointer down, since the car moves from under the finger)
// or Enter/Space, and the selected car is pressed. Cars out of the race aren't buttons.

import abuDhabi2021 from '@data/races/abu-dhabi-2021.json';
import type { RaceModel, RaceState } from '@laststint/sim';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import type { MapFeed } from '../track/feed.js';
import { outlineFor } from '../track/outlines.js';
import { TrackMap } from './TrackMap.js';

const MODEL = abuDhabi2021 as unknown as RaceModel;
const USER = MODEL.userSide;
const RIVAL = MODEL.rival;
const OUTLINE = outlineFor(MODEL.race.id);
if (!OUTLINE) throw new Error('no outline for abu-dhabi-2021');

function race(): RaceState {
  const engine = new GameEngine(MODEL, MODEL.race.seed, { decisions: [] });
  engine.step();
  return structuredClone(engine.state);
}

function map(props: Partial<Parameters<typeof TrackMap>[0]> = {}) {
  const onSelect = vi.fn();
  const r = props.race ?? race();
  const view = render(
    <TrackMap
      outline={OUTLINE as NonNullable<typeof OUTLINE>}
      race={r}
      model={MODEL}
      userSide={USER}
      rival={RIVAL}
      clock={null}
      selected={null}
      onSelect={onSelect}
      dim={false}
      {...props}
    />,
  );
  return { onSelect, race: r, ...view };
}

const car = (code: string) => screen.getByRole('button', { name: `${code}: details` });

describe('TrackMap selection', () => {
  it('titles the map and has a button per running car, none pressed', () => {
    const { race: r } = map();
    const title = screen.getByTitle(/^Track map, lap \d+\. Select a car for its details\.$/);
    expect(title.closest('svg')).toHaveAttribute('aria-labelledby', title.id);
    const running = r.order.filter((c) => !r.cars[c]?.retired);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label')?.slice(0, 3)).sort()).toEqual(
      [...running].sort(),
    );
    for (const b of buttons) expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it('a primary press on any car selects it, with its code', async () => {
    const user = userEvent.setup();
    const { onSelect, race: r } = map();
    for (const code of r.order) await user.pointer({ keys: '[MouseLeft]', target: car(code) });
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(r.order);
  });

  it('a secondary (right) or middle press does not select', async () => {
    const user = userEvent.setup();
    const { onSelect } = map();
    await user.pointer({ keys: '[MouseRight]', target: car(RIVAL) });
    await user.pointer({ keys: '[MouseMiddle]', target: car(RIVAL) });
    expect(onSelect).not.toHaveBeenCalled();
    await user.pointer({ keys: '[MouseLeft>]', target: car(RIVAL) });
    expect(onSelect).toHaveBeenCalledWith(RIVAL);
  });

  it('Enter or Space on a focused car selects it; other keys do not', async () => {
    const user = userEvent.setup();
    const { onSelect } = map();
    car(USER).focus();
    expect(car(USER)).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.keyboard('a');
    await user.keyboard('{Escape}');
    expect(onSelect.mock.calls).toEqual([[USER], [USER]]);
  });

  it('cars are in the tab order', async () => {
    const user = userEvent.setup();
    map();
    await user.tab();
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^[A-Z]{3}: details$/);
  });

  it('marks the selected car pressed (and only it), and feeds it to the 3D view', () => {
    const feedRef = { current: null as MapFeed | null };
    const { rerender, race: r } = map({ selected: RIVAL, feedRef });
    expect(car(RIVAL)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(feedRef.current?.selected).toBe(RIVAL);
    rerender(
      <TrackMap
        outline={OUTLINE as NonNullable<typeof OUTLINE>}
        race={r}
        model={MODEL}
        userSide={USER}
        rival={RIVAL}
        clock={null}
        selected={USER}
        onSelect={vi.fn()}
        dim={false}
        feedRef={feedRef}
      />,
    );
    expect(car(USER)).toHaveAttribute('aria-pressed', 'true');
    expect(car(RIVAL)).toHaveAttribute('aria-pressed', 'false');
    expect(feedRef.current?.selected).toBe(USER);
  });

  it('a retired car is not a button', () => {
    const r = race();
    const out = r.order.find((c) => c !== USER && c !== RIVAL) as string;
    const c = r.cars[out];
    if (c) c.retired = true;
    map({ race: r });
    expect(screen.queryByRole('button', { name: `${out}: details` })).toBeNull();
    expect(car(USER)).toBeInTheDocument();
  });
});
