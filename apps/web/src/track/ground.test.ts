import { describe, expect, it } from 'vitest';
import { groundFor } from './ground.js';
import { outlineFor } from './outlines.js';

describe('the ground under the map', () => {
  it('places the circuit image under the race outline', () => {
    const g = groundFor('belgium-2024');
    expect(g).not.toBeNull();
    expect(g?.src).toMatch(/\/basemap\/spa\.webp$/);
    expect(g?.matrix).toHaveLength(6);
    // The outline's first point, taken into the image's metres and back, lands inside it.
    const o = outlineFor('belgium-2024');
    const [a, b, c, d, e, f] = g?.matrix ?? [1, 0, 0, 1, 0, 0];
    const [px, py] = o?.points[0] ?? [0, 0];
    const det = a * d - b * c;
    const mx = (d * (px - e) - c * (py - f)) / det;
    const my = (-b * (px - e) + a * (py - f)) / det;
    expect(mx).toBeGreaterThan(0);
    expect(mx).toBeLessThan(g?.w ?? 0);
    expect(my).toBeGreaterThan(0);
    expect(my).toBeLessThan(g?.h ?? 0);
  });

  it('has none for a race whose circuit has no image', () => {
    expect(groundFor('monaco-2023')).toBeNull();
    expect(groundFor('no-such-race')).toBeNull();
  });
});
