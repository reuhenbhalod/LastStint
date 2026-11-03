import { describe, expect, it } from 'vitest';
import { StaticDailyProvider } from '../data/provider.js';
import { GameEngine } from '../engine/engine.js';
import {
  carsOnTrack,
  flagOn,
  lapTime,
  lapsToFlag,
  nearestFraction,
  pitLane,
  pitPosition,
  pointAlong,
  pointAt,
  polyline,
  runToFlag,
  spaceOut,
  spreadLane,
} from './geometry.js';

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

describe('pit lane', () => {
  // A 100 x 100 square lap; the lane runs inside the bottom edge.
  const square: Array<[number, number]> = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  const lap = polyline(square);

  it('finds the fraction of the lap nearest a point', () => {
    expect(nearestFraction(lap, [50, -5])).toBeCloseTo(0.125);
    expect(nearestFraction(lap, [105, 50])).toBeCloseTo(0.375);
  });

  it('places entry and exit on the lap and walks the open lane', () => {
    const lane = pitLane(
      {
        raceId: 'x',
        width: 100,
        height: 100,
        points: square,
        corners: [],
        pit: [
          [10, 95],
          [90, 95],
        ],
      },
      lap,
    );
    expect(lane).not.toBeNull();
    expect(lane?.entry).toBeCloseTo(0.725);
    expect(lane?.exit).toBeCloseTo(0.525);
    expect(lane && pointAlong(lane.path, 0.5)).toEqual([50, 95]);
    expect(lane?.path.length).toBe(80);
  });

  it('spreads the lane clear of the track, tapering to the real entry and exit', () => {
    // The lane runs 5 inside the bottom edge; spread to 20, ends untouched.
    const pit: Array<[number, number]> = Array.from({ length: 11 }, (_, i) => [10 + i * 8, 95]);
    const out = spreadLane(lap, pit, 20, 3);
    expect(out[0]?.[1]).toBeCloseTo(95);
    expect(out[10]?.[1]).toBeCloseTo(95);
    expect(out[5]?.[1]).toBeCloseTo(80);
    expect(out[5]?.[0]).toBeCloseTo(50);
  });

  it('has no lane without pit points', () => {
    expect(
      pitLane({ raceId: 'x', width: 1, height: 1, points: square, corners: [] }, lap),
    ).toBeNull();
  });
});

describe('finish and spacing', () => {
  it('keeps cars a dot apart, by where they are on track', () => {
    const out = spaceOut(
      new Map([
        ['A', 0],
        ['B', 0.001],
        ['C', 0.002],
        ['L', 1.0015], // lapped: on track between B and C
      ]),
      0.01,
    );
    expect(out.get('A')).toBe(0);
    expect(out.get('B')).toBeCloseTo(0.01);
    expect(out.get('L')).toBeCloseTo(1.02);
    expect(out.get('C')).toBeCloseTo(0.03);
  });

  it('runs each car to the line from its finishing gap', () => {
    const behind = new Map([
      ['P1', 0],
      ['P2', 0.05],
      ['LAP', 1.2],
    ]);
    expect(lapsToFlag(0)).toBe(0);
    expect(lapsToFlag(0.05)).toBeCloseTo(0.05);
    expect(lapsToFlag(1.2)).toBeCloseTo(0.2);
    const early = runToFlag(behind, 0.01);
    expect(early.get('P1')?.finished).toBe(true);
    expect(early.get('P2')).toMatchObject({ finished: false });
    expect(early.get('P2')?.at).toBeCloseTo(-0.04);
    const later = runToFlag(behind, 0.3);
    expect(later.get('P2')?.finished).toBe(true);
    expect(later.get('LAP')?.finished).toBe(true);
    expect(later.get('P2')?.at).toBeLessThan(0.045);
    // Parked in finishing order: the winner furthest past the line.
    expect(later.get('P1')?.at as number).toBeGreaterThan(later.get('P2')?.at as number);
  });

  it('knows the flag a lap runs under', async () => {
    const { model } = await new StaticDailyProvider().today();
    expect(flagOn(model, 36)).toBe('vsc');
    expect(flagOn(model, 53)).toBe('sc');
    expect(flagOn(model, 57)).toBe('sc');
    expect(flagOn(model, 58)).toBe('green');
  });
});

describe('pitPosition', () => {
  const lane = { entry: 0.95, exit: 0.1 };
  it('drives the lap to pit entry, runs the lane, and rejoins at pit exit', () => {
    // 0.3 of a lap behind, 0.2 more after the stop.
    const at = (p: number) => pitPosition(p, 0.3, 0.5, lane, 0.4);
    expect(at(0)).toEqual({ lane: null, at: -0.3 });
    const tIn = 0.25; // 0.25 - 0.3 = -0.05 = pit entry
    expect(at(tIn - 0.01).lane).toBeNull();
    expect(at(tIn + 0.01).lane).toBeGreaterThan(0);
    const tOut = 0.6; // 0.6 - 0.5 = 0.1 = pit exit
    expect(at(tOut - 0.01).lane).toBeGreaterThan(0.9);
    const out = at(tOut + 0.01);
    expect(out.lane).toBeNull();
    expect(out.at).toBeCloseTo(0.11, 6);
  });
  it('pauses at the garage halfway', () => {
    const at = (p: number) => pitPosition(p, 0.3, 0.5, lane, 0.4);
    expect(at(0.25 + 0.35 * 0.5).lane).toBeCloseTo(0.4, 6);
  });
  it('starts in the lane when the car is already past pit entry', () => {
    // At the start the car is at -0.02: between entry (0.95) and the line.
    const p = pitPosition(0, 0.02, 0.25, lane, 0.4);
    expect(p.lane).not.toBeNull();
    expect(p.lane).toBeGreaterThan(0);
  });
});
