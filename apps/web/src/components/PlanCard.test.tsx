// @vitest-environment jsdom
// The race plan at takeover (PlanCard.tsx): pick one of the engineer's plans (the best is
// marked and picked by default), "Go with plan X" sends the pick, "Build your own" opens the
// editor from the selected plan and grades the draft a moment after the last change (only a
// legal one), and "The engineer’s plans" goes back. bahrain-2021 is the model.

import bahrain2021 from '@data/races/bahrain-2021.json';
import type { CarState, PlanId, RaceModel, RacePlan } from '@laststint/sim';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_PLAN } from '../game/plans.js';
import type { GameState, PlanState } from '../state/machine.js';
import { PlanCard } from './PlanCard.js';

const model = bahrain2021 as unknown as RaceModel;

const A: RacePlan = { id: 'a', stops: [], pace: ['standard'] };
const B: RacePlan = {
  id: 'b',
  stops: [{ lap: 30, compound: 'HARD' }],
  pace: ['standard', 'push'],
};
const C: RacePlan = {
  id: 'c',
  stops: [
    { lap: 25, compound: 'HARD' },
    { lap: 42, compound: 'SOFT' },
  ],
  pace: ['manage', 'standard', 'standard'],
};

function car(over: Partial<CarState>): CarState {
  return {
    compound: 'MEDIUM',
    compoundsUsed: ['MEDIUM'],
    tyreAge: 10,
    totalTime: 1000,
    retired: false,
    ...over,
  } as CarState;
}

function game(plan: Partial<PlanState>): GameState {
  return {
    meta: { userSide: 'VER', rival: 'HAM', takeoverLap: 10, totalLaps: 56 },
    race: {
      lap: 10,
      cars: { VER: car({ totalTime: 1000 }), HAM: car({ totalTime: 1002.5 }) },
    },
    plan: { ...NO_PLAN, offered: [A, B, C], ...plan },
    decisions: [],
  } as unknown as GameState;
}

const chances = {
  a: { hits: 30, samples: 100 },
  b: { hits: 61, samples: 100 },
  c: { hits: 45, samples: 100 },
};

function setup(plan: Partial<PlanState> = { chances }, onBuild = vi.fn(() => true)) {
  const onPick = vi.fn<(id: PlanId) => void>();
  const user = userEvent.setup();
  const view = render(
    <PlanCard state={game(plan)} model={model} onBuild={onBuild} onPick={onPick} />,
  );
  const rerender = (p: Partial<PlanState>) =>
    view.rerender(<PlanCard state={game(p)} model={model} onBuild={onBuild} onPick={onPick} />);
  return { onPick, onBuild, user, rerender };
}

const planButton = (id: string) => screen.getByRole('button', { name: new RegExp(`^${id} · `) });

describe('PlanCard: the engineer’s plans', () => {
  it('names each plan by its stops and chance, its stops as the description, the best marked', () => {
    setup();
    expect(planButton('A')).toHaveAccessibleName('A · No stop, 30%');
    expect(planButton('B')).toHaveAccessibleName('B · One stop, 61%, engineer’s pick');
    expect(planButton('C')).toHaveAccessibleName('C · Two stops, 45%');
    expect(planButton('B')).toHaveAccessibleDescription('hards on lap 30 · standard, then push');
    expect(planButton('A')).toHaveAccessibleDescription('Stay out to the flag');
  });

  it('the engineer’s pick is selected first; Go sends it', async () => {
    const { onPick, user } = setup();
    expect(planButton('B')).toHaveAttribute('aria-pressed', 'true');
    expect(planButton('A')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Go with plan B' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('tapping another plan selects it (only it), and Go sends that one', async () => {
    const { onPick, user } = setup();
    await user.click(planButton('C'));
    expect(planButton('C')).toHaveAttribute('aria-pressed', 'true');
    expect(planButton('B')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Go with plan C' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('c');
    await user.click(planButton('A'));
    await user.click(screen.getByRole('button', { name: 'Go with plan A' }));
    expect(onPick).toHaveBeenLastCalledWith('a');
  });

  it('a plan can be picked with the keyboard', async () => {
    const { onPick, user } = setup();
    planButton('A').focus();
    await user.keyboard('{Enter}');
    expect(planButton('A')).toHaveAttribute('aria-pressed', 'true');
    screen.getByRole('button', { name: 'Go with plan A' }).focus();
    await user.keyboard(' ');
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('while chances are worked out: "…", no pick marked, plan A selected and Go still works', async () => {
    const { onPick, user } = setup({ chances: { a: chances.a } });
    expect(planButton('B')).toHaveAccessibleName('B · One stop, chance being worked out');
    expect(screen.queryByText('Engineer’s pick')).toBeNull();
    expect(planButton('A')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Go with plan A' }));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('the headline has the laps to go, the gap to the rival and the tyres', () => {
    setup();
    expect(screen.getByText(/laps to go/)).toHaveTextContent(
      '46 laps to go · +2.5s on Hamilton · 10-lap-old mediums',
    );
  });
});

describe('PlanCard: build your own', () => {
  // The grading pause runs on fake timers, so these press with fireEvent (Testing Library's
  // async user events wait on real timers).
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('"Build your own" opens the editor from the selected plan; Go is off until it is graded', async () => {
    const { onPick } = setup();
    fireEvent.click(planButton('C'));
    fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
    // The editor holds plan C's two stops.
    expect(screen.getByRole('slider', { name: 'Stop 1 lap' })).toHaveValue('25');
    expect(screen.getByRole('slider', { name: 'Stop 2 lap' })).toHaveValue('42');
    expect(screen.queryByRole('button', { name: /^A · / })).toBeNull();
    const go = screen.getByRole('button', { name: 'Go with your plan' });
    expect(go).toBeDisabled();
    fireEvent.click(go);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('a legal draft is graded 350 ms after the last change, once', async () => {
    const { onBuild } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
    // Plan B is one stop on hards: legal, so it's graded after the pause.
    act(() => vi.advanceTimersByTime(349));
    expect(onBuild).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onBuild).toHaveBeenCalledWith({ ...B, id: 'own' });

    // Two quick changes: only the last is graded.
    onBuild.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Stop 1 later' }));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole('button', { name: 'Stop 1 later' }));
    act(() => vi.advanceTimersByTime(349));
    expect(onBuild).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onBuild).toHaveBeenCalledWith({
      ...B,
      id: 'own',
      stops: [{ lap: 32, compound: 'HARD' }],
    });
  });

  it('an illegal draft (one dry compound) is never graded', async () => {
    const { onBuild } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Stop 1 tyre' })).getByRole('button', {
        name: 'mediums',
      }),
    );
    onBuild.mockClear();
    act(() => vi.advanceTimersByTime(1000));
    expect(onBuild).not.toHaveBeenCalled();
    expect(screen.getByText(/Two dry compounds are compulsory/)).toBeInTheDocument();
  });

  it('once graded (plan.own matches the draft) Go is on and sends "own"; no regrade', async () => {
    const { onBuild, onPick, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
    act(() => vi.advanceTimersByTime(350));
    expect(onBuild).toHaveBeenCalledTimes(1);
    const own = { ...B, id: 'own' as const };
    rerender({ chances: { ...chances, own: { hits: 70, samples: 100 } }, own });
    expect(screen.getByText(/Chance vs HAM/)).toHaveTextContent('70%');
    act(() => vi.advanceTimersByTime(1000));
    expect(onBuild).toHaveBeenCalledTimes(1);
    const go = screen.getByRole('button', { name: 'Go with your plan' });
    expect(go).toBeEnabled();
    fireEvent.click(go);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('own');
  });

  it('"The engineer’s plans" closes the editor and goes back to the engineer’s pick', async () => {
    setup();
    fireEvent.click(planButton('A'));
    fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
    fireEvent.click(screen.getByRole('button', { name: 'The engineer’s plans' }));
    expect(screen.queryByRole('slider')).toBeNull();
    expect(planButton('B')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Go with plan B' })).toBeEnabled();
  });

  it('closing the editor before the pause cancels the pending grade', async () => {
    const { onBuild } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
    fireEvent.click(screen.getByRole('button', { name: 'The engineer’s plans' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(onBuild).not.toHaveBeenCalled();
  });
});
