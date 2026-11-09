"""Jolpica-F1 CSV dump ingest (eras build plan 2.2, simulator roadmap P1).

Jolpica (github.com/jolpica/jolpica-f1, the Ergast successor) publishes its whole database as
a CSV dump: lap times and positions from 1996, pit stops from 2011, and results, retirements
and standings for every year. This turns one race from the dump into the same raw snapshot
the FastF1 ingest writes (ingest.LAP_COLUMNS) plus its status JSON, so cleaning, fitting and
assembly run unchanged.

Licence: the data is CC BY-NC-SA 4.0 (Jolpica TERMS.md); the free dump is for non-commercial
use. Credit Jolpica, and race files built from it carry the same licence.

What Jolpica can't supply is left empty, never invented (step 2.4 estimates it later):
- Compound and TrackStatus: always empty; the status JSON is an empty timeline.
- Stint, TyreLife, PitInTime, PitOutTime: only where stops are known (Jolpica's from 2011,
  or stops passed in from another source). Without stops they are empty and IsAccurate is
  unknown (NA), since the in- and out-laps can't be told apart.
Each race's sidecar (<race-id>.jolpica.json) lists these gaps, the results, retirements,
standings, and every driver without a repo driver code.

Lap-end Time is the sum of the car's lap times from the start (seconds); only differences
matter downstream, as with OpenF1's session seconds. The dump is cached once under
pipeline/cache/eras-sources/jolpica/ (git-ignored) with its version in VERSION.txt.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from .f1db import OUT_DIR as F1DB_DIR
from .f1db import eras_cache_dir
from .ingest import LAP_COLUMNS, IncompleteDataError, raw_snapshot_path, track_status_path
from .paths import DATA_DIR, RAW_DIR, REPO_ROOT

DUMP_ROOT = REPO_ROOT / "pipeline" / "cache" / "eras-sources" / "jolpica"
DRIVERS_PATH = DATA_DIR / "drivers.json"
SOURCE = "jolpica"
RACE = "R"
Q3 = "Q3"  # the last qualifying segment (2006 on): its cars are the top-ten qualifiers
STOPS_FROM = 2011  # Jolpica has pit stops from this season on

# SessionEntry.status (jolpica/formula_one/models/session.py, SessionStatus).
STATUS = {
    0: "finished",
    1: "lapped",
    10: "accident",
    11: "retired",
    20: "disqualified",
    30: "did not start",
    40: "did not qualify",
    41: "did not prequalify",
}
FINISHED, LAPPED, DID_NOT_START = 0, 1, 30

ALWAYS_EMPTY = {
    "Compound": "not in Jolpica (estimated in step 2.4)",
    "TrackStatus": "not in Jolpica (SC laps estimated in step 2.4); status JSON is []",
}
NO_STOPS = {
    "Stint": "no stop data",
    "TyreLife": "no stop data",
    "PitInTime": "no stop data",
    "PitOutTime": "no stop data",
    "IsAccurate": "unknown without stops (in- and out-laps can't be told apart)",
}
WITH_STOPS = {
    "TyreLife": "laps since the last stop (age of the set when fitted is unknown)",
    "PitInTime": "the in-lap's end (the lane entry isn't timed)",
    "PitOutTime": "PitInTime + the stop's pit-lane time",
}


def latest_dump(root: Path | None = None) -> Path:
    """The newest extracted dump (csv-YYYY-MM-DD) under the cache: by default the shared Eras
    cache (f1db.eras_cache_dir, so a git worktree reads the main checkout's), else DUMP_ROOT."""
    if root is None:
        shared = eras_cache_dir() / "jolpica"
        root = shared if shared.is_dir() else DUMP_ROOT
    dumps = sorted(p for p in root.glob("csv-*") if p.is_dir())
    if not dumps:
        raise FileNotFoundError(
            f"no Jolpica CSV dump under {root}: download it from"
            " https://api.jolpi.ca/data/dumps/download/ and extract it to csv-<date>/"
        )
    return dumps[-1]


class Dump:
    """The dump's tables, each read on first use. Accepts name.csv or name.csv.gz."""

    def __init__(self, path: Path):
        self.path = Path(path)
        if not self.path.is_dir():
            raise FileNotFoundError(f"Jolpica dump directory not found: {self.path}")
        self._tables: dict[str, pd.DataFrame] = {}

    def __getitem__(self, name: str) -> pd.DataFrame:
        if name not in self._tables:
            stem = self.path / f"formula_one_{name}.csv"
            path = next((p for p in (stem, stem.with_suffix(".csv.gz")) if p.exists()), None)
            if path is None:
                raise FileNotFoundError(f"Jolpica table missing: {stem}")
            self._tables[name] = pd.read_csv(path, low_memory=False)
        return self._tables[name]


def _norm(text: str) -> str:
    plain = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", plain.lower()).strip()


def _seconds(values: pd.Series) -> pd.Series:
    """Jolpica durations ('01:45:26.4', '00:01:21.893') as float seconds; blanks stay NaN."""
    return pd.to_timedelta(values, errors="raise").dt.total_seconds()


@dataclass
class Race:
    session_id: int
    year: int
    round_number: int
    name: str
    date: str
    locality: str
    country: str
    scheduled_laps: int | None


def find_race(
    dump: Dump, year: int, event: str | None = None, round_number: int | None = None
) -> Race:
    """The race session for a year and an event (part of the round's name, or the circuit's
    country or town: 'Hungary', 'European', 'Abu Dhabi') or a round number."""
    season = dump["season"]
    seasons = season.loc[season["year"] == year, "id"]
    if seasons.empty:
        raise LookupError(f"no {year} season in the Jolpica dump")
    rounds = dump["round"]
    rounds = rounds[(rounds["season_id"] == seasons.iloc[0]) & (rounds["is_cancelled"] != "t")]
    circuits = dump["circuit"].set_index("id")
    rounds = rounds.assign(
        locality=rounds["circuit_id"].map(circuits["locality"]),
        country=rounds["circuit_id"].map(circuits["country"]),
    )
    if round_number is not None:
        found = rounds[rounds["number"] == round_number]
    elif event:
        # The round's name first ('Sakhir' is a Grand Prix and Bahrain's town), then the
        # circuit's country or town ('Hungary' for the Hungarian Grand Prix).
        want = _norm(event)
        found = rounds[rounds["name"].map(_norm).str.contains(want, regex=False)]
        if found.empty:
            found = rounds[
                (rounds["country"].map(_norm) == want) | (rounds["locality"].map(_norm) == want)
            ]
    else:
        raise ValueError("give an event or a round number")
    if len(found) != 1:
        listing = "; ".join(f"{int(r.number)} {r.name}" for r in rounds.itertuples())
        raise LookupError(
            f"{len(found)} {year} rounds match {event or round_number!r} (rounds: {listing})"
        )
    rnd = found.iloc[0]
    sessions = dump["session"]
    race = sessions[(sessions["round_id"] == rnd["id"]) & (sessions["type"] == RACE)]
    if len(race) != 1:
        raise LookupError(f"{len(race)} race sessions for {year} {rnd['name']}")
    s = race.iloc[0]
    return Race(
        session_id=int(s["id"]),
        year=year,
        round_number=int(rnd["number"]),
        name=str(rnd["name"]),
        date=str(rnd["date"]),
        locality=str(rnd["locality"]),
        country=str(rnd["country"]),
        scheduled_laps=int(s["scheduled_laps"]) if pd.notna(s["scheduled_laps"]) else None,
    )


def entries(dump: Dump, session_id: int) -> pd.DataFrame:
    """The race's entries with driver, team and result (one row per car)."""
    se = dump["sessionentry"]
    se = se[se["session_id"] == session_id]
    if se.empty:
        raise IncompleteDataError(f"no entries for Jolpica session {session_id}")
    round_entry = dump["roundentry"].set_index("id")
    team_driver = dump["teamdriver"].set_index("id")
    drivers = dump["driver"].set_index("id")
    teams = dump["team"].set_index("id")
    td = se["round_entry_id"].map(round_entry["team_driver_id"])
    driver_id = td.map(team_driver["driver_id"])
    return pd.DataFrame(
        {
            "entry_id": se["id"].astype(int),
            "round_entry_id": se["round_entry_id"].astype(int),
            "driver_id": driver_id.astype(int),
            "reference": driver_id.map(drivers["reference"]),
            "forename": driver_id.map(drivers["forename"]),
            "surname": driver_id.map(drivers["surname"]),
            "abbreviation": driver_id.map(drivers["abbreviation"]),
            "team": td.map(team_driver["team_id"]).map(teams["name"]),
            "number": se["round_entry_id"].map(round_entry["car_number"]),
            "grid": se["grid"],
            "position": se["position"],
            "classified": se["is_classified"] == "t",
            "status": se["status"].astype("Int64"),
            "detail": se["detail"],
            "laps": se["laps_completed"],
            "time": _seconds(se["time"]),
            "points": se["points"],
        }
    ).reset_index(drop=True)


@dataclass
class Codes:
    """Each entry's Driver value, and how it was found."""

    by_entry: dict[int, str]
    from_jolpica: list[dict] = field(default_factory=list)  # not in drivers.json yet
    no_code: list[dict] = field(default_factory=list)  # no usable code: the reference is used


def repo_codes(path: Path = DRIVERS_PATH) -> dict[str, str]:
    """data/drivers.json as {normalized full name: code}."""
    drivers = json.loads(path.read_text())["drivers"]
    return {_norm(d["name"]): code for code, d in drivers.items()}


def driver_codes(ents: pd.DataFrame, known: dict[str, str]) -> Codes:
    """Map each driver to the repo's 3-letter code (data/drivers.json, by full name). A driver
    not listed takes Jolpica's own code when it clashes with no one; one with no code, or a
    clashing one (Michael Schumacher's MSC is Mick's in the repo), keeps the Jolpica reference
    (e.g. 'hakkinen') and is reported, never given a made-up code."""
    by_name = {frozenset(name.split()): code for name, code in known.items()}
    taken = set(known.values())
    codes = Codes(by_entry={})
    pending = []
    for e in ents.itertuples():
        full = frozenset(_norm(f"{e.forename} {e.surname}").split())
        code = by_name.get(full)
        if code:
            codes.by_entry[e.entry_id] = code
        else:
            pending.append(e)
    used = set(codes.by_entry.values())
    for e in pending:
        name = f"{e.forename} {e.surname}"
        abbr = str(e.abbreviation).upper() if pd.notna(e.abbreviation) else None
        if abbr and len(abbr) == 3 and abbr not in taken and abbr not in used:
            codes.by_entry[e.entry_id] = abbr
            used.add(abbr)
            codes.from_jolpica.append({"name": name, "code": abbr})
        else:
            codes.by_entry[e.entry_id] = str(e.reference)
            reason = f"Jolpica code {abbr} is already another driver's" if abbr else "no code"
            codes.no_code.append({"name": name, "reference": str(e.reference), "why": reason})
    return codes


def jolpica_stops(dump: Dump, ents: pd.DataFrame, codes: Codes) -> pd.DataFrame:
    """The race's pit stops: [Driver, Lap (the in-lap), Number, Duration (pit-lane s)]."""
    stops = dump["pitstop"]
    stops = stops[stops["session_entry_id"].isin(ents["entry_id"])]
    lap_number = dump["lap"].set_index("id")["number"]
    return pd.DataFrame(
        {
            "Driver": stops["session_entry_id"].map(codes.by_entry),
            "Lap": stops["lap_id"].map(lap_number).astype(int),
            "Number": stops["number"].astype(int),
            "Duration": _seconds(stops["duration"]),
        }
    ).reset_index(drop=True)


def f1db_stops(race_id: str, f1db_dir: Path = F1DB_DIR) -> pd.DataFrame | None:
    """A race's F1DB stops (data/raw/f1db/<race-id>.stops.csv, step 2.3) as the `stops` load
    takes: [Number (car number), Lap (in-lap), Duration (pit-lane s)]. None without a file.

    Keyed by car number, not by code: F1DB's codes (BAR for Barrichello) aren't the repo's.
    """
    path = Path(f1db_dir) / f"{race_id}.stops.csv"
    if not path.exists():
        return None
    raw = pd.read_csv(path, dtype={"number": str})
    return pd.DataFrame(
        {
            "Number": raw["number"].astype(str),
            "Lap": raw["lap"].astype(int),
            "Duration": raw["lane_time"].astype(float),
        }
    )


def stops_by_code(stops: pd.DataFrame, ents: pd.DataFrame, codes: Codes) -> pd.DataFrame:
    """Stops keyed by car number ([Number, Lap, Duration]) re-keyed to the race's driver codes
    ([Driver, Lap, Duration]). A number no entry carries is an error, never dropped."""
    by_number = {
        str(int(n)) if isinstance(n, float) else str(n): codes.by_entry[e]
        for n, e in zip(ents["number"], ents["entry_id"], strict=True)
        if pd.notna(n)
    }
    numbers = stops["Number"].astype(str)
    unknown = sorted(set(numbers) - set(by_number))
    if unknown:
        raise IncompleteDataError(f"stops for car numbers no entry has: {unknown}")
    return pd.DataFrame(
        {"Driver": numbers.map(by_number), "Lap": stops["Lap"], "Duration": stops["Duration"]}
    ).reset_index(drop=True)


def laps_frame(
    dump: Dump, ents: pd.DataFrame, codes: Codes, stops: pd.DataFrame | None
) -> tuple[pd.DataFrame, list[str]]:
    """The race's laps in the raw snapshot's shape (ingest.LAP_COLUMNS), and any timing gaps.

    `stops` ([Driver, Lap, Duration]) fills Stint, TyreLife, the pit times and IsAccurate;
    None leaves them empty (unknown), as before 2011.
    """
    laps = dump["lap"]
    laps = laps[laps["session_entry_id"].isin(ents["entry_id"]) & laps["number"].notna()]
    laps = laps[laps["is_deleted"] != "t"]
    team = dict(zip(ents["entry_id"], ents["team"], strict=True))
    stop_laps: dict[str, dict[int, float]] = {}
    if stops is not None:
        for s in stops.itertuples():
            stop_laps.setdefault(s.Driver, {})[int(s.Lap)] = s.Duration
    gaps: list[str] = []
    rows = []
    for entry_id, mine in laps.groupby("session_entry_id"):
        code = codes.by_entry[int(entry_id)]
        mine = mine.sort_values("number")
        numbers = mine["number"].astype(int).tolist()
        if numbers != list(range(1, len(numbers) + 1)):
            gaps.append(f"{code}: lap numbers not 1..{len(numbers)}")
        lap_times = _seconds(mine["time"]).tolist()
        mine_stops = stop_laps.get(code, {})
        elapsed: float | None = 0.0
        stint, stint_start = 1, 1
        for i, (n, lap_time, pos) in enumerate(
            zip(numbers, lap_times, mine["position"], strict=True)
        ):
            if elapsed is not None and (pd.isna(lap_time) or n != i + 1):
                gaps.append(f"{code}: lap {n} untimed or out of sequence; later Times unknown")
                elapsed = None
            if elapsed is not None:
                elapsed = round(elapsed + lap_time, 3)
            known = stops is not None
            pit_in = elapsed if known and n in mine_stops else None
            out_of = mine_stops.get(n - 1) if known and (n - 1) in mine_stops else None
            if known and (n - 1) in mine_stops:
                stint, stint_start = stint + 1, n
            pit_out = None
            if out_of is not None and pd.notna(out_of) and rows and rows[-1]["Time"] is not None:
                pit_out = round(rows[-1]["Time"] + out_of, 3)
            rows.append(
                {
                    "Driver": code,
                    "Team": team[int(entry_id)],
                    "LapNumber": float(n),
                    "LapTime": None if pd.isna(lap_time) else float(lap_time),
                    "Time": elapsed,
                    "Compound": None,
                    "TyreLife": float(n - stint_start + 1) if known else None,
                    "Stint": float(stint) if known else None,
                    "PitInTime": pit_in,
                    "PitOutTime": pit_out,
                    "TrackStatus": None,
                    "Position": float(pos) if pd.notna(pos) else None,
                    # As FastF1 marks them: lap 1, in- and out-laps aren't accurate.
                    "IsAccurate": (
                        n > 1 and n not in mine_stops and (n - 1) not in mine_stops
                        if known
                        else pd.NA
                    ),
                }
            )
    if not rows:
        raise IncompleteDataError("no lap times in the Jolpica dump for this race")
    # A car out on the opening lap has no laps in Jolpica. It gets lap 1 untimed, ending at
    # the start (Time 0), as openf1.py times a stopped car's last lap at its start, so the
    # pipeline sees the retirement (events.retirement_events).
    timed = set(laps["session_entry_id"].astype(int))
    for e in ents.itertuples():
        started = pd.notna(e.status) and int(e.status) not in (FINISHED, LAPPED)
        if started and int(e.status) < DID_NOT_START and e.entry_id not in timed:
            rows.append(
                {
                    **dict.fromkeys(LAP_COLUMNS),
                    "Driver": codes.by_entry[e.entry_id],
                    "Team": e.team,
                    "LapNumber": 1.0,
                    "Time": 0.0,
                    "Stint": 1.0 if stops is not None else None,
                    "TyreLife": 1.0 if stops is not None else None,
                    "IsAccurate": False if stops is not None else pd.NA,
                }
            )
    df = pd.DataFrame(rows, columns=LAP_COLUMNS)
    # Plain bool, as FastF1's, when every lap is known; nullable when not.
    accurate = df["IsAccurate"].astype("boolean")
    df["IsAccurate"] = accurate.astype(bool) if accurate.notna().all() else accurate
    for col in ("LapNumber", "LapTime", "Time", "TyreLife", "Stint", "PitInTime", "PitOutTime"):
        df[col] = df[col].astype("float64")
    df["Position"] = df["Position"].astype("float64")
    return df.sort_values(["LapNumber", "Time"]).reset_index(drop=True), gaps


def results(ents: pd.DataFrame, codes: Codes) -> list[dict]:
    """The classification: grid, finishing position, status, laps, race time, points."""
    out = []
    for e in ents.sort_values(["position", "grid"], na_position="last").itertuples():
        out.append(
            {
                "driver": codes.by_entry[e.entry_id],
                "name": f"{e.forename} {e.surname}",
                "team": e.team,
                "number": int(e.number) if pd.notna(e.number) else None,
                "grid": int(e.grid) if pd.notna(e.grid) else None,
                "position": int(e.position) if pd.notna(e.position) else None,
                "classified": bool(e.classified),
                "status": STATUS.get(int(e.status), str(e.status)) if pd.notna(e.status) else None,
                "detail": e.detail if pd.notna(e.detail) else None,
                "laps": int(e.laps) if pd.notna(e.laps) else None,
                "time": float(e.time) if pd.notna(e.time) else None,
                "points": float(e.points) if pd.notna(e.points) else None,
            }
        )
    return out


def retirements(ents: pd.DataFrame, codes: Codes) -> list[dict]:
    """Cars that started and didn't finish (or were disqualified): laps done and the reason."""
    out = []
    for e in ents.itertuples():
        if (
            pd.isna(e.status)
            or int(e.status) in (FINISHED, LAPPED)
            or int(e.status) >= DID_NOT_START
        ):
            continue
        out.append(
            {
                "driver": codes.by_entry[e.entry_id],
                "laps": int(e.laps) if pd.notna(e.laps) else None,
                "status": STATUS.get(int(e.status), str(e.status)),
                "detail": e.detail if pd.notna(e.detail) else None,
            }
        )
    return sorted(out, key=lambda r: (r["laps"] is None, r["laps"]), reverse=True)


def standings(dump: Dump, race: Race, ents: pd.DataFrame, codes: Codes) -> dict:
    """Both championships as they stood after this race."""
    by_driver = dict(zip(ents["driver_id"], ents["entry_id"], strict=True))
    names = dump["driver"].set_index("id")
    dc = dump["driverchampionship"]
    dc = dc[dc["session_id"] == race.session_id].sort_values("position")
    drivers = []
    for r in dc.itertuples():
        entry = by_driver.get(r.driver_id)
        drivers.append(
            {
                "position": int(r.position) if pd.notna(r.position) else None,
                "driver": codes.by_entry[entry] if entry is not None else None,
                "name": f"{names.at[r.driver_id, 'forename']} {names.at[r.driver_id, 'surname']}",
                "points": float(r.points),
                "wins": int(r.win_count),
            }
        )
    teams_by_id = dump["team"].set_index("id")["name"]
    tc = dump["teamchampionship"]
    tc = tc[tc["session_id"] == race.session_id].sort_values("position")
    teams = [
        {
            "position": int(r.position) if pd.notna(r.position) else None,
            "team": teams_by_id.get(r.team_id),
            "points": float(r.points),
            "wins": int(r.win_count),
        }
        for r in tc.itertuples()
    ]
    return {"drivers": drivers, "teams": teams}


def q3_classification(
    dump: Dump, race: Race, ents: pd.DataFrame, codes: Codes
) -> list[dict] | None:
    """The cars in the round's Q3 session, in its order ({driver, position}); None when the
    round has no Q3 (qualifying before 2006, or a dump cut without it). Jolpica lists a Q3
    car only if it set a time there: the cars a Q3 tyre rule binds (estimates.py)."""
    sessions = dump["session"]
    round_id = sessions.loc[sessions["id"] == race.session_id, "round_id"]
    q3 = sessions[(sessions["round_id"] == round_id.iloc[0]) & (sessions["type"] == Q3)]
    if q3.empty:
        return None
    se = dump["sessionentry"]
    rows = se[se["session_id"] == int(q3["id"].iloc[0])].sort_values("position")
    by_round_entry = dict(zip(ents["round_entry_id"], ents["entry_id"], strict=True))
    out = []
    for r in rows.itertuples():
        entry = by_round_entry.get(int(r.round_entry_id))
        if entry is None:
            raise IncompleteDataError(
                f"Q3 entry {r.round_entry_id} of {race.year} {race.name} has no race entry"
            )
        out.append(
            {
                "driver": codes.by_entry[entry],
                "position": int(r.position) if pd.notna(r.position) else None,
            }
        )
    return out


def race_time_check(df: pd.DataFrame, result: list[dict]) -> list[dict]:
    """Each lead-lap finisher's summed lap times against the official race time."""
    winner_laps = max((r["laps"] or 0) for r in result if r["position"] == 1)
    out = []
    for r in result:
        if r["status"] != "finished" or r["laps"] != winner_laps or r["time"] is None:
            continue
        mine = df[df["Driver"] == r["driver"]]
        summed = float(mine["LapTime"].sum()) if mine["LapTime"].notna().all() else None
        out.append(
            {
                "driver": r["driver"],
                "position": r["position"],
                "official": r["time"],
                "summed": round(summed, 3) if summed is not None else None,
                "diff": round(summed - r["time"], 3) if summed is not None else None,
            }
        )
    return out


def sidecar_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    return raw_dir / f"{race_id}.jolpica.json"


def dump_version(dump_dir: Path) -> str:
    """The dump's VERSION.txt (upload time and hash), or the folder name without one."""
    version = dump_dir.parent / "VERSION.txt"
    for line in version.read_text().splitlines() if version.exists() else []:
        if line.startswith("uploaded_at:"):
            return line.split(":", 1)[1].strip()
    return dump_dir.name


@dataclass
class Ingested:
    laps: pd.DataFrame
    facts: dict
    sidecar: dict


def load(
    year: int,
    event: str | None = None,
    round_number: int | None = None,
    dump_dir: Path | None = None,
    stops: pd.DataFrame | None = None,
    drivers_path: Path = DRIVERS_PATH,
    stops_source: str = "given",
) -> Ingested:
    """Read a race from the dump (no writes). `stops` overrides Jolpica's own (for races
    before 2011, from F1DB: f1db_stops): [Driver or Number (car number), Lap (in-lap),
    Duration (s)]. `stops_source` names where they came from in the sidecar."""
    dump_dir = Path(dump_dir) if dump_dir else latest_dump()
    dump = Dump(dump_dir)
    race = find_race(dump, year, event, round_number)
    ents = entries(dump, race.session_id)
    codes = driver_codes(ents, repo_codes(drivers_path))
    stop_source = stops_source
    if stops is not None and "Driver" not in stops and "Number" in stops:
        stops = stops_by_code(stops, ents, codes)
    if stops is None and year >= STOPS_FROM:
        stops = jolpica_stops(dump, ents, codes)
        stop_source = SOURCE
        if stops.empty:
            raise IncompleteDataError(f"no Jolpica pit stops for {year} {race.name}")
    elif stops is None:
        stop_source = None
    df, gaps = laps_frame(dump, ents, codes, stops)
    result = results(ents, codes)
    winner = next((r for r in result if r["position"] == 1), None)
    if winner is None or not winner["laps"]:
        raise IncompleteDataError(f"no winner in the Jolpica results for {year} {race.name}")
    for r in result:
        done = int(((df["Driver"] == r["driver"]) & df["LapTime"].notna()).sum())
        if r["laps"] is not None and done != r["laps"]:
            gaps.append(f"{r['driver']}: {done} laps timed, {r['laps']} completed")
    facts = {
        "totalLaps": int(winner["laps"]),
        "eventName": race.name,
        "location": race.locality,
        "country": race.country,
        "date": race.date,
    }
    missing = {**ALWAYS_EMPTY, **(WITH_STOPS if stops is not None else NO_STOPS)}
    sidecar = {
        "source": SOURCE,
        "licence": "CC BY-NC-SA 4.0 (Jolpica-F1)",
        "dump": dump_version(dump_dir),
        "year": year,
        "round": race.round_number,
        "scheduledLaps": race.scheduled_laps,
        "stops": stop_source,
        "missing": missing,
        "timingGaps": gaps,
        "driversFromJolpica": codes.from_jolpica,
        "driversWithoutCode": codes.no_code,
        "results": result,
        "retirements": retirements(ents, codes),
        "standings": standings(dump, race, ents, codes),
        "q3": q3_classification(dump, race, ents, codes),
        "raceTimeCheck": race_time_check(df, result),
    }
    return Ingested(laps=df, facts=facts, sidecar=sidecar)


def ingest_jolpica(
    race_id: str,
    year: int,
    event: str | None = None,
    round_number: int | None = None,
    dump_dir: Path | None = None,
    raw_dir: Path = RAW_DIR,
    stops: pd.DataFrame | None = None,
    drivers_path: Path = DRIVERS_PATH,
    stops_source: str = "given",
    estimate: bool = False,
    estimates_dir: Path | None = None,
) -> Ingested:
    """Read a race from the dump and write its raw parquet, status JSON and sidecar into
    raw_dir. Without `estimate` the status JSON is empty (Jolpica has no track status) and
    Compound / TrackStatus stay empty. With it (step 2.4, estimates.py) they're estimated,
    the status timeline is the estimated SC periods, the sidecar gets an "estimates" block,
    and the SC hand-check file is written (and its checked periods honoured) in
    estimates_dir (default data/estimates/)."""
    from . import estimates

    got = load(year, event, round_number, dump_dir, stops, drivers_path, stops_source)
    status: list[dict] = []
    if estimate:
        checks_dir = Path(estimates_dir) if estimates_dir else estimates.ESTIMATES_DIR
        est = estimates.estimate_race(
            race_id,
            got.laps,
            year,
            sidecar=got.sidecar,
            hand_checks=estimates.load_hand_checks(race_id, checks_dir),
        )
        got.laps, status = est.laps, est.status or []
        got.sidecar["estimates"] = est.block
        if "safetyCars" in est.block["estimated"]:
            path = estimates.write_hand_checks(race_id, est.periods, checks_dir)
            shown = path.resolve()
            est.block["safetyCars"]["handCheck"] = str(
                shown.relative_to(REPO_ROOT) if shown.is_relative_to(REPO_ROOT) else shown
            )
    path = raw_snapshot_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    got.laps.to_parquet(path)
    track_status_path(race_id, raw_dir).write_text(
        json.dumps(status, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    sidecar_path(race_id, raw_dir).write_text(
        json.dumps(got.sidecar, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    return got
