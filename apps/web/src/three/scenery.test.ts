import { describe, expect, it } from 'vitest';
import { type SceneryRace, circuitFor, lapIndex, toWorld } from './scenery.js';
import { SCENE_3D } from './switch.js';

const race = (frac: number[]): SceneryRace => ({
  m: [2, 0, 0, -2],
  t: [10, 500],
  err: 1,
  frac,
  corners: [],
  pit: [],
});

describe('3D scenery', () => {
  it.runIf(!SCENE_3D)('has no scenery anywhere while the 3D view is switched off', () => {
    expect(circuitFor('belgium-2024')).toBeNull();
    expect(circuitFor('italy-2024')).toBeNull();
  });

  it.runIf(SCENE_3D)('has scenery for the five circuits and no others', () => {
    expect(circuitFor('belgium-2024')).toBe('spa');
    expect(circuitFor('italy-2019')).toBe('monza');
    expect(circuitFor('bahrain-2022')).toBe('bahrain');
    expect(circuitFor('japan-2024')).toBe('suzuka');
    expect(circuitFor('hungary-2025')).toBe('hungaroring');
    expect(circuitFor('abu-dhabi-2021')).toBeNull();
    // a race at the circuit without its outline lined up
    expect(circuitFor('japan-2023')).toBeNull();
  });

  it('maps a fraction of the game lap to a point of the real one, wrapping past the line', () => {
    // the real lap starts a quarter of the way round the game's
    const r = race([0.25, 0.5, 0.75, 1.0]);
    expect(lapIndex(r, 1000, 0)).toBeCloseTo(250);
    expect(lapIndex(r, 1000, 0.5)).toBeCloseTo(750);
    expect(lapIndex(r, 1000, 0.875)).toBeCloseTo(125); // past the real lap's end
    expect(lapIndex(r, 1000, 1.0)).toBeCloseTo(250); // a full lap round
  });

  it('places a 2D map point in the scenery', () => {
    expect(toWorld(race([0]), 3, 4)).toEqual([16, 492]);
  });
});
