"""End-to-end race-model build (Phase 1.6/1.8 glue).

One canonical path from a committed lap snapshot to a validated race-model dict:
ingest snapshot -> clean -> fit (race-pace base pace) -> track params -> assemble. Used by
the tests, the golden-file generator, and the CLI so they never drift.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from . import assemble, clean, events, fit, ingest, scenario, track
from . import pace as pace_mod

# Race registry: metadata that isn't derivable from the timing data. `split` is the Phase
# 1-2 perfection spec's fixed tune / held-out assignment (A1): held-out races are never used
# to choose a model change. Validation-only races leave user_side/rival as None and get an
# automatic duel (runner-up vs winner) from the data.
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
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
        "split": "tune",
        "dilemma": "Ferrari's hard-tyre call",
    },
    "bahrain-2018": {
        "year": 2018,
        "event": "Bahrain",
        "name": "Bahrain 2018",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 57550,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "usa-2018": {
        "year": 2018,
        "event": "United States",
        "name": "United States 2018",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 68577,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "mexico-2018": {
        "year": 2018,
        "event": "Mexico",
        "name": "Mexico 2018",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 73567,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "abu-dhabi-2018": {
        "year": 2018,
        "event": "Abu Dhabi",
        "name": "Abu Dhabi 2018",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 35326,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "tune",
    },
    "hungary-2019": {
        "year": 2019,
        "event": "Hungary",
        "name": "Hungary 2019",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 80284,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "tune",
    },
    "austria-2019": {
        "year": 2019,
        "event": "Austria",
        "name": "Austria 2019",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 34134,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "singapore-2019": {
        "year": 2019,
        "event": "Singapore",
        "name": "Singapore 2019",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 41331,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "mexico-2019": {
        "year": 2019,
        "event": "Mexico",
        "name": "Mexico 2019",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 19428,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "tune",
    },
    "france-2019": {
        "year": 2019,
        "event": "France",
        "name": "France 2019",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 92053,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "70th-anniversary-2020": {
        "year": 2020,
        "event": "70th Anniversary",
        "name": "70th Anniversary 2020",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 32219,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "spain-2020": {
        "year": 2020,
        "event": "Spain",
        "name": "Spain 2020",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 62761,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "portugal-2020": {
        "year": 2020,
        "event": "Portugal",
        "name": "Portugal 2020",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 99081,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "bahrain-2023": {
        "year": 2023,
        "event": "Bahrain",
        "name": "Bahrain 2023",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 62631,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "singapore-2023": {
        "year": 2023,
        "event": "Singapore",
        "name": "Singapore 2023",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 18891,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "japan-2023": {
        "year": 2023,
        "event": "Japan",
        "name": "Japan 2023",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 87206,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "miami-2024": {
        "year": 2024,
        "event": "Miami",
        "name": "Miami 2024",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 51021,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "tune",
    },
    "italy-2024": {
        "year": 2024,
        "event": "Italy",
        "name": "Italy 2024",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 18811,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "hungary-2024": {
        "year": 2024,
        "event": "Hungary",
        "name": "Hungary 2024",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 36730,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "hungary-2025": {
        "year": 2025,
        "event": "Hungary",
        "name": "Hungary 2025",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 41185,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
    },
    "miami-2025": {
        "year": 2025,
        "event": "Miami",
        "name": "Miami 2025",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 57705,
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "holdout",
        # FastF1's tyre timing for this race is corrupt for the whole field (stints start at
        # lap 25 and all second stints at lap 33, while the pit flags are at laps 26-30; the
        # same on a fresh download, Oct 26 2026). Reported, but not counted in G1.
        "data_issue": "tyre timing corrupt upstream (stints misaligned with the pit stops)",
    },
}


@dataclass
class BuildResult:
    model: dict
    laps: pd.DataFrame
    notes: list[str] = field(default_factory=list)  # priors/fallbacks the build relied on


def resolved_meta(race_id: str, laps: pd.DataFrame | None = None) -> dict:
    """Registry entry with the automatic duel filled in (runner-up vs winner) where unset."""
    if race_id not in RACES:
        raise KeyError(f"unknown race '{race_id}'; known: {sorted(RACES)}")
    meta = dict(RACES[race_id])
    if meta["user_side"] is None or meta["rival"] is None:
        if laps is None:
            laps = pd.read_parquet(ingest.raw_snapshot_path(race_id))
        winner, runner_up = assemble.finishing_order(laps)[:2]
        meta["user_side"], meta["rival"] = runner_up, winner
    return meta


def build_race(race_id: str, laps: pd.DataFrame | None = None) -> BuildResult:
    """Build a validated race-model dict for a registered race, with its build notes."""
    if laps is None:
        laps = pd.read_parquet(ingest.raw_snapshot_path(race_id))
    meta = resolved_meta(race_id, laps)

    clean_df, traffic_df, _ = clean.clean_laps(laps)
    # Model v3 stage 6 (T1): pace from clear-air laps only; the sim adds the dirty-air
    # penalty itself when a car follows within range, so traffic laps would count it twice.
    pace_laps = pd.concat([clean_df, traffic_df])
    fitted = fit.fit_lap_model(
        clean_df,
        pace_laps=clean_df if pace_mod.CLEAR_AIR else pace_laps,
        fallback_pace_laps=pace_laps,
        era=meta["era"],
    )
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
