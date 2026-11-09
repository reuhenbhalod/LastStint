"""FastF1 loading and local caching (Phase 1.1).

Enables the FastF1 cache so each race downloads once, loads the race session with laps,
weather and messages (no car telemetry), projects to the columns we need, coerces lap/pit
times to seconds, and saves a raw parquet snapshot so later steps never re-download.

Heavy imports (fastf1) are done inside functions so `import pipeline` stays light.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

import pandas as pd

from .paths import CACHE_DIR, PIPELINE_ENV, RAW_DIR

# Columns we keep per lap (Implementation Plan 1.1).
LAP_COLUMNS = [
    "Driver",
    "Team",
    "LapNumber",
    "LapTime",
    "Time",  # session time at lap end — used to compute gap to the car ahead
    "Compound",
    "TyreLife",
    "Stint",
    "PitInTime",
    "PitOutTime",
    "TrackStatus",
    "Position",
    "IsAccurate",
]

# FastF1 gives these as timedeltas; we store seconds (float) for the model.
_TIMEDELTA_COLUMNS = ("LapTime", "Time", "PitInTime", "PitOutTime")


def load_credentials(env_path: Path = PIPELINE_ENV) -> bool:
    """Load F1_USERNAME / F1_PASSWORD from the git-ignored pipeline/.env into the environment
    (FastF1 reads them there to log in for years outside the open archive). Existing env vars
    win. Returns whether a username is now set; never logs the values.
    """
    from dotenv import load_dotenv

    if env_path.exists():
        load_dotenv(env_path, override=False)
    return bool(os.environ.get("F1_USERNAME"))


def enable_cache(cache_dir: Path = CACHE_DIR) -> None:
    """Enable the FastF1 on-disk cache (and load F1 account credentials if present)."""
    import fastf1

    load_credentials()

    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))


def default_race_id(year: int, event: str) -> str:
    """Slug for a race, e.g. (2021, 'Abu Dhabi') -> 'abu-dhabi-2021'."""
    slug = re.sub(r"[^a-z0-9]+", "-", event.strip().lower()).strip("-")
    return f"{slug}-{year}"


def raw_snapshot_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    """Path to the raw parquet snapshot for a race."""
    return raw_dir / f"{race_id}.parquet"


def track_status_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    """Path to the race's track-status timeline (session seconds, status code)."""
    return raw_dir / f"{race_id}.status.json"


def project_track_status(track_status: pd.DataFrame) -> list[dict]:
    """FastF1 `session.track_status` as [{time (session s), status}]: the exact moments SCs,
    VSCs and red flags were deployed, which the per-lap TrackStatus can't place."""
    return [
        {"time": round(r.Time.total_seconds(), 3), "status": str(r.Status)}
        for r in track_status.itertuples()
    ]


def save_track_status(race_id: str, session, raw_dir: Path = RAW_DIR) -> Path:
    path = track_status_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(project_track_status(session.track_status), indent=1) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return path


def load_track_status(race_id: str, raw_dir: Path = RAW_DIR) -> list[dict] | None:
    path = track_status_path(race_id, raw_dir)
    return json.loads(path.read_text()) if path.exists() else None


def weather_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    """Path to the race's weather by the minute (weather spec): [{time, rain, track, air}]."""
    return raw_dir / f"{race_id}.weather.json"


def project_weather(weather: pd.DataFrame) -> list[dict]:
    """FastF1 `session.weather_data` as [{time (session s), rain, track, air}]."""
    return [
        {
            "time": round(pd.Timedelta(r.Time).total_seconds(), 3),
            "rain": bool(r.Rainfall),
            "track": float(r.TrackTemp),
            "air": float(r.AirTemp),
        }
        for r in weather.itertuples()
    ]


def save_weather(race_id: str, weather: list[dict], raw_dir: Path = RAW_DIR) -> Path:
    path = weather_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(weather, indent=1) + "\n", encoding="utf-8", newline="\n")
    return path


def load_weather(race_id: str, raw_dir: Path = RAW_DIR) -> list[dict] | None:
    path = weather_path(race_id, raw_dir)
    return json.loads(path.read_text()) if path.exists() else None


def load_race(year: int, event: str, cache_dir: Path = CACHE_DIR, offline: bool = False):
    """Load a race session (laps + weather + messages, no telemetry). `offline`: from the
    on-disk cache only, never the network (FastF1's archive needs an F1TV login since Oct
    2026); weather or race control the cache doesn't hold stay unloaded (`loaded`)."""
    import fastf1

    enable_cache(cache_dir)
    if offline:
        fastf1.Cache.offline_mode(True)
    session = fastf1.get_session(year, event, "R")
    session.load(laps=True, telemetry=False, weather=True, messages=True)
    return session


def loaded(session, name: str):
    """A session's `name` data (race_control_messages, weather_data), or None if FastF1
    didn't load it (an offline cache without it), rather than FastF1's DataNotLoadedError."""
    from fastf1.exceptions import DataNotLoadedError

    try:
        return getattr(session, name, None)
    except DataNotLoadedError:
        return None


def project_laps(laps: pd.DataFrame) -> pd.DataFrame:
    """Project to LAP_COLUMNS and coerce timedelta columns to seconds.

    Pure transform on a FastF1-style laps frame — no network, so it is unit-testable.
    """
    cols = [c for c in LAP_COLUMNS if c in laps.columns]
    df = laps.loc[:, cols].copy()
    for col in _TIMEDELTA_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_timedelta(df[col]).dt.total_seconds()
    return df.reset_index(drop=True)


# 2018 compound names, softest first. From 2019 Pirelli labels each race's three dry
# compounds SOFT/MEDIUM/HARD relative to each other; relabel_2018_compounds does the same.
COMPOUNDS_2018 = ["HYPERSOFT", "ULTRASOFT", "SUPERSOFT", "SOFT", "MEDIUM", "HARD", "SUPERHARD"]
WET_COMPOUNDS = {"INTERMEDIATE", "WET"}


def relabel_2018_compounds(df: pd.DataFrame) -> pd.DataFrame:
    """Map a 2018 race's dry compounds onto relative SOFT/MEDIUM/HARD by softness rank."""
    used = [c for c in COMPOUNDS_2018 if c in set(df["Compound"].dropna().astype(str))]
    if not used:
        return df
    if len(used) > 3:
        raise IncompleteDataError(f"more than three dry compounds used: {used}")
    # With only two of the three nominated compounds used, the unused one is unknown; the
    # common case is that the hardest went unused, so the pair maps to SOFT/MEDIUM.
    mapping = dict(zip(used, ["SOFT", "MEDIUM", "HARD"][: len(used)], strict=True))
    return df.assign(Compound=df["Compound"].map(lambda c: mapping.get(c, c)))


# The red-flag code in the track-status timeline and the per-lap TrackStatus (FastF1's; OpenF1
# race control is mapped onto the same codes). Red-flag races are modelled since eras build
# plan 4.3 (redflag.py).
RED_FLAG = "5"


def race_suitability(df: pd.DataFrame) -> list[str]:
    """Reasons a race can't be modelled yet (spec D8). None today: wet races are modelled
    since the weather spec, red flags since eras build plan 4.3 (redflag.py)."""
    return []


def has_red_flag(df: pd.DataFrame) -> bool:
    """True if any lap ran under a red flag."""
    return bool(df["TrackStatus"].astype(str).str.contains(RED_FLAG).any())


def save_red_flags(
    race_id: str, messages: list[dict], origin: str, raw_dir: Path = RAW_DIR
) -> Path | None:
    """Write data/raw/<race-id>.redflags.json: each red flag's restart, from race control's
    messages (redflag.py). Nothing for a race without a red flag or a word on its restart."""
    from . import redflag

    entries = redflag.restarts_from_messages(messages, origin)
    return redflag.write_entries(race_id, entries, raw_dir) if entries else None


def race_facts(session) -> dict:
    """Race-level facts captured at ingest: total laps, event name, location, date."""
    laps = session.laps
    event = session.event

    def _ev(key: str):
        try:
            return str(event[key])
        except (KeyError, TypeError):
            return None

    total_laps = int(pd.to_numeric(laps["LapNumber"], errors="coerce").max())
    return {
        "totalLaps": total_laps,
        "eventName": _ev("EventName"),
        "location": _ev("Location"),
        "country": _ev("Country"),
        "date": str(getattr(session, "date", None)),
    }


class IncompleteDataError(RuntimeError):
    """FastF1 returned laps but not the timing a race model needs (it can 'succeed' while
    missing track status or positions, e.g. when rate-limited or unauthenticated)."""


def check_complete(df: pd.DataFrame) -> None:
    """Raise IncompleteDataError unless every column the pipeline depends on is populated."""
    if df.empty:
        raise IncompleteDataError("no laps")
    for col in ("TrackStatus", "Position", "LapTime", "Time", "Compound"):
        share = float(df[col].notna().mean())
        if share < 0.8:
            raise IncompleteDataError(f"{col} only {share:.0%} populated")


RATE_LIMIT_WAITS = (60, 300, 900)  # seconds to back off before each retry


def ingest_race(
    race_id: str,
    year: int,
    event: str,
    cache_dir: Path = CACHE_DIR,
    raw_dir: Path = RAW_DIR,
    sleep=time.sleep,
    offline: bool = False,
) -> tuple[pd.DataFrame, dict]:
    """Load a race, project laps, save the raw parquet snapshot. Returns (laps, facts).

    Retries with backoff when FastF1 rate-limits (RATE_LIMIT_WAITS); the on-disk cache means
    a retry only fetches what is still missing. Refuses to write an incomplete snapshot.
    `offline`: read the FastF1 cache only (load_race); a race whose cache has no race control
    or weather is written without its red-flag or weather file (a hand-entered red-flag file
    and `pipeline wet-laps` cover those).
    """
    from fastf1.req import RateLimitExceededError

    for attempt in range(len(RATE_LIMIT_WAITS) + 1):
        try:
            session = (
                load_race(year, event, cache_dir, offline=True)
                if offline
                else load_race(year, event, cache_dir)
            )
            break
        except RateLimitExceededError:
            if attempt == len(RATE_LIMIT_WAITS):
                raise
            sleep(RATE_LIMIT_WAITS[attempt])
    df = project_laps(session.laps)
    if year == 2018:
        df = relabel_2018_compounds(df)
    check_complete(df)
    facts = race_facts(session)

    path = raw_snapshot_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    save_track_status(race_id, session, raw_dir)
    messages = loaded(session, "race_control_messages")
    if has_red_flag(df) and messages is not None and len(messages):
        from .redflag import fastf1_messages

        save_red_flags(race_id, fastf1_messages(messages), "FastF1", raw_dir)
    weather = loaded(session, "weather_data")
    if weather is not None and len(weather):
        save_weather(race_id, project_weather(weather), raw_dir)
    return df, facts


def ingest_openf1(
    race_id: str, year: int, country: str, cache_dir: Path = CACHE_DIR, raw_dir: Path = RAW_DIR
) -> tuple[pd.DataFrame, dict]:
    """Load a race from OpenF1 (openf1.py) and save the same raw snapshot, track status and
    weather as the FastF1 ingest."""
    import urllib.parse
    import urllib.request

    from . import openf1

    query = urllib.parse.urlencode({"year": year, "session_name": "Race", "country_name": country})
    with urllib.request.urlopen(f"{openf1.API}/sessions?{query}", timeout=60) as r:
        sessions = json.load(r)
    if len(sessions) != 1:
        raise IncompleteDataError(f"{len(sessions)} OpenF1 race sessions for {year} {country}")
    raw = openf1.fetch(int(sessions[0]["session_key"]), cache_dir)
    df = openf1.laps_frame(raw)
    check_complete(df)
    path = raw_snapshot_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    status = track_status_path(race_id, raw_dir)
    status.write_text(
        json.dumps(openf1.track_status(raw), indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    save_weather(race_id, openf1.weather(raw), raw_dir)
    if has_red_flag(df):
        save_red_flags(race_id, raw["race_control"], "OpenF1", raw_dir)
    return df, openf1.race_facts(raw, df)
