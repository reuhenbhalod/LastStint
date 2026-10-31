import { simulate } from '@boxthislap/sim';
import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameEngine, decisionMoments } from './engine.js';

const daily = () => new StaticDailyProvider().today();

describe('GameEngine', () => {
  it('reproduces the sim result when replaying scripted strategies', async () => {
    const { model, seed } = await daily();
    const viaEngine = new GameEngine(model, seed).runToFlag();
    expect(viaEngine).toEqual(simulate(model, seed));
  });

  it('steps lap by lap from takeover to the flag', async () => {
    const { model, seed } = await daily();
    const engine = new GameEngine(model, seed);
    const start = engine.lap;
    let steps = 0;
    while (!engine.isFinished()) {
      engine.step();
      steps++;
    }
    expect(engine.lap).toBe(model.race.laps);
    expect(steps).toBe(model.race.laps - start);
    expect(engine.result().finishers.length).toBeGreaterThan(0);
  });

  it('records player calls on a live run', async () => {
    const { model, seed } = await daily();
    const engine = new GameEngine(model, seed, { decisions: [] });
    engine.apply({ lap: engine.lap + 1, kind: 'mode', key: 'pace', value: 'push' });
    expect(engine.decisions).toHaveLength(1);
  });
});

describe('decisionMoments', () => {
  it('derives the Abu Dhabi VSC moment with the real call marked', async () => {
    const { model } = await daily();
    const moments = decisionMoments(model);
    const vsc = moments.find((m) => m.trigger === 'VSC');
    expect(vsc?.lap).toBe(36);
    expect(vsc?.realOptionId).toBe('stay-out');
    for (const m of moments) {
      expect(m.options.length).toBeGreaterThanOrEqual(2);
      expect(m.options.length).toBeLessThanOrEqual(4);
    }
  });
});
