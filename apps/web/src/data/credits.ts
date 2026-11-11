// The data sources the game is built from, for the credits page (/credits) and the one-line
// source credit on an Eras race intro. TUM and Jolpica are CC BY-NC-SA and F1DB is CC BY 4.0:
// their licences require the credit (docs/simulator-roadmap.md's source table). Wording,
// versions and links come from data/tracks/SOURCES.md, pipeline/scripts/f1db_layouts/NOTICE.md
// and the pipeline's provenance sidecars in data/raw, which also say which sources each race
// was built from:
// - <race-id>.provenance.json: a TUM f1-timing-database race (`pipeline tum-ingest`);
// - <race-id>.jolpica.json: a Jolpica race, its stops from F1DB when `stops` is "f1db";
// - <race-id>.reconstruction.json: a reconstructed race, from Jolpica results and F1DB.
// The race file's own `provenance` block (kind, estimated fields) doesn't name its sources.

export type SourceId =
  | 'tum'
  | 'jolpica'
  | 'f1db'
  | 'osm'
  | 'openf1'
  | 'fastf1'
  | 'multiviewer'
  | 'terrain';

export interface Licence {
  name: string;
  url: string;
}

export interface Source {
  id: SourceId;
  /** The name as credited. */
  name: string;
  /** Who makes it, when the name doesn't say. */
  by?: string;
  url: string;
  /** What the game takes from it. */
  gives: string;
  /** The version the race files were built from. */
  version?: string;
  /** Null: no licence terms of its own apply to how the game uses it (see `note`). */
  licence: Licence | null;
  /** ShareAlike: race files built from it are shared under the same licence. */
  shareAlike: boolean;
  note?: string;
}

const BY_NC_SA_3: Licence = {
  name: 'CC BY-NC-SA 3.0',
  url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
};
const BY_NC_SA_4: Licence = {
  name: 'CC BY-NC-SA 4.0',
  url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};
const ODBL: Licence = {
  name: 'ODbL 1.0',
  url: 'https://opendatacommons.org/licenses/odbl/1-0/',
};
const BY_4: Licence = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

/** Every source, in the credits page's order: the licensed lap data first. */
export const SOURCES: readonly Source[] = [
  {
    id: 'tum',
    name: 'TUM f1-timing-database',
    by: 'Institute of Automotive Technology, Technical University of Munich',
    url: 'https://github.com/TUMFTM/f1-timing-database',
    gives:
      'Lap times, gaps, positions, tyre compounds and ages, pit stops and safety-car periods for the 2014–2019 races.',
    version: 'commit 9eaad9c',
    licence: BY_NC_SA_3,
    shareAlike: true,
    note: 'The database is based largely on the Ergast Motor Racing Developer API, with retirement statistics from RaceFans.',
  },
  {
    id: 'jolpica',
    name: 'Jolpica-F1',
    url: 'https://github.com/jolpica/jolpica-f1',
    gives:
      'Lap times (1996 on), results, grids, retirements and pit stops (2011 on) for the races before 2014 and the reconstructed races.',
    version: 'database dump of 24 October 2026',
    licence: BY_NC_SA_4,
    shareAlike: true,
  },
  {
    id: 'f1db',
    name: 'F1DB',
    by: 'F1DB and its contributors (circuit SVG assets by Jules Roy)',
    url: 'https://github.com/f1db/f1db',
    gives:
      'Pit stops and pit-lane times, each driver’s fastest lap, the circuit layout each race used, and the outlines of layouts no 2018-on race ran on (adapted: resampled, scaled, with the start line, corners and pit lane added).',
    version: 'v2026.19.0; circuit layouts from commit be8174f',
    licence: BY_4,
    shareAlike: false,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    by: 'OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
    gives:
      'The ground around every circuit on the race map: grass, trees, water, buildings, grandstands, barriers and roads (pipeline basemap).',
    licence: ODBL,
    shareAlike: false,
    note: 'The maps are drawn from the data (a produced work), so the credit is what the licence asks.',
  },
  {
    id: 'openf1',
    name: 'OpenF1',
    url: 'https://openf1.org',
    gives: 'Lap timing and race data for races from 2023 on.',
    licence: null,
    shareAlike: false,
    note: 'OpenF1 says no credit is required; it is meant for non-commercial fan projects like this one.',
  },
  {
    id: 'fastf1',
    name: 'FastF1',
    url: 'https://github.com/theOehrly/Fast-F1',
    gives:
      'Lap timing, race data and circuit outlines for races from 2018 on, read with the FastF1 Python library.',
    licence: null,
    shareAlike: false,
    note: 'MIT-licensed software, used only to build the race files and not shipped with the game, so no notice is required.',
  },
  {
    id: 'multiviewer',
    name: 'MultiViewer',
    url: 'https://multiviewer.app',
    gives: 'Circuit outlines, official corner numbers and map rotation for some circuits.',
    licence: null,
    shareAlike: false,
    note: 'The circuit information FastF1 also reads. MultiViewer publishes no terms for it.',
  },
  {
    id: 'terrain',
    name: 'Terrain Tiles',
    by: 'Mapzen, on the Registry of Open Data on AWS',
    url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    gives: 'The hill shading on the race map.',
    licence: null,
    shareAlike: false,
    note: 'Built from SRTM, GMTED, ETOPO1 and national elevation data; the linked page lists every source.',
  },
];

export function sourceById(id: SourceId): Source {
  const source = SOURCES.find((s) => s.id === id);
  if (!source) throw new Error(`unknown source ${id}`);
  return source;
}

// The sidecars' fields read here, bundled at build time (one field each, not whole files).
const RAW = '../../../../data/raw/';
const tumFiles = import.meta.glob<string>('../../../../data/raw/*.provenance.json', {
  eager: true,
  import: 'source',
});
const jolpicaStops = import.meta.glob<string>('../../../../data/raw/*.jolpica.json', {
  eager: true,
  import: 'stops',
});
const reconstructed = import.meta.glob<Record<string, unknown>>(
  '../../../../data/raw/*.reconstruction.json',
  { eager: true, import: 'sources' },
);

function byRace<T>(files: Record<string, T>, suffix: string): Map<string, T> {
  return new Map(
    Object.entries(files).map(([path, value]) => {
      if (!path.startsWith(RAW) || !path.endsWith(suffix)) throw new Error(`unexpected ${path}`);
      return [path.slice(RAW.length, -suffix.length), value];
    }),
  );
}

const TUM = byRace(tumFiles, '.provenance.json');
const JOLPICA = byRace(jolpicaStops, '.jolpica.json');
const RECONSTRUCTED = byRace(reconstructed, '.reconstruction.json');

/**
 * The licensed sources a race was built from, by its provenance sidecars: empty for a race
 * built from OpenF1 or FastF1 (no credit line), or one with no sidecar.
 */
export function raceSources(raceId: string): SourceId[] {
  const tum = TUM.get(raceId);
  if (tum !== undefined) {
    if (tum !== 'TUM f1-timing-database') throw new Error(`${raceId}: unknown source ${tum}`);
    return ['tum'];
  }
  const recon = RECONSTRUCTED.get(raceId);
  if (recon !== undefined) {
    const out: SourceId[] = [];
    if (recon.jolpica) out.push('jolpica');
    if (recon.f1db) out.push('f1db');
    return out;
  }
  const stops = JOLPICA.get(raceId);
  if (stops !== undefined) return stops === 'f1db' ? ['jolpica', 'f1db'] : ['jolpica'];
  return [];
}

/** "Jolpica-F1 (CC BY-NC-SA 4.0) and F1DB (CC BY 4.0)". */
function joined(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The intro's one-line credit, e.g. "Race data: TUM f1-timing-database (CC BY-NC-SA 3.0)."; null when none is due. */
export function raceCreditText(raceId: string): string | null {
  const ids = raceSources(raceId);
  if (ids.length === 0) return null;
  const parts = ids.map((id) => {
    const s = sourceById(id);
    return s.licence ? `${s.name} (${s.licence.name})` : s.name;
  });
  return `Race data: ${joined(parts)}.`;
}

/** Test hook: every race id with a provenance sidecar, by kind. */
export const SIDECAR_RACES = {
  tum: [...TUM.keys()],
  jolpica: [...JOLPICA.keys()],
  reconstructed: [...RECONSTRUCTED.keys()],
};
