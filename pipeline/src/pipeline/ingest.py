"""FastF1 loading and local caching.

Enables the FastF1 cache so each race downloads once, loads the race session with laps,
weather and messages, keeps the columns we need per lap, and saves a raw parquet snapshot
so later steps never re-download.
"""

from __future__ import annotations

from pathlib import Path

CACHE_DIR = Path("cache")

# Columns we keep per lap (see Implementation Plan 1.1).
LAP_COLUMNS = [
    "Driver",
    "Team",
    "LapNumber",
    "LapTime",
    "Compound",
    "TyreLife",
    "Stint",
    "PitInTime",
    "PitOutTime",
    "TrackStatus",
    "Position",
    "IsAccurate",
]


def enable_cache(cache_dir: Path = CACHE_DIR) -> None:
    """Enable the FastF1 on-disk cache."""
    import fastf1

    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))


def load_race(year: int, event: str):
    """Load a race session (laps + weather + messages). Returns the FastF1 session."""
    raise NotImplementedError("Phase 1.1: load the FastF1 race session")


def raw_snapshot_path(race_id: str) -> Path:
    """Path to the raw parquet snapshot for a race."""
    return Path("data") / "raw" / f"{race_id}.parquet"
