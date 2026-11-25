// @vitest-environment jsdom
// The big call (BroadcastDecision.tsx), on Abu Dhabi 2021's real moments: each top-level
// button chooses its option; "Box" with more than one tyre opens the tyre step, whose buttons
// choose the stop and whose Back returns; "Box next lap" with one tyre chooses it at once.
// Number keys pick (top level, then tyres), Escape backs out, the first button takes focus.

import type { DecisionMoment, RaceModel, RaceState } from '@laststint/sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import abuJson from '../../../../data/races/abu-dhabi-2021.json';
import type { Daily } from '../data/types.js';
import { RaceEraContext, TODAY_LOOK } from '../eras/RaceEraContext.js';
import { memoryStorage } from '../eras/difficulty/memoryStorage.test-util.js';
import { GameSession } from '../state/session.js';
import { BroadcastDecision } from './BroadcastDecision.js';

const abu = abuJson as unknown as RaceModel;

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

/** Each moment of the race (by lap) with the race as it stood, answering the first option. */
const moments = new Map<number, { moment: DecisionMoment; race: RaceState }>();
beforeAll(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  const daily: Daily = {
    date: '2026-11-07',
    raceId: abu.race.id,
    seed: abu.race.seed,
    model: abu,
    source: 'practice',
  };
  const s = new GameSession(daily, { grader: { hits: () => new Promise<number[]>(() => {}) } });
  s.start();
  s.pickPlan('a');
  for (let i = 0; i < 400 && s.state.phase !== 'finished'; i++) {
    const m = s.state.currentMoment;
    if (s.state.phase === 'decision' && m) {
      moments.set(m.lap, { moment: m, race: s.state.race });
      s.choose(m.options[0]?.id as string);
    } else s.tick();
  }
  vi.unstubAllGlobals();
});

function setup(lap: number, extra: { timer?: React.ReactNode; board?: boolean } = {}) {
  const at = moments.get(lap);
  if (!at) throw new Error(`no moment on lap ${lap}`);
  const onChoose = vi.fn<(id: string) => void>();
  const card = (
    <BroadcastDecision
      moment={at.moment}
      race={at.race}
      model={abu}
      onChoose={onChoose}
      timer={extra.timer}
    />
  );
  render(
    extra.board ? (
      <RaceEraContext.Provider value={{ ...TODAY_LOOK, prompts: 'board' }}>
        {card}
      </RaceEraContext.Provider>
    ) : (
      card
    ),
  );
  return { onChoose };
}

const card = () => within(screen.getByRole('region', { name: 'Your call' }));
const names = () =>
  card()
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('BroadcastDecision (lap 36: stay, box on mediums or hards, box next lap on mediums)', () => {
  it('folds the stops into Box (two tyres) and Box next lap (one tyre)', () => {
    setup(36);
    expect(names()).toEqual(['Stay out', 'Box', 'Box next lap, mediums']);
    expect(card().getByRole('alert')).toHaveTextContent(/^Engineer · .* · Lap 36$/);
  });

  it('describes each top button with its line (title)', () => {
    setup(36);
    expect(card().getByRole('button', { name: 'Stay out' })).toHaveAccessibleDescription(
      /Keep the \d+-lap-old/,
    );
    expect(card().getByRole('button', { name: 'Box' })).toHaveAccessibleDescription(/^Fresh tyres/);
    expect(
      card().getByRole('button', { name: 'Box next lap, mediums' }),
    ).toHaveAccessibleDescription(/^One lap, then fresh/);
  });

  it('Stay out chooses "stay"', async () => {
    const { onChoose } = setup(36);
    await userEvent.click(card().getByRole('button', { name: 'Stay out' }));
    expect(onChoose.mock.calls).toEqual([['stay']]);
  });

  it('Box next lap with one tyre chooses that stop at once', async () => {
    const { onChoose } = setup(36);
    await userEvent.click(card().getByRole('button', { name: 'Box next lap, mediums' }));
    expect(onChoose.mock.calls).toEqual([['cover-next-medium']]);
  });

  it('Box opens the tyre step (nothing chosen yet), softest first, the first focused', async () => {
    const { onChoose } = setup(36);
    await userEvent.click(card().getByRole('button', { name: 'Box' }));
    expect(onChoose).not.toHaveBeenCalled();
    expect(names()).toEqual(['Mediums', 'Hards', 'Back']);
    expect(card().getByText(/Box: which tyres\?/)).toBeInTheDocument();
    expect(card().getByRole('button', { name: 'Mediums' })).toHaveFocus();
  });

  it.each([
    ['Mediums', 'cover-medium'],
    ['Hards', 'cover-hard'],
  ])('in the tyre step, %s chooses %s', async (name, id) => {
    const { onChoose } = setup(36);
    await userEvent.click(card().getByRole('button', { name: 'Box' }));
    await userEvent.click(card().getByRole('button', { name }));
    expect(onChoose.mock.calls).toEqual([[id]]);
  });

  it('Back returns to the top level, focus on its first button, nothing chosen', async () => {
    const { onChoose } = setup(36);
    await userEvent.click(card().getByRole('button', { name: 'Box' }));
    await userEvent.click(card().getByRole('button', { name: 'Back' }));
    expect(names()).toEqual(['Stay out', 'Box', 'Box next lap, mediums']);
    expect(card().getByRole('button', { name: 'Stay out' })).toHaveFocus();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('focuses the first button when the card opens', () => {
    setup(36);
    expect(card().getByRole('button', { name: 'Stay out' })).toHaveFocus();
  });

  it('keys: 2 opens Box, Escape backs out, 3 picks box next lap', async () => {
    const { onChoose } = setup(36);
    await userEvent.keyboard('2');
    expect(names()).toEqual(['Mediums', 'Hards', 'Back']);
    await userEvent.keyboard('{Escape}');
    expect(names()).toEqual(['Stay out', 'Box', 'Box next lap, mediums']);
    await userEvent.keyboard('3');
    expect(onChoose.mock.calls).toEqual([['cover-next-medium']]);
  });

  it('keys in the tyre step pick the tyre by number; out-of-range and 0 do nothing', async () => {
    const { onChoose } = setup(36);
    await userEvent.keyboard('2');
    await userEvent.keyboard('0');
    await userEvent.keyboard('3');
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.keyboard('2');
    expect(onChoose.mock.calls).toEqual([['cover-hard']]);
  });

  it('key 1 at the top level chooses the first option; 4 (none) does nothing', async () => {
    const { onChoose } = setup(36);
    await userEvent.keyboard('4');
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.keyboard('1');
    expect(onChoose.mock.calls).toEqual([['stay']]);
  });

  it('keyboard: Tab to Box and Enter opens the tyre step', async () => {
    const user = userEvent.setup();
    const { onChoose } = setup(36);
    await user.tab();
    expect(card().getByRole('button', { name: 'Box' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(names()).toEqual(['Mediums', 'Hards', 'Back']);
    await user.keyboard('{Enter}');
    expect(onChoose.mock.calls).toEqual([['cover-medium']]);
  });

  it('shows the Eras timer by the tag, and the pit-board tag in Eras 1-2', () => {
    setup(36, { timer: <span>0:30</span>, board: true });
    expect(card().getByText('0:30')).toBeInTheDocument();
    expect(card().getByRole('alert')).toHaveTextContent(/^Pit board · /);
    expect(screen.getByRole('region', { name: 'Your call' })).toHaveClass('pit-board');
  });
});

describe('BroadcastDecision (other moments)', () => {
  it('lap 44: Box opens three tyres; Box next lap opens two', async () => {
    const { onChoose } = setup(44);
    expect(names()).toEqual(['Stay out', 'Box', 'Box next lap']);
    await userEvent.click(card().getByRole('button', { name: 'Box' }));
    expect(names()).toEqual(['Softs', 'Mediums', 'Hards', 'Back']);
    await userEvent.click(card().getByRole('button', { name: 'Softs' }));
    expect(onChoose).toHaveBeenLastCalledWith('box-soft');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(card().getByRole('button', { name: 'Box next lap' }));
    expect(names()).toEqual(['Mediums', 'Hards', 'Back']);
    await userEvent.keyboard('2');
    expect(onChoose).toHaveBeenLastCalledWith('box-next-hard');
  });

  it.each([
    ['Push now', 'push'],
    ['Standard pace', 'standard'],
    ['Manage the tyres', 'manage'],
    ['Push and attack', 'push-attack'],
  ])('lap 49 (pace calls, no stop): %s chooses %s', async (name, id) => {
    const { onChoose } = setup(49);
    expect(names()).toEqual(['Push now', 'Standard pace', 'Manage the tyres', 'Push and attack']);
    await userEvent.click(card().getByRole('button', { name }));
    expect(onChoose.mock.calls).toEqual([[id]]);
  });

  it.each([
    ['Defend hard', 'defend'],
    ['Hold the line', 'hold'],
    ['Attack', 'attack'],
  ])('lap 57 (battle modes): %s chooses %s', async (name, id) => {
    const { onChoose } = setup(57);
    await userEvent.click(card().getByRole('button', { name }));
    expect(onChoose.mock.calls).toEqual([[id]]);
  });

  it('Escape at the top level does nothing', async () => {
    const { onChoose } = setup(57);
    await userEvent.keyboard('{Escape}');
    expect(names()).toEqual(['Defend hard', 'Hold the line', 'Attack']);
    expect(onChoose).not.toHaveBeenCalled();
  });
});
