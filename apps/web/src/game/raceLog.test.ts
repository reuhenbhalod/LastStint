import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameEngine } from '../engine/engine.js';
import { RaceLog, lapEvents } from './raceLog.js';

describe('lapEvents', () => {
  it('finds the real stops with their cost and lap times', async () => {
    const { model, seed } = await new StaticDailyProvider().today();
    const engine = new GameEngine(model, seed); // the scripted real race
    const stops: Array<{ code: string; lap: number; cost: number | null }> = [];
    let prev = structuredClone(engine.state);
    while (!engine.isFinished()) {
      engine.step();
      const ev = lapEvents(prev, engine.state);
      for (const p of ev.pits) stops.push(p);
      if (ev.lap === 40) expect(ev.lapTimes.HAM).toBeGreaterThan(80);
      prev = structuredClone(engine.state);
    }
    // Verstappen's real stops after the takeover: the VSC (out-lap 37) and the SC (out-lap 54).
    const ver = stops.filter((s) => s.code === 'VER');
    expect(ver.map((s) => s.lap)).toEqual([37, 54]);
    // A VSC stop costs real time, though less than under green.
    expect(ver[0]?.cost).toBeGreaterThan(5);
    expect(ver[0]?.cost).toBeLessThan(25);
  });

  it('logs laps from the sim state it is handed, though the sim mutates it in place', async () => {
    const { model, seed } = await new StaticDailyProvider().today();
    const engine = new GameEngine(model, seed);
    const log = new RaceLog();
    log.see(engine.state);
    while (engine.lap < 38) {
      engine.step();
      log.see(engine.state);
      log.see(engine.state); // a re-render on the same lap adds nothing
    }
    expect(log.laps.map((l) => l.lap)).toEqual([35, 36, 37, 38]);
    expect(log.laps.find((l) => l.lap === 37)?.pits.map((p) => p.code)).toContain('VER');
    expect(log.laps[0]?.lapTimes.HAM).toBeGreaterThan(80);
  });
});
