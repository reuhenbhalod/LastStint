import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ERAS,
  ERA_RACES,
  HISTORY_PATH,
  eraById,
  eraLeaderboardPath,
  eraRace,
  eraRacePath,
  erasRoute,
  raceName,
  racesOfEra,
} from './catalog.js';

const repo = join(__dirname, '..', '..', '..', '..');

/** The spec's §4 race tables: era id -> [raceId, dilemma] rows in position order. */
function specRaces(): Record<number, [string, string][]> {
  const spec = readFileSync(join(repo, 'docs', 'laststint-eras-mode-spec.md'), 'utf8');
  const out: Record<number, [string, string][]> = {};
  let era: number | null = null;
  for (const line of spec.split('\n')) {
    const head = /^### Era (\d+):/.exec(line);
    if (head) era = Number(head[1]);
    else if (line.startsWith('#')) era = null;
    const row = /^\| (\d+) \| ([a-z0-9-]+) \| (.+?) \| .+ \|$/.exec(line);
    if (era !== null && row) {
      const rows = out[era] ?? [];
      rows.push([row[2] as string, row[3] as string]);
      out[era] = rows;
    }
  }
  return out;
}

describe('ERAS', () => {
  it('has the ten eras in play order, Era 10 first', () => {
    expect(ERAS.map((e) => e.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(ERAS.map((e) => e.playOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(eraById(10)).toMatchObject({ name: 'Ground-effect era', years: '2022–2025' });
    expect(eraById(1)).toMatchObject({ name: 'Turbo era', years: '1983–1988' });
    expect(eraById(11)).toBeUndefined();
  });
});

describe('ERA_RACES', () => {
  it("has each era's ten races and dilemmas exactly as in the spec's §4 tables", () => {
    const spec = specRaces();
    expect(Object.keys(spec)).toHaveLength(10);
    for (const era of ERAS) {
      const races = racesOfEra(era.id);
      expect(races.map((r) => [r.raceId, r.dilemma])).toEqual(spec[era.id]);
      expect(races.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(races.every((r) => r.eraId === era.id)).toBe(true);
    }
  });

  it("matches data/pools.json's eras block, race for race", () => {
    const pools = JSON.parse(readFileSync(join(repo, 'data', 'pools.json'), 'utf8')) as {
      eras: Record<string, string[]>;
    };
    const ours = Object.fromEntries(
      Object.entries(ERA_RACES).map(([id, races]) => [id, races.map((r) => r.raceId)]),
    );
    expect(ours).toEqual(pools.eras);
  });

  it('finds a race by id and names it from its id', () => {
    expect(eraRace('abu-dhabi-2021')).toEqual({
      raceId: 'abu-dhabi-2021',
      eraId: 9,
      position: 10,
      dilemma: 'The finale',
    });
    expect(eraRace('abu-dhabi-2024')).toBeUndefined();
    expect(racesOfEra(11)).toEqual([]);
    expect(raceName('abu-dhabi-2021')).toBe('Abu Dhabi 2021');
    expect(raceName('great-britain-1987')).toBe('Great Britain 1987');
    expect(raceName('monaco-2022')).toBe('Monaco 2022');
  });
});

describe('erasRoute', () => {
  it('routes /eras to the map', () => {
    expect(erasRoute('/eras')).toEqual({ kind: 'map' });
    expect(erasRoute('/eras/')).toEqual({ kind: 'map' });
  });

  it('routes /eras/<eraId> to that era', () => {
    expect(erasRoute('/eras/10')).toMatchObject({ kind: 'era', era: { id: 10 } });
    expect(erasRoute('/eras/1/')).toMatchObject({ kind: 'era', era: { id: 1 } });
  });

  it('flags an era id that is not an era', () => {
    expect(erasRoute('/eras/11')).toEqual({ kind: 'unknown', segment: '11' });
    expect(erasRoute('/eras/0')).toEqual({ kind: 'unknown', segment: '0' });
    expect(erasRoute('/eras/ten')).toEqual({ kind: 'unknown', segment: 'ten' });
  });

  it('routes /eras/<eraId>/<raceId> to that race, and …/legend to it at Legend', () => {
    const race = eraRace('abu-dhabi-2021');
    if (!race) throw new Error('no race');
    expect(erasRoute('/eras/9/abu-dhabi-2021')).toEqual({
      kind: 'race',
      era: eraById(9),
      race,
      legend: false,
    });
    expect(erasRoute('/eras/9/abu-dhabi-2021/legend/')).toMatchObject({
      kind: 'race',
      legend: true,
    });
    expect(eraRacePath(race, false)).toBe('/eras/9/abu-dhabi-2021');
    expect(eraRacePath(race, true)).toBe('/eras/9/abu-dhabi-2021/legend');
    expect(erasRoute(eraRacePath(race, true))).toMatchObject({ kind: 'race', legend: true });
  });

  it('flags a race that is not in that era', () => {
    expect(erasRoute('/eras/10/abu-dhabi-2021')).toEqual({
      kind: 'unknown',
      segment: '10/abu-dhabi-2021',
    });
    expect(erasRoute('/eras/10/races')).toEqual({ kind: 'unknown', segment: '10/races' });
    expect(erasRoute('/eras/11/abu-dhabi-2021')).toEqual({ kind: 'unknown', segment: '11' });
  });

  it('routes /eras/history to the history book', () => {
    expect(erasRoute('/eras/history')).toEqual({ kind: 'history' });
    expect(erasRoute('/eras/history/')).toEqual({ kind: 'history' });
    expect(erasRoute(HISTORY_PATH)).toEqual({ kind: 'history' });
    expect(erasRoute('/eras/history/x')).toEqual({ kind: 'unknown', segment: 'history' });
  });

  it('routes …/<raceId>/leaderboard to the race’s board, …/leaderboard/legend to Legend’s', () => {
    const race = eraRace('abu-dhabi-2021');
    if (!race) throw new Error('abu-dhabi-2021');
    expect(erasRoute('/eras/9/abu-dhabi-2021/leaderboard')).toEqual({
      kind: 'leaderboard',
      era: eraById(9),
      race,
      legend: false,
    });
    expect(erasRoute('/eras/9/abu-dhabi-2021/leaderboard/legend/')).toMatchObject({
      kind: 'leaderboard',
      legend: true,
    });
    expect(eraLeaderboardPath(race, false)).toBe('/eras/9/abu-dhabi-2021/leaderboard');
    expect(eraLeaderboardPath(race, true)).toBe('/eras/9/abu-dhabi-2021/leaderboard/legend');
    expect(erasRoute(eraLeaderboardPath(race, true))).toMatchObject({ kind: 'leaderboard' });
    expect(erasRoute('/eras/10/abu-dhabi-2021/leaderboard')).toEqual({
      kind: 'unknown',
      segment: '10/abu-dhabi-2021',
    });
    expect(erasRoute('/eras/9/abu-dhabi-2021/legend/leaderboard')).toBeNull();
  });

  it('leaves paths that are not Eras paths alone', () => {
    expect(erasRoute('/')).toBeNull();
    expect(erasRoute('/erasmus')).toBeNull();
    expect(erasRoute('/eras/9/abu-dhabi-2021/hard')).toBeNull();
    expect(erasRoute('/eras//x')).toBeNull();
    expect(erasRoute('/gauntlet')).toBeNull();
  });
});
