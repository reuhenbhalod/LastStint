"""End-to-end race-model build (Phase 1.6/1.8 glue).

One canonical path from a committed lap snapshot to a validated race-model dict:
ingest snapshot -> clean -> fit (race-pace base pace) -> track params -> assemble. Used by
the tests, the golden-file generator, and the CLI so they never drift.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from . import assemble, clean, events, fit, ingest, scenario, track

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
        "rival": "VER",
        # P7 and back were decided by race control (only the lapped cars between HAM and
        # VER unlapped before the restart), a frozen event the sim can't reproduce.
        "score_positions": 6,
    },
    "spain-2021": {
        "year": 2021,
        "event": "Spain",
        "name": "Spain 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 20,
        "seed": 49123,
        "user_side": "VER",
        "rival": "HAM",
        "score_positions": 6,
    },
    "bahrain-2021": {
        "year": 2021,
        "event": "Bahrain",
        "name": "Bahrain 2021: Verstappen vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": 10,  # D3 rule
        "seed": 86636,
        "user_side": "VER",
        "rival": "HAM",
        "score_positions": 6,
        "dilemma": "Chase on fresher tyres vs Mercedes' undercut (0.7s finish)",
    },
    "france-2021": {
        "year": 2021,
        "event": "France",
        "name": "France 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 15,  # D3 rule
        "seed": 97680,
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "Cover Red Bull's second stop or stay on one stop",
    },
    "usa-2021": {
        "year": 2021,
        "event": "United States",
        "name": "USA 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 10,  # D3 rule
        "seed": 96860,
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "Undercut war; Mercedes went long",
    },
    "brazil-2021": {
        "year": 2021,
        "event": "São Paulo",
        "name": "Brazil 2021: Verstappen vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": 9,  # D3 rule
        "seed": 87737,
        "user_side": "VER",
        "rival": "HAM",
        "score_positions": 6,
        "dilemma": "SC/VSC stop timing while defending",
    },
    "mexico-2021": {
        "year": 2021,
        "event": "Mexico City",
        "name": "Mexico 2021: Perez vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": 26,  # D3 rule
        "seed": 56351,
        "user_side": "PER",
        "rival": "HAM",
        "score_positions": 6,
        "dilemma": "Fight for P2 on different strategies",
    },
    "saudi-2022": {
        "year": 2022,
        "event": "Saudi Arabia",
        "name": "Saudi Arabia 2022: Leclerc vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 13,  # D3 rule
        "seed": 20653,
        "user_side": "LEC",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "Late VSC with no stop, DRS duel",
    },
    "miami-2022": {
        "year": 2022,
        "event": "Miami",
        "name": "Miami 2022: Leclerc vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 21,  # D3 rule
        "seed": 81093,
        "user_side": "LEC",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "Late safety car with fresh tyres",
    },
    "canada-2022": {
        "year": 2022,
        "event": "Canada",
        "name": "Canada 2022: Sainz vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 17,  # D3 rule
        "seed": 96345,
        "user_side": "SAI",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "VSC/SC stop timing, 1.0s finish",
    },
    "bahrain-2022": {
        "year": 2022,
        "event": "Bahrain",
        "name": "Bahrain 2022: Leclerc vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 11,  # D3 rule
        "seed": 78727,
        "user_side": "LEC",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "Late safety car; Verstappen's retirement is frozen",
    },
    "hungary-2022": {
        "year": 2022,
        "event": "Hungary",
        "name": "Hungary 2022: Leclerc vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 13,  # D3 rule
        "seed": 30341,
        "user_side": "LEC",
        "rival": "VER",
        "score_positions": 6,
        "dilemma": "Ferrari's hard-tyre call",
    },
}


@dataclass
class BuildResult:
    model: dict
    laps: pd.DataFrame
    notes: list[str] = field(default_factory=list)  # priors/fallbacks the build relied on


def build_race(race_id: str, laps: pd.DataFrame | None = None) -> BuildResult:
    """Build a validated race-model dict for a registered race, with its build notes."""
    if race_id not in RACES:
        raise KeyError(f"unknown race '{race_id}'; known: {sorted(RACES)}")
    meta = RACES[race_id]
    if laps is None:
        laps = pd.read_parquet(ingest.raw_snapshot_path(race_id))

    clean_df, traffic_df, _ = clean.clean_laps(laps)
    pace_laps = pd.concat([clean_df, traffic_df])
    fitted = fit.fit_lap_model(clean_df, pace_laps=pace_laps, era=meta["era"])
    params = track.fit_track_params(laps, clean_df, traffic_df, fitted)

    takeover = meta["takeover_lap"]
    if takeover is None:
        takeover = scenario.default_takeover_lap(
            laps,
            events.extract_events(laps),
            [meta["user_side"], meta["rival"]],
        )
    model = assemble.assemble_race_model(
        race_id=race_id,
        laps=laps,
        clean_laps=clean_df,
        fit=fitted,
        track_params=params,
        name=meta["name"],
        era=meta["era"],
        takeover_lap=takeover,
        seed=meta["seed"],
        user_side=meta["user_side"],
        rival=meta["rival"],
    )
    return BuildResult(model=model, laps=laps, notes=[*fitted.prior_notes, *params.notes])


def build_race_model(race_id: str, laps: pd.DataFrame | None = None) -> tuple[dict, pd.DataFrame]:
    """Build a validated race-model dict for a registered race. Returns (model, laps)."""
    result = build_race(race_id, laps)
    return result.model, result.laps
