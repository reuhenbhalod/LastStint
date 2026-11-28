// @vitest-environment jsdom
// Team radio (TeamRadio.tsx), on a real race (Abu Dhabi 2021, HAM vs VER, team-mate BOT):
// the open/close bar; each tyre's box call for the coming lap; the three team orders (hold up
// toggling to release); the headset's mode calls; the disabled, retired and boxing states; and
// in a refuelling race the required fuel fill (picked afresh for each stop).

import type { Decision, RaceModel, RaceState } from '@laststint/sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import abuJson from '../../../../data/races/abu-dhabi-2021.json';
import type { Daily } from '../data/types.js';
import { memoryStorage } from '../eras/difficulty/memoryStorage.test-util.js';
import { GameSession } from '../state/session.js';
import { TeamRadio } from './TeamRadio.js';

const abu = abuJson as unknown as RaceModel;
const REFUEL: RaceModel = { ...abu, era: '1994-2009', rules: { refuelling: true } };

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

/** The race at the takeover (plan A picked), as the race screen has it. */
function raceAt(model: RaceModel): RaceState {
  const daily: Daily = {
    date: '2026-11-07',
    raceId: model.race.id,
    seed: model.race.seed,
    model,
    source: 'practice',
  };
  const s = new GameSession(daily, { grader: { hits: () => new Promise<number[]>(() => {}) } });
  s.start();
  s.pickPlan('a');
  return s.state.race;
}

type Props = Parameters<typeof TeamRadio>[0];
function setup(props: Partial<Props> = {}) {
  const onCall = vi.fn<(c: Decision) => void>();
  const race = props.race ?? raceAt(props.model ?? abu);
  const all: Props = {
    race,
    model: abu,
    userSide: 'HAM',
    rival: 'VER',
    pending: {},
    boxing: null,
    disabled: false,
    describe: () => null,
    onCall,
    ...props,
  };
  const utils = render(<TeamRadio {...all} />);
  return { onCall, race, next: race.lap + 1, ...utils, all };
}

const radio = () => within(screen.getByRole('region', { name: 'Team radio' }));
const tyre = (name: RegExp) => radio().getByRole('button', { name });
const withCar = (race: RaceState, code: string, patch: object): RaceState => ({
  ...race,
  cars: { ...race.cars, [code]: { ...race.cars[code], ...patch } as RaceState['cars'][string] },
});

describe('TeamRadio', () => {
  it('the bar is named "Team radio", describes what is set, and opens and closes', async () => {
    setup();
    const bar = screen.getByRole('button', { name: 'Team radio' });
    expect(bar).toHaveAttribute('aria-expanded', 'true');
    expect(bar).toHaveAccessibleDescription(/Pace standard/);
    expect(radio().getByRole('group', { name: 'Pace' })).toBeInTheDocument();
    await userEvent.click(bar);
    expect(bar).toHaveAttribute('aria-expanded', 'false');
    expect(radio().queryByRole('group', { name: 'Pace' })).toBeNull();
    expect(radio().queryByRole('button', { name: /Softs/ })).toBeNull();
    await userEvent.click(bar);
    expect(bar).toHaveAttribute('aria-expanded', 'true');
    expect(radio().getByRole('group', { name: 'Pace' })).toBeInTheDocument();
  });

  it.each([
    [/Softs/, 'SOFT'],
    [/Mediums/, 'MEDIUM'],
    [/Hards/, 'HARD'],
  ])('box on %s calls a pit stop for the coming lap onto %s', async (name, compound) => {
    const { onCall, next } = setup();
    await userEvent.click(tyre(name));
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith({ lap: next, kind: 'pit', compound });
  });

  it.each([
    ['Hold up Verstappen', 'holdUp'],
    ['Bottas lets you by', 'teammateLetsYouPast'],
    ['Let Bottas by', 'letTeammatePast'],
  ])('team order "%s" calls %s for the coming lap', async (name, order) => {
    const { onCall, next } = setup();
    await userEvent.click(radio().getByRole('button', { name }));
    expect(onCall).toHaveBeenCalledWith({ lap: next, kind: 'teamOrder', order });
  });

  it('hold up is a toggle: pressed while on, and it then reads (and calls) release', async () => {
    const race = raceAt(abu);
    const { onCall, next } = setup({
      race: { ...race, teamOrders: { ...race.teamOrders, holdUp: true } },
    });
    expect(radio().queryByRole('button', { name: 'Hold up Verstappen' })).toBeNull();
    const release = radio().getByRole('button', { name: 'Release Verstappen' });
    expect(release).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(release);
    expect(onCall).toHaveBeenCalledWith({ lap: next, kind: 'teamOrder', order: 'release' });
  });

  it('a headset flip calls the mode for the coming lap', async () => {
    const { onCall, next } = setup();
    await userEvent.click(
      within(radio().getByRole('group', { name: 'Pace' })).getByRole('button', { name: 'push' }),
    );
    await userEvent.click(
      within(radio().getByRole('group', { name: 'Fuel' })).getByRole('button', {
        name: 'Lift & coast',
      }),
    );
    expect(onCall.mock.calls).toEqual([
      [{ lap: next, kind: 'mode', key: 'pace', value: 'push' }],
      [{ lap: next, kind: 'mode', key: 'fuel', value: 'liftAndCoast' }],
    ]);
  });

  it('shows a mode booked for next lap as pressed', () => {
    setup({ pending: { pace: 'manage' } });
    expect(
      within(radio().getByRole('group', { name: 'Pace' })).getByRole('button', { name: 'manage' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('disabled: every order is disabled and clicks call nothing (the bar still toggles)', async () => {
    const { onCall } = setup({ disabled: true });
    const buttons = radio()
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label') !== 'Team radio');
    expect(buttons.length).toBe(18); // 3 tyres, 3 team orders, 12 modes
    for (const b of buttons) expect(b).toBeDisabled();
    for (const b of buttons) await userEvent.click(b);
    expect(onCall).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Team radio' })).toBeEnabled();
  });

  it('our car retired: tyres and headset off; the team orders stay on for the team-mate', () => {
    const race = raceAt(abu);
    setup({ race: withCar(race, 'HAM', { retired: true }) });
    expect(tyre(/Softs/)).toBeDisabled();
    expect(
      within(radio().getByRole('group', { name: 'Pace' })).getByRole('button', { name: 'push' }),
    ).toBeDisabled();
    expect(radio().getByRole('button', { name: 'Let Bottas by' })).toBeEnabled();
  });

  it('the team-mate retired: the team orders are disabled', () => {
    const race = raceAt(abu);
    setup({ race: withCar(race, 'BOT', { retired: true }) });
    for (const name of ['Hold up Verstappen', 'Bottas lets you by', 'Let Bottas by'])
      expect(radio().getByRole('button', { name })).toBeDisabled();
    expect(tyre(/Softs/)).toBeEnabled();
  });

  it('no team-mate in the race: no team orders', () => {
    const model: RaceModel = {
      ...abu,
      drivers: abu.drivers.filter((d) => d.code !== 'BOT'),
    };
    setup({ model, race: raceAt(abu) });
    expect(radio().queryByRole('button', { name: 'Let Bottas by' })).toBeNull();
    expect(screen.queryByText(/Team orders/)).toBeNull();
  });

  it('a stop under way shows it in place of the tyre buttons, and on the bar', () => {
    setup({ boxing: { compound: 'HARD', when: 'at the end of this lap' } });
    expect(radio().queryByRole('button', { name: /Softs/ })).toBeNull();
    expect(radio().getByRole('status')).toHaveTextContent('Hards · at the end of this lap');
    expect(screen.getByRole('button', { name: 'Team radio' })).toHaveAccessibleDescription(
      /Boxing · Hards/,
    );
  });

  describe('a refuelling race', () => {
    it('no fill is picked and the tyres wait for one', async () => {
      const { onCall } = setup({ model: REFUEL });
      const fills = within(radio().getByRole('group', { name: 'Fuel fill' }));
      expect(fills.getAllByRole('button')).toHaveLength(3);
      for (const b of fills.getAllByRole('button'))
        expect(b).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Pick a fuel fill, then the tyres.')).toBeInTheDocument();
      expect(tyre(/Softs/)).toBeDisabled();
      await userEvent.click(tyre(/Softs/));
      expect(onCall).not.toHaveBeenCalled();
      expect(radio().getByRole('meter', { name: /^Fuel to/ })).toBeInTheDocument();
    });

    it.each([
      [/^Short/, 'short'],
      [/^Standard/, 'standard'],
      [/^Long/, 'long'],
    ])(
      'fill %s then a tyre: the box call carries %s, and the next stop picks afresh',
      async (fillName, fill) => {
        const { onCall, next } = setup({ model: REFUEL });
        const fills = within(radio().getByRole('group', { name: 'Fuel fill' }));
        await userEvent.click(fills.getByRole('button', { name: fillName }));
        expect(fills.getByRole('button', { name: fillName })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        expect(screen.queryByText('Pick a fuel fill, then the tyres.')).toBeNull();
        await userEvent.click(tyre(/Mediums/));
        expect(onCall).toHaveBeenCalledWith({ lap: next, kind: 'pit', compound: 'MEDIUM', fill });
        // The fill resets: the tyres wait again.
        expect(fills.getByRole('button', { name: fillName })).toHaveAttribute(
          'aria-pressed',
          'false',
        );
        expect(tyre(/Mediums/)).toBeDisabled();
      },
    );

    it('disabled: the fills are disabled too', () => {
      setup({ model: REFUEL, disabled: true });
      for (const b of within(radio().getByRole('group', { name: 'Fuel fill' })).getAllByRole(
        'button',
      ))
        expect(b).toBeDisabled();
    });
  });

  it('without ERS (a 2005 race block): no ERS row and no ERS on the bar', () => {
    const noErs: RaceModel = { ...abu, era: '1994-2009' };
    setup({ model: noErs, race: raceAt(noErs) });
    expect(radio().queryByRole('group', { name: 'ERS' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Team radio' })).not.toHaveAccessibleDescription(
      /ERS/,
    );
  });
});
