"""FastF1 loading and local caching (Phase 1.1).

Enables the FastF1 cache so each race downloads once, loads the race session with laps,
weather and messages (no car telemetry), projects to the columns we need, coerces lap/pit
times to seconds, and saves a raw parquet snapshot so later steps never re-download.

Heavy imports (fastf1) are done inside functions so `import pipeline` stays light.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from .paths import CACHE_DIR, RAW_DIR

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


def enable_cache(cache_dir: Path = CACHE_DIR) -> None:
    """Enable the FastF1 on-disk cache."""
    import fastf1

    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))


def default_race_id(year: int, event: str) -> str:
    """Slug for a race, e.g. (2021, 'Abu Dhabi') -> 'abu-dhabi-2021'."""
    slug = re.sub(r"[^a-z0-9]+", "-", event.strip().lower()).strip("-")
    return f"{slug}-{year}"


def raw_snapshot_path(race_id: str, raw_dir: Path = RAW_DIR) -> Path:
    """Path to the raw parquet snapshot for a race."""
    return raw_dir / f"{race_id}.parquet"


def load_race(year: int, event: str, cache_dir: Path = CACHE_DIR):
    """Load a race session (laps + weather + messages, no telemetry)."""
    import fastf1

    enable_cache(cache_dir)
    session = fastf1.get_session(year, event, "R")
    session.load(laps=True, telemetry=False, weather=True, messages=True)
    return session


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


def ingest_race(
    race_id: str,
    year: int,
    event: str,
    cache_dir: Path = CACHE_DIR,
    raw_dir: Path = RAW_DIR,
) -> tuple[pd.DataFrame, dict]:
    """Load a race, project laps, save the raw parquet snapshot. Returns (laps, facts)."""
    session = load_race(year, event, cache_dir)
    df = project_laps(session.laps)
    facts = race_facts(session)

    path = raw_snapshot_path(race_id, raw_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    return df, facts
