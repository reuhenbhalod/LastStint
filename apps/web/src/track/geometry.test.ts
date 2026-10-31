import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameEngine } from '../engine/engine.js';
import { carsOnTrack, lapTime, pointAt, polyline } from './geometry.js';

describe('pointAt', () => {
  const square = polyline([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  it('walks the closed outline by distance', () => {
    expect(square.length).toBe(40);
    expect(pointAt(square, 0)).toEqual([0, 0]);
    expect(pointAt(square, 0.125)).toEqual([5, 0]);
    expect(pointAt(square, 0.5)).toEqual([10, 10]);
    expect(pointAt(square, 0.875)).toEqual([0, 5]); // the closing segment back to the start
  });
  it('wraps fractions outside [0, 1)', () => {
    expect(pointAt(square, 1.25)).toEqual(pointAt(square, 0.25));
    expect(pointAt(square, -0.25)).toEqual(pointAt(square, 0.75));
  });
});

describe('carsOnTrack', () => {
  it('places each car by its gap to the leader, lapped cars a lap or more back', async () => {
    const { model, seed } = await new StaticDailyProvider().today();
    const engine = new GameEngine(model, seed);
    for (let i = 0; i < 18; i++) engine.step(); // lap 52, green
    const cars = carsOnTrack(engine.state, model);
    expect(cars[0]).toEqual({ code: engine.state.order[0], behind: 0, lapped: false });
    const lap = lapTime(model, engine.state.flag);
    for (const c of cars) {
      const car = engine.state.cars[c.code];
      const leader = engine.state.cars[cars[0]?.code as string];
      expect(c.behind).toBeCloseTo(((car?.totalTime ?? 0) - (leader?.totalTime ?? 0)) / lap, 9);
      expect(c.lapped).toBe(c.behind >= 1);
    }
    expect(cars.some((c) => c.lapped)).toBe(true); // backmarkers are a lap down by lap 52
  });
});
