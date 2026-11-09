import type { DecisionMoment, Fill } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { choicesFor, tyreLabel } from './choices.js';

const moment = async (id: string) => {
  const { model } = await new StaticDailyProvider().today();
  const m = model.decisionMoments.find((x) => x.id === id);
  if (!m) throw new Error(`no moment ${id}`);
  return m;
};

describe('choicesFor', () => {
  it('folds the stop options into Box and Box next lap, tyres softest first', async () => {
    const c = choicesFor(await moment('tyres-going'));
    expect(c.direct.map((o) => o.id)).toEqual(['stay']);
    expect(c.boxes.map((b) => [b.key, b.label, b.lap])).toEqual([
      ['now', 'Box', 44],
      ['next', 'Box next lap', 45],
    ]);
    expect(c.boxes[0]?.tyres.map((t) => [t.option.id, t.compound])).toEqual([
      ['box-soft', 'SOFT'],
      ['box-medium', 'MEDIUM'],
      ['box-hard', 'HARD'],
    ]);
    expect(c.boxes[1]?.tyres.map((t) => t.compound)).toEqual(['MEDIUM', 'HARD']);
    expect(c.boxIndex).toBe(1);
  });

  it('a single stop option is still a Box, with one tyre', async () => {
    const c = choicesFor(await moment('sc-stop'));
    expect(c.boxes.map((b) => b.tyres.length)).toEqual([3, 1]);
  });

  it('moments without stops have no Box; combined calls stay direct', async () => {
    const restart = choicesFor(await moment('restart-stance'));
    expect(restart.boxes).toEqual([]);
    expect(restart.direct.map((o) => o.id)).toEqual(['defend', 'hold', 'attack']);
    const push = choicesFor(await moment('manage-or-push'));
    expect(push.direct.map((o) => o.id)).toEqual(['push', 'standard', 'manage', 'push-attack']);
  });

  it('a refuelling stop offered with several fills names each fill on its tyre button', () => {
    const pit = (id: string, fill: Fill) => ({
      id,
      label: id,
      decisions: [{ lap: 61, kind: 'pit' as const, compound: 'MEDIUM', fill }],
    });
    const c = choicesFor({
      id: 'stop-61',
      lap: 61,
      trigger: 'cliff',
      options: [
        { id: 'stay', label: 'Stay out', decisions: [] },
        pit('box-medium', { laps: 10 }),
        pit('box-medium-short', 'short'),
        pit('box-medium-long', 'long'),
      ],
      realOptionId: 'box-medium',
    } as unknown as DecisionMoment);
    const tyres = c.boxes[0]?.tyres ?? [];
    expect(tyres.map((t) => tyreLabel(t, tyres))).toEqual([
      'Mediums, 10 laps of fuel',
      'Mediums, short fill',
      'Mediums, long fill',
    ]);
    // One option per compound: the tyre alone, as before.
    const one = tyres.slice(0, 1);
    expect(tyreLabel(one[0] as (typeof one)[number], one)).toBe('Mediums');
  });
});
