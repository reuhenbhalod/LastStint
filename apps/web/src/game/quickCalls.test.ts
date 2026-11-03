import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameEngine } from '../engine/engine.js';
import { quickCallAt, quickCallLaps, safetyCarCall } from './quickCalls.js';
import { RaceLog } from './raceLog.js';

describe('quick calls', () => {
  it('fill the quiet laps, clear of the big moments and the safety car', async () => {
    const { model } = await new StaticDailyProvider().today();
    const laps = quickCallLaps(model);
    expect(laps).toEqual([39, 41, 45, 47, 50]);
    const busy = model.decisionMoments.flatMap((m) => [m.lap - 1, m.lap]);
    for (const l of laps) {
      expect(busy).not.toContain(l);
      expect(l).toBeLessThan(53); // SC from lap 53
    }
  });

  it('asks something real every scheduled lap, and every answer is a valid order', async () => {
    const { model, seed } = await new StaticDailyProvider().today();
    const engine = new GameEngine(model, seed, { decisions: [] });
    const log = new RaceLog();
    log.see(engine.state);
    const laps = new Set(quickCallLaps(model));
    let asked = 0;
    while (!engine.isFinished()) {
      engine.step();
      const events = log.see(engine.state);
      if (!laps.has(engine.lap)) continue;
      const call = quickCallAt(engine.state, model, events);
      expect(call).not.toBeNull();
      asked++;
      for (const o of call?.options ?? []) {
        if (o.call) {
          expect(o.call.lap).toBe(engine.lap + 1);
          engine.apply(o.call); // valid for the sim
          break;
        }
      }
    }
    expect(asked).toBe(laps.size);
  });
});

describe('safetyCarCall', () => {
  it('asks to box when a crash brings out a safety car the race model does not have', async () => {
    const { model } = await new StaticDailyProvider().today();
    const engine = new GameEngine(model, 64, { decisions: [] });
    while (engine.lap < 40) engine.step();
    const race = { ...engine.state, nextFlag: 'sc' as const };
    const call = safetyCarCall(race, model);
    expect(call?.text).toMatch(/Safety car!/);
    expect(call?.options.map((o) => o.id)).toEqual(['box', 'stay']);
    expect(call?.options[0]?.call).toMatchObject({ lap: 41, kind: 'pit' });
    // Asked once, as it comes out: not on the next SC lap, nor with a stop called or booked.
    expect(safetyCarCall({ ...race, flag: 'sc' }, model)).toBeNull();
    expect(safetyCarCall(race, model, true)).toBeNull();
    const me = race.cars[model.userSide];
    const booked = {
      ...race,
      cars: { ...race.cars, [model.userSide]: { ...me, strategy: [{ lap: 42, to: 'HARD' }] } },
    } as typeof race;
    expect(safetyCarCall(booked, model)).toBeNull();
    // Green next lap, or the race's own SC: no call.
    expect(safetyCarCall({ ...race, nextFlag: 'green' }, model)).toBeNull();
    while (engine.lap < 53) engine.step();
    expect(safetyCarCall(engine.state, model)).toBeNull();
  });
});
