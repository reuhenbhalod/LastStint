// @vitest-environment jsdom
// The race plan during the race (PlanBar.tsx): the bar's "Change" opens the editor (from the
// plan's rest after the coming lap) and "Cancel" closes it; "Run this plan" sends a legal plan
// and closes only if it was taken. The heads-up before a planned stop (Box as planned, One more
// lap when it can wait, Change plan) and the engineer's new-plan offer (Switch, Keep ours).

import bahrain2021 from '@data/races/bahrain-2021.json';
import type { CarState, RaceModel, RacePlan } from '@laststint/sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NO_PLAN } from '../game/plans.js';
import type { GameState, PlanState } from '../state/machine.js';
import { PlanBar, PlanHeadsUp, ReplanOffer, betterPlan, headsUpStop } from './PlanBar.js';

const model = bahrain2021 as unknown as RaceModel;

const B: RacePlan = {
  id: 'b',
  stops: [
    { lap: 30, compound: 'HARD' },
    { lap: 45, compound: 'SOFT' },
  ],
  pace: ['standard', 'push', 'standard'],
};

function game(plan: Partial<PlanState>, lap = 15): GameState {
  const car = {
    compound: 'MEDIUM',
    compoundsUsed: ['MEDIUM'],
    tyreAge: 15,
    totalTime: 1000,
    retired: false,
    strategy: [],
  } as unknown as CarState;
  return {
    meta: { userSide: 'VER', rival: 'HAM', takeoverLap: 10, totalLaps: 56 },
    race: { lap, cars: { VER: car, HAM: { ...car, totalTime: 1003 } } },
    plan: { ...NO_PLAN, offered: [B], ...plan },
    decisions: [],
  } as unknown as GameState;
}

const running = { active: B, picked: B, chances: { b: { hits: 61, samples: 100 } } };

/** The bar with its editor flag held in state, as the race screen holds it. */
function Bar({
  state,
  onChange,
  setEditing,
}: {
  state: GameState;
  onChange: (p: RacePlan) => boolean;
  setEditing: (on: boolean) => void;
}) {
  const [editing, set] = useState(false);
  return (
    <PlanBar
      state={state}
      model={model}
      onChange={onChange}
      editing={editing}
      setEditing={(on) => {
        setEditing(on);
        set(on);
      }}
    />
  );
}

function setup(state = game(running), taken = true) {
  const onChange = vi.fn((_p: RacePlan) => taken);
  const setEditing = vi.fn<(on: boolean) => void>();
  const user = userEvent.setup();
  render(<Bar state={state} onChange={onChange} setEditing={setEditing} />);
  return { onChange, setEditing, user };
}

describe('PlanBar', () => {
  it('shows the next stop, the pace and the chance', () => {
    setup();
    const bar = screen.getByRole('region', { name: 'Race plan' });
    expect(bar).toHaveTextContent('Plan B');
    expect(bar).toHaveTextContent('Box lap 30 for hards (in 14)');
    expect(bar).toHaveTextContent('standard, then push, then standard');
    expect(bar).toHaveTextContent('vs Hamilton 61%');
  });

  it('the latest re-rank’s chance wins over the takeover one', () => {
    setup(game({ ...running, live: { lap: 15, mine: 0.33, best: null } }));
    expect(screen.getByRole('region', { name: 'Race plan' })).toHaveTextContent('vs Hamilton 33%');
  });

  it('"Change" opens the editor from the rest of the plan; "Cancel" closes it', async () => {
    const { user, setEditing, onChange } = setup();
    expect(screen.queryByRole('button', { name: 'Run this plan' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(setEditing).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('slider', { name: 'Stop 1 lap' })).toHaveValue('30');
    expect(screen.getByRole('slider', { name: 'Stop 2 lap' })).toHaveValue('45');
    // Stops go after the coming lap: the slider starts on lap 17.
    expect(screen.getByRole('slider', { name: 'Stop 1 lap' })).toHaveAttribute('min', '17');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setEditing).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('"Run this plan" sends the edited plan (as your own) and closes the editor', async () => {
    const { user, onChange, setEditing } = setup();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('button', { name: 'Remove stop 2' }));
    await user.click(screen.getByRole('button', { name: 'Run this plan' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      id: 'own',
      stops: [{ lap: 30, compound: 'HARD' }],
      pace: ['standard', 'push'],
    });
    expect(setEditing).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('button', { name: 'Run this plan' })).toBeNull();
  });

  it('a plan the race refuses leaves the editor open', async () => {
    const { user, onChange, setEditing } = setup(game(running), false);
    await user.click(screen.getByRole('button', { name: 'Change' }));
    setEditing.mockClear();
    await user.click(screen.getByRole('button', { name: 'Run this plan' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(setEditing).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Run this plan' })).toBeInTheDocument();
  });

  it('"Run this plan" is disabled while the plan breaks the two-compound rule', async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    for (const n of [1, 2]) {
      await user.click(
        within(screen.getByRole('group', { name: `Stop ${n} tyre` })).getByRole('button', {
          name: 'mediums',
        }),
      );
    }
    const run = screen.getByRole('button', { name: 'Run this plan' });
    expect(run).toBeDisabled();
    await user.click(run);
    expect(onChange).not.toHaveBeenCalled();
    // A second compound back on: it's on again.
    await user.click(
      within(screen.getByRole('group', { name: 'Stop 1 tyre' })).getByRole('button', {
        name: 'hards',
      }),
    );
    expect(screen.getByRole('button', { name: 'Run this plan' })).toBeEnabled();
  });

  it('no stops left: "to the flag", and Change still opens the editor', async () => {
    const { user } = setup(game(running, 46));
    expect(screen.getByRole('region', { name: 'Race plan' })).toHaveTextContent(
      'No more stops: to the flag',
    );
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('button', { name: '+ Add a stop' })).toBeInTheDocument();
  });

  it('renders nothing without an active plan', () => {
    setup(game({ active: null }));
    expect(screen.queryByRole('region', { name: 'Race plan' })).toBeNull();
  });
});

describe('PlanHeadsUp', () => {
  function heads(canLater: boolean) {
    const fns = { onBox: vi.fn(), onLater: vi.fn(), onChange: vi.fn() };
    render(<PlanHeadsUp stop={{ lap: 30, compound: 'HARD' }} canLater={canLater} {...fns} />);
    return { ...fns, user: userEvent.setup() };
  }

  it('says the stop, and each button calls its own handler once', async () => {
    const { onBox, onLater, onChange, user } = heads(true);
    expect(screen.getByRole('region', { name: 'Planned stop' })).toHaveTextContent(
      'Box next lap for hards, as planned. Still good?',
    );
    await user.click(screen.getByRole('button', { name: 'Box as planned' }));
    expect(onBox).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'One more lap' }));
    expect(onLater).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Change plan' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onBox).toHaveBeenCalledTimes(1);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('"One more lap" is disabled when the stop can’t wait', async () => {
    const { onLater, user } = heads(false);
    const later = screen.getByRole('button', { name: 'One more lap' });
    expect(later).toBeDisabled();
    await user.click(later);
    expect(onLater).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Box as planned' })).toBeEnabled();
  });

  it('works from the keyboard', async () => {
    const { onBox, user } = heads(true);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Box as planned' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onBox).toHaveBeenCalledTimes(1);
  });
});

describe('ReplanOffer', () => {
  it('says the plan and both chances; Switch and Keep ours call their handlers', async () => {
    const onSwitch = vi.fn();
    const onKeep = vi.fn();
    const user = userEvent.setup();
    render(
      <ReplanOffer
        offer={{ plan: B, chance: 0.58, mine: 0.41 }}
        onSwitch={onSwitch}
        onKeep={onKeep}
      />,
    );
    expect(screen.getByRole('region', { name: 'New plan' })).toHaveTextContent(
      'The race has moved. Two stops, hards on lap 30, then softs on lap 45, standard, then push, then standard now looks better: 58% against our 41%.',
    );
    await user.click(screen.getByRole('button', { name: 'Keep ours' }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onSwitch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Switch' }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });
});

describe('headsUpStop and betterPlan', () => {
  it('the heads-up is for a stop on the lap after the coming one', () => {
    expect(headsUpStop(game(running, 28))).toEqual({ lap: 30, compound: 'HARD' });
    expect(headsUpStop(game(running, 27))).toBeNull();
    expect(headsUpStop(game(running, 29))).toBeNull();
  });

  it('a better plan is offered at 8 points or more, on this lap’s re-rank only', () => {
    const best = { plan: B, chance: 0.5 };
    expect(betterPlan(game({ live: { lap: 15, mine: 0.42, best } }))).toEqual({
      ...best,
      mine: 0.42,
    });
    expect(betterPlan(game({ live: { lap: 15, mine: 0.43, best } }))).toBeNull();
    expect(betterPlan(game({ live: { lap: 14, mine: 0.1, best } }))).toBeNull();
    expect(betterPlan(game({ live: { lap: 15, mine: 0.1, best: null } }))).toBeNull();
  });
});
