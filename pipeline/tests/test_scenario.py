"""Unit tests for scenario (Phase 1.5), offline against the Abu Dhabi 2021 snapshot."""

from __future__ import annotations

import json

import pandas as pd
import pytest

from pipeline import events, ingest, paths, scenario


@pytest.fixture(scope="module")
def laps() -> pd.DataFrame:
    return pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))


def test_real_strategy_reproduces_stops(laps: pd.DataFrame):
    strat = scenario.real_strategy(laps)
    assert strat["HAM"] == [{"lap": 15, "to": "HARD"}]
    ver = strat["VER"]
    assert len(ver) == 3
    assert ver[-1] == {"lap": 54, "to": "SOFT"}  # the decisive stop under the late SC


def test_state_at_takeover_matches_timing_screen(laps: pd.DataFrame):
    state = scenario.state_at_takeover(laps, 34)
    assert state["HAM"]["position"] == 1
    assert state["HAM"]["compound"] == "HARD"
    assert state["HAM"]["tyreAge"] == 21
    assert state["HAM"]["gapAhead"] is None  # leader has no car ahead
    assert state["VER"]["position"] == 2
    assert state["VER"]["gapAhead"] == pytest.approx(5.535, abs=0.5)


def test_candidate_moments_include_neutralizations(laps: pd.DataFrame):
    evs = events.extract_events(laps)
    moments = scenario.candidate_decision_moments(laps, evs)
    assert 36 in moments  # VSC (race lap)
    assert 53 in moments  # safety car (race lap)
    assert moments == sorted(set(moments))


def test_default_takeover_lap_rule(laps: pd.DataFrame):
    # Abu Dhabi 2021: HAM's first stop (out-lap 14, in-lap 13) is the first event after lap
    # 10 involving HAM or VER (VER's in-lap 12 is also after 10) -> 3 laps before the earliest.
    evs = events.extract_events(laps)
    lap = scenario.default_takeover_lap(laps, evs, ["HAM", "VER"])
    strategy = scenario.real_strategy(laps)
    first = min(s["lap"] - 1 for d in ("HAM", "VER") for s in strategy[d] if s["lap"] - 1 > 10)
    assert lap == first - scenario.TAKEOVER_LEAD


def test_pit_lane_pass_is_not_a_stop():
    # Brazil 2021: under the SC (laps 7-9) the whole field was routed through the pit lane
    # without changing tyres. Only the real stops (laps 27/28 and 41/44) may count.
    brazil = pd.read_parquet(ingest.raw_snapshot_path("brazil-2021"))
    strategy = scenario.real_strategy(brazil)
    assert [s["lap"] for s in strategy["VER"]] == [28, 41]
    assert [s["lap"] for s in strategy["HAM"]] == [27, 44]


def test_stop_whose_new_set_shows_a_lap_late():
    # Bahrain 2018 / Hungary 2019 timing labels the out-lap with the old set; the new compound
    # shows from the next lap. HAM's race-winning lap-49 stop in Hungary 2019 must count.
    hungary = pd.read_parquet(ingest.raw_snapshot_path("hungary-2019"))
    assert scenario.real_strategy(hungary)["HAM"] == [
        {"lap": 32, "to": "HARD"},
        {"lap": 49, "to": "MEDIUM"},
    ]
    bahrain = pd.read_parquet(ingest.raw_snapshot_path("bahrain-2018"))
    assert scenario.real_strategy(bahrain)["HAM"] == [{"lap": 26, "to": "HARD"}]


def test_state_at_takeover_dry_race_lists_dry_compounds(laps: pd.DataFrame):
    # A dry race: compoundsUsed is the dry compounds run so far, the takeover tyre included.
    state = scenario.state_at_takeover(laps, 34)
    assert state["HAM"]["compoundsUsed"] == ["HARD", "MEDIUM"]
    assert all(c in scenario.DRY_COMPOUNDS for s in state.values() for c in s["compoundsUsed"])


def test_state_at_takeover_lists_wet_tyres():
    # Wet tyres count (they waive the two-compound rule): a car on intermediates at the
    # takeover lists them (great-britain-2016, lap 14), and so does one that started on them
    # and is on slicks at the takeover (hungary-2021, lap 4: Hamilton on mediums).
    gb = scenario.state_at_takeover(
        pd.read_parquet(ingest.raw_snapshot_path("great-britain-2016")), 14
    )
    assert gb["VER"]["compound"] == "INTERMEDIATE"
    assert "INTERMEDIATE" in gb["VER"]["compoundsUsed"]
    hu = pd.read_parquet(ingest.raw_snapshot_path("hungary-2021"))
    takeover = int(
        json.loads((paths.RACES_DIR / "hungary-2021.json").read_text())["race"]["takeoverLap"]
    )
    state = scenario.state_at_takeover(hu, takeover)
    assert state["HAM"]["compound"] in scenario.DRY_COMPOUNDS
    assert "INTERMEDIATE" in state["HAM"]["compoundsUsed"]
