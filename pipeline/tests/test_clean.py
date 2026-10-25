"""Unit tests for clean (Phase 1.2).

Runs against the committed Abu Dhabi 2021 snapshot (data/raw/) so it is fully offline.
"""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import clean, ingest

SNAPSHOT = ingest.raw_snapshot_path("abu-dhabi-2021")

_RULE_KEYS = ("not_accurate", "not_green", "pit_lap", "lap_1", "no_laptime", "traffic", "outlier")


@pytest.fixture(scope="module")
def laps() -> pd.DataFrame:
    return pd.read_parquet(SNAPSHOT)


def test_partition_accounts_for_every_lap(laps: pd.DataFrame):
    clean_df, traffic_df, log = clean.clean_laps(laps)
    counted = sum(log[k] for k in _RULE_KEYS) + log["clean"]
    assert counted == log["total"] == len(laps)
    assert len(clean_df) == log["clean"]
    assert len(traffic_df) == log["traffic"]


def test_clean_laps_satisfy_all_rules(laps: pd.DataFrame):
    clean_df, _, _ = clean.clean_laps(laps)
    assert clean.is_green(clean_df).all()
    assert (~clean.is_pit_lap(clean_df)).all()
    assert (clean_df["LapNumber"] != 1).all()
    assert clean_df["LapTime"].notna().all()


def test_traffic_laps_are_close_behind(laps: pd.DataFrame):
    _, traffic_df, _ = clean.clean_laps(laps)
    assert len(traffic_df) > 0
    assert (traffic_df["GapAhead"] < clean.TRAFFIC_GAP_SECONDS).all()


def test_contenders_keep_enough_clean_laps(laps: pd.DataFrame):
    clean_df, _, _ = clean.clean_laps(laps)
    for drv in ("HAM", "VER"):
        assert (clean_df["Driver"] == drv).sum() >= 15


def test_late_safety_car_shows_as_non_green(laps: pd.DataFrame):
    _, _, log = clean.clean_laps(laps)
    assert log["not_green"] > 0


def test_green_detection():
    df = pd.DataFrame({"TrackStatus": ["1", "12", "4", "671", None]})
    assert list(clean.is_green(df).fillna(False)) == [True, False, False, False, False]
