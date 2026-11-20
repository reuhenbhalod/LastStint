"""TUM f1-timing-database adapter, 2014-2019 (Eras build plan 2.1, simulator roadmap P1).

Source: the TUM f1-timing-database by the Institute of Automotive Technology, Technical
University of Munich (Alexander Heilmeier et al.), https://github.com/TUMFTM/f1-timing-database,
itself built largely on the Ergast API. Licensed CC BY-NC-SA 3.0: race files built from it
carry the same licence and credit TUM (the provenance sidecar this module writes says so).
Pinned to commit TUM_COMMIT; the SQLite file is checked against TUM_SHA256.

Reads one race from the SQLite and writes the same raw parquet (ingest.LAP_COLUMNS) and status
JSON as ingest.py, so clean / fit / track / assemble run unchanged. How each column is made:

- Driver / Team: TUM initials and team (TEAM_NAMES spells teams as FastF1 does).
- LapTime, Time, Position: TUM laptime, racetime (seconds from the start, so Time and the
  status timeline share a zero at lights out), position at the end of the lap.
- Compound: TUM's absolute codes A1 (hardest) - A7 mapped per race from the race's own
  nomination (`races.availablecompounds`), softest first: three dry compounds become
  SOFT/MEDIUM/HARD; two (2014-15, one step apart) become SOFT/MEDIUM, as ingest.py labels a
  pair. I / W are INTERMEDIATE / WET. A compound outside the nomination is an error.
- TyreLife: TUM tireage (laps on the set at the end of the lap; TUM sets a top-10 starter's
  qualifying set to 2 laps old at the start).
- Stint: 1 + the driver's earlier pit stops.
- PitInTime / PitOutTime: TUM gives a wall-clock pit entry with no race-start clock, so pit
  entry is taken as the in-lap's end (Time) and exit as that plus TUM's pit-lane time
  (pitstopduration; Abu Dhabi 2018 HAM: 21.283 s, FastF1 21.28 s).
- TrackStatus: per lap, from TUM's per-lap SC/VSC progress: "1" green, "4" SC, "6" VSC, in
  the order they occurred within the lap (e.g. "14", "41", "16"). TUM has no yellow flags.
- IsAccurate: a timed lap that isn't lap 1 or a pit in/out lap.
- Retirements: like FastF1, a retired car gets a row for the lap it didn't finish (no
  LapTime), ending at the earliest that lap could have ended (`retirement_rows`).
- Status JSON: TUM's fcyphases as SC "4" / VSC "6" deployments and "1" when each ends.

Gaps (see `race_notes`): TUM has no red-flag phases or weather; races its comment marks as
red-flagged or interrupted are flagged not suitable rather than given an invented timeline.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from pathlib import Path

import pandas as pd

from .ingest import (
    LAP_COLUMNS,
    IncompleteDataError,
    check_complete,
    raw_snapshot_path,
    track_status_path,
)
from .paths import RAW_DIR, REPO_ROOT

TUM_URL = "https://github.com/TUMFTM/f1-timing-database"
TUM_COMMIT = "9eaad9c22780d7a2169fd4517938e9dc721d5729"  # 2021-09-18, "Updated readme"
TUM_SHA256 = "bf46e62930c9ede978e7d6323e5e2796ca1e17dc157666c25d87fd1c266c0e7c"
TUM_LICENCE = "CC BY-NC-SA 3.0"
TUM_CREDIT = (
    "Lap data: TUM f1-timing-database (Institute of Automotive Technology, Technical "
    f"University of Munich; based on the Ergast API), {TUM_URL} @ {TUM_COMMIT[:7]}, "
    f"licensed {TUM_LICENCE}."
)
DEFAULT_DB = (
    REPO_ROOT / "pipeline" / "cache" / "eras-sources" / "tum" / "repo"
    / "F1_timingdata_2014_2019.sqlite"
)  # fmt: skip
SEASONS = range(2014, 2020)

# Race-id slug (ingest.default_race_id style, with the aliases the repo already uses) -> TUM
# `races.location`.
LOCATIONS = {
    "australia": "Melbourne",
    "malaysia": "KualaLumpur",
    "bahrain": "Sakhir",
    "china": "Shanghai",
    "spain": "Catalunya",
    "monaco": "MonteCarlo",
    "canada": "Montreal",
    "austria": "Spielberg",
    "great-britain": "Silverstone",
    "british": "Silverstone",
    "germany": "Hockenheim",
    "hungary": "Budapest",
    "belgium": "Spa",
    "italy": "Monza",
    "singapore": "Singapore",
    "japan": "Suzuka",
    "russia": "Sochi",
    "united-states": "Austin",
    "usa": "Austin",
    "brazil": "SaoPaulo",
    "abu-dhabi": "YasMarina",
    "mexico": "MexicoCity",
    "azerbaijan": "Baku",
    "europe": "Baku",  # 2016: the European Grand Prix, at Baku
    "france": "LeCastellet",
}

# TUM team names -> FastF1's spelling (data/raw, teamTheme.ts).
TEAM_NAMES = {
    "RedBull": "Red Bull Racing",
    "ToroRosso": "Toro Rosso",
    "ForceIndia": "Force India",
    "HaasF1Team": "Haas F1 Team",
    "LotusF1": "Lotus F1",
    "ManorMarussia": "Manor Marussia",
    "AlfaRomeo": "Alfa Romeo Racing",
    "RacingPoint": "Racing Point",
}
# Force India raced as Racing Point Force India from the 2018 Belgian GP (TUM keeps
# "ForceIndia"; FastF1 says "Racing Point").
RACING_POINT_FROM = "2018-08-26"
# TUM keeps one team per driver per season (starterfields), so a mid-season move is missed.
# driver -> [(first race date, last race date, TUM team)], checked against Jolpica's
# per-race constructors (https://api.jolpi.ca/ergast/f1/<year>/<round>/results.json):
# Verstappen and Kvyat swapped seats from the 2016 Spanish GP (round 5; Hungary, round 11:
# VER Red Bull, KVY Toro Rosso); Sainz drove for Renault from the 2017 United States GP
# (rounds 17-18: Renault).
TEAM_MOVES: dict[str, list[tuple[str, str, str]]] = {
    "VER": [("2016-05-15", "2016-12-31", "RedBull")],
    "KVY": [("2016-05-15", "2016-12-31", "ToroRosso")],
    "SAI": [("2017-10-22", "2017-12-31", "Renault")],
}

DRY_LABELS = ["SOFT", "MEDIUM", "HARD"]
WET_CODES = {"I": "INTERMEDIATE", "W": "WET"}
_DRY_CODE = re.compile(r"A([1-7])")
# Race comments that mean the race was stopped (TUM has no red-flag phases).
_STOPPED = re.compile(r"red flag|interrupted", re.IGNORECASE)

GREEN, SC, VSC = "1", "4", "6"


class TumVersionError(RuntimeError):
    """The SQLite file isn't the pinned TUM version."""


def sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def connect(db_path: Path = DEFAULT_DB, verify: bool = True) -> sqlite3.Connection:
    """Open the TUM SQLite read-only; with `verify`, refuse anything but the pinned file."""
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(
            f"TUM database not found at {db_path}; clone {TUM_URL} (commit {TUM_COMMIT})"
            " into pipeline/cache/eras-sources/tum/repo"
        )
    if verify and (digest := sha256(db_path)) != TUM_SHA256:
        raise TumVersionError(f"{db_path} has sha256 {digest}, expected {TUM_SHA256}")
    return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)


def parse_race_id(race_id: str) -> tuple[int, str]:
    """'abu-dhabi-2018' -> (2018, 'YasMarina'). Raises ValueError outside TUM's coverage."""
    m = re.fullmatch(r"([a-z0-9-]+)-(\d{4})", race_id)
    if not m:
        raise ValueError(f"race id '{race_id}' is not <event-slug>-<year>")
    slug, year = m.group(1), int(m.group(2))
    if year not in SEASONS:
        raise ValueError(f"TUM covers {SEASONS.start}-{SEASONS.stop - 1}, not {year}")
    if slug not in LOCATIONS:
        raise ValueError(f"no TUM location for '{slug}' (known: {', '.join(sorted(LOCATIONS))})")
    return year, LOCATIONS[slug]


def find_race(con: sqlite3.Connection, season: int, location: str) -> dict:
    """The TUM `races` row for a season and location."""
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "SELECT * FROM races WHERE season = ? AND location = ?", (season, location)
    ).fetchall()
    con.row_factory = None
    if len(rows) != 1:
        raise IncompleteDataError(f"{len(rows)} TUM races for {season} {location}")
    return dict(rows[0])


def compound_map(available: str) -> dict[str, str]:
    """A race's nominated TUM codes (e.g. 'A5,A6,A7,I,W') -> SOFT/MEDIUM/HARD, INTERMEDIATE,
    WET. Softest (highest A number) first; a two-compound nomination is SOFT/MEDIUM."""
    codes = [c.strip() for c in (available or "").split(",") if c.strip()]
    dry, mapping = [], {}
    for code in codes:
        if code in WET_CODES:
            mapping[code] = WET_CODES[code]
        elif m := _DRY_CODE.fullmatch(code):
            dry.append((int(m.group(1)), code))
        else:
            raise IncompleteDataError(f"unknown TUM compound code '{code}' in '{available}'")
    if len(dry) not in (2, 3) or len({n for n, _ in dry}) != len(dry):
        raise IncompleteDataError(f"expected two or three dry compounds, got '{available}'")
    for label, (_, code) in zip(DRY_LABELS, sorted(dry, reverse=True), strict=False):
        mapping[code] = label
    return mapping


def team_name(tum_team: str | None, date: str, driver: str | None = None) -> str | None:
    if tum_team is None:
        return None
    for first, last, team in TEAM_MOVES.get(driver or "", []):
        if first <= date[:10] <= last:
            tum_team = team
    if tum_team == "ForceIndia" and date >= RACING_POINT_FROM:
        return "Racing Point"
    return TEAM_NAMES.get(tum_team, tum_team)


def lap_status(start_vsc, end_vsc, start_sc, end_sc) -> str:
    """Per-lap TrackStatus from TUM's lap-progress fractions of the VSC / SC (NaN when the
    lap had none): the codes in the order they ran during the lap, e.g. '14', '4', '41'."""
    phases = sorted(
        (float(s), float(e), code)
        for s, e, code in ((start_vsc, end_vsc, VSC), (start_sc, end_sc, SC))
        if not (pd.isna(s) or pd.isna(e))
    )
    out, at = "", 0.0
    for start, end, code in phases:
        if start > at:
            out += GREEN
        out += code
        at = max(at, end)
    if at < 1.0:
        out += GREEN
    # collapse repeats (a VSC handing straight to an SC is '64', not '614')
    return re.sub(r"(.)\1+", r"\1", out)


_LAPS_SQL = """
SELECT d.initials AS Driver, s.team AS tum_team, s.status AS tum_status,
       l.lapno, l.position, l.laptime, l.racetime, l.compound, l.tireage,
       l.pitintime, l.pitstopduration,
       l.startlapprog_vsc, l.endlapprog_vsc, l.startlapprog_sc, l.endlapprog_sc
FROM laps l
JOIN drivers d ON d.id = l.driver_id
LEFT JOIN starterfields s ON s.race_id = l.race_id AND s.driver_id = l.driver_id
WHERE l.race_id = ?
ORDER BY d.initials, l.lapno
"""


def laps_frame(con: sqlite3.Connection, race: dict) -> pd.DataFrame:
    """One TUM race as a raw lap frame in LAP_COLUMNS (see the module docstring)."""
    everything = pd.read_sql_query(_LAPS_SQL, con, params=(race["id"],))
    grid = everything[everything["lapno"] == 0]
    raw = everything[everything["lapno"] > 0].reset_index(drop=True)
    if raw.empty:
        raise IncompleteDataError(f"no TUM laps for race {race['id']}")
    if raw.groupby(["Driver", "lapno"]).size().max() > 1:
        raise IncompleteDataError("two TUM drivers share initials in one race")
    mapping = compound_map(race["availablecompounds"])
    unknown = set(everything["compound"].dropna()) - set(mapping)
    if unknown:
        raise IncompleteDataError(
            f"compounds {sorted(unknown)} not in the nomination {race['availablecompounds']}"
        )

    pit_in = raw["pitintime"].notna()
    in_time = raw["racetime"].where(pit_in)
    by_driver = raw.groupby("Driver", sort=False)
    prev_in = in_time.groupby(raw["Driver"]).shift(1)
    prev_dur = raw["pitstopduration"].where(pit_in).groupby(raw["Driver"]).shift(1)
    # Previous lap is the in-lap only if it is lap n-1 (TUM has no gaps; guard anyway).
    contiguous = by_driver["lapno"].diff() == 1
    pit_out = (prev_in + prev_dur).where(contiguous & prev_in.notna())
    stint = 1 + pit_in.astype(int).groupby(raw["Driver"]).cumsum() - pit_in.astype(int)
    status = [
        lap_status(*r)
        for r in raw[
            ["startlapprog_vsc", "endlapprog_vsc", "startlapprog_sc", "endlapprog_sc"]
        ].itertuples(index=False)
    ]
    df = pd.DataFrame(
        {
            "Driver": raw["Driver"].astype(str),
            "Team": [
                team_name(t, race["date"], d)
                for t, d in zip(raw["tum_team"], raw["Driver"], strict=True)
            ],
            "LapNumber": raw["lapno"].astype("float64"),
            "LapTime": raw["laptime"].astype("float64"),
            "Time": raw["racetime"].astype("float64"),
            "Compound": raw["compound"].map(mapping),
            "TyreLife": raw["tireage"].astype("float64"),
            "Stint": stint.astype("float64"),
            "PitInTime": in_time.astype("float64"),
            "PitOutTime": pit_out.astype("float64"),
            "TrackStatus": pd.Series(status, dtype=object),
            "Position": raw["position"].astype("float64"),
        }
    )
    df["IsAccurate"] = (
        df["LapTime"].notna()
        & (df["LapNumber"] > 1)
        & df["PitInTime"].isna()
        & df["PitOutTime"].isna()
    ).astype(bool)
    df = pd.concat([df, retirement_rows(df, grid, mapping, race["date"])], ignore_index=True)
    return df[LAP_COLUMNS].sort_values(["Driver", "LapNumber"]).reset_index(drop=True)


def retirement_rows(
    df: pd.DataFrame, grid: pd.DataFrame, mapping: dict[str, str], date: str
) -> pd.DataFrame:
    """The lap each retired car (TUM status DNF) didn't finish, as FastF1 records it: no
    LapTime or Position, on its last set. assemble.finishing_order and
    events.retirement_events read it (a car out on lap 1 has no other row). TUM doesn't
    say when the car stopped, so its Time is the earliest it could have finished that lap (at
    the fastest time anyone ran it), which keeps the stop inside the race lap in progress
    (events.race_lap_at). A car whose last lap ended in the pits retired there: no row is added."""
    rows = []
    fastest = df.groupby("LapNumber")["LapTime"].min()
    status_mode = df.groupby("LapNumber")["TrackStatus"].agg(lambda st: st.mode().iloc[0])
    for _, g in grid[grid["tum_status"] == "DNF"].iterrows():
        own = df[df["Driver"] == g["Driver"]]
        if len(own):
            last = own.loc[own["LapNumber"].idxmax()]
            if not pd.isna(last["PitInTime"]):
                continue
            lap, start = float(last["LapNumber"]) + 1, float(last["Time"])
            compound, age, stint = last["Compound"], float(last["TyreLife"]) + 1, last["Stint"]
        else:
            lap, start = 1.0, 0.0
            compound, age, stint = mapping[g["compound"]], float(g["tireage"]) + 1, 1.0
        if lap not in fastest.index or pd.isna(fastest[lap]):
            continue  # nobody ran that lap: nothing to place the retirement against
        rows.append(
            {
                "Driver": str(g["Driver"]),
                "Team": team_name(g["tum_team"], date, str(g["Driver"])),
                "LapNumber": lap,
                "LapTime": float("nan"),
                "Time": start + float(fastest[lap]),
                "Compound": compound,
                "TyreLife": age,
                "Stint": float(stint),
                "PitInTime": float("nan"),
                "PitOutTime": float("nan"),
                "TrackStatus": status_mode[lap],
                "Position": float("nan"),
                "IsAccurate": False,
            }
        )
    return pd.DataFrame(rows, columns=df.columns).astype(df.dtypes.to_dict())


def track_status(con: sqlite3.Connection, race: dict) -> list[dict]:
    """TUM fcyphases as the status timeline [{time (s from the start), status}]: green at the
    start, SC "4" / VSC "6" when deployed, green when each ends (unless the next phase starts
    then: a VSC handed straight to an SC stays neutral)."""
    phases = con.execute(
        "SELECT startracetime, endracetime, type FROM fcyphases WHERE race_id = ?"
        " ORDER BY startracetime",
        (race["id"],),
    ).fetchall()
    out = [{"time": 0.0, "status": GREEN}]
    for i, (start, end, kind) in enumerate(phases):
        if kind not in ("SC", "VSC"):
            raise IncompleteDataError(f"unknown TUM FCY type '{kind}'")
        out.append({"time": round(float(start), 3), "status": SC if kind == "SC" else VSC})
        nxt = phases[i + 1][0] if i + 1 < len(phases) else None
        if end is not None and (nxt is None or float(nxt) > float(end)):
            out.append({"time": round(float(end), 3), "status": GREEN})
    return out


def race_notes(race: dict) -> list[str]:
    """Reasons a TUM race can't be modelled as-is (the red flags TUM doesn't time)."""
    comment = race.get("comment") or ""
    if _STOPPED.search(comment):
        return [f"red flag (TUM has no red-flag timing; its note: {comment})"]
    return []


def race_facts(race: dict) -> dict:
    """The ingest.race_facts fields TUM can fill."""
    return {
        "totalLaps": int(race["nolaps"]),
        "eventName": None,
        "location": race["location"],
        "country": None,
        "date": race["date"],
    }


def provenance_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    return raw_dir / f"{race_id}.provenance.json"


def provenance(race: dict, mapping: dict[str, str], db_sha: str) -> dict:
    return {
        "source": "TUM f1-timing-database",
        "url": TUM_URL,
        "commit": TUM_COMMIT,
        "sha256": db_sha,
        "licence": TUM_LICENCE,
        "credit": TUM_CREDIT,
        "tumRaceId": int(race["id"]),
        "tumComment": race.get("comment") or None,
        "nominatedCompounds": race["availablecompounds"],
        "compoundMap": mapping,
        "lapsPlanned": int(race["nolapsplanned"]),
        "estimates": [
            "PitInTime is the in-lap's end; PitOutTime adds TUM's pit-lane time",
            "TrackStatus has SC/VSC only (TUM has no yellow or red flags)",
            "IsAccurate: every timed lap except lap 1 and pit in/out laps",
            "TyreLife of a top-10 starter's first set: TUM's default of 2 laps at the start",
            "Each retired car's unfinished lap ends at the fastest time anyone ran that lap",
        ],
        "notes": race_notes(race),
    }


def ingest_tum(
    race_id: str,
    db_path: Path = DEFAULT_DB,
    raw_dir: Path = RAW_DIR,
    location: str | None = None,
    verify: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Read a 2014-2019 race from TUM and write raw/<id>.parquet, .status.json and
    .provenance.json (credit and licence). Returns (laps, facts)."""
    year, loc = parse_race_id(race_id)
    con = connect(db_path, verify=verify)
    try:
        race = find_race(con, year, location or loc)
        df = laps_frame(con, race)
        status = track_status(con, race)
    finally:
        con.close()
    check_complete(df)

    path = raw_snapshot_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    track_status_path(race_id, raw_dir).write_text(
        json.dumps(status, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    prov = provenance(race, compound_map(race["availablecompounds"]), sha256(db_path))
    provenance_path(race_id, raw_dir).write_text(
        json.dumps(prov, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    return df, {**race_facts(race), "notes": prov["notes"], "credit": TUM_CREDIT}
