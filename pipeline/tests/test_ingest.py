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


def _snapshot(race_id: str) -> pd.DataFrame:
    return pd.read_parquet(ingest.raw_snapshot_path(race_id))


def test_check_complete_accepts_a_real_snapshot():
    ingest.check_complete(_snapshot("abu-dhabi-2021"))


def test_check_complete_rejects_missing_track_status():
    laps = _snapshot("abu-dhabi-2021").assign(TrackStatus=None)
    try:
        ingest.check_complete(laps)
    except ingest.IncompleteDataError as e:
        assert "TrackStatus" in str(e)
    else:
        raise AssertionError("incomplete snapshot accepted")


def test_ingest_backs_off_on_rate_limit(monkeypatch, tmp_path):
    from fastf1.req import RateLimitExceededError

    calls, waits = [], []
    good = _snapshot("abu-dhabi-2021")

    class FakeSession:
        laps = good
        event = {}
        date = None

        def __getattr__(self, name):
            raise AttributeError(name)

    def fake_load(year, event, cache_dir):
        calls.append(1)
        if len(calls) < 3:
            raise RateLimitExceededError("slow down")
        return FakeSession()

    monkeypatch.setattr(ingest, "load_race", fake_load)
    monkeypatch.setattr(ingest, "project_laps", lambda laps: laps)
    monkeypatch.setattr(ingest, "race_facts", lambda s: {"totalLaps": 58})
    ingest.ingest_race("x-2021", 2021, "X", raw_dir=tmp_path, sleep=waits.append)
    assert len(calls) == 3
    assert waits == list(ingest.RATE_LIMIT_WAITS[:2])
    assert (tmp_path / "x-2021.parquet").exists()
