import { tyreLife } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameEngine } from '../engine/engine.js';
import { modeLine, tyreOutlooks } from './guide.js';

describe('tyre guide', () => {
  it('reads pace, drop-off and gain from the model at the lap-53 safety car', async () => {
    const { model, seed } = await new StaticDailyProvider().today();
    const engine = new GameEngine(model, seed, { decisions: [] });
    while (engine.lap < 52) engine.step();
    const ham = engine.state.cars.HAM;
    const [soft, medium, hard] = tyreOutlooks(model, ham, 53, ['SOFT', 'MEDIUM', 'HARD']);
    expect(soft?.newPace).toBe(0);
    expect(medium?.newPace).toBeCloseTo(model.compounds.MEDIUM?.offset as number);
    // Its usable life, not the fitted cliff.
    expect(hard?.dropOff).toBe(tyreLife(model.compounds.HARD as never));
    expect(soft?.toFlag).toBe(true); // 5 laps left
    // Fresh tyres beat 30-lap-old hards over the last laps, softs most of all.
    expect(soft?.gain).toBeGreaterThan(0);
    expect(soft?.gain as number).toBeGreaterThan(hard?.gain as number);
  });

  it('describes the headset modes from the sim', async () => {
    const { model } = await new StaticDailyProvider().today();
    expect(modeLine(model, 'pace', 'push')).toBe(
      '−0.25 s a lap · tyres wear 30% faster · more mistakes · uses 6% more fuel · more risk of a failure or puncture',
    );
    expect(modeLine(model, 'pace', 'manage')).toBe(
      '+0.35 s a lap · tyres wear 25% slower · uses 4% less fuel',
    );
    expect(modeLine(model, 'fuel', 'liftAndCoast')).toBe(
      '+0.30 s a lap · tyres wear 10% slower · uses 15% less fuel',
    );
    expect(modeLine(model, 'battle', 'hold')).toBe('No change: the baseline');
    expect(modeLine(model, 'battle', 'defend')).toBe(
      '+0.15 s a lap · harder to pass you · more crash risk in a fight',
    );
    expect(modeLine(model, 'ers', 'deploy')).toBe('−0.20 s a lap · uses 15% of the battery a lap');
    expect(modeLine(model, 'ers', 'harvest')).toBe('+0.25 s a lap · battery +15% a lap');
  });
});
