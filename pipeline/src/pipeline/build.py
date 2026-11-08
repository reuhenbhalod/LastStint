"""End-to-end race-model build (Phase 1.6/1.8 glue).

One canonical path from a committed lap snapshot to a validated race-model dict:
ingest snapshot -> clean -> fit (race-pace base pace) -> track params -> assemble. Used by
the tests, the golden-file generator, and the CLI so they never drift.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from . import assemble, clean, estimates, events, export, fit, ingest, scenario, track, wet
from . import pace as pace_mod
from .paths import DATA_DIR, RAW_DIR

# Authored Eras content (eras build plan, "Eras overlay files"): data/eras/<race-id>.json,
# with up to four keys, applied over the built model by export.with_eras_fields.
ERAS_DIR = DATA_DIR / "eras"
OVERLAY_KEYS = ("eras", "provenance", "rules", "storylineEvents")

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
}


@dataclass
class BuildResult:
    model: dict
    laps: pd.DataFrame
    notes: list[str] = field(default_factory=list)  # priors/fallbacks the build relied on
    estimates: list[str] = field(default_factory=list)  # estimated fields and quirks (2.4)


def load_sidecar(race_id: str, raw_dir: Path = RAW_DIR) -> dict | None:
    """The race's Jolpica sidecar (<race-id>.jolpica.json), if it was ingested from Jolpica."""
    path = Path(raw_dir) / f"{race_id}.jolpica.json"
    return json.loads(path.read_text()) if path.exists() else None


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


# A refuelling race's fuel effect (s/lap) until eras build plan 4.2: the fit's fuel term is a
# slope on the race lap, which refuelling breaks (the car is refilled at each stop, so the
# weight saws up and down), and it can come out negative. 0 = no race-long weight trend.
REFUELLING_FUEL = 0.0


def _dir_arg(raw_dir: Path) -> tuple[Path, ...]:
    """raw_dir as an extra argument only when it isn't the default, so the one-argument
    loaders existing tests patch in (test_tum.py) keep working."""
    return () if Path(raw_dir) == RAW_DIR else (Path(raw_dir),)


def dry_fit(
    race_id: str,
    laps: pd.DataFrame,
    era: str,
    raw_dir: Path = RAW_DIR,
    refuelling: bool = False,
) -> DryFit:
    clean_df, traffic_df, _ = clean.clean_laps(laps)
    # A wet race (weather spec): the dry model is fitted on the laps the rain didn't touch,
    # with the usual fuel effect (its dry laps can be too few to fit one); the weather block
    # then explains the rest.
    rain_data = ingest.load_weather(race_id, *_dir_arg(raw_dir))
    wet_race = wet.is_wet_race(laps, rain_data)
    if wet_race:
        period = wet.wet_period(laps, rain_data)

        def dry(frame: pd.DataFrame) -> pd.DataFrame:
            slick = frame["Compound"].astype(str).map(wet.tyre_class) == "slick"
            return frame[slick & ~frame["LapNumber"].isin(period)]

        clean_df, traffic_df = dry(clean_df), dry(traffic_df)
    # Model v3 stage 6 (T1): pace from clear-air laps only; the sim adds the dirty-air
    # penalty itself when a car follows within range, so traffic laps would count it twice.
    pace_laps = pd.concat([clean_df, traffic_df])
    fitted = fit.fit_lap_model(
        clean_df,
        pace_laps=clean_df if pace_mod.CLEAR_AIR else pace_laps,
        fallback_pace_laps=pace_laps,
        era=era,
        fixed_fuel=REFUELLING_FUEL if refuelling else wet.FUEL_PRIOR if wet_race else None,
    )
    return DryFit(clean_df, traffic_df, fitted, rain_data, wet_race)


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


def apply_eras(model: dict, estimated: list[str], overlay: dict | None) -> tuple[dict, list[str]]:
    """The model with its provenance (the estimated fields, merged with the overlay's) and the
    overlay's eras / rules / storylineEvents, via export.with_eras_fields. Unchanged (the same
    dict) when there's nothing to apply. Returns the model and report lines."""
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
    )
    lines = [f"overlay: {', '.join(k for k in OVERLAY_KEYS if k in overlay)}"] if overlay else []
    return out, lines


def build_race(
    race_id: str,
    laps: pd.DataFrame | None = None,
    *,
    raw_dir: Path = RAW_DIR,
    eras_dir: Path = ERAS_DIR,
) -> BuildResult:
    """Build a validated race-model dict for a registered race (or an ingested Jolpica one),
    with its build notes, its estimates applied as provenance and its Eras overlay."""
    if laps is None:
        laps = pd.read_parquet(ingest.raw_snapshot_path(race_id, raw_dir))
    meta = resolved_meta(race_id, laps, raw_dir)
    block = (load_sidecar(race_id, raw_dir) or {}).get("estimates")
    refuelling = "fuelLoads" in (block or {}).get("estimated", [])

    dry = dry_fit(race_id, laps, meta["era"], raw_dir, refuelling)
    clean_df, traffic_df, fitted = dry.clean, dry.traffic, dry.fitted
    weather = wet.weather_block(laps, dry.rain, fitted, wet.load_curves()) if dry.wet else None
    wet_pace = (
        wet.driver_wet_pace(laps, weather, fitted, wet.wet_period(laps, dry.rain))
        if weather
        else None
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
        fastest_lap_point=meta["year"] in scenario.FASTEST_LAP_POINT_YEARS,
        rival=meta["rival"],
        track_status=ingest.load_track_status(race_id, *_dir_arg(raw_dir)),
        sc_unlap=meta.get("sc_unlap"),
        weather=weather,
        wet_pace=wet_pace,
    )
    model, overlay_lines = apply_eras(
        model, (block or {}).get("estimated", []), load_overlay(race_id, eras_dir)
    )
    report = [*(estimates.report_lines(block) if block else []), *overlay_lines]
    if refuelling:
        report.append(
            f"  fuel effect fixed at {REFUELLING_FUEL} s/lap: a refuelling race (step 4.2)"
        )
    return BuildResult(
        model=model,
        laps=laps,
        notes=[*fitted.prior_notes, *params.notes],
        estimates=report,
    )


def build_race_model(
    race_id: str, laps: pd.DataFrame | None = None, **dirs: Path
) -> tuple[dict, pd.DataFrame]:
    """Build a validated race-model dict for a registered race. Returns (model, laps).
    `dirs`: build_race's raw_dir / eras_dir."""
    result = build_race(race_id, laps, **dirs)
    return result.model, result.laps
