import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIDECAR_RACES, SOURCES, raceCreditText, raceSources, sourceById } from './credits.js';

const raw = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../../data/raw/${name}`, import.meta.url), 'utf8'));

describe('the sources', () => {
  it('lists each source once, with a link', () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'tum',
      'jolpica',
      'f1db',
      'osm',
      'openf1',
      'fastf1',
      'multiviewer',
      'terrain',
    ]);
    for (const s of SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });

  it('gives TUM, Jolpica and F1DB the licences their data carries', () => {
    expect(sourceById('tum').licence).toEqual({
      name: 'CC BY-NC-SA 3.0',
      url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    });
    expect(sourceById('jolpica').licence).toEqual({
      name: 'CC BY-NC-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    });
    expect(sourceById('f1db').licence).toEqual({
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    });
    expect(SOURCES.filter((s) => s.shareAlike).map((s) => s.id)).toEqual(['tum', 'jolpica']);
  });

  it("agrees with the sidecars' licences and versions", () => {
    const tum = raw('spain-2016.provenance.json');
    expect(tum.licence).toBe(sourceById('tum').licence?.name);
    expect(sourceById('tum').version).toContain(tum.commit.slice(0, 7));
    expect(tum.url).toBe(sourceById('tum').url);

    const jolpica = raw('brazil-2003.jolpica.json');
    expect(jolpica.licence.startsWith(`${sourceById('jolpica').licence?.name} `)).toBe(true);
    expect(jolpica.dump.slice(0, 10)).toBe('2026-10-24');
    expect(sourceById('jolpica').version).toContain('24 October 2026');

    const f1db = raw('f1db/source.json');
    expect(f1db.licence).toContain(sourceById('f1db').licence?.name);
    expect(f1db.licence).toContain(sourceById('f1db').licence?.url);
    expect(sourceById('f1db').version).toContain(f1db.version);
  });

  it('gives every TUM sidecar the same source, licence and commit', () => {
    expect(SIDECAR_RACES.tum.length).toBeGreaterThan(0);
    for (const id of SIDECAR_RACES.tum) {
      const p = raw(`${id}.provenance.json`);
      expect(p.licence, id).toBe('CC BY-NC-SA 3.0');
      expect(p.commit.slice(0, 7), id).toBe('9eaad9c');
    }
  });
});

describe("a race's sources, from its provenance sidecars", () => {
  it('credits TUM for a TUM race', () => {
    expect(raceSources('spain-2016')).toEqual(['tum']);
    expect(raceCreditText('spain-2016')).toBe(
      'Race data: TUM f1-timing-database (CC BY-NC-SA 3.0).',
    );
  });

  it('credits Jolpica, and F1DB when the stops are F1DB’s', () => {
    expect(raceSources('brazil-2003')).toEqual(['jolpica', 'f1db']);
    expect(raceCreditText('brazil-2003')).toBe(
      'Race data: Jolpica-F1 (CC BY-NC-SA 4.0) and F1DB (CC BY 4.0).',
    );
    expect(raceSources('canada-2011')).toEqual(['jolpica']);
    expect(raceCreditText('canada-2011')).toBe('Race data: Jolpica-F1 (CC BY-NC-SA 4.0).');
  });

  it('credits Jolpica and F1DB for a reconstructed race', () => {
    expect(raceSources('australia-1986')).toEqual(['jolpica', 'f1db']);
  });

  it('has no credit line for a race with no licensed source, or an unknown id', () => {
    expect(raceSources('abu-dhabi-2021')).toEqual([]);
    expect(raceCreditText('abu-dhabi-2021')).toBeNull();
    expect(raceCreditText('no-such-race')).toBeNull();
  });

  it('reads every sidecar by race id', () => {
    for (const ids of Object.values(SIDECAR_RACES))
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+-\d{4}$/);
    expect(SIDECAR_RACES.jolpica.length).toBeGreaterThan(0);
    expect(SIDECAR_RACES.reconstructed.length).toBeGreaterThan(0);
  });
});
