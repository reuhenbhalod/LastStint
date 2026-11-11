// Eras build plan 2.6: every driver in the 100 appendix races' entry lists (Jolpica, cached in
// fixtures/eras-appendix-entries.json) is in data/drivers.json, every appendix team has a colour
// for its year, and every incident added for an appendix race cites its source.

import db from '@data/drivers.json';
import incidents from '@data/incidents.json';
import { describe, expect, it } from 'vitest';
import { teamColour } from '../game/teamTheme.js';
import { driverInfo } from './drivers.js';
import appendix from './fixtures/eras-appendix-entries.json';

interface Entry {
  driverId: string;
  name: string;
  code: string;
  team: string;
}

const RACES = (appendix as unknown as { races: Record<string, { entries: Entry[] }> }).races;
const DRIVERS = db.drivers as Record<string, { name: string; code?: string; jolpicaId?: string }>;
const INCIDENTS = incidents as unknown as Record<
  string,
  Array<{ lap: number; type: string; driver?: string; cars?: string[]; source?: string }>
>;

/** Appendix races whose incidents.json entry predates 2.6. */
const BEFORE_2_6 = new Set([
  'hungary-2019',
  'bahrain-2021',
  'france-2021',
  'russia-2021',
  'abu-dhabi-2021',
]);

const plain = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\p{L} ]/gu, '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

describe('eras appendix roster', () => {
  it('covers the 100 appendix races', () => {
    expect(Object.keys(RACES)).toHaveLength(100);
  });

  it('lists every appendix driver in drivers.json, under the right person', () => {
    const wrong: string[] = [];
    for (const [race, { entries }] of Object.entries(RACES)) {
      const codes = new Set<string>();
      for (const e of entries) {
        const d = DRIVERS[e.code];
        if (!d || !driverInfo(e.code)) wrong.push(`${race} ${e.code} missing`);
        else if (d.jolpicaId ? d.jolpicaId !== e.driverId : plain(d.name) !== plain(e.name))
          wrong.push(`${race} ${e.code} is ${d.name}, not ${e.name}`);
        // A race's codes are its drivers' ids, so they must be unique within the race.
        if (codes.has(e.code)) wrong.push(`${race} ${e.code} twice`);
        codes.add(e.code);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('keeps one key per historic driver, with a three-letter display code', () => {
    const seen = new Map<string, string>();
    for (const [key, d] of Object.entries(DRIVERS)) {
      if (!d.jolpicaId) continue;
      expect(seen.get(d.jolpicaId)).toBeUndefined();
      seen.set(d.jolpicaId, key);
      expect(d.code).toMatch(/^[A-Z]{3}$/);
      expect(key.startsWith(d.code as string)).toBe(true);
      expect(key.length).toBeLessThanOrEqual(4); // the race schema's code limit
    }
  });

  it('gives every appendix team a colour for its year', () => {
    const missing = new Set<string>();
    for (const [race, { entries }] of Object.entries(RACES)) {
      const year = Number(race.slice(-4));
      for (const e of entries) if (!teamColour(e.team, year)) missing.add(`${e.team} ${year}`);
    }
    expect([...missing]).toEqual([]);
  });

  it("uses a team's livery for the year, and today's colour without one", () => {
    expect(teamColour('McLaren', 1988)).not.toBe(teamColour('McLaren', 2024));
    expect(teamColour('McLaren', 2024)).toBe(teamColour('McLaren'));
    expect(teamColour('Red Bull', 2010)).toBe(teamColour('Red Bull Racing'));
    expect(teamColour('Williams', 2018)).toBe(teamColour('Williams')); // built races unchanged
  });

  it('cites a source for every appendix incident, naming drivers in the race', () => {
    for (const [race, { entries }] of Object.entries(RACES)) {
      const items = INCIDENTS[race];
      if (!items) continue;
      const inRace = new Set(entries.map((e) => e.code));
      for (const item of items) {
        if (BEFORE_2_6.has(race)) continue; // written earlier from FastF1 by `pipeline incidents`
        expect([race, item.lap, typeof item.source]).toEqual([race, item.lap, 'string']);
        for (const code of [item.driver, ...(item.cars ?? [])].filter(Boolean))
          expect([race, code, inRace.has(code as string)]).toEqual([race, code, true]);
      }
    }
  });
});
