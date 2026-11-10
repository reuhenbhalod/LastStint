"""F1DB pit stops and fastest laps for the Eras races (build plan step 2.3).

F1DB (github.com/f1db/f1db) is licensed CC BY 4.0: free to use in the game, with credit.
Every file this writes carries the credit (data/raw/f1db/source.json), and the game's credits
must name "F1DB (f1db.com), CC BY 4.0".

It stands in for formula1.com as well: formula1.com's terms forbid copying or extracting its
historical race data, and F1DB carries the same tables (pit stops from 1994: 14 of 16 races in
1994, every race from 1995; each driver's fastest lap and the lap it came on, every race).

The release is downloaded once, pinned by version and SHA-256, into the shared Eras cache
(pipeline/cache/eras-sources/f1db/<version>/, git-ignored). For each race it writes two small
committed CSVs under data/raw/f1db/, keyed by race id (`<event-slug>-<year>`, as in the build
plan appendix) and the 3-letter driver code, for jolpica.py to merge:

<race-id>.stops.csv           one row per stop, in race order
    race_id   e.g. japan-2005
    driver    3-letter code: F1DB's abbreviation (the repo's codes), made unique per race
              by resolve_codes
    driver_id F1DB driver id (unique across eras: MSC is Michael in 2005, Mick in 2022)
    number    car number
    stop      1, 2, ... for this driver
    lap       the lap the car came in on (official lap numbering)
    lane_time pit-lane time in seconds (entry to exit; blank where F1DB has none)

<race-id>.fastest-laps.csv    one row per driver who set a lap time
    race_id, driver, driver_id, number
    rank      1 = the race's fastest lap
    lap       the lap it came on (blank where F1DB has none)
    time      lap time in seconds

Network only in `download`; everything else reads the cached zip, so tests run on fixtures.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import unicodedata
import urllib.request
import zipfile
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

import pandas as pd

from .paths import RAW_DIR, REPO_ROOT

VERSION = "v2026.19.0"
SHA256 = "69038edcee2cd27d61b41e9d83f31f4c8910b6f1a7c7cc9a94ca13864af8a77c"
ASSET = "f1db-csv.zip"
URL = "https://github.com/f1db/f1db/releases/download/{version}/" + ASSET
LICENCE = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"
ATTRIBUTION = "F1DB (https://github.com/f1db/f1db), CC BY 4.0. Columns renamed and filtered."

OUT_DIR = RAW_DIR / "f1db"
STOP_COLUMNS = ["race_id", "driver", "driver_id", "number", "stop", "lap", "lane_time"]
FASTEST_COLUMNS = ["race_id", "driver", "driver_id", "number", "rank", "lap", "time"]

# Appendix races F1DB covers: stops for every race from 1994 to 2010 (Jolpica has stops from
# 2011), fastest laps for every race before 2011 (later years come with full laps).
# australia-2010 left the appendix (Era 6 swap, Nov 9) but stays: its build is an Eras fixture.
APPENDIX_RACES = [
    *("south-africa-1983", "monaco-1984", "portugal-1984", "germany-1986", "portugal-1985"),
    *("mexico-1986", "hungary-1986", "australia-1986", "great-britain-1987", "monaco-1988"),
    *("france-1990", "united-states-1990", "mexico-1990", "brazil-1991", "monaco-1992"),
    *("belgium-1992", "hungary-1992", "brazil-1993", "europe-1993", "australia-1993"),
    *("spain-1994", "australia-1994", "belgium-1995", "spain-1996", "hungary-1997"),
    *("europe-1997", "hungary-1998", "belgium-1998", "malaysia-1999", "europe-1999"),
    *("canada-2003", "japan-2000", "san-marino-2000", "austria-2002", "hungary-2001"),
    *("austria-2001", "france-2001", "italy-2001", "france-2004", "san-marino-2003"),
    *("san-marino-2005", "japan-2005", "hungary-2006", "brazil-2006", "china-2007"),
    *("europe-2007", "brazil-2007", "monaco-2008", "brazil-2008", "brazil-2009"),
    *("australia-2010", "abu-dhabi-2010", "italy-2010"),
]
FIRST_STOPS_YEAR = 1994


def resolve_codes(drivers: pd.DataFrame, results: pd.DataFrame) -> dict[str, str]:
    """One 3-letter code per F1DB driver, unique in every race they started.

    F1DB's abbreviations repeat inside some races (BER: Berger, Bernard and Beretta in 1994;
    PAN: Panis and Pantano in 2004). Drivers are taken in order of career starts; each keeps
    F1DB's code unless a driver they raced alongside already holds it, and then takes the first
    free code made from their surname (initial + two later letters, in order). So established
    drivers keep their codes, and a driver's code is the same in every race.
    """
    teammates: dict[str, set[str]] = {d: set() for d in drivers.id}
    for ids in results.groupby("raceId").driverId.agg(set):
        for d in ids:
            teammates.setdefault(d, set()).update(ids - {d})
    order = drivers.sort_values(["totalRaceStarts", "id"], ascending=[False, True])
    codes: dict[str, str] = {}
    for d, abbr, last in zip(order.id, order.abbreviation, order.lastName, strict=True):
        taken = {codes[o] for o in teammates.get(d, ()) if o in codes}
        letters = [c for c in _ascii(last).upper() if c.isalpha()]
        candidates = [abbr] + [
            letters[0] + letters[i] + letters[j]
            for i in range(1, len(letters))
            for j in range(i + 1, len(letters))
        ]
        codes[d] = next((c for c in candidates if c not in taken), abbr)
    return codes


def _ascii(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


def eras_cache_dir() -> Path:
    """The shared Eras source cache: $ERAS_SOURCES_CACHE, else pipeline/cache/eras-sources/ in
    the main checkout (a git worktree's `.git` file points back to it), so each source
    downloads once for every worktree."""
    if env := os.environ.get("ERAS_SOURCES_CACHE"):
        return Path(env)
    root = REPO_ROOT
    git = root / ".git"
    if git.is_file():  # "gitdir: <main>/.git/worktrees/<name>"
        gitdir = Path(git.read_text().split(":", 1)[1].strip())
        if gitdir.parent.name == "worktrees":
            root = gitdir.parents[2]
    return root / "pipeline" / "cache" / "eras-sources"


def zip_path(cache_dir: Path | None = None, version: str = VERSION) -> Path:
    return (cache_dir or eras_cache_dir()) / "f1db" / version / ASSET


def download(cache_dir: Path | None = None, version: str = VERSION) -> Path:
    """The release zip, downloaded once (network) and checked against the pinned SHA-256."""
    path = zip_path(cache_dir, version)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            URL.format(version=version), headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        path.write_bytes(data)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if version == VERSION and digest != SHA256:
        raise ValueError(f"{path}: SHA-256 {digest} is not the pinned {SHA256}")
    return path


@dataclass
class F1DB:
    """The F1DB tables this module uses, read from a release zip."""

    races: pd.DataFrame
    drivers: pd.DataFrame
    results: pd.DataFrame
    stops: pd.DataFrame
    fastest: pd.DataFrame

    @classmethod
    def load(cls, path: Path) -> F1DB:
        with zipfile.ZipFile(path) as z:

            def read(name: str, cols: list[str]) -> pd.DataFrame:
                with z.open(f"f1db-{name}.csv") as f:
                    return pd.read_csv(
                        io.TextIOWrapper(f, "utf-8"),
                        usecols=cols,
                        dtype={"driverNumber": str},
                        keep_default_na=False,
                        na_values=[""],
                    )

            return cls(
                races=read("races", ["id", "year", "round", "grandPrixId", "laps"]),
                drivers=read("drivers", ["id", "abbreviation", "lastName", "totalRaceStarts"]),
                results=read(
                    "races-race-results",
                    ["raceId", "driverId", "driverNumber", "laps", "pitStops", "positionText"],
                ),
                stops=read(
                    "races-pit-stops",
                    ["raceId", "driverNumber", "driverId", "stop", "lap", "timeMillis"],
                ),
                fastest=read(
                    "races-fastest-laps",
                    ["raceId", "positionNumber", "driverNumber", "driverId", "lap", "timeMillis"],
                ),
            )

    @cached_property
    def codes(self) -> dict[str, str]:
        """F1DB driver id -> the 3-letter code used in the output (resolve_codes)."""
        return resolve_codes(self.drivers, self.results)

    def race(self, race_id: str) -> pd.Series:
        ids = self.races.grandPrixId + "-" + self.races.year.astype(str)
        match = self.races[ids == race_id]
        if len(match) != 1:
            raise KeyError(f"F1DB has no race '{race_id}'")
        return match.iloc[0]

    def _codes(self, driver_ids: pd.Series) -> pd.Series:
        codes = driver_ids.map(self.codes)
        if codes.isna().any():
            raise ValueError(f"no F1DB code for {sorted(driver_ids[codes.isna()])}")
        return codes

    def race_stops(self, race_id: str) -> pd.DataFrame:
        """The race's stops (STOP_COLUMNS), in race order."""
        race = self.race(race_id)
        s = self.stops[self.stops.raceId == race.id]
        out = pd.DataFrame(
            {
                "race_id": race_id,
                "driver": self._codes(s.driverId),
                "driver_id": s.driverId,
                "number": s.driverNumber,
                "stop": s["stop"].astype(int),
                "lap": s.lap.astype(int),
                "lane_time": s.timeMillis / 1000,
            }
        )
        return out.sort_values(["lap", "driver", "stop"], kind="stable").reset_index(drop=True)

    def race_fastest_laps(self, race_id: str) -> pd.DataFrame:
        """Each driver's fastest lap (FASTEST_COLUMNS), quickest first."""
        race = self.race(race_id)
        f = self.fastest[self.fastest.raceId == race.id]
        out = pd.DataFrame(
            {
                "race_id": race_id,
                "driver": self._codes(f.driverId),
                "driver_id": f.driverId,
                "number": f.driverNumber,
                "rank": f.positionNumber.astype("Int64"),
                "lap": f.lap.astype("Int64"),
                "time": f.timeMillis / 1000,
            }
        )
        return out.sort_values("time", kind="stable").reset_index(drop=True)

    def check_stops(self, race_id: str, stops: pd.DataFrame) -> list[str]:
        """Problems with a race's stops (empty = every stop lands on a lap the driver ran):
        each lap within the laps the driver completed (+1: a car can retire in the pits),
        stops numbered 1..n in lap order, the count matching the results' pit-stop count,
        and the 3-letter codes unique in the race."""
        race = self.race(race_id)
        res = self.results[self.results.raceId == race.id].set_index("driverId")
        problems = []
        if stops.empty and race.year >= FIRST_STOPS_YEAR:
            problems.append("no stops")
        for did, s in stops.groupby("driver_id", sort=False):
            code = s.driver.iloc[0]
            if did not in res.index:
                problems.append(f"{code}: stops but no race result")
                continue
            laps = int(res.loc[did, "laps"])
            if (s.lap < 1).any() or (s.lap > min(laps + 1, int(race.laps))).any():
                problems.append(f"{code}: stop lap outside 1..{laps} ({list(s.lap)})")
            ordered = s.sort_values("stop")
            if list(ordered["stop"]) != list(range(1, len(s) + 1)):
                problems.append(f"{code}: stops numbered {list(ordered['stop'])}")
            if not ordered.lap.is_monotonic_increasing:
                problems.append(f"{code}: stop laps out of order {list(ordered.lap)}")
            listed = res.loc[did, "pitStops"]
            if pd.notna(listed) and int(listed) != len(s):
                problems.append(f"{code}: {len(s)} stops, results say {int(listed)}")
        drivers = self.results[self.results.raceId == race.id].driverId
        codes = self._codes(drivers)
        if codes.duplicated().any():
            problems.append(f"duplicate codes {sorted(set(codes[codes.duplicated()]))}")
        return problems


def write_race(
    db: F1DB, race_id: str, out_dir: Path | None = None
) -> tuple[pd.DataFrame, pd.DataFrame, list[str]]:
    """Write <race-id>.stops.csv (from 1994) and <race-id>.fastest-laps.csv; returns the
    tables and any stop problems (check_stops)."""
    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    year = int(db.race(race_id).year)
    stops = db.race_stops(race_id)
    problems = db.check_stops(race_id, stops) if year >= FIRST_STOPS_YEAR else []
    if year >= FIRST_STOPS_YEAR:
        _write_csv(stops, STOP_COLUMNS, out_dir / f"{race_id}.stops.csv")
    fastest = db.race_fastest_laps(race_id)
    _write_csv(fastest, FASTEST_COLUMNS, out_dir / f"{race_id}.fastest-laps.csv")
    return stops, fastest, problems


def write_source(out_dir: Path | None = None, version: str = VERSION) -> Path:
    """data/raw/f1db/source.json: the version, checksum, licence and credit for these files."""
    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "source.json"
    meta = {
        "source": "F1DB",
        "version": version,
        "asset": ASSET,
        "url": URL.format(version=version),
        "sha256": SHA256 if version == VERSION else None,
        "licence": LICENCE,
        "attribution": ATTRIBUTION,
        "columns": {"stops": STOP_COLUMNS, "fastest-laps": FASTEST_COLUMNS},
    }
    path.write_text(json.dumps(meta, indent=2) + "\n")
    return path


def _write_csv(df: pd.DataFrame, columns: list[str], path: Path) -> None:
    out = df[columns].copy()
    for col in ("lane_time", "time"):
        if col in out:
            out[col] = out[col].map(lambda v: "" if pd.isna(v) else f"{v:.3f}")
    out.to_csv(path, index=False, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
