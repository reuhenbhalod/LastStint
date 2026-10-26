"""Unit tests for events (Phase 1.5), offline against the Abu Dhabi 2021 snapshot."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import events, ingest


@pytest.fixture(scope="module")
def laps() -> pd.DataFrame:
    return pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))


def test_neutralization_events_match_real_race(laps: pd.DataFrame):
    by = {(e["type"], e["lap"]): e for e in events.neutralization_events(laps)}
    assert ("VSC", 34) in by and by[("VSC", 34)]["laps"] == 5
    assert ("SC", 51) in by and by[("SC", 51)]["laps"] == 7


def test_no_red_flag(laps: pd.DataFrame):
    assert not any(e["type"] == "RED" for e in events.neutralization_events(laps))


def test_retirements_are_the_real_dnfs(laps: pd.DataFrame):
    retired = {e["driver"] for e in events.retirement_events(laps)}
    assert retired == {"GIO", "LAT", "PER", "RAI", "RUS"}


def test_extract_events_sorted_and_typed(laps: pd.DataFrame):
    evs = events.extract_events(laps)
    assert [e["lap"] for e in evs] == sorted(e["lap"] for e in evs)
    assert all(e["type"] in {"SC", "VSC", "RED", "RETIREMENT"} for e in evs)
