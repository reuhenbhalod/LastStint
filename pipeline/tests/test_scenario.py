"""Unit tests for scenario (Phase 1.5), offline against the Abu Dhabi 2021 snapshot."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import events, ingest, scenario


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
