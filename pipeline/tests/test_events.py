"""Unit tests for events (Phase 1.5), offline against the Abu Dhabi 2021 snapshot."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import events, ingest


@pytest.fixture(scope="module")
def laps() -> pd.DataFrame:
    return pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))


def test_neutralization_events_match_real_race(laps: pd.DataFrame):
    # Race laps (leader's laps): VSC for Giovinazzi on lap 36, SC for Latifi on lap 53,
    # restart on the final lap 58.
    by = {(e["type"], e["lap"]): e for e in events.neutralization_events(laps)}
    assert ("VSC", 36) in by and by[("VSC", 36)]["laps"] == 3
    assert ("SC", 53) in by and by[("SC", 53)]["laps"] == 5


def test_events_keyed_to_leader_laps_not_lapped_cars(laps: pd.DataFrame):
    # Lapped cars' own lap numbers run behind the race; no event may start before lap 36.
    neutral = [e for e in events.neutralization_events(laps) if e["lap"] > 1]
    assert min(e["lap"] for e in neutral) == 36


def test_no_red_flag(laps: pd.DataFrame):
    assert not any(e["type"] == "RED" for e in events.neutralization_events(laps))


def test_retirements_are_the_real_dnfs(laps: pd.DataFrame):
    retired = {e["driver"] for e in events.retirement_events(laps)}
    assert retired == {"GIO", "LAT", "PER", "RAI", "RUS"}


def test_retirement_laps_are_race_laps(laps: pd.DataFrame):
    by = {e["driver"]: e["lap"] for e in events.retirement_events(laps)}
    assert by["GIO"] == 36  # triggered the lap-36 VSC (his own count was 34)
    assert by["LAT"] >= 53  # crash brought out the lap-53 SC (his own count was 51)


def test_extract_events_sorted_and_typed(laps: pd.DataFrame):
    evs = events.extract_events(laps)
    assert [e["lap"] for e in evs] == sorted(e["lap"] for e in evs)
    assert all(e["type"] in {"SC", "VSC", "RED", "RETIREMENT"} for e in evs)


def test_from_takeover_keeps_a_period_running_at_the_takeover():
    timeline = [
        {"lap": 3, "type": "VSC", "laps": 2},  # over by lap 4: dropped
        {"lap": 9, "type": "SC", "laps": 6},  # laps 9-14, takeover on 10: kept from lap 10
        {"lap": 10, "type": "RETIREMENT", "driver": "AAA"},
        {"lap": 39, "type": "SC", "laps": 4},
    ]
    assert events.from_takeover(timeline, 10) == [
        {"lap": 10, "type": "SC", "laps": 5},
        {"lap": 10, "type": "RETIREMENT", "driver": "AAA"},
        {"lap": 39, "type": "SC", "laps": 4},
    ]
    assert timeline[1] == {"lap": 9, "type": "SC", "laps": 6}  # input not mutated


def test_from_takeover_drops_a_period_ending_on_the_takeover_lap():
    # Brazil 2021: SC laps 6-9, takeover on 9; the sim's first lap (10) is green.
    assert events.from_takeover([{"lap": 6, "type": "SC", "laps": 4}], 9) == []
    # A VSC still out after it is cut like an SC.
    assert events.from_takeover([{"lap": 6, "type": "VSC", "laps": 5}], 9) == [
        {"lap": 9, "type": "VSC", "laps": 2}
    ]


def test_from_takeover_does_not_cut_a_red_flag_or_a_fault():
    timeline = [
        {"lap": 5, "type": "RED", "laps": 3},
        {"lap": 5, "type": "FAULT", "driver": "AAA", "fault": "power-loss", "paceLoss": 1.0},
    ]
    assert events.from_takeover(timeline, 6) == []  # faults are kept by assemble (lasts_past)
