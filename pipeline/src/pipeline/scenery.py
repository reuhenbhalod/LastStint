"""3D scenery for a circuit (docs/3d-spec.md): the real lap, the ground's shape and what stands
around the track, for the race screen's 3D view (apps/web/src/three).

Everything comes from open data:
- OpenStreetMap (© OpenStreetMap contributors, ODbL) through the Overpass API: the circuit's
  raceway sections, buildings and grandstands, land cover, roads, streams, single trees.
- Elevation from the Terrarium terrain tiles (Mapzen / AWS open data).

The lap is the cycle of raceway sections whose length matches the circuit's official length
(and, where several do, whose shape best fits the game's outline). The game's outline (the
2D map, data/tracks) is lined up with it by a similarity transform, and a table maps a fraction
of the game's lap to a fraction of the real one, so the 3D cars run where the 2D ones do.
The ground under the track is shaped to the track's own smoothed profile (no track buried in
the terrain or floating over it); a raceway on a bridge (Suzuka's crossover) is raised.

Output: data/scenery/<circuit>.json. Downloads are cached in cache/scenery.
"""

from __future__ import annotations

import base64
import io
import json
import math
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

from . import paths

SCENERY_DIR = paths.DATA_DIR / "scenery"
CACHE = paths.CACHE_DIR / "scenery"
OVERPASS = "https://overpass-api.de/api/interpreter"
TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
USER_AGENT = "LastStint-scenery/1.0 (purohit.abhiram@gmail.com)"

# The five circuits with a 3D view. `centre` only seeds the map download; `length` is the
# official lap (m); `light` is the time of day the scene is lit for (three/environment.ts).
CIRCUITS: dict[str, dict] = {
    "monza": {
        "name": "Monza",
        "centre": (45.6190, 9.2812),
        "length": 5793,
        "races": ["italy-2019", "italy-2022", "italy-2024"],
        "light": "afternoon",
        "ground": "park",
    },
    "spa": {
        "name": "Spa-Francorchamps",
        "centre": (50.4372, 5.9714),
        "length": 7004,
        "races": ["belgium-2024"],
        "light": "overcast",
        "ground": "forest",
    },
    "bahrain": {
        "name": "Bahrain",
        "centre": (26.0325, 50.5106),
        "length": 5412,
        "races": ["bahrain-2021", "bahrain-2022"],
        "light": "dusk",
        "ground": "desert",
    },
    "suzuka": {
        "name": "Suzuka",
        "centre": (34.8431, 136.5407),
        "length": 5807,
        "races": ["japan-2024"],
        "light": "afternoon",
        "ground": "park",
    },
    "hungaroring": {
        "name": "Hungaroring",
        "centre": (47.5830, 19.2511),
        "length": 4381,
        "races": ["hungary-2019", "hungary-2025"],
        "light": "summer",
        "ground": "dry",
    },
    # The rest have no 3D view yet: the 2D map draws their ground (the basemap step).
    "yas-marina": {
        "name": "Yas Marina",
        "centre": (24.4672, 54.6031),
        "length": 5281,
        "races": ["abu-dhabi-2020", "abu-dhabi-2021", "abu-dhabi-2024"],
        "light": "dusk",
        "ground": "desert",
    },
    "red-bull-ring": {
        "name": "Red Bull Ring",
        "centre": (47.2197, 14.7647),
        "length": 4318,
        "races": ["austria-2019", "austria-2025", "styria-2020", "styria-2021"],
        "light": "afternoon",
        "ground": "park",
    },
    "villeneuve": {
        "name": "Circuit Gilles Villeneuve",
        "centre": (45.5000, -73.5228),
        "length": 4361,
        "races": ["canada-2019", "canada-2022", "canada-2024"],
        "light": "afternoon",
        "ground": "park",
    },
    "shanghai": {
        "name": "Shanghai",
        "centre": (31.3389, 121.2197),
        "length": 5451,
        "races": ["china-2024", "china-2025"],
        "light": "overcast",
        "ground": "dry",
    },
    "paul-ricard": {
        "name": "Paul Ricard",
        "centre": (43.2506, 5.7917),
        "length": 5842,
        "races": ["france-2019", "france-2021"],
        "light": "summer",
        "ground": "dry",
    },
    "mexico-city": {
        "name": "Autódromo Hermanos Rodríguez",
        "centre": (19.4042, -99.0907),
        "length": 4304,
        "races": ["mexico-2019", "mexico-2021", "mexico-2022", "mexico-2024"],
        "light": "afternoon",
        "ground": "dry",
    },
    "miami": {
        "name": "Miami",
        "centre": (25.9581, -80.2389),
        "length": 5412,
        "races": ["miami-2022", "miami-2023"],
        "light": "afternoon",
        "ground": "dry",
    },
    "zandvoort": {
        "name": "Zandvoort",
        "centre": (52.3888, 4.5409),
        "length": 4259,
        "races": ["netherlands-2022"],
        "light": "overcast",
        "ground": "park",
    },
    "portimao": {
        "name": "Portimão",
        "centre": (37.2270, -8.6267),
        "length": 4653,
        "races": ["portugal-2020", "portugal-2021"],
        "light": "summer",
        "ground": "dry",
    },
    "sochi": {
        "name": "Sochi",
        "centre": (43.4057, 39.9578),
        "length": 5848,
        # most of the circuit is mapped as the Olympic Park's pedestrian ways (sport=motor),
        # not as a raceway: without them the road fit settled on the street grid north-west
        # of the park
        "extra": True,
        "races": ["russia-2020", "russia-2021"],
        "light": "afternoon",
        "ground": "park",
    },
    "jeddah": {
        "name": "Jeddah",
        "centre": (21.6319, 39.1044),
        "length": 6174,
        "races": ["saudi-arabia-2025"],
        "light": "dusk",
        "ground": "desert",
    },
    "barcelona": {
        "name": "Barcelona-Catalunya",
        "centre": (41.5700, 2.2611),
        "length": 4657,
        "races": ["spain-2020", "spain-2023"],
        "light": "summer",
        "ground": "dry",
    },
    "cota": {
        "name": "Circuit of the Americas",
        "centre": (30.1328, -97.6411),
        "length": 5513,
        "races": ["united-states-2019", "united-states-2023", "usa-2022"],
        "light": "afternoon",
        "ground": "dry",
    },
    "adelaide": {
        "name": "Adelaide",
        "centre": (-34.9272, 138.6172),
        "length": 3780,
        "races": [],
        "light": "summer",
        "ground": "dry",
    },
    "baku": {
        "name": "Baku",
        "centre": (40.3725, 49.8533),
        "length": 6003,
        "fit": {"footways": True},
        "races": [],
        "light": "afternoon",
        "ground": "dry",
    },
    "donington": {
        "name": "Donington Park",
        "centre": (52.8298, -1.3796),
        "length": 4023,
        "races": [],
        "light": "overcast",
        "ground": "park",
    },
    "estoril": {
        "name": "Estoril",
        "centre": (38.7508, -9.3942),
        "length": 4349,
        "races": [],
        "light": "summer",
        "ground": "dry",
    },
    "hockenheim": {
        "name": "Hockenheim",
        "centre": (49.3278, 8.5658),
        "length": 4574,
        # the old long layout's forest loop (gone since 2002) is in OSM as abandoned raceway:
        # fit the old layouts to the raceway sections (the road fit turned them round onto
        # the motorways and the town)
        "extra": True,
        "radius": 3200,  # the old Ostkurve is 2.3 km east of the centre
        "layouts": {"hockenheimring-2": {"on": "raceway"}, "hockenheimring-3": {"on": "raceway"}},
        "races": [],
        "light": "afternoon",
        "ground": "forest",
    },
    "imola": {
        "name": "Imola",
        "centre": (44.3411, 11.7133),
        "length": 4909,
        "races": [],
        "light": "afternoon",
        "ground": "park",
    },
    "indianapolis": {
        "name": "Indianapolis",
        "centre": (39.7983, -86.2328),
        "length": 4192,
        "races": [],
        "light": "afternoon",
        "ground": "park",
    },
    "interlagos": {
        "name": "Interlagos",
        "centre": (-23.7011, -46.6972),
        "length": 4309,
        "races": [],
        "light": "afternoon",
        "ground": "park",
    },
    "istanbul": {
        "name": "Istanbul Park",
        "centre": (40.9517, 29.4050),
        "length": 5338,
        "races": [],
        "light": "afternoon",
        "ground": "dry",
    },
    "jerez": {
        "name": "Jerez",
        "centre": (36.7083, -6.0342),
        "length": 4428,
        "races": [],
        "light": "summer",
        "ground": "dry",
    },
    "kyalami": {
        "name": "Kyalami",
        "centre": (-25.9986, 28.0689),
        "length": 4104,
        # the 1983 lap (4104 m) has no raceway cycle as long: the road fit took the motorway
        # a kilometre north-east. Of the old lap only Sunset, Clubhouse and the Esses are
        # still in today's (Wikipedia, Kyalami): fit it to those (OSM ways, Sunset to the
        # Esses).
        "layouts": {
            "kyalami-1": {"on": "ways", "ways": list(range(1359379871, 1359379876))},
        },
        "races": [],
        "light": "summer",
        "ground": "dry",
    },
    "magny-cours": {
        "name": "Magny-Cours",
        "centre": (46.8632, 3.1642),
        "length": 4411,
        "races": [],
        "light": "afternoon",
        "ground": "park",
    },
    "marina-bay": {
        "name": "Marina Bay",
        "centre": (1.2915, 103.8638),
        "length": 4940,
        # OSM has only the pit straight and turns 1-3 as raceway: the road fit alone put the
        # outline on the street grid north of Stamford Road. Fit it to those and the streets
        # the circuit runs on (Wikipedia, Marina Bay Street Circuit).
        "fit": {
            "around": (1.2905, 103.857),
            "reach": 400,
            "streets": "raffles av|republic boulevard|raffles boulevard|nicoll|stamford road"
            "|st\\.? andrew|connaught|fullerton road|esplanade drive|anderson bridge"
            "|bayfront avenue|sheares",
        },
        # the 2014 layout (5065 m): fitted to the part of today's lap it shares (on the
        # roads alone it went on the CBD's street grid, mirrored)
        "layouts": {"marina-bay-2": {"on": "lap"}},
        "races": [],
        "light": "dusk",
        "ground": "park",
    },
    "melbourne": {
        "name": "Albert Park",
        "centre": (-37.8497, 144.9683),
        "length": 5278,
        "races": [],
        "light": "afternoon",
        "ground": "park",
    },
    "monaco": {
        "name": "Monaco",
        "centre": (43.7347, 7.4206),
        "length": 3337,
        "fit": {"footways": True},
        "races": [],
        "light": "summer",
        "ground": "dry",
    },
    "nurburgring": {
        "name": "Nürburgring",
        "centre": (50.3356, 6.9475),
        "length": 5148,
        "races": [],
        "light": "overcast",
        "ground": "forest",
    },
    "phoenix": {
        "name": "Phoenix",
        "centre": (33.4479, -112.0746),
        "length": 3800,
        # downtown's regular grid fits the outline on many blocks: the road fit alone chose
        # one four blocks south. Pin it to the 1989-90 lap's place, its straights on
        # Washington and Jefferson streets and turn 1 at Jefferson and Central.
        "fit": {"around": (33.44798, -112.07131), "reach": 120, "turn": (-10, 10)},
        "races": [],
        "light": "afternoon",
        "ground": "desert",
    },
    "sepang": {
        "name": "Sepang",
        "centre": (2.7606, 101.7375),
        "length": 5543,
        "races": [],
        "light": "afternoon",
        "ground": "park",
    },
    "silverstone": {
        "name": "Silverstone",
        "centre": (52.0786, -1.0169),
        "length": 5891,
        "races": [],
        "light": "overcast",
        "ground": "park",
    },
    "valencia": {
        "name": "Valencia",
        "centre": (39.4588, -0.3256),
        "length": 5419,
        # no raceway in OSM: the road fit alone settled on El Cabanyal's street grid, north
        # of the harbour the circuit runs round
        "fit": {"around": (39.457, -0.327), "reach": 400},
        "races": [],
        "light": "summer",
        "ground": "dry",
    },
}

# Every race's circuit, F1DB layout and official lap length (data/scenery/layouts.json, from
# F1DB's race table): which races sit on each circuit's ground, and how long each one's lap is
# (an older layout's differs from today's).
LAYOUTS: dict[str, dict] = json.loads((paths.DATA_DIR / "scenery" / "layouts.json").read_text())


def races_of(circuit: str) -> list[str]:
    """The races on a circuit: its listed ones first (the first picks the lap), then the rest
    of the layout table's, newest first."""
    listed = CIRCUITS[circuit]["races"]
    rest = sorted(
        (r for r, x in LAYOUTS.items() if x["circuit"] == circuit and r not in listed),
        key=lambda r: r.rsplit("-", 1)[1],
        reverse=True,
    )
    return [*listed, *rest]


RADIUS = 2600  # m around the centre to download
MARGIN = 550  # m of scenery kept around the lap
STEP = 8  # m between ground heights
ZOOM = 15  # terrain tile zoom (about 4.8 m a pixel at the equator)
SAMPLE = 3  # m between the lap's points
TRACK_HALF = 6.5  # m, half the track's width (with its lines)
BRIDGE_RISE = 7.5  # m a raceway bridge sits above the ground under it
NOT_THE_LAP = re.compile(
    r"pit|kart|moto|drag|paddock|support|service|access|test|oval|anello|alta", re.I
)


# ---------------------------------------------------------------- downloads


def _fetch(url: str, data: bytes | None = None, cache: Path | None = None) -> bytes:
    if cache and cache.exists():
        return cache.read_bytes()
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                body = r.read()
            break
        except Exception:  # noqa: BLE001 - Overpass is busy now and then: wait and retry
            if attempt == 4:
                raise
            time.sleep(10 * (attempt + 1))
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(body)
    return body


def osm(circuit: str, lat: float, lon: float, radius: float = RADIUS) -> dict:
    dlat = radius / 110574
    dlon = radius / (111320 * math.cos(math.radians(lat)))
    bb = f"{lat - dlat},{lon - dlon},{lat + dlat},{lon + dlon}"
    keys = [
        'way["highway"="raceway"]',
        'way["building"]',
        'relation["building"]',
        'way["building:part"]',
        'way["landuse"]',
        'relation["landuse"]',
        'way["natural"]',
        'relation["natural"]',
        'way["leisure"]',
        'way["amenity"="parking"]',
        'way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track"]',
        'way["surface"]',
        'way["area:highway"]',
        'way["waterway"]',
        'way["barrier"]',
        'way["man_made"]',
        'way["attraction"]',
        'node["attraction"]',
        'node["natural"="tree"]',
        'way["railway"]',
        'way["power"="line"]',
    ]
    q = "[out:json][timeout:180];(" + "".join(f"{k}({bb});" for k in keys) + ");out geom;"
    name = f"{circuit}-osm.json" if radius == RADIUS else f"{circuit}-r{radius:.0f}-osm.json"
    body = _fetch(OVERPASS, urllib.parse.urlencode({"data": q}).encode(), CACHE / name)
    return json.loads(body)


EXTRA_RADIUS = 4500  # m: an old layout can reach well beyond today's lap (old Hockenheim)


def osm_extra(circuit: str, lat: float, lon: float, radius: float = EXTRA_RADIUS) -> list[dict]:
    """Circuit ways OSM doesn't tag as a raceway, retagged as one so the lap search and the
    fits take them: ways tagged sport=motor (Sochi's circuit is mapped as the Olympic Park's
    pedestrian ways) and a layout that's gone, mapped as abandoned:highway=raceway or
    historic=raceway (old Hockenheim's forest loop)."""
    dlat = radius / 110574
    dlon = radius / (111320 * math.cos(math.radians(lat)))
    bb = f"{lat - dlat},{lon - dlon},{lat + dlat},{lon + dlon}"
    q = (
        "[out:json][timeout:180];("
        f'way["sport"="motor"]["highway"]["highway"!="raceway"]({bb});'
        f'way["abandoned:highway"="raceway"]({bb});'
        f'way["historic"="raceway"]({bb});'
        ");out geom;"
    )
    body = _fetch(
        OVERPASS, urllib.parse.urlencode({"data": q}).encode(), CACHE / f"{circuit}-extra.json"
    )
    return [
        {**e, "tags": {**e["tags"], "highway": "raceway"}}
        for e in json.loads(body)["elements"]
        if e["type"] == "way"
        and e["tags"].get("motor_vehicle") != "no"
        and e["tags"].get("highway") != "raceway"
    ]


class Frame:
    """Local metres round a reference point: x east, z south (as the 2D map: y down)."""

    def __init__(self, lat0: float, lon0: float):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = math.cos(math.radians(lat0)) * 111320
        self.kz = 110574

    def xz(self, lat: float, lon: float) -> tuple[float, float]:
        return ((lon - self.lon0) * self.kx, -(lat - self.lat0) * self.kz)

    def ll(self, x: float, z: float) -> tuple[float, float]:
        return (self.lat0 - z / self.kz, self.lon0 + x / self.kx)


def _tile_xy(lat: float, lon: float, z: int) -> tuple[float, float]:
    n = 2**z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def elevation(circuit: str, frame: Frame, x0: float, z0: float, nx: int, nz: int) -> np.ndarray:
    """Ground heights (m) on an nx by nz grid STEP apart from (x0, z0), bilinear from the
    Terrarium tiles."""
    lat_a, lon_a = frame.ll(x0, z0)
    lat_b, lon_b = frame.ll(x0 + (nx - 1) * STEP, z0 + (nz - 1) * STEP)
    tx0, ty0 = _tile_xy(lat_a, lon_a, ZOOM)
    tx1, ty1 = _tile_xy(lat_b, lon_b, ZOOM)
    tiles: dict[tuple[int, int], np.ndarray] = {}
    for tx in range(int(tx0), int(tx1) + 1):
        for ty in range(int(ty0), int(ty1) + 1):
            png = _fetch(
                TERRARIUM.format(z=ZOOM, x=tx, y=ty),
                cache=CACHE / "tiles" / f"{ZOOM}_{tx}_{ty}.png",
            )
            a = np.asarray(Image.open(io.BytesIO(png)).convert("RGB")).astype(np.float64)
            tiles[(tx, ty)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    out = np.zeros((nz, nx))
    for j in range(nz):
        for i in range(nx):
            lat, lon = frame.ll(x0 + i * STEP, z0 + j * STEP)
            tx, ty = _tile_xy(lat, lon, ZOOM)
            ix, iy = int(tx), int(ty)
            px = min(max((tx - ix) * 256 - 0.5, 0), 254.999)
            py = min(max((ty - iy) * 256 - 0.5, 0), 254.999)
            a = tiles[(ix, iy)]
            ii, jj = int(px), int(py)
            fx, fy = px - ii, py - jj
            out[j, i] = (
                a[jj, ii] * (1 - fx) * (1 - fy)
                + a[jj, ii + 1] * fx * (1 - fy)
                + a[jj + 1, ii] * (1 - fx) * fy
                + a[jj + 1, ii + 1] * fx * fy
            )
    return out


# ---------------------------------------------------------------- the lap


def _length(pts: list[tuple[float, float]]) -> float:
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:], strict=False))


def raceway_edges(elements: list[dict], frame: Frame) -> list[dict]:
    """The raceway sections as directed edges between junctions (ways split where another
    raceway joins them mid-way). A two-way section gives an edge each way."""
    ways = [
        e
        for e in elements
        if e["type"] == "way"
        and e.get("tags", {}).get("highway") == "raceway"
        and e.get("tags", {}).get("area") != "yes"
        and not NOT_THE_LAP.search(e.get("tags", {}).get("name", ""))
        and not NOT_THE_LAP.search(e.get("tags", {}).get("raceway", ""))
    ]
    uses: dict[int, int] = {}
    for w in ways:
        for k, n in enumerate(w["nodes"]):
            if k in (0, len(w["nodes"]) - 1) or True:
                uses[n] = uses.get(n, 0) + 1
    edges = []
    for w in ways:
        t = w.get("tags", {})
        # only a section tagged as a bridge is raised (a layer on its own often just marks a
        # section drawn over another way, not a bridge)
        bridge = t.get("bridge") not in (None, "no")
        nodes, geom = w["nodes"], w["geometry"]
        cut = [0] + [k for k in range(1, len(nodes) - 1) if uses[nodes[k]] > 1] + [len(nodes) - 1]
        for a, b in zip(cut, cut[1:], strict=False):
            pts = [frame.xz(p["lat"], p["lon"]) for p in geom[a : b + 1]]
            e = {
                "from": nodes[a],
                "to": nodes[b],
                "pts": pts,
                "len": _length(pts),
                "bridge": bridge,
                "name": t.get("name", ""),
            }
            edges.append(e)
            if t.get("oneway") not in ("yes", "1", "true"):
                edges.append({**e, "from": nodes[b], "to": nodes[a], "pts": pts[::-1]})
    return edges


def lap_cycles(
    edges: list[dict],
    official: float,
    slack: float = 0.04,
    budget: int = 3_000_000,
    keep: int = 300,
) -> list[list[dict]]:
    """Simple cycles of edges whose length is within `slack` of the official lap. A circuit
    with many layouts (Paul Ricard has dozens) has too many to list, so the search stops after
    `budget` steps in all, and only the `keep` cycles closest to the official length are
    kept for fitting."""
    out: dict[frozenset, list[dict]] = {}
    spent = 0
    by_from: dict[int, list[int]] = {}
    for k, e in enumerate(edges):
        by_from.setdefault(e["from"], []).append(k)
    hi, lo = official * (1 + slack), official * (1 - slack)
    for start_k, start in enumerate(edges):
        if spent >= budget:
            break
        stack = [(start["to"], [start_k], start["len"], {start["from"], start["to"]})]
        steps = 0
        while stack and steps < 200000 and spent < budget:
            steps += 1
            spent += 1
            node, path, length, seen = stack.pop()
            for k in by_from.get(node, []):
                e = edges[k]
                total = length + e["len"]
                if total > hi:
                    continue
                if e["to"] == start["from"]:
                    if total >= lo:
                        key = frozenset(path + [k])
                        if key not in out and min(path + [k]) == min(key):
                            out[key] = [edges[i] for i in path + [k]]
                    continue
                if e["to"] in seen:
                    continue
                stack.append((e["to"], path + [k], total, seen | {e["to"]}))
    # A closed way on its own is a lap too.
    for e in edges:
        if e["from"] == e["to"] and lo <= e["len"] <= hi:
            out[frozenset([id(e)])] = [e]
    found = list(out.values())
    found.sort(key=lambda c: abs(sum(e["len"] for e in c) - official))
    return found[:keep]


def resample(pts: list[tuple[float, float]], step: float, closed: bool) -> np.ndarray:
    p = np.asarray(pts, float)
    if closed and np.linalg.norm(p[0] - p[-1]) > 1e-6:
        p = np.vstack([p, p[:1]])
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(round(cum[-1] / step)))
    t = np.linspace(0, cum[-1], n, endpoint=not closed)
    return np.stack([np.interp(t, cum, p[:, 0]), np.interp(t, cum, p[:, 1])], axis=1)


# ---------------------------------------------------------------- lining up the game's map


def align(game: np.ndarray, real: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """The similarity transform (2x2 matrix M, offset t) taking the game outline's points onto
    the real lap: real ~ game @ M.T + t. A reflection is allowed (the outline's frame is the
    timing data's, not the map's). Returns M, t and the mean distance left (m)."""
    tree = cKDTree(real)
    g_mu, r_mu = game.mean(0), real.mean(0)
    g0, r0 = game - g_mu, real - r_mu
    s = math.sqrt((r0**2).sum(1).mean() / (g0**2).sum(1).mean())
    best = (math.inf, None, None)
    for flip in (1, -1):
        F = np.diag([1, flip])
        for deg in range(0, 360, 2):
            a = math.radians(deg)
            R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
            M = s * R @ F
            d, _ = tree.query(g0 @ M.T + r_mu)
            if d.mean() < best[0]:
                best = (d.mean(), M, F)
    M, F = best[1], best[2]
    t = r_mu - g_mu @ M.T
    # Refine: least-squares similarity on the nearest points, a few rounds, keeping the mirror
    # the search chose (the rotation is fitted to the mirrored outline).
    flipped = game @ F.T
    for _ in range(40):
        _, idx = tree.query(game @ M.T + t)
        target = real[idx]
        gm, tm = flipped.mean(0), target.mean(0)
        A, B = flipped - gm, target - tm
        U, S, Vt = np.linalg.svd(A.T @ B)
        D = np.diag([1, np.sign(np.linalg.det(U @ Vt))])
        R = (U @ D @ Vt).T
        scale = (S * np.diag(D)).sum() / (A**2).sum()
        M = scale * R @ F
        t = tm - gm @ (scale * R).T
    d, _ = tree.query(game @ M.T + t)
    return M, t, float(d.mean())


FOOT = re.compile(r"footway|path|cycleway|steps|pedestrian|bridleway|corridor|track")


def road_points(
    elements: list[dict],
    frame: Frame,
    step: float = 4.0,
    vehicles: bool = False,
    streets: str | None = None,
) -> np.ndarray:
    """Points every `step` m along every road and raceway (`vehicles`: not paths and
    footways; `streets`: only the raceways and the roads whose name matches it)."""
    out: list[tuple[float, float]] = []
    named = re.compile(streets, re.I) if streets else None
    for e in elements:
        if e["type"] != "way" or "highway" not in e.get("tags", {}):
            continue
        if vehicles and FOOT.fullmatch(e["tags"]["highway"]):
            continue
        if (
            named
            and e["tags"]["highway"] != "raceway"
            and not named.search(e["tags"].get("name", ""))
        ):
            continue
        pts = [frame.xz(p["lat"], p["lon"]) for p in e.get("geometry", [])]
        if len(pts) >= 2:
            out += [tuple(p) for p in resample(pts, step, closed=False)]
    return np.asarray(out, float)


def _turn_ok(deg: float, turn: tuple[float, float] | None) -> bool:
    """Whether a rotation (degrees) lies in the range `turn` (lo, hi), going round from lo."""
    return turn is None or (deg - turn[0]) % 360 <= (turn[1] - turn[0]) % 360


def _rot(deg: float) -> np.ndarray:
    a = math.radians(deg)
    return np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])


def align_to_roads(
    game: np.ndarray,
    roads: np.ndarray,
    official: float,
    reach: float = 900.0,
    *,
    around: tuple[float, float] = (0.0, 0.0),
    flips: tuple[int, ...] = (1, -1),
    turn: tuple[float, float] | None = None,
    need: float = 0.3,
    rigid: bool = False,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Fit the game's outline onto a road network (a circuit with no raceway lap): the scale
    from the official length, then a search over mirror, rotation and position for the fit
    that keeps the outline on the roads, refined on the near roads only. The search puts the
    outline's middle within `reach` of `around` (m in the frame), with the mirrors in `flips`
    and the rotations in `turn` (degrees, lo to hi) only: a venue whose streets would let the
    outline sit on many blocks is pinned to the right one. `rigid` keeps the official size
    in the refinement, and `need` is the share of the outline that must be on a road for it
    to refine at all (a layout that has mostly gone: a small share).
    Returns M, t (real ~ game @ M.T + t) and the median distance left (m)."""
    tree = cKDTree(roads)
    g_len = float(np.linalg.norm(np.diff(np.vstack([game, game[:1]]), axis=0), axis=1).sum())
    s = official / g_len
    g_mu = game.mean(0)
    g0 = game - g_mu
    probe = g0[:: max(1, len(g0) // 240)]
    clip = 40.0
    c0 = np.asarray(around, float)
    grid = 60.0 if reach > 300 else max(10.0, reach / 6)

    def score(M: np.ndarray, t: np.ndarray, pts: np.ndarray) -> float:
        d, _ = tree.query(pts @ M.T + t)
        return float(np.minimum(d, clip).mean())

    best = (math.inf, None, None)
    for flip in flips:
        F = np.diag([1, flip])
        for deg in range(0, 360, 3):
            if not _turn_ok(deg, turn):
                continue
            M = s * _rot(deg) @ F
            for dx in np.arange(-reach, reach + 1, grid):
                for dz in np.arange(-reach, reach + 1, grid):
                    t = c0 + np.array([dx, dz])
                    v = score(M, t, probe)
                    if v < best[0]:
                        best = (v, M, t)
    _, M, t = best
    if rigid:
        # a partial fit has no near roads all round to pull it in: search finer round the best
        F = np.diag([1, np.sign(np.linalg.det(M))])
        R0 = M @ F / s
        deg0 = math.degrees(math.atan2(R0[1, 0], R0[0, 0]))
        t0 = t
        for ddeg in np.arange(-3, 3.01, 0.5):
            if not _turn_ok((deg0 + ddeg) % 360, turn):
                continue
            Mc = s * _rot(deg0 + ddeg) @ F
            for dx in np.arange(-40, 41, 8.0):
                for dz in np.arange(-40, 41, 8.0):
                    tc = t0 + np.array([dx, dz])
                    v = score(Mc, tc, g0)
                    if v < best[0]:
                        best = (v, Mc, tc)
        _, M, t = best
    # Least squares on the near points (a road within 15 m).
    for _ in range(40):
        moved = g0 @ M.T + t
        d, idx = tree.query(moved)
        near = d < 15
        if near.sum() < len(g0) * need:
            break
        A, B = g0[near], roads[idx[near]]
        am, bm = A.mean(0), B.mean(0)
        F = np.diag([1, np.sign(np.linalg.det(M))])
        Af = (A - am) @ F.T
        U, S, Vt = np.linalg.svd(Af.T @ (B - bm))
        D = np.diag([1, np.sign(np.linalg.det(U @ Vt))])
        R = (U @ D @ Vt).T
        scale = s if rigid else (S * np.diag(D)).sum() / (Af**2).sum()
        M = scale * R @ F
        t = bm - am @ M.T
    t = t - g_mu @ M.T
    d, _ = tree.query(game @ M.T + t)
    return M, t, float(np.median(d))


def _road_kw(hint: dict, frame: Frame) -> dict:
    """A circuit's `fit` hint as align_to_roads' search limits, in the frame's metres."""
    kw: dict = {k: hint[k] for k in ("reach", "turn", "flips") if k in hint}
    if "around" in hint:
        kw["around"] = frame.xz(*hint["around"])
    return kw


def _hint_roads(
    elements: list[dict], hint: dict, frame: Frame, stand_in: bool = False
) -> np.ndarray:
    """The road points a venue's fit uses: vehicle roads (only the raceways and the streets
    the circuit runs on, with the hint's `streets`), within its `near` metres of its `around`
    when it has one. `stand_in`: for the lap that stands in when OSM has no raceway lap, a
    `footways` hint keeps the pedestrian ways too (Monaco and Baku run on streets OSM maps as
    pedestrian in places)."""
    vehicles = not (stand_in and hint.get("footways"))
    pts = road_points(elements, frame, vehicles=vehicles, streets=hint.get("streets"))
    return _near(pts, hint, frame)


def _near(pts: np.ndarray, hint: dict, frame: Frame) -> np.ndarray:
    """The road points within the hint's `near` metres of its `around` (all without one)."""
    if "near" not in hint:
        return pts
    c = np.asarray(frame.xz(*hint["around"]))
    return pts[np.linalg.norm(pts - c, axis=1) <= hint["near"]]


def fit_hint(circuit: str, race_id: str) -> dict:
    """The fit hint for a race: its circuit's `fit`, with its layout's entry over it."""
    cfg = CIRCUITS[circuit]
    layout = LAYOUTS.get(race_id, {}).get("layout")
    return {**cfg.get("fit", {}), **cfg.get("layouts", {}).get(layout, {})}


FIT_NEAR = 12.0  # m: a point of the outline this close to real tarmac counts as on it
SIZE_SLACK = 0.08  # a fit may scale the outline this far from its official length


def _refine(
    game: np.ndarray, M: np.ndarray, t: np.ndarray, tree: cKDTree, pts: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Robust least squares (the outline's points within 25 m of a real road or raceway only):
    a layout that has partly gone keeps its fit on the part that's still there."""
    F = np.diag([1, np.sign(np.linalg.det(M))])
    for reach in (40.0, 25.0, 25.0, 15.0, 15.0, 15.0):
        d, idx = tree.query(game @ M.T + t)
        near = d < reach
        if near.sum() < len(game) * 0.25:
            break
        A, B = game[near] @ F.T, pts[idx[near]]
        am, bm = A.mean(0), B.mean(0)
        U, S, Vt = np.linalg.svd((A - am).T @ (B - bm))
        D = np.diag([1, np.sign(np.linalg.det(U @ Vt))])
        R = (U @ D @ Vt).T
        scale = (S * np.diag(D)).sum() / ((A - am) ** 2).sum()
        M = scale * R @ F
        t = bm - (game[near] @ F.T).mean(0) @ (scale * R).T
    return M, t


def fit_race(
    game: np.ndarray,
    lap: list[tuple[float, float]],
    edges: list[dict],
    elements: list[dict],
    frame: Frame,
    length: float,
    found: dict,
    hint: dict | None = None,
) -> dict:
    """A race's outline placed on the real ground, and how well it sits there. Tried in turn,
    keeping the best: today's lap; any raceway lap as long as this race's own (an older
    layout); the road network (a street circuit, or a layout that's gone). Each fit is then
    refined on every road and raceway nearby. `err` is the median distance from the outline to
    real tarmac (m), `cover` the share of it within FIT_NEAR, `scale` the outline's length over
    the official one (1 when its shape is true to size).

    `hint` (the circuit's `fit`, with its layout's entry in `layouts` over it) pins a venue
    where the search alone finds the wrong place: the road fit's search is limited to it
    (`_road_kw`), and an `on` hint fits the outline only to part of the real ground ("lap":
    today's lap, "raceway": every raceway section, "ways": the OSM ways listed in `ways`), at
    its official size, for a layout of which only some still stands (old Hockenheim, whose
    forest loop OSM keeps as abandoned raceway; Kyalami's 1983 lap)."""
    hint = hint or {}
    if found["roads"] is None:
        pts = _hint_roads(elements, hint, frame)
        found["roads"] = (pts, cKDTree(pts))
    pts, tree = found["roads"]
    g_len = float(np.linalg.norm(np.diff(np.vstack([game, game[:1]]), axis=0), axis=1).sum())

    def judge(M: np.ndarray, t: np.ndarray, how: str, refine: bool = True) -> dict:
        if refine:
            M, t = _refine(game, M, t, tree, pts)
        d, _ = tree.query(game @ M.T + t)
        s = math.sqrt(abs(np.linalg.det(M)))
        return {
            "M": M,
            "t": t,
            "err": float(np.median(d)),
            "cover": float((d < FIT_NEAR).mean()),
            "scale": g_len * s / length,
            "how": how,
        }

    def sized(a: dict) -> bool:
        # true to its official length: a fit that shrinks or stretches the outline to sit on
        # some other lap (old Hockenheim's 6.8 km on today's 4.6 km) isn't the right place
        return abs(a["scale"] - 1) <= SIZE_SLACK

    def better(a: dict, b: dict | None) -> bool:
        return b is None or (sized(a), a["cover"], -a["err"]) > (sized(b), b["cover"], -b["err"])

    real = resample(lap, SAMPLE, closed=True)
    if hint.get("on"):
        if hint["on"] == "raceway":
            target = np.vstack([resample(e["pts"], SAMPLE, closed=False) for e in edges])
        elif hint["on"] == "ways":
            target = np.vstack(
                [
                    resample([frame.xz(q["lat"], q["lon"]) for q in e["geometry"]], SAMPLE, False)
                    for e in elements
                    if e["type"] == "way" and e["id"] in hint["ways"]
                ]
            )
        else:
            target = real
        M, t, _ = align_to_roads(
            game, target, length, need=0.1, rigid=True, **_road_kw(hint, frame)
        )
        return judge(M, t, "partial", refine=False)
    M, t, _ = align(game, real)
    best = judge(M, t, "lap")
    if best["cover"] < 0.95:
        key = round(length / 25)
        if key not in found["cycles"]:
            found["cycles"][key] = lap_cycles(edges, length, budget=600_000, keep=60)
        for cyc in found["cycles"][key][:60]:
            cp: list[tuple[float, float]] = []
            for e in cyc:
                cp += e["pts"] if not cp else e["pts"][1:]
            M, t, _ = align(game, resample(cp, SAMPLE, closed=True))
            cand = judge(M, t, "layout")
            if better(cand, best):
                best = cand
    if best["cover"] < 0.85 or not sized(best):
        M, t, _ = align_to_roads(game, pts, length, **_road_kw(hint, frame))
        cand = judge(M, t, "roads")
        if better(cand, best):
            best = cand
    return best


def fraction_table(
    game: np.ndarray, real: np.ndarray, M: np.ndarray, t: np.ndarray, n: int = 400
) -> list[float]:
    """For n fractions of the game's lap, the matching fraction of the real lap (unwrapped,
    so it only grows; the browser takes it mod 1)."""
    g = resample(list(map(tuple, game)), 1, closed=True)
    seg = np.linalg.norm(np.diff(np.vstack([g, g[:1]]), axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    total = cum[-1]
    real_tree = cKDTree(real)
    out = []
    for k in range(n):
        d = k / n * total
        i = int(np.searchsorted(cum, d, side="right") - 1) % len(g)
        p = g[i] @ M.T + t
        _, j = real_tree.query(p)
        out.append(j / len(real))
    # unwrap: the real lap may start anywhere, and fractions only move forward
    un = [out[0]]
    for f in out[1:]:
        prev = un[-1]
        step = (f - prev) % 1
        un.append(prev + (step if step < 0.5 else step - 1))
    return [round(f, 5) for f in un]


# ---------------------------------------------------------------- features


def _simplify(p: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    if len(p) < 4:
        return p
    a, b = np.asarray(p[0]), np.asarray(p[-1])
    ab = b - a
    L = np.linalg.norm(ab)
    pts = np.asarray(p[1:-1])
    if L < 1e-9:
        d = np.linalg.norm(pts - a, axis=1)
    else:
        d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / L
    k = int(np.argmax(d))
    if d[k] > tol:
        return _simplify(p[: k + 2], tol)[:-1] + _simplify(p[k + 1 :], tol)
    return [p[0], p[-1]]


def simplify(p: list[tuple[float, float]], tol: float = 1.2) -> list[tuple[float, float]]:
    """Douglas-Peucker; a closed ring is split at its far point first so it keeps its shape."""
    if len(p) > 3 and math.dist(p[0], p[-1]) < 1e-6:
        ring = p[:-1]
        k = max(range(len(ring)), key=lambda i: math.dist(ring[0], ring[i]))
        return _simplify(ring[: k + 1], tol)[:-1] + _simplify(ring[k:] + [ring[0]], tol)
    return _simplify(p, tol)


def stitch(ways: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
    rings, segs = [], [list(w) for w in ways]
    while segs:
        r = segs.pop()
        grown = True
        while math.dist(r[0], r[-1]) > 1e-6 and grown:
            grown = False
            for s in segs:
                if math.dist(s[0], r[-1]) < 1e-6:
                    r += s[1:]
                elif math.dist(s[-1], r[-1]) < 1e-6:
                    r += s[::-1][1:]
                else:
                    continue
                segs.remove(s)
                grown = True
                break
        if math.dist(r[0], r[-1]) < 1e-6:
            rings.append(r)
    return rings


def area_kind(t: dict) -> str | None:
    lu, na, su, le = t.get("landuse"), t.get("natural"), t.get("surface"), t.get("leisure")
    if lu == "forest" or na == "wood":
        return "forest"
    if na in ("scrub", "heath"):
        return "scrub"
    if na == "water" or lu in ("reservoir", "basin") or t.get("water"):
        return "water"
    if na in ("sand", "beach", "bare_rock", "desert") or su == "sand":
        return "sand"
    if lu in (
        "residential",
        "farmyard",
        "commercial",
        "industrial",
        "retail",
        "construction",
        "railway",
    ):
        return "urban"
    if lu in ("farmland", "vineyard", "orchard", "allotments", "plant_nursery"):
        return "farm"
    if (
        lu in ("meadow", "grass", "village_green", "recreation_ground")
        or na == "grassland"
        or su == "grass"
        or le in ("park", "garden", "golf_course", "pitch")
    ):
        return "grass"
    if su in ("gravel", "pebblestone", "compacted", "fine_gravel", "dirt") or na in ("shingle",):
        return "gravel"
    if (
        "area:highway" in t
        or su in ("asphalt", "concrete", "paved", "paving_stones")
        or t.get("amenity") == "parking"
        or lu == "garages"
    ):
        return "asphalt"
    return None


ROAD_W = {
    "motorway": 14,
    "trunk": 12,
    "primary": 9,
    "secondary": 8,
    "tertiary": 7,
    "unclassified": 5.5,
    "residential": 5.5,
    "service": 4,
    "track": 3,
}


def _num(s: str | None) -> float | None:
    if not s:
        return None
    m = re.match(r"\s*([0-9]+(?:\.[0-9]+)?)", s)
    return float(m.group(1)) if m else None


def build(circuit: str) -> dict:
    cfg = CIRCUITS[circuit]
    lat0, lon0 = cfg["centre"]
    frame = Frame(lat0, lon0)
    data = osm(circuit, lat0, lon0, cfg.get("radius", RADIUS))
    E = data["elements"]
    if cfg.get("extra"):
        E = E + osm_extra(circuit, lat0, lon0)

    # The lap: the cycle matching the official length and the game's outline best.
    edges = raceway_edges(E, frame)
    cycles = lap_cycles(edges, cfg["length"])
    first_race = races_of(circuit)[0]
    outline = json.loads((paths.DATA_DIR / "tracks" / f"{first_race}.json").read_text())
    game = resample([tuple(p) for p in outline["points"]], 2, closed=True)
    lap_pts: list[tuple[float, float]] = []
    bridge_pts: list[bool] = []
    if cycles:
        scored = []
        for cyc in cycles:
            pts: list[tuple[float, float]] = []
            for e in cyc:
                pts += e["pts"] if not pts else e["pts"][1:]
            real = resample(pts, SAMPLE, closed=True)
            _, _, err = align(game, real)
            scored.append((err, cyc, real))
        scored.sort(key=lambda s: s[0])
        err, cyc, _ = scored[0]
        for e in cyc:
            add = e["pts"] if not lap_pts else e["pts"][1:]
            lap_pts += add
            bridge_pts += [e["bridge"]] * len(add)
    else:
        # No lap tagged as a raceway (Sochi runs on the Olympic Park's roads): the game's own
        # outline, fitted onto the real roads, stands in for it. Vehicle roads only (as
        # fit_race): with the footways in, Albert Park's outline settled on the street grid
        # west of the park instead of the lake road.
        hint = fit_hint(circuit, first_race)
        M, t, err = align_to_roads(
            game,
            _hint_roads(E, hint, frame, stand_in=True),
            cfg["length"],
            **_road_kw({k: v for k, v in hint.items() if k != "on"}, frame),
        )
        lap_pts = [tuple(p) for p in (game @ M.T + t)]
        bridge_pts = [False] * len(lap_pts)

    # Each race's outline on the real ground (fit_race), before the box: an older layout can
    # reach beyond today's lap.
    fits: dict[str, dict] = {}
    found = {"cycles": {}, "roads": None}
    for race_id in races_of(circuit):
        f = paths.DATA_DIR / "tracks" / f"{race_id}.json"
        if not f.exists():
            continue
        o = json.loads(f.read_text())
        g = resample([tuple(p) for p in o["points"]], 2, closed=True)
        length = LAYOUTS.get(race_id, {}).get("length", cfg["length"])
        fit = fit_race(g, lap_pts, edges, E, frame, length, found, fit_hint(circuit, race_id))
        fits[race_id] = {"o": o, "g": g, **fit}

    # Scenery box round the lap and every race's outline, in a frame whose origin is its corner.
    placed = [lap_pts] + [list(map(tuple, x["g"] @ x["M"].T + x["t"])) for x in fits.values()]
    xs = [p[0] for pts in placed for p in pts]
    zs = [p[1] for pts in placed for p in pts]
    X0, Z0 = min(xs) - MARGIN, min(zs) - MARGIN
    X1, Z1 = max(xs) + MARGIN, max(zs) + MARGIN
    shift = lambda p: (p[0] - X0, p[1] - Z0)  # noqa: E731
    lap_pts = [shift(p) for p in lap_pts]
    lap = resample(lap_pts, SAMPLE, closed=True)
    # which resampled points are on a bridge: by distance along the lap (a nearest-point match
    # would jump to the other road where the lap crosses itself)
    raw = np.asarray(lap_pts + [lap_pts[0]], float)
    cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(raw, axis=0), axis=1))])
    along = np.linspace(0, cum[-1], len(lap), endpoint=False)
    seg_end = np.clip(np.searchsorted(cum, along, side="right"), 1, len(raw) - 1)
    on_bridge = np.array([bridge_pts[k % len(bridge_pts)] for k in seg_end])

    # Ground.
    nx = int((X1 - X0) / STEP) + 1
    nz = int((Z1 - Z0) / STEP) + 1
    ground = elevation(circuit, frame, X0, Z0, nx, nz)

    def ground_at(x: float, z: float) -> float:
        fx = min(max(x / STEP, 0), nx - 1.001)
        fz = min(max(z / STEP, 0), nz - 1.001)
        i, j = int(fx), int(fz)
        u, v = fx - i, fz - j
        return float(
            ground[j, i] * (1 - u) * (1 - v)
            + ground[j, i + 1] * u * (1 - v)
            + ground[j + 1, i] * (1 - u) * v
            + ground[j + 1, i + 1] * u * v
        )

    # The track's height: the ground under it, smoothed round the lap (the source is a surface
    # model with trees in it), raised on bridges.
    n = len(lap)
    raw = np.array([ground_at(x, z) for x, z in lap])
    # under a bridge the ground is the lower road's: take the lowest nearby off-bridge height
    prof = raw.copy()
    win = 31
    k = np.ones(win) / win
    for _ in range(3):
        prof = np.convolve(np.concatenate([prof[-win:], prof, prof[:win]]), k, "same")[win:-win]
    rise = np.zeros(n)
    if on_bridge.any():
        idx = np.where(on_bridge)[0]
        for i in range(n):
            d = np.min(np.abs((idx - i + n // 2) % n - n // 2)) * SAMPLE
            rise[i] = BRIDGE_RISE * (
                1 if d == 0 else max(0.0, math.cos(min(d, 90) / 90 * math.pi / 2))
            )
        # the lower road at the crossing must stay below: ground already carries it
    prof = prof + rise

    # Shape the ground to the track: flat under it, easing back to the real ground 35 m out.
    # A bridge's approaches become embankments (the ground rises with the deck), except over the
    # road it crosses: there the ground keeps that road's height, leaving the span open.
    gx, gz = np.meshgrid(np.arange(nx) * STEP, np.arange(nz) * STEP)
    grid_pts = np.stack([gx.ravel(), gz.ravel()], 1)
    d_all, i_all = cKDTree(lap).query(grid_pts)
    below = ~on_bridge if (~on_bridge).any() else np.ones(n, bool)
    d_low, i_low = cKDTree(lap[below]).query(grid_pts)
    under = d_low < TRACK_HALF + 8
    h_track = (np.where(under, prof[below][i_low], prof[i_all]) - 0.2).reshape(nz, nx)
    d = np.where(under, d_low, d_all).reshape(nz, nx)
    t = np.clip((d - (TRACK_HALF + 6)) / 35, 0, 1)
    t = t * t * (3 - 2 * t)
    ground = h_track * (1 - t) + ground * t

    # The pit lane (the map's own, named pit lane) shaped the same way.
    pit_way = None
    best_pit = math.inf
    for e in E:
        tg = e.get("tags", {})
        if (
            e["type"] == "way"
            and tg.get("highway") == "raceway"
            and re.search(
                r"pit", tg.get("name", "") + tg.get("raceway", "") + tg.get("service", ""), re.I
            )
            and not re.search(r"support|kart|moto", tg.get("name", ""), re.I)
        ):
            pts = [shift(frame.xz(p["lat"], p["lon"])) for p in e["geometry"]]
            L = _length(pts)
            # the main pit lane: long, and close to the lap all along
            dd, _ = cKDTree(lap).query(np.asarray(pts))
            score = dd.mean() - L / 50
            if L > 250 and dd.max() < 120 and score < best_pit:
                best_pit, pit_way = score, pts
    pit = resample(pit_way, 4, closed=False) if pit_way else None
    if pit is not None:
        ph = np.array([ground_at(x, z) for x, z in pit])
        ph = np.convolve(np.pad(ph, 10, mode="edge"), np.ones(21) / 21, "same")[10:-10]
        pt = cKDTree(pit)
        d2, i2 = pt.query(np.stack([gx.ravel(), gz.ravel()], 1))
        d2 = d2.reshape(nz, nx)
        t2 = np.clip((d2 - 9) / 20, 0, 1)
        t2 = t2 * t2 * (3 - 2 * t2)
        ground = np.where(d2 < d, ph[i2].reshape(nz, nx) - 0.2, ground) * (1 - t2) + ground * t2

    # Light smoothing of the rest (tree canopy in the source).
    kk = np.array([1, 4, 6, 4, 1], float)
    kk /= kk.sum()
    sm = ground.copy()
    for _ in range(2):
        sm = np.apply_along_axis(
            lambda r: np.convolve(np.pad(r, 2, mode="edge"), kk, "valid"), 1, sm
        )
        sm = np.apply_along_axis(
            lambda r: np.convolve(np.pad(r, 2, mode="edge"), kk, "valid"), 0, sm
        )
    near_track = t < 1
    ground = np.where(near_track, ground, sm)

    hmin = float(min(ground.min(), prof.min())) - 1
    q = np.round((ground - hmin) * 10).astype("<u2")

    # Features.
    def inside(p: tuple[float, float]) -> bool:
        return 0 <= p[0] <= X1 - X0 and 0 <= p[1] <= Z1 - Z0

    R = lambda pts: [[round(x, 1), round(z, 1)] for x, z in pts]  # noqa: E731
    areas: dict[str, list] = {}
    buildings, roads, streams, barriers, rails, trees, landmarks = [], [], [], [], [], [], []
    # Today's tarmac (every raceway in use, pit lanes and other layouts too: the 2D map draws
    # it under the race's own track, so a race on a layout that's gone still shows the circuit
    # as it is now) and the coastline (the 2D map fills the sea from it).
    raceways, coast = [], []
    for e in E:
        tg = e.get("tags", {})
        if e["type"] == "node":
            p = shift(frame.xz(e["lat"], e["lon"]))
            if not inside(p):
                continue
            if tg.get("natural") == "tree":
                trees.append([round(p[0], 1), round(p[1], 1)])
            elif tg.get("attraction") == "big_wheel":
                landmarks.append(
                    {
                        "kind": "wheel",
                        "at": [round(p[0], 1), round(p[1], 1)],
                        "size": _num(tg.get("height")) or 50,
                    }
                )
            continue
        if e["type"] == "relation":
            kind = area_kind(tg)
            if "building" in tg:
                kind = None
            outers = [
                [shift(frame.xz(p["lat"], p["lon"])) for p in m["geometry"]]
                for m in e.get("members", [])
                if m.get("role") == "outer" and m.get("geometry")
            ]
            if kind:
                for r in stitch(outers):
                    if any(inside(p) for p in r) and len(r) >= 4:
                        areas.setdefault(kind, []).append(R(simplify(r, 1.5)))
            continue
        if e["type"] != "way" or "geometry" not in e:
            continue
        pts = [shift(frame.xz(p["lat"], p["lon"])) for p in e["geometry"]]
        if not any(inside(p) for p in pts):
            continue
        closed = e["nodes"][0] == e["nodes"][-1]
        if tg.get("attraction") == "big_wheel":
            c = np.asarray(pts).mean(0)
            span = max(math.dist(a, b) for a in pts for b in pts)
            landmarks.append(
                {
                    "kind": "wheel",
                    "at": [round(c[0], 1), round(c[1], 1)],
                    "size": _num(tg.get("height")) or max(40, span),
                }
            )
            continue
        if ("building" in tg or "building:part" in tg) and closed:
            h = _num(tg.get("height"))
            levels = _num(tg.get("building:levels"))
            kind = tg.get("building") or tg.get("building:part")
            name = tg.get("name", "")
            stand = kind == "grandstand" or bool(
                re.search(r"grand ?stand|tribun|tribüne|lelátó|スタンド", name, re.I)
            )
            if h is None and levels is not None:
                h = levels * 3.3 + 1
            if h is None:
                h = (
                    12
                    if stand
                    else 4
                    if kind in ("roof", "carport")
                    else 7
                    if kind in ("house", "detached", "yes", "residential", "shed", "garage")
                    else 9
                )
            minh = _num(tg.get("min_height")) or (h - 1.0 if kind == "roof" else 0)
            buildings.append(
                {
                    "p": R(simplify(pts, 0.6)),
                    "h": round(h, 1),
                    **({"min": round(minh, 1)} if minh else {}),
                    **({"stand": 1} if stand else {}),
                    **({"roof": tg["roof:shape"]} if tg.get("roof:shape") else {}),
                }
            )
            continue
        hw = tg.get("highway")
        if (
            hw == "raceway"
            and tg.get("area") != "yes"
            and "abandoned:highway" not in tg
            and tg.get("historic") != "raceway"
        ):
            pit_lane = re.search(r"pit", tg.get("name", "") + tg.get("service", ""), re.I)
            raceways.append({"w": 8 if pit_lane else 12, "p": R(simplify(pts, 0.8))})
            continue
        if tg.get("natural") == "coastline":
            coast.append(R(simplify(pts, 1.5)))
            continue
        if hw in ROAD_W and tg.get("area") != "yes":
            roads.append({"w": ROAD_W[hw], "p": R(simplify(pts, 1))})
            continue
        if tg.get("waterway") in ("stream", "river", "ditch", "canal", "drain"):
            streams.append(
                {"w": 8 if tg["waterway"] in ("river", "canal") else 2, "p": R(simplify(pts, 1))}
            )
            continue
        if tg.get("railway") in ("rail", "light_rail", "narrow_gauge"):
            rails.append(R(simplify(pts, 1)))
            continue
        b = tg.get("barrier")
        if (
            b
            in ("guard_rail", "wall", "fence", "retaining_wall", "jersey_barrier", "tyres", "kerb")
            and not closed
        ):
            barriers.append({"kind": b, "p": R(simplify(pts, 0.8))})
            continue
        if tg.get("natural") == "tree_row":
            for a, bb in zip(pts, pts[1:], strict=False):
                L = math.dist(a, bb)
                for s in np.arange(0, L, 9):
                    trees.append(
                        [
                            round(a[0] + (bb[0] - a[0]) * s / L, 1),
                            round(a[1] + (bb[1] - a[1]) * s / L, 1),
                        ]
                    )
            continue
        # a closed path (the cycleway round Albert Park Lake) is a ring, not an area: its
        # surface tag would fill the lake with gravel
        if closed and (tg.get("area") == "yes" or tg.get("highway") is None):
            kind = area_kind(tg)
            if kind:
                areas.setdefault(kind, []).append(R(simplify(pts, 1.5)))

    # Each race on this circuit: its outline lined up with the lap, and the fraction table.
    races = {}
    for race_id, x in fits.items():
        o, M = x["o"], x["M"]
        tt = x["t"] - np.array([X0, Z0])
        races[race_id] = {
            "m": [round(float(v), 6) for v in M.ravel()],
            "t": [round(float(v), 3) for v in tt],
            "err": round(x["err"], 2),
            "cover": round(x["cover"], 3),
            "how": x["how"],
            "scale": round(x["scale"], 4),
            "frac": fraction_table(np.asarray(o["points"], float), lap, M, tt),
            "corners": [
                [c[0], *[round(float(v), 1) for v in (np.asarray(c[1:]) @ M.T + tt)]]
                for c in o.get("corners", [])
            ],
            # the game's pit lane in the scenery's frame (the 3D cars in the lane follow it)
            "pit": [
                [round(float(v), 1) for v in (np.asarray(q) @ M.T + tt)] for q in o.get("pit", [])
            ],
        }

    return {
        "circuit": circuit,
        "name": cfg["name"],
        "light": cfg["light"],
        "ground": cfg["ground"],
        "size": [round(X1 - X0, 1), round(Z1 - Z0, 1)],
        "grid": {
            "nx": nx,
            "nz": nz,
            "step": STEP,
            "min": round(hmin, 2),
            "h": base64.b64encode(q.tobytes()).decode(),
        },
        "lap": {
            "pts": R(map(tuple, lap)),
            "y": [round(float(v), 2) for v in prof],
            "bridge": [i for i in range(n) if on_bridge[i]],
            "length": round(
                float(np.linalg.norm(np.diff(np.vstack([lap, lap[:1]]), axis=0), axis=1).sum()), 1
            ),
        },
        "pit": R(map(tuple, pit)) if pit is not None else None,
        "areas": areas,
        "buildings": buildings,
        "roads": roads,
        "raceways": raceways,
        "coast": coast,
        "streams": streams,
        "rails": rails,
        "barriers": barriers,
        "trees": trees,
        "landmarks": landmarks,
        "races": races,
        "fit": round(err, 2),
        "credit": "© OpenStreetMap contributors · Elevation: Mapzen terrain tiles",
    }


def write(circuit: str) -> Path:
    out = build(circuit)
    SCENERY_DIR.mkdir(parents=True, exist_ok=True)
    path = SCENERY_DIR / f"{circuit}.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    return path
