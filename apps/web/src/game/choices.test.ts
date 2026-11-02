import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { choicesFor } from './choices.js';

describe('choicesFor', () => {
  it('folds the stop options into one Box, tyres softest first', async () => {
    const { model } = await new StaticDailyProvider().today();
    const sc = model.decisionMoments.find((m) => m.id === 'sc-stop');
    const c = choicesFor(sc as NonNullable<typeof sc>);
    expect(c.direct.map((o) => o.id)).toEqual(['stay']);
    expect(c.box?.tyres.map((t) => [t.option.id, t.compound])).toEqual([
      ['box-soft', 'SOFT'],
      ['box-medium', 'MEDIUM'],
      ['box-hard', 'HARD'],
    ]);
    expect(c.boxIndex).toBe(1);
  });

  it('a single stop option is still one Box, with one tyre', async () => {
    const { model } = await new StaticDailyProvider().today();
    const vsc = model.decisionMoments.find((m) => m.id === 'vsc-cover');
    const one = { ...(vsc as NonNullable<typeof vsc>) };
    one.options = one.options.filter((o) => o.id !== 'cover-medium');
    expect(choicesFor(one).box?.tyres).toHaveLength(1);
    expect(choicesFor(vsc as NonNullable<typeof vsc>).box?.tyres.map((t) => t.compound)).toEqual([
      'MEDIUM',
      'HARD',
    ]);
  });

  it('moments without stops have no Box', async () => {
    const { model } = await new StaticDailyProvider().today();
    const restart = model.decisionMoments.find((m) => m.id === 'restart-stance');
    const c = choicesFor(restart as NonNullable<typeof restart>);
    expect(c.box).toBeNull();
    expect(c.direct.map((o) => o.id)).toEqual(['defend', 'hold', 'attack']);
  });
});
