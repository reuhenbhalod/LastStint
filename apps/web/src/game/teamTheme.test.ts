import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RaceModel } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { seasonOf } from '../track/garages.js';
import { TEAM_COLOR, colourDistance, inkOn, teamColour, teamTheme } from './teamTheme.js';

const dir = join(__dirname, '..', '..', '..', '..', 'data', 'races');
const races = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RaceModel);
const model = (id: string) => races.find((m) => m.race.id === id) as RaceModel;

describe('team colours', () => {
  it('every team in our races has a colour', () => {
    // In the race's year: Eras teams (Caterham, Lotus F1...) have only a historic livery.
    const missing = races.flatMap((m) =>
      m.drivers
        .filter((d) => !teamColour(d.team, seasonOf(m.race.id)))
        .map((d) => `${m.race.id}: ${d.team}`),
    );
    expect([...new Set(missing)]).toEqual([]);
  });

  it('a Ferrari race is red, and the rival keeps its own team colour', () => {
    const t = teamTheme(model('canada-2022')); // SAI (Ferrari) vs VER (Red Bull)
    expect(t.you).toBe(TEAM_COLOR.Ferrari);
    expect(t.rival).toBe(TEAM_COLOR['Red Bull Racing']);
    expect(t.youInk).toBe('#ffffff');
  });

  it('never gives the rival a colour you could mistake for yours', () => {
    for (const m of races) {
      const t = teamTheme(m);
      expect(colourDistance(t.you, t.rival)).toBeGreaterThanOrEqual(150);
    }
    // Team-mates: NOR vs PIA, both McLaren.
    const mc = teamTheme(model('china-2025'));
    expect(mc.you).toBe(TEAM_COLOR.McLaren);
    expect(mc.rival).not.toBe(TEAM_COLOR.McLaren);
  });

  it('turns warnings amber beside a red team, so good and bad never look alike', () => {
    expect(teamTheme(model('canada-2022')).box).not.toBe('#d4432f'); // Ferrari
    expect(teamTheme(model('abu-dhabi-2021')).box).toBe('#d4432f'); // Mercedes
  });

  it('picks readable text for each colour', () => {
    expect(inkOn('#ff8000')).toBe('#0b0f0e');
    expect(inkOn('#3671c6')).toBe('#ffffff');
  });
});
