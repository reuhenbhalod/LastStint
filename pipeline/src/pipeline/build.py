"""End-to-end race-model build (Phase 1.6/1.8 glue).

One canonical path from a committed lap snapshot to a validated race-model dict:
ingest snapshot -> clean -> fit (race-pace base pace) -> track params -> assemble. Used by
the tests, the golden-file generator, and the CLI so they never drift.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from pathlib import Path

import pandas as pd

from . import (
    assemble,
    clean,
    dirty_air,
    estimates,
    events,
    export,
    faults,
    fit,
    incidents,
    ingest,
    overtaking,
    race_rules,
    reconstruct,
    redflag,
    refuel,
    restart,
    scenario,
    storyline,
    track,
    wet,
    wet_laps,
)
from . import pace as pace_mod
from . import wear_shape as wear_shape_mod
from .paths import DATA_DIR, RACES_DIR, RAW_DIR

# Authored Eras content (eras build plan, "Eras overlay files"): data/eras/<race-id>.json,
# with up to five keys, applied over the built model by export.with_eras_fields
# (decisionMoments: the Eras side's moments, for a shared race whose Eras driver isn't its
# Daily one; an Eras-only race keeps its moments in data/moments/).
ERAS_DIR = DATA_DIR / "eras"
OVERLAY_KEYS = ("eras", "provenance", "rules", "storylineEvents", "decisionMoments")
# The game modes' race pools. A Daily or Gauntlet race's file is never given its overlay
# (eras build plan, "Shared races"): the Worker serves the overlay beside it to Eras only.
POOLS_PATH = DATA_DIR / "pools.json"

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
        # Beta seed (Oct 31 2026): its run reaches the lap-53 SC with HAM 11.9s ahead, as in
        # the real race, which is less than a SC stop costs, so boxing there isn't free. Of
        # the seeds that do, its last-lap luck follows the odds: covering at the lap-36 VSC
        # then staying out wins, Mercedes' real calls lose (packages/sim scripts/combos.ts).
        "seed": 64,
        "user_side": "HAM",
        "rival": "VER",
        # P7 and back were decided by race control (only the lapped cars between HAM and
        # VER unlapped before the restart), a frozen event the sim can't reproduce.
        "score_positions": 6,
        # ...but the sim follows that call at the restart (the lapped cars elsewhere stay a
        # lap down), so the field doesn't close up behind the leaders on the last lap.
        "sc_unlap": "duel",
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
        "seed": 17370,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
        "user_side": "VER",
        "rival": "HAM",
        "score_positions": 6,
        "split": "tune",
        "dilemma": "Chase on fresher tyres vs Mercedes' undercut (0.7s finish)",
    },
    "france-2021": {
        "year": 2021,
        "event": "France",
        "name": "France 2021: Hamilton vs Perez",
        "era": "2014-2025",
        "takeover_lap": 15,  # pinned: the duel below changed (races batch 2)
        "seed": 6466,  # tuned: scripts/tune.ts (races batch 2)
        "user_side": "HAM",
        "rival": "PER",  # defend race: the car behind (races batch 2)
        "score_positions": 6,
        "split": "tune",
        "dilemma": "Cover Red Bull's second stop or stay on one stop",
    },
    "united-states-2021": {
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
        "seed": 7383,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
        "user_side": "PER",
        "rival": "HAM",
        "score_positions": 6,
        "split": "tune",
        "dilemma": "Fight for P2 on different strategies",
    },
    "saudi-arabia-2022": {
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
        "seed": 46029,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
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
        "seed": 592,  # tuned: scripts/tune.ts (races batch 1)
        "user_side": "SAI",
        "rival": "VER",
        "score_positions": 6,
        "split": "tune",
        "dilemma": "VSC/SC stop timing, 1.0s finish",
    },
    "bahrain-2022": {
        "year": 2022,
        "event": "Bahrain",
        "name": "Bahrain 2022: Leclerc vs Sainz",
        "era": "2014-2025",
        "takeover_lap": 11,  # pinned: the duel below changed (races batch 1)
        "seed": 33967,  # tuned: scripts/tune.ts (races batch 1)
        "user_side": "LEC",
        "rival": "SAI",  # defend race: the car behind (races batch 1)
        "score_positions": 6,
        "split": "tune",
        "dilemma": "Late safety car; Verstappen's retirement is frozen",
    },
    "hungary-2022": {
        "year": 2022,
        "event": "Hungary",
        "name": "Hungary 2022: Verstappen vs Leclerc",
        "era": "2014-2025",
        "takeover_lap": 13,  # D3 rule
        "seed": 30341,
        "user_side": "VER",  # the hard-call side (eras 6.2: VER 2, LEC 1)
        "rival": "LEC",
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
    "united-states-2018": {
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
        "name": "Hungary 2019: Verstappen vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 56769,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "tune",
    },
    "austria-2019": {
        "year": 2019,
        "event": "Austria",
        "name": "Austria 2019: Leclerc vs Bottas",
        "era": "2014-2025",
        "takeover_lap": 19,  # pinned: the duel below changed (races batch 2)
        "seed": 24531,  # tuned: scripts/tune.ts (races batch 2)
        "user_side": "LEC",
        "rival": "BOT",  # defend race: the car behind (races batch 2)
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
        "name": "Mexico 2019: Vettel vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 11977,  # tuned: scripts/tune.ts (races batch 1)
        "user_side": None,  # validation race: automatic duel, runner-up vs winner
        "rival": None,
        "score_positions": 6,
        "split": "tune",
    },
    "france-2019": {
        "year": 2019,
        "event": "France",
        "name": "France 2019: Bottas vs Leclerc",
        "era": "2014-2025",
        "takeover_lap": 20,  # pinned: the duel below changed (races batch 1)
        "seed": 50312,  # tuned: scripts/tune.ts (races batch 1)
        "user_side": "BOT",
        "rival": "LEC",  # defend race: the car behind (races batch 1)
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
        "name": "Spain 2020: Verstappen vs Bottas",
        "era": "2014-2025",
        "takeover_lap": 18,  # pinned: the duel below changed (races batch 1)
        "seed": 27170,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
        "user_side": "VER",
        "rival": "BOT",  # defend race: the car behind (races batch 1)
        "score_positions": 6,
        "split": "holdout",
    },
    "portugal-2020": {
        "year": 2020,
        "event": "Portugal",
        "name": "Portugal 2020: Bottas vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 26,  # pinned (the duel changed); earlier for more calls (batch 1)
        "seed": 26892,  # tuned: scripts/tune.ts (races batch 1)
        "user_side": "BOT",
        "rival": "VER",  # defend race: the car behind (races batch 1)
        "score_positions": 6,
        "split": "holdout",
    },
    "bahrain-2023": {
        "year": 2023,
        "event": "Bahrain",
        "name": "Bahrain 2023: Sainz vs Alonso",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 62631,
        # Eras storyline (swap-races-e10-e9.md): Sainz and Alonso fight for the last podium
        # place. Eras side by hard calls (SAI 2, ALO 1; real: Alonso P3, Sainz P4).
        "user_side": "SAI",
        "rival": "ALO",
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
        "name": "Italy 2024: Piastri vs Leclerc",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 99524,  # tuned: scripts/tune.ts (races batch 1)
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
        "name": "Hungary 2025: Piastri vs Norris",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 95190,  # tuned: scripts/tune.ts (races batch 1)
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
    "italy-2019": {  # races batch 2
        "year": 2019,
        "event": "Italy",
        "name": "Italy 2019: Bottas vs Leclerc",
        "era": "2014-2025",
        "takeover_lap": 17,  # pinned (races batch 2)
        "seed": 18948,  # tuned: scripts/tune.ts (races batch 2)
        "user_side": "BOT",
        "rival": "LEC",
        "score_positions": 6,
        "split": "holdout",
    },
    "united-states-2022": {  # races batch 2
        "year": 2022,
        "event": "United States",
        "name": "USA 2022: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 9,  # pinned (races batch 2)
        "seed": 84707,  # tuned: scripts/tune.ts (races batch 2)
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "mexico-2024": {  # races batch 2
        "year": 2024,
        "event": "Mexico",
        "name": "Mexico 2024: Norris vs Sainz",
        "era": "2014-2025",
        "takeover_lap": 27,  # pinned (races batch 2)
        "seed": 50116,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
        "user_side": "NOR",
        "rival": "SAI",
        "score_positions": 6,
        "split": "holdout",
    },
    "abu-dhabi-2024": {  # races batch 2
        "year": 2024,
        "event": "Abu Dhabi",
        "name": "Abu Dhabi 2024: Sainz vs Norris",
        "era": "2014-2025",
        "takeover_lap": 10,  # pinned: earlier for more calls (races batch 2)
        "seed": 21142,  # tuned: scripts/tune.ts (strategy planner, Nov 5 2026)
        "user_side": "SAI",
        "rival": "NOR",
        "score_positions": 6,
        "split": "holdout",
    },
    "canada-2019": {  # races batch 3 (survivor)
        "year": 2019,
        "event": "Canada",
        "name": "Canada 2019: Hamilton vs Vettel",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "VET",
        "score_positions": 6,
        "split": "holdout",
    },
    "united-states-2019": {  # races batch 3 (survivor)
        "year": 2019,
        "event": "United States",
        "name": "USA 2019: Hamilton vs Bottas",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "BOT",
        "score_positions": 6,
        "split": "holdout",
    },
    "styria-2020": {  # races batch 3 (survivor)
        "year": 2020,
        "event": "Styria",
        "name": "Styria 2020: Bottas vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BOT",
        "rival": "HAM",
        "score_positions": 6,
        "split": "holdout",
    },
    "russia-2020": {  # races batch 3 (survivor)
        "year": 2020,
        "event": "Russia",
        "name": "Russia 2020: Verstappen vs Bottas",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VER",
        "rival": "BOT",
        "score_positions": 6,
        "split": "holdout",
    },
    "abu-dhabi-2020": {  # races batch 3 (survivor)
        "year": 2020,
        "event": "Abu Dhabi",
        "name": "Abu Dhabi 2020: Bottas vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BOT",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "portugal-2021": {  # races batch 3 (survivor)
        "year": 2021,
        "event": "Portugal",
        "name": "Portugal 2021: Verstappen vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VER",
        "rival": "HAM",
        "score_positions": 6,
        "split": "holdout",
    },
    "styria-2021": {  # races batch 3 (survivor)
        "year": 2021,
        "event": "Styria",
        "name": "Styria 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "netherlands-2022": {  # races batch 3 (survivor)
        "year": 2022,
        "event": "Netherlands",
        "name": "Netherlands 2022: Russell vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RUS",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "italy-2022": {  # races batch 3 (survivor)
        "year": 2022,
        "event": "Italy",
        "name": "Italy 2022: Leclerc vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "LEC",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "mexico-2022": {  # races batch 3 (survivor)
        "year": 2022,
        "event": "Mexico",
        "name": "Mexico 2022: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "miami-2023": {  # races batch 3 (survivor)
        "year": 2023,
        "event": "Miami",
        "name": "Miami 2023: Pérez vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PER",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "spain-2023": {  # races batch 3 (survivor)
        "year": 2023,
        "event": "Spain",
        "name": "Spain 2023: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "united-states-2023": {  # races batch 3 (survivor)
        "year": 2023,
        "event": "United States",
        "name": "USA 2023: Hamilton vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "japan-2024": {  # races batch 3 (survivor)
        "year": 2024,
        "event": "Japan",
        "name": "Japan 2024: Pérez vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PER",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "china-2024": {  # races batch 3 (survivor)
        "year": 2024,
        "event": "China",
        "name": "China 2024: Norris vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "NOR",
        "rival": "VER",
        "score_positions": 6,
        "split": "holdout",
    },
    "belgium-2024": {  # races batch 3 (survivor)
        "year": 2024,
        "event": "Belgium",
        "name": "Belgium 2024: Hamilton vs Russell",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "RUS",
        "score_positions": 6,
        "split": "holdout",
    },
    "china-2025": {  # races batch 3 (survivor)
        "year": 2025,
        "event": "China",
        "name": "China 2025: Norris vs Piastri",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "NOR",
        "rival": "PIA",
        "score_positions": 6,
        "split": "holdout",
    },
    "saudi-arabia-2025": {  # races batch 3 (survivor)
        "year": 2025,
        "event": "Saudi Arabia",
        "name": "Saudi Arabia 2025: Verstappen vs Piastri",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VER",
        "rival": "PIA",
        "score_positions": 6,
        "split": "holdout",
    },
    "austria-2025": {  # races batch 3 (survivor)
        "year": 2025,
        "event": "Austria",
        "name": "Austria 2025: Piastri vs Norris",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PIA",
        "rival": "NOR",
        "score_positions": 6,
        "split": "holdout",
    },
    "russia-2021": {  # weather spec (mixed-weather races)
        "year": 2021,
        "event": "Russia",
        "name": "Russia 2021: Norris vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": 38,
        "seed": 75098,  # tuned: scripts/tune.ts (weather)
        "user_side": "NOR",
        "rival": "HAM",
        "score_positions": 6,
        "split": "wet",
    },
    "great-britain-2024": {  # weather spec (mixed-weather races)
        "year": 2024,
        "event": "United Kingdom",
        "source": "openf1",  # FastF1 needs F1TV since Oct 2026 (pipeline/openf1.py)
        "name": "Great Britain 2024: Norris vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": 16,
        "seed": 1,
        "user_side": "NOR",
        "rival": "HAM",
        "score_positions": 6,
        "split": "wet",
    },
    "canada-2024": {  # weather spec (mixed-weather races)
        "year": 2024,
        "event": "Canada",
        "source": "openf1",  # FastF1 needs F1TV since Oct 2026 (pipeline/openf1.py)
        "name": "Canada 2024: Norris vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 20,
        "seed": 37410,  # tuned: scripts/tune.ts (weather)
        "user_side": "NOR",
        "rival": "VER",
        "score_positions": 6,
        "split": "wet",
    },
    "monaco-2023": {  # weather spec (mixed-weather races)
        "year": 2023,
        "event": "Monaco",
        "source": "openf1",  # FastF1 needs F1TV since Oct 2026 (pipeline/openf1.py)
        "name": "Monaco 2023: Alonso vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": 45,
        "seed": 1,
        "user_side": "ALO",
        "rival": "VER",
        "score_positions": 6,
        "split": "wet",
    },
    "australia-2025": {  # weather spec (mixed-weather races)
        "year": 2025,
        "event": "Australia",
        "source": "openf1",  # FastF1 needs F1TV since Oct 2026 (pipeline/openf1.py)
        "name": "Australia 2025: Verstappen vs Norris",
        "era": "2014-2025",
        "takeover_lap": 32,
        "seed": 1,
        "user_side": "VER",
        "rival": "NOR",
        "score_positions": 6,
        "split": "wet",
    },
    # Eras wave A (build plan 3.1). Held out: never used to choose a model change. The duel
    # is the Eras storyline's (eras spec §3); `pipeline hard-calls` sets the Eras userSide.
    # TUM races are read with `pipeline tum-ingest`, and carry its CC BY-NC-SA 3.0 licence
    # and credit (data/raw/<id>.provenance.json).
    "monaco-2017": {
        "year": 2017,
        "event": "Monaco",
        "source": "tum",
        "name": "Monaco 2017: Räikkönen vs Vettel",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RAI",
        "rival": "VET",
        "score_positions": 6,
        "split": "eras",
    },
    "russia-2018": {
        "year": 2018,
        "event": "Russia",
        "source": "tum",
        "name": "Russia 2018: Bottas vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BOT",
        "rival": "HAM",
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2019": {
        "year": 2019,
        "event": "Brazil",
        "source": "tum",
        "name": "Brazil 2019: Hamilton vs Gasly",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",  # the hard-call side (eras 6.2: 0-0, HAM gave up more chance)
        "rival": "GAS",
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2025": {
        "year": 2025,
        "event": "Monaco",
        "source": "openf1",  # FastF1 needs F1TV since Oct 2026 (pipeline/openf1.py)
        "name": "Monaco 2025: Norris vs Leclerc",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "NOR",
        "rival": "LEC",
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave A (Eras build plan 3.1): Era 7 races from the TUM f1-timing-database
    # (`pipeline tum-ingest`; CC BY-NC-SA 3.0, credit in data/raw/<id>.provenance.json). The
    # duel is the storyline pair of the Eras spec's race table (§4), the user's driver first.
    # split "eras": outside the model's tune / held-out sets. Seeds are untuned: the races
    # have no decision moments until step 6.2, and scripts/tune.ts plays those.
    "bahrain-2014": {
        "year": 2014,
        "event": "Bahrain",
        "source": "tum",
        "name": "Bahrain 2014: Hamilton vs Rosberg",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "ROS",  # defend: Hamilton holds off Rosberg
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2015": {
        "year": 2015,
        "event": "Monaco",
        "source": "tum",
        "name": "Monaco 2015: Hamilton vs Rosberg",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "ROS",  # Hamilton holds P1 (real: the late stop drops him behind Rosberg)
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-2015": {
        "year": 2015,
        "event": "Hungary",
        "source": "tum",
        "name": "Hungary 2015: Vettel vs Kvyat",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VET",
        "rival": "KVY",  # Vettel wins; defend race: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "spain-2016": {
        "year": 2016,
        "event": "Spain",
        "source": "tum",
        "name": "Spain 2016: Räikkönen vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (RAI 1, VER 1; tie to RAI by chance given up): Räikkönen
        # chases the win (real: P2, 0.6 s behind Verstappen).
        "user_side": "RAI",
        "rival": "VER",
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2016": {
        "year": 2016,
        "event": "Monaco",
        "source": "tum",
        "name": "Monaco 2016: Ricciardo vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RIC",
        "rival": "HAM",  # Ricciardo holds P1 (real: the slow stop hands Hamilton the win)
        "score_positions": 6,
        "split": "eras",
    },
    "abu-dhabi-2016": {
        "year": 2016,
        "event": "Abu Dhabi",
        "source": "tum",
        "name": "Abu Dhabi 2016: Rosberg vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (ROS 1, HAM 0): Rosberg P3 or better for the title while
        # Hamilton backs him into the pack (real: P2, champion by 5 points).
        "user_side": "ROS",
        "rival": "HAM",
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave A (Eras build plan 3.1c): Era 6 races and sakhir-2020 from the Jolpica dump
    # (`pipeline jolpica`; CC BY-NC-SA, credit in data/raw/<id>.jolpica.json), with F1DB stops
    # before 2011 and estimated compounds and SC laps (data/estimates/<id>.sc.json, for the
    # owner to check). Duels, split and seeds as for the TUM races above.
    "abu-dhabi-2010": {
        "year": 2010,
        "event": "Abu Dhabi",
        "source": "jolpica",
        "name": "Abu Dhabi 2010: Petrov vs Alonso",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: PET 1, ALO 0).
        "user_side": "PET",
        "rival": "ALO",
        "score_positions": 6,
        "split": "eras",
    },
    "china-2011": {
        "year": 2011,
        "event": "China",
        "source": "jolpica",
        "name": "China 2011: Vettel vs Hamilton",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: VET 1, HAM 1; Vettel gave
        # up more chance, 9.0 vs 8.3 pts).
        "user_side": "VET",
        "rival": "HAM",
        "score_positions": 6,
        "split": "eras",
    },
    "europe-2012": {
        "year": 2012,
        "event": "Europe",
        "source": "jolpica",
        "name": "Europe 2012: Räikkönen vs Alonso",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (RAI 2, ALO 0): Räikkönen chases Alonso, who won from P11
        # (real: Räikkönen P2).
        "user_side": "RAI",
        "rival": "ALO",
        "score_positions": 6,
        "split": "eras",
    },
    "abu-dhabi-2012": {
        "year": 2012,
        "event": "Abu Dhabi",
        "source": "jolpica",
        "name": "Abu Dhabi 2012: Vettel vs Button",
        "era": "2010-2013",
        # D3 rule: lap 10, inside the lap 9-14 SC, which the race file keeps from lap 10 on
        # (events.from_takeover), so Vettel's stop under it is still played. (It was pinned to
        # lap 8 while an SC running at the takeover was dropped.)
        "takeover_lap": None,
        "seed": 1,
        "user_side": "VET",
        "rival": "BUT",  # Vettel from the pit lane to the podium; Button the car he beat to P3
        "score_positions": 6,
        "split": "eras",
    },
    "spain-2013": {
        "year": 2013,
        "event": "Spain",
        "source": "jolpica",
        "name": "Spain 2013: Räikkönen vs Alonso",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: RAI 3, ALO 1).
        "user_side": "RAI",
        "rival": "ALO",
        "score_positions": 6,
        "split": "eras",
    },
    "sakhir-2020": {
        "year": 2020,
        "event": "Sakhir",
        "source": "jolpica",
        "name": "Sakhir 2020: Russell vs Pérez",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RUS",
        "rival": "PER",  # Russell holds P1 (real: the stop mix-up and a puncture, P9)
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (Eras build plan 5.1): wet races with no weather data (TUM has none, and
    # FastF1's 2018+ weather now needs an F1TV login). `pipeline wet-laps` fits when the track
    # was wet from the lap times (step 4.5) and writes <id>.weather.json; the hand check
    # against the race reports is docs/eras-checks/4.5-wet-races.md. TUM races as above;
    # Jolpica races (CC BY-NC-SA 4.0, `pipeline jolpica`, credit in the raw sidecar) carry
    # step 2.4's estimated SC laps (data/estimates/<id>.sc.json) and compounds. Duels, seeds
    # and split as for wave A.
    "hungary-2014": {
        "year": 2014,
        "event": "Hungary",
        "source": "tum",
        "name": "Hungary 2014: Hamilton vs Rosberg",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "ROS",  # beat-rival: Hamilton from the pit lane, ahead of Rosberg
        "score_positions": 6,
        "split": "eras",
    },
    "united-states-2015": {
        "year": 2015,
        "event": "United States",
        "source": "tum",
        "name": "USA 2015: Hamilton vs Rosberg",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "ROS",  # beat-rival: Hamilton ahead of Rosberg (and Vettel) for the title
        "score_positions": 6,
        "split": "eras",
    },
    "germany-2018": {
        "year": 2018,
        "event": "Germany",
        "source": "tum",
        "name": "Germany 2018: Hamilton vs Bottas",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "BOT",  # win from P14; defend race: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "germany-2019": {
        "year": 2019,
        "event": "Germany",
        "source": "tum",
        "name": "Germany 2019: Verstappen vs Vettel",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VER",
        "rival": "VET",  # win through the rain; defend race: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "turkey-2020": {
        "year": 2020,
        "event": "Turkey",
        "source": "jolpica",
        "name": "Turkey 2020: Hamilton vs Perez",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "PER",  # win from P6 for the title; defend race: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "turkey-2021": {
        "year": 2021,
        "event": "Turkey",
        "source": "jolpica",
        "name": "Turkey 2021: Leclerc vs Hamilton",
        "era": "2014-2025",
        # Pinned (eras 6.2): the D3 rule gives lap 44, three laps before Leclerc's stop, so his
        # call to stay out and lead after Bottas' stop (lap 37) couldn't be played. Takeovers
        # at laps 30, 33 and 35 fail G1 (the LEC-HAM gap).
        "takeover_lap": 38,
        "seed": 1,
        "user_side": "LEC",  # the hard-call side (eras 6.2: LEC 2, HAM 1)
        "rival": "HAM",
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): wet races before 2018 from Jolpica (`pipeline jolpica`,
    # then `pipeline wet-laps`: wetness from the lap times, step 4.5) and canada-2014 from TUM
    # with both Mercedes' power losses (step 4.4; facts in data/incidents.json). The duel is
    # the storyline pair of the Eras spec's race table (§4), the user's driver first.
    "australia-2010": {
        "year": 2010,
        "event": "Australia",
        "source": "jolpica",
        "name": "Australia 2010: Button vs Kubica",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BUT",
        "rival": "KUB",  # Button chases the win: the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2012": {
        "year": 2012,
        "event": "Brazil",
        "source": "jolpica",
        "name": "Brazil 2012: Vettel vs Alonso",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VET",
        "rival": "ALO",  # Vettel high enough for the title: Alonso, his title rival
        "score_positions": 6,
        "split": "eras",
    },
    "malaysia-2013": {
        "year": 2013,
        "event": "Malaysia",
        "source": "jolpica",
        "name": "Malaysia 2013: Webber vs Vettel",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: WEB 1, VET 1; Webber gave
        # up more chance, 48.0 vs 45.3 pts).
        "user_side": "WEB",
        "rival": "VET",
        "score_positions": 6,
        "split": "eras",
    },
    "canada-2014": {
        "year": 2014,
        "event": "Canada",
        "source": "tum",
        "name": "Canada 2014: Rosberg vs Ricciardo",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ROS",
        "rival": "RIC",  # Rosberg nurses a failing car to the win (real: Ricciardo passes)
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): Era 2 races reconstructed from their anchors (`pipeline
    # reconstruct`, step 4.6: Jolpica results, F1DB fastest laps, sourced stops in
    # data/reconstruction/<id>.json). Checked on their anchors instead of G1; the build marks
    # them reconstructed (reconstruct.mark_model). Duels from the Eras spec's race table (§4).
    "united-states-1990": {
        "year": 1990,
        "event": "United States",
        "source": "reconstruct",
        "name": "United States 1990: Alesi vs Senna",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ALE",
        "rival": "SENA",  # Alesi holds off Senna (real: Senna passes, wins)
        "score_positions": 6,
        "split": "eras",
    },
    "mexico-1990": {
        "year": 1990,
        "event": "Mexico",
        "source": "reconstruct",
        "name": "Mexico 1990: Prost vs Mansell",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PRO",
        "rival": "MAN",  # Prost from P13 to the win; Mansell the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-1991": {
        "year": 1991,
        "event": "Brazil",
        "source": "reconstruct",
        "name": "Brazil 1991: Senna vs Patrese",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "SENA",
        "rival": "PAT",  # Senna holds P1 (real: stuck in sixth late on, wins); Patrese P2
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-1992": {
        "year": 1992,
        "event": "Monaco",
        "source": "reconstruct",
        "name": "Monaco 1992: Senna vs Mansell",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side flipped to Senna (6.2, Nov 8 2026): `pipeline hard-calls` MAN 0, SENA 0;
        # the tie goes to Senna, whose real calls gave up more chance (31.7 pts vs 0.0).
        "user_side": "SENA",
        "rival": "MAN",  # Senna holds off Mansell's fresh tyres to the flag (real: by 0.2 s)
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-1992": {
        "year": 1992,
        "event": "Hungary",
        "source": "reconstruct",
        "name": "Hungary 1992: Berger vs Mansell",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras plays the side with more hard calls (6.2 re-author, `pipeline hard-calls` on
        # the sourced lap leaders: 0-0, the tie to BER on chance given up, 47.7 pts to 0.0).
        "user_side": "BER",
        "rival": "MAN",  # beat-rival: Berger, non-stop, keeps Mansell behind (real: P3, MAN P2)
        "score_positions": 6,
        "split": "eras",
    },
    "australia-1993": {
        "year": 1993,
        "event": "Australia",
        "source": "reconstruct",
        "name": "Australia 1993: Senna vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "SENA",
        "rival": "PRO",  # Senna holds P1 in his last win; Prost P2
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): reconstructed races, 1984-1988 (`pipeline reconstruct`,
    # step 4.6: synthetic laps solved to Jolpica's results, F1DB's fastest laps and the
    # sourced stops of data/reconstruction/<id>.json). No safety cars before 1993, no
    # refuelling; the fuel limit is the overlay's rules. Checked on their anchors, not G1
    # (data/raw/<id>.anchors.md). Duels, seeds and split as for wave A.
    "portugal-1984": {
        "year": 1984,
        "event": "Portuguese",
        "source": "reconstruct",
        "name": "Portugal 1984: Lauda vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "LAU",
        "rival": "PRO",  # Lauda P2 or better for the title, by half a point over Prost
        "score_positions": 6,
        "split": "eras",
    },
    "mexico-1986": {
        "year": 1986,
        "event": "Mexican",
        "source": "reconstruct",
        "name": "Mexico 1986: Berger vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BER",
        "rival": "PRO",  # Berger wins with no tyre stop; Prost the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-1986": {
        "year": 1986,
        "event": "Hungarian",
        "source": "reconstruct",
        "name": "Hungary 1986: Piquet vs Senna",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PIQN",
        "rival": "SENA",  # beat-rival: Piquet ahead of Senna
        "score_positions": 6,
        "split": "eras",
    },
    "australia-1986": {
        "year": 1986,
        "event": "Australian",
        "source": "reconstruct",
        "name": "Australia 1986: Mansell vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "MAN",
        "rival": "PRO",  # Mansell P3 or better for the title (real: tyre failure, Prost wins)
        "score_positions": 6,
        "split": "eras",
    },
    "great-britain-1987": {
        "year": 1987,
        "event": "British",  # `pipeline reconstruct great-britain-1987 --event British`
        "source": "reconstruct",
        "name": "Britain 1987: Piquet vs Mansell",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras plays the side with more hard calls (owner decision, step 6.2): 0-0, and the
        # tie goes to Piquet, whose real call (no stop) gave up more chance (`pipeline
        # hard-calls`). defend: Piquet holds off Mansell, who pits and chases him down.
        "user_side": "PIQN",
        "rival": "MAN",
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-1988": {
        "year": 1988,
        "event": "Monaco",
        "source": "reconstruct",
        "name": "Monaco 1988: Senna vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "SENA",
        "rival": "PRO",  # defend: Senna holds the lead to the flag (real: crashed on lap 67)
        "score_positions": 6,
        "split": "eras",
    },
    # Eras build plan 5.5: the wet reconstructed races, 1984-1995 (`pipeline reconstruct`,
    # with the sourced weather of data/reconstruction/<id>.json: wetness per lap, wet tyres).
    # monaco-1984, portugal-1985 and europe-1993 are wet on every lap, so their dry pace is
    # the solver's (build.solver_dry_fit). monaco-1984 ends at its results lap (31, red flag)
    # with the disqualified Bellof run third on the road (facts roadPositions). Checked on
    # their anchors, not G1. Duels from the Eras spec's race tables (§4).
    "monaco-1984": {
        "year": 1984,
        "event": "Monaco",
        "source": "reconstruct",
        "name": "Monaco 1984: Prost vs Senna",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PRO",
        "rival": "SENA",  # defend: Prost holds off Senna to the results lap
        "score_positions": 6,
        "split": "eras",
    },
    "portugal-1985": {
        "year": 1985,
        "event": "Portuguese",
        "source": "reconstruct",
        "name": "Portugal 1985: Senna vs Alboreto",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "SENA",
        "rival": "ALBM",  # defend: Senna holds P1 in the rain; Alboreto P2
        "score_positions": 6,
        "split": "eras",
    },
    "belgium-1992": {
        "year": 1992,
        "event": "Belgian",
        "source": "reconstruct",
        "name": "Belgium 1992: Schumacher vs Mansell",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "MSCM",
        # Mansell again (Eras grader fixes, Nov 8 2026): 6.2 made Patrese the rival because the
        # Expert rival took the slicks on the crossover and won every path. The overlay now
        # flags Mansell's real late slick stop (in-lap 33, Motor Sport) as a storyline call
        # (eras.storylineCalls), so the rival makes it on its real lap whatever its policy.
        "rival": "MAN",  # win: Schumacher times the slicks; Mansell's late Williams call
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-1993": {
        "year": 1993,
        "event": "Brazilian",
        "source": "reconstruct",
        "name": "Brazil 1993: Senna vs Hill",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "SENA",
        "rival": "HIL",  # win: Senna in the rain; Hill the car behind at the flag
        "score_positions": 6,
        "split": "eras",
        # Built from Nov 8 2026 (was a data issue, docs/g1-report.md, 5.5: no source gives the
        # field's slick stops, so eight cars ran wets on a dry track for the last 30 laps and
        # Senna was P14 at the takeover). The facts file's weather.slickChange (GPE, Wikipedia:
        # everyone changed to slicks, laps 37-43) gives those cars an estimated slick stop
        # (reconstruct.apply_slick_change), and Motor Sport's lap-39/43/47 order holds Senna
        # P3 at the takeover, Hill ahead until the stops, Herbert third after them.
    },
    "europe-1993": {
        "year": 1993,
        "event": "European",
        "source": "reconstruct",
        "name": "Europe 1993: Senna vs Hill",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "SENA",
        # Hill again (Eras grader fixes, Nov 8 2026): 6.2 made Prost the rival because the
        # Expert rival Hill fixed his real calls and won every path. The overlay now flags
        # Hill's sourced slick and wet stops (Motor Sport) as storyline calls
        # (eras.storylineCalls), so the rival makes them on their real laps whatever its policy.
        "rival": "HIL",  # win: Senna through the wet-dry calls; Hill P2, the only car not lapped
        "score_positions": 6,
        "split": "eras",
    },
    "belgium-1995": {
        "year": 1995,
        "event": "Belgian",
        "source": "reconstruct",
        "name": "Belgium 1995: Schumacher vs Hill",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras plays the side with more hard calls (6.2 re-author, `pipeline hard-calls` on
        # the sourced lap leaders: MSCM 5, HIL 1; was HIL on a 2-2 tie).
        "user_side": "MSCM",
        "rival": "HIL",  # win: Schumacher from P16 on slicks in the wet; Hill second
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): red-flag races of the 2010s. No source has red-flag timing,
    # so each red flag's stoppage lap and restart SC laps come from its hand-entered file
    # (data/redflags/<id>.json, R1). TUM races via `pipeline tum-ingest`, Jolpica ones via
    # `pipeline jolpica`; the wet ones then `pipeline wet-laps`.
    "azerbaijan-2017": {
        "year": 2017,
        "event": "Azerbaijan",
        "source": "tum",
        "name": "Azerbaijan 2017: Ricciardo vs Bottas",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RIC",
        "rival": "BOT",  # win from P10: the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2011": {
        "year": 2011,
        "event": "Monaco",
        "source": "jolpica",
        "name": "Monaco 2011: Vettel vs Alonso",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VET",
        "rival": "ALO",  # Vettel holds P1: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "canada-2011": {
        "year": 2011,
        "event": "Canada",
        "source": "jolpica",
        "name": "Canada 2011: Button vs Vettel",
        "era": "2010-2013",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BUT",
        "rival": "VET",  # Button wins from last: the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): red-flag races of 2020-2024 (step 4.3; the facts are in
    # data/redflags/<id>.json, step R1). OpenF1 for 2023-24 (race control gives the restarts),
    # the project's FastF1 cache for hungary-2021 (`pipeline ingest --offline`), and Jolpica
    # for the rest (`pipeline jolpica`, with step 2.4's estimated compounds and SC laps, and
    # the stoppage lap entered in the red-flag file as resumeLap). Wet races get `pipeline
    # wet-laps`. The duel is the storyline pair of the Eras spec's race table (§4), the user's
    # driver first. Seeds and split as for wave A.
    "netherlands-2023": {
        "year": 2023,
        "event": "Netherlands",
        "source": "openf1",
        "name": "Netherlands 2023: Alonso vs Verstappen",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ALO",
        "rival": "VER",  # position: P2 or better; the car ahead (as step 4.3's fixture)
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-2021": {
        "year": 2021,
        "event": "Hungary",
        "name": "Hungary 2021: Hamilton vs Alonso",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "ALO",  # position: the podium; Alonso, the car he passed for it
        "score_positions": 6,
        "split": "eras",
    },
    "great-britain-2021": {
        "year": 2021,
        "event": "British",
        "name": "Britain 2021: Leclerc vs Hamilton",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Swapped in for saudi-arabia-2021. Hard calls tie 0-0; LEC by chance given up (45.0
        # pts against HAM's 10.3). The lap-2 red flag is before the D3 takeover (lap 24).
        "user_side": "LEC",
        "rival": "HAM",
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2022": {
        "year": 2022,
        "event": "Monaco",
        "source": "jolpica",
        "name": "Monaco 2022: Leclerc vs Pérez",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "LEC",
        "rival": "PER",  # Leclerc holds the lead (real: Pérez wins, Leclerc P4)
        "score_positions": 6,
        "split": "eras",
    },
    "great-britain-2022": {
        "year": 2022,
        "event": "Great Britain",
        "source": "jolpica",
        "name": "Britain 2022: Leclerc vs Sainz",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "LEC",
        "rival": "SAI",  # Leclerc holds the lead after the SC (real: Sainz wins, Leclerc P4)
        "score_positions": 6,
        "split": "eras",
    },
    "azerbaijan-2021": {
        "year": 2021,
        "event": "Azerbaijan",
        "source": "jolpica",
        "name": "Azerbaijan 2021: Pérez vs Vettel",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PER",
        "rival": "VET",  # Pérez holds the lead at the restart; defend race: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "saudi-arabia-2021": {
        "year": 2021,
        "event": "Saudi Arabia",
        "source": "jolpica",
        "name": "Saudi Arabia 2021: Hamilton vs Verstappen",
        "era": "2014-2025",
        # The D3 rule skips events up to lap 10, so it lands on lap 10: Hamilton's in-lap for
        # his stop under the lap-10 SC (the storyline's first call), which live play can't
        # take at the takeover. Lap 7 is the rule's three laps of play before that SC.
        "takeover_lap": 7,
        "seed": 1,
        "user_side": "HAM",
        "rival": "VER",  # beat-rival: Hamilton ahead of Verstappen
        "score_positions": 6,
        "split": "eras",
    },
    "italy-2020": {
        "year": 2020,
        "event": "Italy",
        "source": "jolpica",
        "name": "Italy 2020: Gasly vs Sainz",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "GAS",
        "rival": "SAI",  # Gasly holds the lead to the flag; defend race: the car behind
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): refuelling races 2005-09 from Jolpica (`pipeline jolpica`,
    # F1DB stops before 2011, CC BY-NC-SA 4.0, credit in the raw sidecar), with step 2.4's
    # estimated compounds, SC laps (data/estimates/<id>.sc.json) and fuel loads, and the fill
    # model fitted from the F1DB stops (refuel.race_fill_model). monaco-2008's wet start is
    # fitted from the lap times (`pipeline wet-laps`) and Hamilton's puncture is a FAULT
    # (data/incidents.json). The duel is the storyline pair of the Eras spec's race table (§4),
    # the user's driver first; split and seeds as for wave A.
    "san-marino-2005": {
        "year": 2005,
        "event": "San Marino",
        "source": "jolpica",
        "name": "San Marino 2005: Schumacher vs Alonso",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: MSCM 1, ALO 0).
        "user_side": "MSCM",
        "rival": "ALO",
        "score_positions": 6,
        "split": "eras",
    },
    "japan-2005": {
        "year": 2005,
        "event": "Japan",
        "source": "jolpica",
        "name": "Japan 2005: Räikkönen vs Fisichella",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RAI",
        "rival": "FIS",  # win from P17: Fisichella, passed on the last lap
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2006": {
        "year": 2006,
        "event": "Brazil",
        "source": "jolpica",
        "name": "Brazil 2006: Alonso vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ALO",
        "rival": "MSCM",  # Alonso P8 or better for the title: Schumacher, his title rival
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2007": {
        "year": 2007,
        "event": "Brazil",
        "source": "jolpica",
        "name": "Brazil 2007: Räikkönen vs Hamilton",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "RAI",
        "rival": "HAM",  # deny: Räikkönen wins, Hamilton (title rival) kept P6 or lower
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2008": {
        "year": 2008,
        "event": "Monaco",
        "source": "jolpica",
        "name": "Monaco 2008: Hamilton vs Kubica",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "KUB",  # win after the puncture: Kubica the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2009": {
        "year": 2009,
        "event": "Brazil",
        "source": "jolpica",
        "name": "Brazil 2009: Button vs Barrichello",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BUT",
        "rival": "BAR",  # Button from P14 high enough for the title: Barrichello, his title rival
        "score_positions": 6,
        "split": "eras",
    },
    # Era 4 (2000-04), refuelling as above: one dry compound, new tyres at a stop.
    "japan-2000": {
        "year": 2000,
        "event": "Japan",
        "source": "jolpica",
        "name": "Japan 2000: Häkkinen vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: HAK 0, MSCM 0; Häkkinen
        # gave up more chance, 148.7 vs 115.7 pts).
        "user_side": "HAK",
        "rival": "MSCM",
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): refuelling races 2002-04 (dry), as the 2005-09 races
    # above: Jolpica with F1DB stops, one estimated dry compound, estimated SC laps and fuel
    # loads, the fill model fitted from the F1DB stops.
    "austria-2002": {
        "year": 2002,
        "event": "Austria",
        "source": "jolpica",
        "name": "Austria 2002: Barrichello vs Schumacher",
        "era": "1994-2009",
        # Pinned (Eras 6.2): lap 26, after both Ferraris' stops under the lap-24 SC (the D3
        # rule's lap 21 came before them). A moment can't offer the stop the grader prices
        # there (its continuation refuels to the flag, past what a pit card fill can name).
        "takeover_lap": 26,
        "seed": 1,
        # Eras side by hard calls from lap 26 (BAR 1, MSCM 0): team, Ferrari 1-2 (real:
        # Barrichello let Schumacher by on the last lap).
        "user_side": "BAR",
        "rival": "MSCM",
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-2003": {
        "year": 2003,
        "event": "Hungary",
        "source": "jolpica",
        "name": "Hungary 2003: Alonso vs Räikkönen",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ALO",
        "rival": "RAI",  # defend: Alonso holds P1; the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "japan-2003": {
        "year": 2003,
        "event": "Japan",
        "source": "jolpica",
        "name": "Japan 2003: Schumacher vs Räikkönen",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "MSCM",
        "rival": "RAI",  # Schumacher P8 or better for the title: Räikkönen, his title rival
        "score_positions": 6,
        "split": "eras",
    },
    "france-2004": {
        "year": 2004,
        "event": "France",
        "source": "jolpica",
        "name": "France 2004: Alonso vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: ALO 1, MSCM 0).
        "user_side": "ALO",
        "rival": "MSCM",
        "score_positions": 6,
        "split": "eras",
    },
    "monaco-2004": {
        "year": 2004,
        "event": "Monaco",
        "source": "jolpica",
        "name": "Monaco 2004: Trulli vs Button",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "TRU",
        "rival": "BUT",  # defend: Trulli holds P1; the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): refuelling races 1994-99 and 1983. 1996-99 from Jolpica
    # (`pipeline jolpica`, F1DB stops) with step 2.4's estimated compounds, SC laps
    # (data/estimates/<id>.sc.json) and fuel loads; Hill's lap-74 hydraulic failure at
    # hungary-1997 is a FAULT (data/incidents.json). 1994 and 1983 are reconstructed from
    # their anchors (`pipeline reconstruct`, step 4.6; 1994's stops from F1DB, 1983's from
    # data/reconstruction/<id>.json) and checked on them. The fill model is fitted from the
    # F1DB stops (refuel.race_fill_model). Duels from the Eras spec's race table (§4), the
    # user's driver first; seeds and split as for wave A.
    "hungary-1997": {
        "year": 1997,
        "event": "Hungary",
        "source": "jolpica",
        "name": "Hungary 1997: Hill vs Villeneuve",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HIL",
        "rival": "VIL",  # defend: Hill holds P1 (real: hydraulics on lap 74, Villeneuve wins)
        "score_positions": 6,
        "split": "eras",
    },
    "europe-1997": {
        "year": 1997,
        "event": "European",
        "source": "jolpica",
        "name": "Europe 1997: Villeneuve vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VIL",
        "rival": "MSCM",  # beat-rival: Villeneuve ahead of Schumacher, the title decider
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-1998": {
        "year": 1998,
        "event": "Hungary",
        "source": "jolpica",
        "name": "Hungary 1998: Coulthard vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras side by hard calls (Eras 6.2 re-author, the honest grader: COU 2, MSCM 0).
        "user_side": "COU",
        "rival": "MSCM",
        "score_positions": 6,
        "split": "eras",
    },
    "malaysia-1999": {
        "year": 1999,
        "event": "Malaysia",
        "source": "jolpica",
        "name": "Malaysia 1999: Irvine vs Häkkinen",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "IRV",
        "rival": "HAK",  # deny: Irvine wins, Häkkinen (title rival) kept P3 or lower
        "score_positions": 6,
        "split": "eras",
    },
    "spain-1994": {
        "year": 1994,
        "event": "Spanish",  # `pipeline reconstruct spain-1994 --event Spanish`
        "source": "reconstruct",
        "name": "Spain 1994: Hill vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras plays the side with more hard calls (6.2, `pipeline hard-calls`: HIL 1, MSCM 0).
        "user_side": "HIL",
        "rival": "MSCM",  # win: Hill beats Schumacher, who is stuck in fifth gear
        "score_positions": 6,
        "split": "eras",
    },
    "australia-1994": {
        "year": 1994,
        "event": "Australia",
        "source": "reconstruct",
        "name": "Australia 1994: Hill vs Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        # Eras plays the side with more hard calls (6.2 re-author, `pipeline hard-calls` on
        # the sourced lap leaders: HIL 1, MSCM 0).
        "user_side": "HIL",
        "rival": "MSCM",  # beat-rival: Hill ahead of Schumacher (real: they collide, both out)
        "score_positions": 6,
        "split": "eras",
    },
    "south-africa-1983": {
        "year": 1983,
        "event": "South Africa",
        "source": "reconstruct",
        "name": "South Africa 1983: Piquet vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "PIQN",
        "rival": "PRO",  # Piquet high enough for the title: Prost, his title rival
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): refuelling races with a red flag, wet, from Jolpica with
    # F1DB stops as above, then `pipeline wet-laps`. The red flags are R1's
    # (data/redflags/<id>.json): europe-2007 is suspended on laps 4-5 and resumed behind the SC;
    # brazil-2003 ended under red and is classified at lap 54 (redflag.cut_at_results);
    # belgium-1998's start was voided and the race rerun (redflag.is_voided_start).
    "europe-2007": {
        "year": 2007,
        "event": "Europe",
        "source": "jolpica",
        "name": "Europe 2007: Alonso vs Massa",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ALO",
        "rival": "MAS",  # win: Alonso chases Massa (real: passes him in the rain on lap 56)
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2003": {
        "year": 2003,
        "event": "Brazil",
        "source": "jolpica",
        "name": "Brazil 2003: Fisichella vs Räikkönen",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "FIS",
        "rival": "RAI",  # win in the chaos: Räikkönen, the car behind at the results lap
        "score_positions": 6,
        "split": "eras",
    },
    "belgium-1998": {
        "year": 1998,
        "event": "Belgium",
        "source": "jolpica",
        "name": "Belgium 1998: Hill vs Ralf Schumacher",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HIL",
        "rival": "SCH",  # team: Jordan 1-2; Ralf Schumacher, the team-mate next to Hill
        "score_positions": 6,
        "split": "eras",
    },
    # Eras wave B (build plan 5.1): wet refuelling races 1996-2008 from Jolpica (`pipeline
    # jolpica`, F1DB stops, the 2.4 estimates), then `pipeline wet-laps` (wetness and tyre
    # classes from the lap times, step 4.5; docs/eras-checks/4.5-wet-races.md), with the fill
    # model fitted from the F1DB stops. The duel is the storyline pair of the Eras spec's race
    # table (§4), the user's driver first; split and seeds as above.
    "spain-1996": {
        "year": 1996,
        "event": "Spain",
        "source": "jolpica",
        "name": "Spain 1996: Schumacher vs Alesi",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "MSCM",
        "rival": "ALE",  # Schumacher wins in the rain: Alesi, the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "europe-1999": {
        "year": 1999,
        "event": "European",
        "source": "jolpica",
        "name": "Europe 1999: Herbert vs Trulli",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HER",
        "rival": "TRU",  # Herbert wins from P14: Trulli, the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "germany-2000": {
        "year": 2000,
        "event": "German",
        "source": "jolpica",
        "name": "Germany 2000: Barrichello vs Häkkinen",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BAR",
        "rival": "HAK",  # Barrichello wins from P18 on slicks: Häkkinen, the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "malaysia-2001": {
        "year": 2001,
        "event": "Malaysia",
        "source": "jolpica",
        "name": "Malaysia 2001: Schumacher vs Barrichello",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "MSCM",
        "rival": "BAR",  # Schumacher recovers the lead: Barrichello, the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "united-states-2003": {
        "year": 2003,
        "event": "United States",
        "source": "jolpica",
        "name": "United States 2003: Schumacher vs Räikkönen",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "MSCM",
        "rival": "RAI",  # Schumacher on the right tyre: Räikkönen, the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "hungary-2006": {
        "year": 2006,
        "event": "Hungary",
        "source": "jolpica",
        "name": "Hungary 2006: Button vs de la Rosa",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "BUT",
        "rival": "DLR",  # Button wins from P14: de la Rosa, the car behind at the flag
        "score_positions": 6,
        "split": "eras",
    },
    "china-2007": {
        "year": 2007,
        "event": "China",
        "source": "jolpica",
        "name": "China 2007: Hamilton vs Alonso",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "ALO",  # Hamilton high enough to clinch: Alonso, his nearest title rival
        "score_positions": 6,
        "split": "eras",
    },
    "brazil-2008": {
        "year": 2008,
        "event": "Brazil",
        "source": "jolpica",
        "name": "Brazil 2008: Hamilton vs Massa",
        "era": "1994-2009",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "HAM",
        "rival": "MAS",  # Hamilton P5 or better for the title: Massa, his title rival
        "score_positions": 6,
        "split": "eras",
    },
    # Eras build plan 5.6: the four replacement races (owner, Nov 7;
    # docs/eras-checks/swap-races.md). belgium-2023 from OpenF1 (its shower is in the weather
    # data), great-britain-2016 from TUM then `pipeline wet-laps`, france-1990 and germany-1986
    # reconstructed (`pipeline reconstruct`). Duels, seeds and split as for wave A.
    "belgium-2023": {
        "year": 2023,
        "event": "Belgium",
        "source": "openf1",
        "name": "Belgium 2023: Verstappen vs Pérez",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VER",
        "rival": "PER",  # win from P6 after the gearbox penalty: Pérez, the car behind
        "score_positions": 6,
        "split": "eras",
    },
    "great-britain-2016": {
        "year": 2016,
        "event": "Great Britain",
        "source": "tum",
        "name": "Britain 2016: Verstappen vs Rosberg",
        "era": "2014-2025",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "VER",
        "rival": "ROS",  # position: the podium; Rosberg, his fight for P2 on the road
        "score_positions": 6,
        "split": "eras",
    },
    "france-1990": {
        "year": 1990,
        "event": "French",
        "source": "reconstruct",
        "name": "France 1990: Capelli vs Prost",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "CAP",
        "rival": "PRO",  # win from P7 with no tyre stop; Prost, who caught and passed him
        "score_positions": 6,
        "split": "eras",
    },
    "germany-1986": {
        "year": 1986,
        "event": "German",
        "source": "reconstruct",
        "name": "Germany 1986: Rosberg vs Senna",
        "era": "1988-1993",
        "takeover_lap": None,  # D3 rule
        "seed": 1,
        "user_side": "ROSK",
        "rival": "SENA",  # position: P2 or better on the fuel; Senna, who took the P2 he lost
        "score_positions": 6,
        "split": "eras",
    },
}


@dataclass
class BuildResult:
    model: dict
    laps: pd.DataFrame
    notes: list[str] = field(default_factory=list)  # priors/fallbacks the build relied on
    estimates: list[str] = field(default_factory=list)  # estimated fields and quirks (2.4)
    fit: object | None = None  # the dry lap model (fit.LapTimeFit; overtaking.py reads it)
    wet: bool = False  # a wet race (wet.is_wet_race)


def load_sidecar(race_id: str, raw_dir: Path = RAW_DIR) -> dict | None:
    """The race's Jolpica sidecar (<race-id>.jolpica.json), if it was ingested from Jolpica."""
    path = Path(raw_dir) / f"{race_id}.jolpica.json"
    return json.loads(path.read_text()) if path.exists() else None


def load_reconstruction(race_id: str, raw_dir: Path = RAW_DIR) -> dict | None:
    """The race's reconstruction sidecar (<race-id>.reconstruction.json, `pipeline
    reconstruct`), if it was rebuilt from its anchors (a 1983-1995 race)."""
    path = reconstruct.sidecar_path(race_id, Path(raw_dir))
    return json.loads(path.read_text()) if path.exists() else None


def reconstructed_laps(laps: pd.DataFrame, year: int) -> pd.DataFrame:
    """A reconstructed race's synthetic laps with their compounds filled as step 2.4 does
    (one dry compound before 2007): the reconstruction leaves Compound empty on its slick
    stints. A wet race's wet-tyre stints (from its facts file's weather) keep their
    INTERMEDIATE / WET."""
    era = estimates.era_for_year(year)
    refuelling = year in estimates.REFUELLING
    wet_tyre = laps["Compound"].astype(str).isin(wet.WET_COMPOUNDS)
    dry = laps.copy()
    dry.loc[wet_tyre, "Compound"] = None
    out = estimates.estimate_compounds(dry, year, estimates.burn_per_lap(era), refuelling).laps
    out.loc[wet_tyre, "Compound"] = laps.loc[wet_tyre, "Compound"]
    return out


def reconstructed_pit_loss(params: track.TrackParams, recon: dict) -> track.TrackParams:
    """A reconstructed race with no stop to measure (none sourced) takes the pit loss its
    reconstruction assumes for a stop with no sourced lane time (lane time less the track it
    bypasses, reconstruct.Params): the loss a stop in its synthetic laps would show."""
    if params.pit_loss is not None:
        return params
    p = recon["params"]
    loss = round(max(float(p["default_lane_time"]) - float(p["pit_bypass"]), 0.0), 3)
    note = (
        f"pitLoss: no stop in the reconstruction, its assumed {loss}s (lane time"
        f" {p['default_lane_time']}s less the {p['pit_bypass']}s bypassed; no source has one)"
    )
    return replace(
        params,
        pit_loss=loss,
        pit_loss_under_sc=loss * track.SC_PIT_LOSS_FACTOR,
        pit_loss_under_vsc=loss * track.VSC_PIT_LOSS_FACTOR,
        notes=[*params.notes, note],
    )


def official_result(model: dict, recon: dict) -> tuple[dict, list[str]]:
    """The race file's realResult for a reconstruction with disqualified cars placed on the
    road (facts `roadPositions`, owner decision Nov 8): the cars still run to the flag at their
    road place, but the official result keeps them excluded, listed behind the classified cars
    (as Jolpica's order has them). Returns the model and report lines."""
    placed = [r["driver"] for r in sorted(recon["roadPositions"], key=lambda r: r["position"])]
    classified = set(recon.get("classified") or [])
    order = [c for c in model["realResult"] if c not in placed]
    after = max((i for i, c in enumerate(order) if c in classified), default=-1) + 1
    order[after:after] = [d for d in placed if d in model["realResult"]]
    lines = [
        f"  realResult: {r['driver']} disqualified, P{r['position']} on the road"
        + (f" at +{r['gap']:.3f}s" if r["gapSourced"] else " (gap estimated)")
        + f"; listed P{order.index(r['driver']) + 1}, behind the classified cars"
        for r in recon["roadPositions"]
        if r["driver"] in order
    ]
    return {**model, "realResult": order}, lines


def scripted_blocks(
    model: dict, race_id: str, recon: dict | None, team_orders: list[dict] | None = None
) -> tuple[dict, list[str]]:
    """Eras model fixes M4 (Eras builds only): the SC restart's jump and spread
    (`track.restart`, restart.py), the race's sourced team orders and let-bys as TEAM_ORDER
    events (data/incidents.json), and a reconstruction's last-lap stops (`lastLapStops`: a car
    that ran dry on the last lap) as RETIREMENT events on the last lap where the timing doesn't
    already show one. Returns the model and report lines."""
    out, lines = {**model}, []
    if restart.IN_ERAS_BUILDS:
        out = {**model, "track": {**model["track"], "restart": restart.track_block()}}
        lines.append(
            f"SC restart: jump {restart.JUMP}s, spread {restart.SPREAD}s a place"
            f" (to P{restart.PLACES + 1})"
        )
    facts = incidents.team_order_facts(race_id) if team_orders is None else team_orders
    added = incidents.team_order_events(facts, out)
    total = int(out["race"]["laps"])
    retired = {e["driver"] for e in out["events"] if e["type"] == "RETIREMENT"}
    for s in (recon or {}).get("lastLapStops") or []:
        if s["driver"] not in retired:
            added.append({"lap": total, "type": "RETIREMENT", "driver": s["driver"]})
            lines.append(f"  last-lap stop: {s['driver']} retires on lap {total} (sourced)")
    for e in added:
        if e["type"] == "TEAM_ORDER":
            lines.append(f"  team order: lap {e['lap']} {e['driver']} lets {e['other']} by")
    if added:
        out["events"] = sorted([*out["events"], *added], key=lambda e: (e["lap"], e["type"]))
    return out, lines


def eras_meta(race_id: str, sidecar: dict) -> dict:
    """A registry entry for a Jolpica race not in RACES (the Eras races until Phase 3 registers
    them): its season's era, the automatic duel and the D3 takeover, seed 1."""
    year = int(sidecar["year"])
    return {
        "year": year,
        "event": sidecar.get("eventName"),
        "name": f"{race_id} (Eras, unregistered)",
        "era": estimates.era_for_year(year),
        "takeover_lap": None,
        "seed": 1,
        "user_side": None,
        "rival": None,
        "score_positions": 6,
        "split": "eras",
    }


def resolved_meta(race_id: str, laps: pd.DataFrame | None = None, raw_dir: Path = RAW_DIR) -> dict:
    """Registry entry with the automatic duel filled in (runner-up vs winner) where unset. A
    race not in RACES with a Jolpica sidecar in raw_dir gets eras_meta."""
    if race_id in RACES:
        meta = dict(RACES[race_id])
    elif (sidecar := load_sidecar(race_id, raw_dir)) is not None:
        meta = eras_meta(race_id, sidecar)
    else:
        raise KeyError(f"unknown race '{race_id}'; known: {sorted(RACES)}")
    if meta["user_side"] is None or meta["rival"] is None:
        if laps is None:
            laps = pd.read_parquet(ingest.raw_snapshot_path(race_id, raw_dir))
        winner, runner_up = assemble.finishing_order(laps)[:2]
        meta["user_side"], meta["rival"] = runner_up, winner
    return meta


@dataclass
class DryFit:
    """The dry lap model of a race and the laps it was fitted on (weather spec: a wet race's
    dry laps only)."""

    clean: pd.DataFrame
    traffic: pd.DataFrame
    fitted: fit.LapTimeFit
    rain: list[dict] | None
    wet: bool
    # "fitted" from the race's dry laps; "reconstruction": a reconstructed race wet on every
    # lap takes its reconstruction's solved dry pace (solver_dry_fit), an estimate.
    dry_pace: str = "fitted"


def _from_raw(load, race_id: str, raw_dir: Path):
    """`load(race_id)` from data/raw, or from another raw directory."""
    return load(race_id) if raw_dir == RAW_DIR else load(race_id, raw_dir)


def _dir_arg(raw_dir: Path) -> tuple[Path, ...]:
    """raw_dir as an extra argument only when it isn't the default, so the one-argument
    loaders existing tests patch in (test_tum.py) keep working."""
    return () if Path(raw_dir) == RAW_DIR else (Path(raw_dir),)


def solver_dry_fit(recon: dict, laps: pd.DataFrame | None = None) -> fit.LapTimeFit:
    """A reconstructed race's dry lap model from its reconstruction (owner decision, Nov 8):
    for a race wet on every lap, which has no dry lap to fit one on. The solver knows each
    car's dry pace: its synthetic laps are (b + w x wear + fuel x laps of fuel on board) x
    (1 + the tyre's wet penalty) + noise (reconstruct.py), so in the sims' terms (basePace +
    degPerLap x wear - fuelEffectPerLap x lap, sim_reference._clean_lap) a car's base pace is
    b + fuel x (laps + 1), the dry compound's wear the field's median w, the fuel effect the
    solver's own, the noise each car's solved noise. The era's one dry compound is the
    reference (before 2007). The wet tyres `laps` run wear as the solver ran them (the car's
    one wear rate, at wet.wear_mult: reconstruct.features), so they take the same wear and no
    offset (their pace is the weather curves'), in place of wet.WET_TYRES' defaults. Every
    number is the solver's estimate, not a measurement."""
    year = int(recon["year"])
    p = recon["params"]
    refuels = p.get("refuel")
    refuels = year >= reconstruct.REFUEL_FROM if refuels is None else bool(refuels)
    if refuels:
        # A refuelling reconstruction's fuel term resets at each stop: no single slope.
        raise ValueError(
            f"{recon['raceId']}: a refuelling reconstruction wet on every lap: its solver's fuel"
            " term resets at each stop, so it gives no single dry pace to build on"
        )
    if year >= estimates.TWO_COMPOUNDS_FROM:
        raise ValueError(f"{recon['raceId']}: solver dry pace is for one dry compound (pre-2007)")
    solved = recon.get("fitted") or {}
    if not solved:
        raise ValueError(f"{recon['raceId']}: its reconstruction has no solved pace (fitted)")
    fuel = float(p["fuel_per_lap"])
    total = int(recon["laps"])
    ref = estimates.SINGLE
    wear = float(pd.Series([float(f["wear"]) for f in solved.values()]).median())
    used = set() if laps is None else set(laps["Compound"].dropna().astype(str))
    tyres = [ref, *[c for c in wet.WET_COMPOUNDS if c in used]]
    fresh_laps = int(
        fit.load_compound_priors(estimates.era_for_year(year)).get("freshTyre", {}).get("laps", 3)
    )
    return fit.LapTimeFit(
        driver_pace={d: float(f["pace"]) + fuel * (total + 1) for d, f in solved.items()},
        driver_noise={d: float(f["noise"]) for d, f in solved.items()},
        compound_offset=dict.fromkeys(tyres, 0.0),
        compound_wear=dict.fromkeys(tyres, wear),
        fuel_per_lap=fuel,
        reference_compound=ref,
        r_squared=float("nan"),
        n_obs=0,
        compound_cliff=dict.fromkeys(tyres),
        fresh_tyre_bonus=0.0,
        fresh_tyre_laps=fresh_laps,
        prior_notes=[
            "dry pace: wet on every lap, so each car's dry pace, the dry wear and the fuel"
            " effect are its reconstruction's solved ones (estimated, not fitted)"
        ],
    )


def running_at(laps: pd.DataFrame, takeover: int) -> set[str]:
    """The cars running at the takeover (a position and a tyre on the takeover lap): the race
    model's cars."""
    state = scenario.state_at_takeover(laps, takeover)
    return {c for c, s in state.items() if s["position"] is not None and s["compound"] is not None}


def with_estimated_pace(
    laps: pd.DataFrame, weather: dict | None, fitted: fit.LapTimeFit, takeover: int
) -> tuple[fit.LapTimeFit, list[str]]:
    """Model fix 1.6 (Eras builds): `fitted` with a dry pace for each car running at the
    takeover that has none (it ran only wet laps: dry_fit fits on the dry ones), estimated by
    wet.estimated_dry_pace, and the build report's lines (provenance: driverPace). A car with
    no pace would be dropped from the model (assemble)."""
    missing = sorted(running_at(laps, takeover) - set(fitted.driver_pace))
    if not missing:
        return fitted, []
    est = wet.estimated_dry_pace(laps, weather, fitted, missing)
    lines = [
        f"estimated: driverPace ({', '.join(missing)}: no dry lap to fit; model fix 1.6)",
        *(
            f"  dry pace {d} {p:.3f} s (noise {n:.3f}): {how}"
            for d, (p, n, how) in sorted(est.items())
        ),
    ]
    return (
        replace(
            fitted,
            driver_pace={**fitted.driver_pace, **{d: p for d, (p, _, _) in est.items()}},
            driver_noise={**fitted.driver_noise, **{d: n for d, (_, n, _) in est.items()}},
        ),
        lines,
    )


def dry_fit(
    race_id: str,
    laps: pd.DataFrame,
    era: str,
    fault_facts: list[dict] | None = None,
    raw_dir: Path = RAW_DIR,
    recon: dict | None = None,
    quad_priors: dict | None = None,
) -> DryFit:
    """The dry lap model. A refuelling race's `laps` carry the Tank and FuelLap columns
    (refuel.with_fuel_columns): the fuel term is fitted on the sim's sawtooth. `recon`: a
    reconstructed race's sidecar (load_reconstruction); wet on every lap, it gives the dry
    pace instead (solver_dry_fit). A real-timing race wet on every lap can't be built.
    `quad_priors` (Eras builds, wear_shape.quad_priors): quadratic wear per dry compound."""
    clean_df, traffic_df, _ = clean.clean_laps(laps)
    # A faulted car's laps while the fault lasts aren't its pace (faults.py fits the loss).
    clean_df = faults.without_fault_laps(clean_df, fault_facts or [], laps)
    traffic_df = faults.without_fault_laps(traffic_df, fault_facts or [], laps)
    # A wet race (weather spec): the dry model is fitted on the laps the rain didn't touch,
    # with the usual fuel effect (its dry laps can be too few to fit one); the weather block
    # then explains the rest.
    rain_data = _from_raw(ingest.load_weather, race_id, raw_dir)
    wet_race = wet.is_wet_race(laps, rain_data)
    if wet_race:
        period = wet.wet_period(laps, rain_data)

        def dry(frame: pd.DataFrame) -> pd.DataFrame:
            slick = frame["Compound"].astype(str).map(wet.tyre_class) == "slick"
            return frame[slick & ~frame["LapNumber"].isin(period)]

        clean_df, traffic_df = dry(clean_df), dry(traffic_df)
        if clean_df.empty and recon is not None:
            # Owner decision (Nov 8): a reconstructed race wet on every lap (monaco-1984,
            # portugal-1985, europe-1993) takes its solver's dry pace. Real timing never does.
            fitted = solver_dry_fit(recon, laps)
            return DryFit(clean_df, traffic_df, fitted, rain_data, wet_race, "reconstruction")
        if clean_df.empty:
            # Wet all race (Brazil 2016, Interlagos 2024: every lap on inters or wets): the
            # wet model is a correction on a dry lap model this race can't give, and the build
            # says so instead of failing inside the fit.
            raise ValueError(
                f"{race_id}: no dry lap to fit the dry model on (no clean slick lap outside the"
                " wet period: every lap on wet-weather tyres or in the wet period); a race wet"
                " from start to finish needs a dry-pace reference from elsewhere"
            )
    # Model v3 stage 6 (T1): pace from clear-air laps only; the sim adds the dirty-air
    # penalty itself when a car follows within range, so traffic laps would count it twice.
    pace_laps = pd.concat([clean_df, traffic_df])
    fitted = fit.fit_lap_model(
        clean_df,
        pace_laps=clean_df if pace_mod.CLEAR_AIR else pace_laps,
        fallback_pace_laps=pace_laps,
        era=era,
        fixed_fuel=wet.FUEL_PRIOR if wet_race else None,
        quad_priors=quad_priors,
    )
    return DryFit(clean_df, traffic_df, fitted, rain_data, wet_race)


def refuelling_race(
    race_id: str, block: dict | None, overlay: dict | None, shared: bool = False
) -> bool:
    """Whether the race file refuels: its overlay's rules.refuelling (the switch the sims read),
    on a race whose file takes its overlay. A race whose stops refuelled (the sidecar lists
    fuelLoads) but whose file wouldn't is an error: the fit and the sims would disagree."""
    rules = (overlay or {}).get("rules") or {}
    on = rules.get("refuelling") is True and not shared
    if not on and "fuelLoads" in (block or {}).get("estimated", []):
        raise ValueError(
            f"{race_id}: its stops refuelled (the sidecar lists fuelLoads) but its race file"
            " has no rules.refuelling: set it in data/eras/<id>.json (python -m pipeline.refuel"
            " overlays)"
        )
    return on


def refuel_report(model: dict, fill: dict | None, slope: dict | None, wet_race: bool) -> list[str]:
    """The build report's lines on a refuelling race's fuel effect and fill rate."""
    fuel = model["fuelEffectPerLap"]
    lines = [
        f"  fuel effect {fuel:.4f} s per lap of fuel on board"
        + (" (the wet races' fixed prior)" if wet_race else ", fitted on the refuelling sawtooth")
        + " (refuel.with_fuel_columns)"
    ]
    if fill is None:
        lines.append(
            "  NO FILL FIT: no F1DB stops (data/raw/f1db/<id>.stops.csv); a new stop pays the"
            f" {refuel.PRIOR_SECONDS_PER_LAP} s/lap prior on its whole fill"
        )
        return lines
    own = (
        f"its own slope {slope['slope']:+.3f} s, se {slope['se']:.3f}"
        if slope and slope["slope"] == slope["slope"]
        else "no slope of its own"
    )
    lines.append(
        f"  fill rate {fill['secondsPerLap']:.4f} s per lap of fuel ({own}; {fill['stops']} stops),"
        f" refFill {fill['refFill']:.1f} laps, tank {fill['tankLaps']} laps (track.refuel)"
    )
    return lines


def lap_time_weather(records: list[dict] | None) -> bool:
    """Whether a race's weather records are `pipeline wet-laps`'s fit from the lap times
    (step 4.5) rather than a rain gauge, so the race's provenance lists weather as estimated."""
    return any(r.get("source") == wet_laps.SOURCE for r in records or [])


def eras_sc_unlap(year: int | None) -> str | None:
    """race.scUnlap for an Eras build: "none" in a season whose lapped cars couldn't unlap
    behind the SC (race_rules.sc_unlap_for_year: before 2007 and 2010-11), else None (the
    default, every lapped car unlaps)."""
    if year is None:
        return None
    return "none" if race_rules.sc_unlap_for_year(int(year)) == "none" else None


def load_overlay(race_id: str, eras_dir: Path = ERAS_DIR) -> dict | None:
    """data/eras/<race-id>.json, the race's authored Eras keys; None without one. A key that
    isn't one of OVERLAY_KEYS is an error (a typo would otherwise be dropped silently)."""
    path = Path(eras_dir) / f"{race_id}.json"
    if not path.exists():
        return None
    overlay = json.loads(path.read_text())
    unknown = sorted(set(overlay) - set(OVERLAY_KEYS))
    if unknown:
        raise ValueError(f"{path}: unknown keys {unknown} (allowed: {list(OVERLAY_KEYS)})")
    return overlay


def pinned_schema_version(race_id: str, model: dict, pools_path: Path = POOLS_PATH) -> dict:
    """A Daily/Gauntlet pool race keeps the schemaVersion of its committed file: its file and
    hash are pinned in production, and a newer version stamp would change both. Other races
    get the current version."""
    committed = RACES_DIR / f"{race_id}.json"
    if race_id not in shared_races(pools_path) or not committed.exists():
        return model
    version = json.loads(committed.read_text()).get("schemaVersion")
    if version is None or version == model.get("schemaVersion"):
        return model
    return {**model, "schemaVersion": version}


def shared_races(pools_path: Path = POOLS_PATH) -> frozenset[str]:
    """The Daily and Gauntlet (survivor) races of data/pools.json. Their race files keep their
    Daily content and hash, so `build_race` leaves their Eras overlay out (the Worker merges it
    in for Eras: apps/worker/src/erasOverlay.ts)."""
    pools = json.loads(Path(pools_path).read_text())
    return frozenset([*pools.get("daily", []), *pools.get("survivor", {})])


def apply_eras(model: dict, estimated: list[str], overlay: dict | None) -> tuple[dict, list[str]]:
    """The model with its provenance (the estimated fields, merged with the overlay's) and the
    overlay's eras / rules / storylineEvents / decisionMoments, via export.with_eras_fields
    (which also plays it from eras.userSide). Unchanged (the same dict) when there's nothing
    to apply. Returns the model and report lines."""
    prov = estimates.provenance(estimated, (overlay or {}).get("provenance"))
    if prov is None and not overlay:
        return model, []
    overlay = overlay or {}
    storyline = [(int(lap), str(kind)) for lap, kind in overlay.get("storylineEvents", [])]
    out = export.with_eras_fields(
        model,
        eras=overlay.get("eras"),
        provenance=prov,
        rules=overlay.get("rules"),
        storyline_events=storyline or None,
        decision_moments=overlay.get("decisionMoments"),
    )
    lines = [f"overlay: {', '.join(k for k in OVERLAY_KEYS if k in overlay)}"] if overlay else []
    return out, lines


def build_race(
    race_id: str,
    laps: pd.DataFrame | None = None,
    raw_dir: Path = RAW_DIR,
    fault_facts: list[dict] | None = None,
    *,
    eras_dir: Path = ERAS_DIR,
    pools_path: Path = POOLS_PATH,
    wet_inputs: list | None = None,
    wear_shape: bool = True,
) -> BuildResult:
    """Build a validated race-model dict for a registered race (or an ingested Jolpica one),
    with its build notes, its estimates applied as provenance and its Eras overlay, unless it
    is a Daily or Gauntlet race (`shared_races`): its overlay stays out of its file.
    `raw_dir`: where its snapshot lives; `fault_facts`: its car faults (default: its FAULT
    items in data/incidents.json); `pools_path`: the pools file naming the shared races.
    `wet_inputs`: a list that an Eras build of a timed wet race appends its (laps, weather
    records, dry model) to, for the Eras wet-curve fit (`pipeline wet-fit --eras`).
    `wear_shape`: False leaves out Eras model fix S4's quadratic wear (wear_shape.py measures
    races without it)."""
    if laps is None:
        laps = pd.read_parquet(ingest.raw_snapshot_path(race_id, raw_dir))
    # Red flags (eras build plan 4.3): a race ended under the red flag ends at its results
    # lap; a hand-entered file marks the red laps a source without red-flag timing (TUM,
    # Jolpica) can't show; a voided start is a fresh race (redflag.race_entries).
    red_flags = redflag.load_entries(race_id, raw_dir)
    laps = redflag.cut_at_results(laps, red_flags)
    meta = resolved_meta(race_id, laps, raw_dir)
    laps, red_flags, red_notes = redflag.race_entries(laps, red_flags, meta.get("year"))
    if fault_facts is None:
        fault_facts = incidents.fault_facts(race_id)
    # A race rebuilt from its anchors (step 4.6): its compounds are filled here, and its file
    # is marked reconstructed with the sidecar's provenance (eras build plan 5.1).
    recon = load_reconstruction(race_id, raw_dir)
    unfitted: list[dict] = []
    if recon is not None:
        laps = reconstructed_laps(laps, int(recon["year"]))
        # A fault's magnitude is fitted from the car's real laps (faults.py); a reconstructed
        # race's laps are synthetic, solved to the anchors with no fault in them, so a fit
        # would only read back the solver's noise. Its faults stay out until a sourced loss is
        # built into the faulted car's laps (reported, never guessed).
        unfitted, fault_facts = fault_facts, []
    fault_facts, fault_notes = faults.split_retired(laps, fault_facts)
    sidecar = load_sidecar(race_id, raw_dir) or {}
    block = sidecar.get("estimates")
    overlay = load_overlay(race_id, eras_dir)
    shared = overlay is not None and race_id in shared_races(pools_path)
    refuelling = refuelling_race(race_id, block, overlay, shared)
    # Eras builds (a race whose file takes its Eras overlay; never a Daily/Gauntlet race, whose
    # file must replay as it is). See the fixes listed below.
    eras_build = overlay is not None and not shared
    # Eras model fix S4 (wear_shape.py): quadratic wear per dry compound, shrunk to the track
    # and era's. Real timing only (a reconstruction's laps are solved to a linear wear).
    quad_priors, shape_note = None, None
    if eras_build and recon is None and wear_shape:
        quad_priors, shape_note = wear_shape_mod.quad_priors(race_id, meta["era"])
    refuel_fit = refuel_slope = None
    if refuelling:
        # Eras build plan 4.2: every fuel term reads the tank the sim carries (to the next
        # real stop, plus the reserve), and the fill rate is fitted from the F1DB stops.
        total = int(laps["LapNumber"].max())
        ins = refuel.stop_in_laps(scenario.real_strategy(laps))
        laps = refuel.with_fuel_columns(laps, ins, total)
        refuel_fit, refuel_slope = refuel.race_fill_model(
            race_id, sidecar.get("results"), Path(raw_dir) / "f1db"
        )

    dry = dry_fit(race_id, laps, meta["era"], fault_facts, raw_dir, recon, quad_priors)
    clean_df, traffic_df, fitted = dry.clean, dry.traffic, dry.fitted
    weather = wet.weather_block(laps, dry.rain, fitted, wet.load_curves()) if dry.wet else None
    # Eras sim fixes (a race whose file takes its Eras overlay; never a Daily/Gauntlet race,
    # whose file must replay as it is): the robust pit loss, stops with no tyre change, the
    # year's no-unlapping rule, the stop-loss fixes (a back-to-back stop's shared lap
    # counted once; stops on partly yellow laps priced in the sim frame), and driver pace by
    # track state (model fix M1: damp and wet pace from clear-air laps against the field, and
    # the race's full wets against its inters; real lap timing only).
    damp_pace = None
    takeover = meta["takeover_lap"]
    if takeover is None:
        takeover = scenario.default_takeover_lap(
            laps,
            events.extract_events(laps),
            [meta["user_side"], meta["rival"]],
        )
    pace_lines: list[str] = []
    # Not a reconstructed race: its laps are solved to the anchors, so a driver's pace against
    # the field on a lap would read back the solver's noise (as with its faults, above).
    if weather and eras_build and recon is None:
        # Eras model fix 1.3: the Eras wet curves (data/wet-eras.json), refitted on the Eras
        # wet races' mixed-tyre laps (wet.fit_eras_curves); the timeline follows them.
        if wet_inputs is not None:
            wet_inputs.append((laps, dry.rain, fitted))
        weather = wet.eras_weather_block(laps, dry.rain, fitted)
        shift = wet.wet_tyre_shift(laps, weather, fitted)
        if shift:  # the race tells full wets from inters: its own wet curve, and timeline
            weather = wet.weather_block(
                laps, dry.rain, fitted, wet.shifted_curves(weather["curves"], shift)
            )
    if eras_build and recon is None:
        # Model fix 1.6: a car still running at the takeover with no dry lap (wet laps only)
        # takes an estimated dry pace, after the weather is fitted (without it) and before
        # the wet pace (its own then measured against it). Not a reconstructed race: its laps
        # against the field would read back the solver's (belgium-1992's BOUT, reported).
        fitted, pace_lines = with_estimated_pace(laps, weather, fitted, takeover)
    if weather and eras_build and recon is None:
        wet_pace, damp_pace = wet.driver_band_pace(laps, weather, fitted)
    elif weather:
        wet_pace = wet.driver_wet_pace(laps, weather, fitted, wet.wet_period(laps, dry.rain))
    else:
        wet_pace = None
    params = track.fit_track_params(
        laps,
        clean_df,
        traffic_df,
        fitted,
        pit_loss_guard=eras_build,
        refuelling=refuelling,
        eras_stops=eras_build,
    )
    if recon is not None:
        params = reconstructed_pit_loss(params, recon)
    if eras_build and recon is None:
        # Eras sim fix M3 (overtaking.py): the pooled overtake model (slopes per era group,
        # intercept per track layout, partly pooled with the race's own rate) and the train
        # term the sims apply when the file has trainCoef. Not a reconstructed race: its laps
        # (and so its passes) are solved to the anchors, which its replay is checked against.
        own = track.pass_opportunities(laps, fitted)
        model_ot, ot_note = overtaking.eras_model(race_id, own)
        params = replace(params, overtake_model=model_ot, notes=[*params.notes, ot_note])
    dirty = None
    if eras_build and recon is None and dirty_air.IN_ERAS_BUILDS:
        # Eras sim fix W3 (dirty_air.py): the dirty-air loss by start-of-lap gap band, the
        # race's real loss (pooled by era group and track layout) taken off the pace offsets'
        # laps, the sims' banded cost and held gap. A wet race's laps (against its dry model)
        # don't measure it: it takes its layout's.
        rows = None if dry.wet else dirty_air.real_laps(laps, fitted)
        dirty, da_note = dirty_air.eras_dirty_air(race_id, rows)
        held = dirty_air.held_gap()
        if held is not None:
            params = replace(params, overtake_model={**params.overtake_model, "heldGap": held})
        params = replace(params, notes=[*params.notes, da_note])

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
        fastest_lap_point=meta["year"] in scenario.FASTEST_LAP_POINT_YEARS,
        rival=meta["rival"],
        track_status=_from_raw(ingest.load_track_status, race_id, raw_dir),
        sc_unlap=meta.get("sc_unlap")
        or (eras_sc_unlap(meta.get("year") or race_rules.year_of(race_id)) if eras_build else None),
        weather=weather,
        wet_pace=wet_pace,
        damp_pace=damp_pace,
        fault_facts=fault_facts,
        year=meta.get("year"),
        red_flags=red_flags,
        refuel=refuel_fit,
        # A refuelling race's stop that kept its tyres may be a fuel-only stop: not one.
        service_stops=eras_build and not refuelling,
        eras_stops=eras_build,
        # Pace by stint (Eras model fix M2): timed races only (a reconstruction's laps are
        # solved to its anchors, so their stint residuals are the solver's, not the drivers').
        stint_pace=eras_build and recon is None,
        dirty_air=dirty,
    )
    if eras_build and recon is None:
        missing = sorted(running_at(laps, takeover) - {d["code"] for d in model["drivers"]})
        if missing:
            raise ValueError(f"{race_id}: cars running at the takeover not in the model: {missing}")
    official_lines: list[str] = []
    if recon is not None and recon.get("roadPositions"):
        model, official_lines = official_result(model, recon)
    scripted_lines: list[str] = []
    if eras_build:
        model, scripted_lines = scripted_blocks(model, race_id, recon)
        if restart.LAPS_DOWN_IN_ERAS_BUILDS:
            # Job 1.5: a no-unlapping race's SC and red-flag queues take each scripted car's
            # real laps down (restart.with_laps_down), not the sims' own gaps.
            model, down_lines = restart.with_laps_down(model, laps)
            scripted_lines += down_lines
    estimated = list((block or {}).get("estimated", []))
    if recon is not None:
        estimated += [f for f in recon["provenance"].get("estimated", []) if f not in estimated]
    fitted_weather = lap_time_weather(dry.rain)
    if fitted_weather:
        estimated.append("weather")  # step 4.5: the wetness is fitted from the lap times
    if pace_lines:
        estimated.append("driverPace")  # model fix 1.6: a wet-only car's dry pace
    if shared:
        # The Worker's merge replaces the provenance block outright (as with_eras_fields
        # does), so it can't also carry this build's estimated fields.
        if estimated and "provenance" in overlay:
            raise ValueError(
                f"{race_id}: a Daily/Gauntlet race with estimated fields {estimated} can't "
                "take an overlay provenance (the Worker's merge would drop them)"
            )
        model, overlay_lines = apply_eras(model, estimated, None)
        overlay_lines = [
            *overlay_lines,
            f"overlay: {', '.join(k for k in OVERLAY_KEYS if k in overlay)} "
            "(a Daily/Gauntlet race: served beside the race file, not in it)",
        ]
    else:
        model, overlay_lines = apply_eras(model, estimated, overlay)
        overlay_lines += storyline.check(
            model, ((overlay or {}).get("eras") or {}).get("storylineRetirements")
        )
    if recon is not None:
        # The sidecar's estimated fields merged with the overlay's (apply_eras), kind
        # reconstructed.
        prov = {**model["provenance"], "kind": "reconstructed"}
        model = reconstruct.mark_model(model, {"provenance": prov})
    report = [
        *(estimates.report_lines(block) if block else []),
        *overlay_lines,
        *scripted_lines,
        *red_notes,
        *pace_lines,
    ]
    if recon is not None:
        report.append(
            f"reconstructed (step 4.6): all anchors pass: {recon['solver']['passed']};"
            f" estimated {', '.join(model['provenance'].get('estimated', []))}"
        )
        if dry.dry_pace == "reconstruction":
            report.append(
                "  dry pace: wet on every lap (no dry lap to fit): each car's dry pace, the dry"
                " wear and the fuel effect from the reconstruction's solver (estimated;"
                " provenance: weather)"
            )
        report.extend(official_lines)
        for f in unfitted:
            report.append(
                f"  fault not modelled: lap {f['lap']} {f['driver']} {f['fault']} (synthetic"
                " laps can't fit its loss; no sourced magnitude)"
            )
    if fitted_weather:
        report.append("estimated: weather (wet laps from the lap times, `pipeline wet-laps`)")
    if refuelling:
        report.extend(refuel_report(model, refuel_fit, refuel_slope, dry.wet))
    model = pinned_schema_version(race_id, model, pools_path)
    return BuildResult(
        model=model,
        laps=laps,
        notes=[
            *fitted.prior_notes,
            *([shape_note] if shape_note else []),
            *params.notes,
            *fault_notes,
        ],
        estimates=report,
        fit=fitted,
        wet=dry.wet,
    )


def build_race_model(
    race_id: str, laps: pd.DataFrame | None = None, **dirs: Path
) -> tuple[dict, pd.DataFrame]:
    """Build a validated race-model dict for a registered race. Returns (model, laps).
    `dirs`: build_race's raw_dir / eras_dir."""
    result = build_race(race_id, laps, **dirs)
    return result.model, result.laps
