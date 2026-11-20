// The map's motion over whole races (pit fix 2): every pool race run frame by frame, with your
// car boxing now and then. No car jumps round the map, every stop turns in at pit entry and
// rejoins at pit exit, and a stop drives the lane at a believable speed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type RaceModel, mulberry32 } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/engine.js';
import { type PitLane, flagOn, nearestFraction, pitLane, polyline } from './geometry.js';
import { MapMotion, laneAt } from './motion.js';
import { outlineFor } from './outlines.js';

const root = join(__dirname, '..', '..', '..', '..', 'data');
const pools = JSON.parse(readFileSync(join(root, 'pools.json'), 'utf8')) as {
  daily: string[];
  survivor: Record<string, number[]>;
};
const ids = [...pools.daily, ...Object.keys(pools.survivor)];
/** Frames per lap tick (2x speed at 60 fps is 300; fewer keeps the test quick). */
const FRAMES = 150;

/** How far round the lap (signed, -0.5 to 0.5) point `f` is from `g`. */
const apart = (f: number, g: number) => ((((f - g + 0.5) % 1) + 1) % 1) - 0.5;

function run(id: string) {
  const model = JSON.parse(readFileSync(join(root, 'races', `${id}.json`), 'utf8')) as RaceModel;
  const outline = outlineFor(id);
  if (!outline) throw new Error(`no outline for ${id}`);
  const line = polyline(outline.points);
  const lane = pitLane(outline, line, 30) as PitLane;
  const engine = new GameEngine(model, model.race.seed, { decisions: [] });
  const motion = new MapMotion(line, lane, () => 0.4, 24 / line.length);
  const rng = mulberry32(5);
  const perFrame = line.length / FRAMES;
  const out = {
    fastest: 0,
    /** The same for cars unlapping themselves (they pass the queue, a lap back in the model). */
    fastestUnlapping: 0,
    quick: 0,
    frames: 0,
    entries: 0,
    exits: 0,
    offEntry: 0,
    offExit: 0,
    laneFrames: [] as number[],
    retired: 0,
    shownStopping: 0,
  };
  const prev = new Map<string, { x: number; y: number; lane: boolean }>();
  const inLane = new Map<string, number>();
  let userBox: number | null = null;
  let lastGap = new Map<string, number>();
  while (!engine.isFinished()) {
    const race = engine.state;
    if (userBox === null && rng.next() < 0.08 && race.lap + 1 < model.race.laps) {
      userBox = race.lap + 1;
      engine.apply({ lap: userBox, kind: 'pit', compound: Object.keys(model.compounds)[0] ?? '' });
    }
    const flag = race.nextFlag ?? flagOn(model, race.lap + 1);
    // Cars the race model unlaps at a restart (a lap back in one): they do pass the queue.
    const leader = race.cars[race.order[0] ?? ''];
    const behind = (c: string) => (race.cars[c]?.totalTime ?? 0) - (leader?.totalTime ?? 0);
    const unlapping = new Set([...lastGap].filter(([c, g]) => g - behind(c) > 30).map(([c]) => c));
    lastGap = new Map(race.order.map((c) => [c, behind(c)]));
    // The lap being shown, run ahead as the game does (an exact replay of the calls).
    const replay = new GameEngine(model, model.race.seed, { decisions: engine.decisions });
    while (replay.lap < race.lap + 1 && !replay.isFinished()) replay.step();
    const ahead = replay.state;
    // ...and cars unlapping on the lap being shown (they now pass the queue through the lap).
    const aheadLeader = ahead.cars[ahead.order[0] ?? ''];
    for (const c of race.order) {
      const g = (ahead.cars[c]?.totalTime ?? 0) - (aheadLeader?.totalTime ?? 0);
      if (behind(c) - g > 30) unlapping.add(c);
    }
    const stopping = new Set<string>();
    for (let f = 0; f < FRAMES; f++) {
      const places = motion.frame({
        race,
        model,
        flag,
        progress: Math.min(0.995, f / FRAMES),
        smooth: true,
        userSide: model.userSide,
        userBox: userBox !== null && userBox > race.lap ? userBox : null,
        ahead,
      });
      for (const [code, p] of places) {
        if (p.out !== undefined && !race.cars[code]?.retired) stopping.add(code);
        const q = prev.get(code);
        if (q) {
          const pace = Math.hypot(p.x - q.x, p.y - q.y) / perFrame;
          if (unlapping.has(code)) out.fastestUnlapping = Math.max(out.fastestUnlapping, pace);
          else out.fastest = Math.max(out.fastest, pace);
          out.frames++;
          if (pace > 2.5 && !unlapping.has(code)) out.quick++;
          if (!q.lane && p.lane) {
            out.entries++;
            if (Math.abs(apart(nearestFraction(line, [q.x, q.y]), lane.entry)) > 0.03)
              out.offEntry++;
          }
          if (q.lane && !p.lane) {
            out.exits++;
            if (Math.abs(apart(nearestFraction(line, [p.x, p.y]), lane.exit)) > 0.03) out.offExit++;
            out.laneFrames.push(inLane.get(code) ?? 0);
          }
        }
        inLane.set(code, p.lane ? (inLane.get(code) ?? 0) + 1 : 0);
        prev.set(code, p);
      }
    }
    const before = new Set(race.order.filter((c) => !race.cars[c]?.retired));
    engine.step();
    // Every car that retires on the lap was shown stopping on track during it.
    for (const c of before) {
      if (!engine.state.cars[c]?.retired) continue;
      out.retired++;
      if (stopping.has(c)) out.shownStopping++;
    }
    if (userBox !== null && engine.state.lap > userBox + 1) userBox = null;
  }
  return out;
}

describe('the map’s motion', () => {
  it.each(ids)('%s: no jumps, stops in at pit entry and out at pit exit', (id) => {
    const r = run(id);
    // A frame's move is at most a few frames' driving, and that only for a moment: an
    // unlapping car or a glide to a new gap goes quicker, and a stop the race model decides
    // after its in-lap (the rival covering you) hops into the lane. A car flying round the
    // lap would be 10x and more, frame after frame.
    expect(r.fastest).toBeLessThan(6);
    expect(r.fastestUnlapping).toBeLessThan(8);
    expect(r.quick / r.frames).toBeLessThan(0.0005);
    // A Daily with 15-25 laps left (races batch 3) sees only a few stops after the takeover.
    const { race } = JSON.parse(
      readFileSync(join(root, 'races', `${id}.json`), 'utf8'),
    ) as RaceModel;
    expect(r.entries).toBeGreaterThan(race.laps - race.takeoverLap > 25 ? 5 : 0);
    expect(r.exits).toBeGreaterThanOrEqual(r.entries - 2); // a stop or two in the lane at the flag
    expect(r.offEntry).toBeLessThanOrEqual(Math.max(1, r.entries * 0.1));
    expect(r.offExit).toBeLessThanOrEqual(Math.max(1, r.exits * 0.1));
    // In the lane for a believable time: more than a blink, under a lap (a long repair stop,
    // Sargeant's 66 s in Japan 2024, takes most of one).
    for (const n of r.laneFrames) {
      expect(n).toBeGreaterThan(FRAMES * 0.08);
      expect(n).toBeLessThan(FRAMES * 0.95);
    }
    // A car that retires stops on track where it's seen (not vanishing at the line).
    expect(r.shownStopping).toBe(r.retired);
  });

  it('drives the lane in, waits at the garage, then out', () => {
    expect(laneAt(0, 0.4)).toBe(0);
    expect(laneAt(0.45, 0.4)).toBeCloseTo(0.4, 9);
    expect(laneAt(1, 0.4)).toBeCloseTo(1, 9);
    // Never backwards.
    let last = 0;
    for (let r = 0; r <= 1; r += 0.01) {
      expect(laneAt(r, 0.5)).toBeGreaterThanOrEqual(last - 1e-12);
      last = laneAt(r, 0.5);
    }
  });
});
