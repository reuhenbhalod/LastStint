// @vitest-environment jsdom
// The plan editor (PlanEditor.tsx), pressed control by control: add and remove a stop, move it
// (the − and + steps, the lap slider, clamped to the race and to a minimum stint), pick its
// tyre, pick each stint's pace, and a refuelling race's fuel fills. The rules messages and the
// chance follow the plan. A real race file is the model: bahrain-2021 (56 laps, three dry
// tyres, the two-compound rule) and japan-2005 (refuelling, no tyre changes).

import bahrain2021 from '@data/races/bahrain-2021.json';
import japan2005 from '@data/races/japan-2005.json';
import type { RaceModel, RacePlan } from '@laststint/sim';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PlanEditor } from './PlanEditor.js';

const bahrain = bahrain2021 as unknown as RaceModel;
const japan = japan2005 as unknown as RaceModel;
const onMedium = { compound: 'MEDIUM', compoundsUsed: ['MEDIUM'] };

function plan(stops: RacePlan['stops'], pace?: RacePlan['pace']): RacePlan {
  return { id: 'own', stops, pace: pace ?? stops.map(() => 'standard').concat('standard') };
}

/** The editor with its plan held in state, as PlanCard and PlanBar hold it; `spy` sees each. */
function Editor({
  start,
  spy,
  model = bahrain,
  car = onMedium,
  chance,
}: {
  start: RacePlan;
  spy: (p: RacePlan) => void;
  model?: RaceModel;
  car?: { compound: string; compoundsUsed: string[] };
  chance?: number | null;
}) {
  const [value, setValue] = useState(start);
  return (
    <PlanEditor
      model={model}
      from={10}
      car={car}
      value={value}
      chance={chance}
      onChange={(p) => {
        spy(p);
        setValue(p);
      }}
    />
  );
}

function setup(props: Omit<Parameters<typeof Editor>[0], 'spy'>) {
  const spy = vi.fn<(p: RacePlan) => void>();
  const user = userEvent.setup();
  render(<Editor spy={spy} {...props} />);
  return { spy, user, last: () => spy.mock.lastCall?.[0] };
}

describe('PlanEditor: stops', () => {
  it('"+ Add a stop" puts one mid-way through the longest stint, on a tyre not yet run', async () => {
    const { spy, user, last } = setup({ start: plan([]) });
    await user.click(screen.getByRole('button', { name: '+ Add a stop' }));
    expect(spy).toHaveBeenCalledTimes(1);
    // Laps 11 to 55 are free: the middle is lap 33; the car has run mediums, so softs.
    expect(last()).toEqual(plan([{ lap: 33, compound: 'SOFT' }], ['standard', 'standard']));
    expect(screen.getByText('lap 33')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Stop 1 lap' })).toHaveValue('33');
  });

  it('a second stop goes in the longer stint, sorted, and copies the pace of the stint it splits', async () => {
    const { user, last } = setup({
      start: plan([{ lap: 20, compound: 'HARD' }], ['push', 'manage']),
    });
    await user.click(screen.getByRole('button', { name: '+ Add a stop' }));
    // Stints 11-20 and 21-55: the second is longer, its middle lap 38.
    expect(last()).toEqual(
      plan(
        [
          { lap: 20, compound: 'HARD' },
          { lap: 38, compound: 'SOFT' },
        ],
        ['push', 'manage', 'manage'],
      ),
    );
  });

  it('"+ Add a stop" is disabled at three stops, and when no stint has room for one', () => {
    setup({
      start: plan([
        { lap: 20, compound: 'HARD' },
        { lap: 30, compound: 'SOFT' },
        { lap: 40, compound: 'HARD' },
      ]),
    });
    expect(screen.getByRole('button', { name: '+ Add a stop' })).toBeDisabled();
  });

  it('"+ Add a stop" is disabled when every stint is shorter than two minimum stints', () => {
    const model = { ...bahrain, race: { ...bahrain.race, laps: 20 } } as RaceModel;
    // Laps 11 to 19, one stop on 15: stints 11-15 and 16-19, neither has 6 laps.
    setup({ model, start: plan([{ lap: 15, compound: 'HARD' }]) });
    expect(screen.getByRole('button', { name: '+ Add a stop' })).toBeDisabled();
  });

  it('Remove drops that stop and the pace of the stint after it', async () => {
    const { user, last } = setup({
      start: plan(
        [
          { lap: 20, compound: 'HARD' },
          { lap: 40, compound: 'SOFT' },
        ],
        ['manage', 'push', 'standard'],
      ),
    });
    await user.click(screen.getByRole('button', { name: 'Remove stop 1' }));
    expect(last()).toEqual(plan([{ lap: 40, compound: 'SOFT' }], ['manage', 'standard']));
    // The rest renumber: the one left is stop 1 now.
    expect(screen.getByRole('button', { name: 'Remove stop 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove stop 2' })).toBeNull();
  });

  it('the − and + steps move the stop a lap earlier or later', async () => {
    const { user, last } = setup({ start: plan([{ lap: 30, compound: 'HARD' }]) });
    await user.click(screen.getByRole('button', { name: 'Stop 1 earlier' }));
    expect(last()?.stops).toEqual([{ lap: 29, compound: 'HARD' }]);
    await user.click(screen.getByRole('button', { name: 'Stop 1 later' }));
    await user.click(screen.getByRole('button', { name: 'Stop 1 later' }));
    expect(last()?.stops).toEqual([{ lap: 31, compound: 'HARD' }]);
  });

  it('the − step stops at the first lap after the takeover (11)', async () => {
    const { user, last } = setup({ start: plan([{ lap: 11, compound: 'HARD' }]) });
    await user.click(screen.getByRole('button', { name: 'Stop 1 earlier' }));
    expect(last()?.stops[0]?.lap).toBe(11);
  });

  it('the + step stops at lap 55 of 56', async () => {
    const { user, last } = setup({ start: plan([{ lap: 55, compound: 'HARD' }]) });
    await user.click(screen.getByRole('button', { name: 'Stop 1 later' }));
    expect(last()?.stops[0]?.lap).toBe(55);
  });

  it('two stops keep a minimum stint (3 laps) between them', async () => {
    const { user, last } = setup({
      start: plan([
        { lap: 20, compound: 'HARD' },
        { lap: 23, compound: 'SOFT' },
      ]),
    });
    await user.click(screen.getByRole('button', { name: 'Stop 1 later' }));
    expect(last()?.stops.map((s) => s.lap)).toEqual([20, 23]);
    await user.click(screen.getByRole('button', { name: 'Stop 2 earlier' }));
    expect(last()?.stops.map((s) => s.lap)).toEqual([20, 23]);
    await user.click(screen.getByRole('button', { name: 'Stop 2 later' }));
    expect(last()?.stops.map((s) => s.lap)).toEqual([20, 24]);
  });

  it('the lap slider runs from the lap after the takeover to the last lap but one, and moves the stop', () => {
    const { last } = setup({ start: plan([{ lap: 30, compound: 'HARD' }]) });
    const slider = screen.getByRole('slider', { name: 'Stop 1 lap' });
    expect(slider).toHaveAttribute('min', '11');
    expect(slider).toHaveAttribute('max', '55');
    fireEvent.change(slider, { target: { value: '44' } });
    expect(last()?.stops).toEqual([{ lap: 44, compound: 'HARD' }]);
    expect(screen.getByText('lap 44')).toBeInTheDocument();
  });

  it('the slider is clamped by the next stop too', () => {
    const { last } = setup({
      start: plan([
        { lap: 20, compound: 'HARD' },
        { lap: 30, compound: 'SOFT' },
      ]),
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Stop 1 lap' }), {
      target: { value: '50' },
    });
    expect(last()?.stops.map((s) => s.lap)).toEqual([27, 30]);
  });
});

describe('PlanEditor: tyres and pace', () => {
  it('each stop offers the race’s three tyres, the one fitted pressed; a tap fits another', async () => {
    const { user, last } = setup({
      start: plan([
        { lap: 20, compound: 'HARD' },
        { lap: 40, compound: 'SOFT' },
      ]),
    });
    const stop2 = screen.getByRole('group', { name: 'Stop 2 tyre' });
    const names = within(stop2)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['softs', 'mediums', 'hards']);
    expect(within(stop2).getByRole('button', { name: 'softs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(stop2).getByRole('button', { name: 'hards' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(within(stop2).getByRole('button', { name: 'mediums' }));
    expect(last()?.stops).toEqual([
      { lap: 20, compound: 'HARD' },
      { lap: 40, compound: 'MEDIUM' },
    ]);
    expect(
      within(screen.getByRole('group', { name: 'Stop 2 tyre' })).getByRole('button', {
        name: 'mediums',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('each stint has Manage, Standard and Push; a tap sets that stint only', async () => {
    const { user, last } = setup({
      start: plan([{ lap: 30, compound: 'HARD' }], ['standard', 'standard']),
    });
    const stint1 = screen.getByRole('group', { name: 'Stint 1 pace' });
    const stint2 = screen.getByRole('group', { name: 'Stint 2 pace' });
    expect(
      within(stint1)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Manage', 'Standard', 'Push']);
    expect(within(stint1).getByRole('button', { name: 'Standard' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(stint1).getByRole('button', { name: 'Push' }));
    expect(last()?.pace).toEqual(['push', 'standard']);
    await user.click(
      within(screen.getByRole('group', { name: 'Stint 2 pace' })).getByRole('button', {
        name: 'Manage',
      }),
    );
    expect(last()?.pace).toEqual(['push', 'manage']);
    expect(
      within(screen.getByRole('group', { name: 'Stint 1 pace' })).getByRole('button', {
        name: 'Push',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(stint2).toBeInTheDocument();
  });

  it('a pace button works from the keyboard (Space)', async () => {
    const { user, last } = setup({ start: plan([]) });
    within(screen.getByRole('group', { name: 'Stint 1 pace' }))
      .getByRole('button', { name: 'Manage' })
      .focus();
    await user.keyboard(' ');
    expect(last()?.pace).toEqual(['manage']);
  });
});

describe('PlanEditor: rules and chance', () => {
  it('one dry compound to the flag says the rule and hides the chance', () => {
    setup({ start: plan([{ lap: 30, compound: 'MEDIUM' }]), chance: 0.5 });
    expect(screen.getByText(/Two dry compounds are compulsory/)).toBeInTheDocument();
    expect(screen.queryByText(/Chance vs/)).toBeNull();
  });

  it('a legal plan shows its chance as a percentage, with no rule message', () => {
    const legal = plan([{ lap: 30, compound: 'HARD' }]);
    setup({ start: legal, chance: 0.42 });
    expect(screen.getByText(/Chance vs HAM/)).toHaveTextContent('Chance vs HAM: 42%');
    expect(screen.queryByText(/compulsory/)).toBeNull();
  });

  it('a chance of null reads "…"', () => {
    setup({ start: plan([{ lap: 30, compound: 'HARD' }]), chance: null });
    expect(screen.getByText(/Chance vs HAM/)).toHaveTextContent('Chance vs HAM: …');
  });

  it('no chance prop (changing the plan during the race): no chance line', () => {
    setup({ start: plan([{ lap: 30, compound: 'HARD' }]) });
    expect(screen.queryByText(/Chance vs/)).toBeNull();
  });

  it('fitting a second compound clears the rule message', async () => {
    const { user } = setup({ start: plan([{ lap: 30, compound: 'MEDIUM' }]), chance: 0.3 });
    await user.click(
      within(screen.getByRole('group', { name: 'Stop 1 tyre' })).getByRole('button', {
        name: 'hards',
      }),
    );
    expect(screen.queryByText(/compulsory/)).toBeNull();
    expect(screen.getByText(/Chance vs HAM/)).toHaveTextContent('30%');
  });
});

describe('PlanEditor: a refuelling race (japan-2005)', () => {
  const car = { compound: 'MEDIUM', compoundsUsed: ['MEDIUM'] };

  it('no tyre changes: a stop offers only the tyre fitted, and no rule message', () => {
    setup({ model: japan, car, start: plan([{ lap: 30, compound: 'MEDIUM', fill: 'standard' }]) });
    const tyres = within(screen.getByRole('group', { name: 'Stop 1 tyre' })).getAllByRole('button');
    expect(tyres.map((b) => b.getAttribute('aria-label'))).toEqual(['mediums']);
    expect(screen.queryByText(/compulsory/)).toBeNull();
  });

  it('a new stop has no fill: the plan asks for one; Short, Standard or Long picks it', async () => {
    const { user, last } = setup({ model: japan, car, start: plan([]), chance: 0.5 });
    await user.click(screen.getByRole('button', { name: '+ Add a stop' }));
    expect(last()?.stops[0]?.fill).toBeUndefined();
    expect(screen.getByText('Pick a fuel fill for every stop.')).toBeInTheDocument();
    expect(screen.queryByText(/Chance vs/)).toBeNull();

    const fills = screen.getByRole('group', { name: 'Stop 1 fuel fill' });
    const buttons = within(fills).getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.replace(/\s*\d+$/, ''))).toEqual([
      'Short',
      'Standard',
      'Long',
    ]);
    // Each shows the laps it fuels, none pressed yet.
    for (const b of buttons) {
      expect(b.textContent).toMatch(/\d+$/);
      expect(b).toHaveAttribute('aria-pressed', 'false');
    }
    await user.click(within(fills).getByRole('button', { name: /^Long/ }));
    expect(last()?.stops[0]?.fill).toBe('long');
    expect(
      within(screen.getByRole('group', { name: 'Stop 1 fuel fill' })).getByRole('button', {
        name: /^Long/,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Pick a fuel fill for every stop.')).toBeNull();
    expect(screen.getByText(/Chance vs FIS/)).toHaveTextContent('50%');
  });

  it('an engineer’s exact fill shows as its laps, with no choice pressed', () => {
    setup({
      model: japan,
      car,
      start: plan([{ lap: 30, compound: 'MEDIUM', fill: { laps: 23 } }]),
    });
    const fills = screen.getByRole('group', { name: 'Stop 1 fuel fill' });
    expect(within(fills).getByRole('status')).toHaveTextContent('Fuel 23');
    for (const b of within(fills).getAllByRole('button'))
      expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it('a dry race has no fuel fills', () => {
    setup({ start: plan([{ lap: 30, compound: 'HARD' }]) });
    expect(screen.queryByRole('group', { name: 'Stop 1 fuel fill' })).toBeNull();
  });
});
