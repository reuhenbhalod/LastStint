// data/drivers.json covers every driver in every race file, with consistent numbers: a new
// race with a driver nobody has researched fails here instead of defaulting quietly.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driverCodes, driverInfo } from './drivers.js';

const races = join(__dirname, '..', '..', '..', '..', 'data', 'races');

describe('driver attitudes', () => {
  it('lists every driver in every race', () => {
    const missing = new Set<string>();
    for (const file of readdirSync(races).filter((f) => f.endsWith('.json'))) {
      const model = JSON.parse(readFileSync(join(races, file), 'utf8')) as {
        drivers: Array<{ code: string }>;
      };
      for (const d of model.drivers) if (!driverInfo(d.code)) missing.add(d.code);
    }
    expect([...missing]).toEqual([]);
  });

  it('tiers follow the ignore rate', () => {
    for (const code of driverCodes()) {
      const d = driverInfo(code);
      if (!d) continue;
      const tier = d.ignores >= 10 ? 'high' : d.ignores >= 3 ? 'medium' : 'low';
      expect([code, d.tier]).toEqual([code, tier]);
      expect(d.ignores).toBeGreaterThanOrEqual(0);
      expect(d.ignores).toBeLessThanOrEqual(100);
    }
  });
});
