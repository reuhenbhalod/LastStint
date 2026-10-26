"""End-to-end race-model build (Phase 1.6/1.8 glue).

One canonical path from a committed lap snapshot to a validated race-model dict:
ingest snapshot -> clean -> fit (race-pace base pace) -> track params -> assemble. Used by
the tests, the golden-file generator, and the CLI so they never drift.
"""

from __future__ import annotations

import pandas as pd

from . import assemble, clean, fit, ingest, track

# Race registry: metadata that isn't derivable from the timing data.
RACES: dict[str, dict] = {
    "abu-dhabi-2021": {
        "year": 2021,
        "event": "Abu Dhabi",
        "name": "Abu Dhabi 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 34,
        "seed": 81723,
        "user_side": "HAM",
    },
    "spain-2021": {
        "year": 2021,
        "event": "Spain",
        "name": "Spain 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 20,
        "seed": 49123,
        "user_side": "VER",
    },
}


def build_race_model(race_id: str, laps: pd.DataFrame | None = None) -> tuple[dict, pd.DataFrame]:
    """Build a validated race-model dict for a registered race. Returns (model, laps)."""
    if race_id not in RACES:
        raise KeyError(f"unknown race '{race_id}'; known: {sorted(RACES)}")
    meta = RACES[race_id]
    if laps is None:
        laps = pd.read_parquet(ingest.raw_snapshot_path(race_id))

    clean_df, traffic_df, _ = clean.clean_laps(laps)
    pace_laps = pd.concat([clean_df, traffic_df])
    fitted = fit.fit_lap_model(clean_df, pace_laps=pace_laps, era=meta["era"])
    params = track.fit_track_params(laps, clean_df, traffic_df, fitted)

    model = assemble.assemble_race_model(
        race_id=race_id,
        laps=laps,
        clean_laps=clean_df,
        fit=fitted,
        track_params=params,
        name=meta["name"],
        era=meta["era"],
        takeover_lap=meta["takeover_lap"],
        seed=meta["seed"],
        user_side=meta["user_side"],
    )
    return model, laps
