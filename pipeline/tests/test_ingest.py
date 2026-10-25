"""Offline unit tests for ingest.project_laps (Phase 1.1).

Uses a small saved fixture (a slice of real FastF1 laps, raw timedelta dtypes) so the
transform is exercised without any network access.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from pipeline import ingest

FIXTURE = Path(__file__).parent / "fixtures" / "laps_raw_sample.parquet"


def test_fixture_is_raw_timedelta():
    # The fixture must be pre-projection so the coercion is actually tested.
    raw = pd.read_parquet(FIXTURE)
    assert pd.api.types.is_timedelta64_dtype(raw["LapTime"])


def test_project_laps_keeps_known_columns_in_order():
    raw = pd.read_parquet(FIXTURE)
    df = ingest.project_laps(raw)
    expected = [c for c in ingest.LAP_COLUMNS if c in raw.columns]
    assert list(df.columns) == expected


def test_project_laps_coerces_times_to_seconds():
    raw = pd.read_parquet(FIXTURE)
    df = ingest.project_laps(raw)
    assert df["LapTime"].dtype == "float64"
    valid = df["LapTime"].dropna()
    assert (valid > 0).all()
    # Yas Marina race laps sit comfortably inside this band.
    assert 60 < valid.median() < 180


def test_project_laps_preserves_non_time_dtypes():
    raw = pd.read_parquet(FIXTURE)
    df = ingest.project_laps(raw)
    assert df["IsAccurate"].dtype == bool
    assert set(df["Driver"].unique()) == {"HAM", "VER"}


def test_default_race_id():
    assert ingest.default_race_id(2021, "Abu Dhabi") == "abu-dhabi-2021"
    assert ingest.default_race_id(2019, "Hungary") == "hungary-2019"
