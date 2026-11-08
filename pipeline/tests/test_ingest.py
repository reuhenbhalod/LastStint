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
        track_status = pd.DataFrame(
            {"Time": pd.to_timedelta([0.0, 95.5], unit="s"), "Status": ["1", "4"]}
        )

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
    assert ingest.load_track_status("x-2021", tmp_path) == [
        {"time": 0.0, "status": "1"},
        {"time": 95.5, "status": "4"},
    ]


def test_offline_ingest_reads_the_cache_only_and_skips_what_it_lacks(monkeypatch, tmp_path):
    # Hungary 2021's FastF1 cache holds the timing but not race control or the weather: an
    # offline ingest writes the snapshot and status, and no red-flag or weather file.
    from fastf1.exceptions import DataNotLoadedError

    good = _snapshot("abu-dhabi-2021").copy()
    # A red flag, so the ingest looks for race control.
    good.loc[good.index[0], "TrackStatus"] = ingest.RED_FLAG
    seen = {}

    class CachedSession:
        laps = good
        track_status = pd.DataFrame({"Time": pd.to_timedelta([0.0], unit="s"), "Status": ["1"]})

        def __getattr__(self, name):
            if name in ("race_control_messages", "weather_data"):
                raise DataNotLoadedError(name)
            raise AttributeError(name)

    def fake_load(year, event, cache_dir, offline=False):
        seen["offline"] = offline
        return CachedSession()

    monkeypatch.setattr(ingest, "load_race", fake_load)
    monkeypatch.setattr(ingest, "project_laps", lambda laps: laps)
    monkeypatch.setattr(ingest, "race_facts", lambda s: {"totalLaps": 58})
    ingest.ingest_race("x-2021", 2021, "X", raw_dir=tmp_path, offline=True)
    assert seen == {"offline": True}
    assert (tmp_path / "x-2021.parquet").exists()
    assert ingest.load_track_status("x-2021", tmp_path) == [{"time": 0.0, "status": "1"}]
    assert not (tmp_path / "x-2021.weather.json").exists()
    assert not (tmp_path / "x-2021.redflags.json").exists()
    assert ingest.loaded(CachedSession(), "weather_data") is None
    assert ingest.loaded(CachedSession(), "laps") is good


def test_load_credentials_reads_env_file_without_overriding(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("F1_USERNAME=someone@example.com\nF1_PASSWORD='p#ss'\n")
    monkeypatch.delenv("F1_USERNAME", raising=False)
    monkeypatch.delenv("F1_PASSWORD", raising=False)
    assert ingest.load_credentials(env) is True
    import os

    assert os.environ["F1_PASSWORD"] == "p#ss"  # quoted '#' is part of the value
    monkeypatch.setenv("F1_USERNAME", "already@set.com")
    ingest.load_credentials(env)
    assert os.environ["F1_USERNAME"] == "already@set.com"  # existing env wins


def test_load_credentials_without_file(tmp_path, monkeypatch):
    monkeypatch.delenv("F1_USERNAME", raising=False)
    assert ingest.load_credentials(tmp_path / "missing.env") is False


def test_relabel_2018_compounds_by_softness_rank():
    laps = pd.DataFrame({"Compound": ["ULTRASOFT", "SUPERSOFT", "SOFT", "INTERMEDIATE", None]})
    out = ingest.relabel_2018_compounds(laps)["Compound"].tolist()
    assert out[:4] == ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE"]


def test_relabel_2018_two_compounds_map_to_soft_medium():
    laps = pd.DataFrame({"Compound": ["SUPERSOFT", "SOFT"]})
    assert ingest.relabel_2018_compounds(laps)["Compound"].tolist() == ["SOFT", "MEDIUM"]


def test_race_suitability_accepts_red_and_wet():
    dry = _snapshot("abu-dhabi-2021")
    assert ingest.race_suitability(dry) == []
    # Wet races are modelled since the weather spec.
    wet = dry.assign(Compound=["INTERMEDIATE"] + list(dry["Compound"][1:]))
    red = dry.assign(TrackStatus=["15"] + list(dry["TrackStatus"][1:]))
    assert ingest.race_suitability(wet) == []
    # Red flags are modelled since eras build plan 4.3 (redflag.py).
    assert ingest.race_suitability(red) == []
    assert ingest.has_red_flag(red) and not ingest.has_red_flag(dry)
