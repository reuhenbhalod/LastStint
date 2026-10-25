"""Unit tests for fit (Phase 1.3).

Fits the lap-time model on the committed Abu Dhabi 2021 snapshot (offline) and checks the
robust sanity properties. We deliberately do NOT assert the full soft<med<hard ordering:
on a single real race, track evolution and when each compound ran can put medium and hard
out of the textbook order. The reliable signals are asserted instead.
"""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import clean, fit, ingest


@pytest.fixture(scope="module")
def fitted() -> fit.LapTimeFit:
    laps = pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))
    clean_df, _, _ = clean.clean_laps(laps)
    return fit.fit_lap_model(clean_df)


def test_fit_structure(fitted: fit.LapTimeFit):
    assert fitted.reference_compound == "SOFT"
    for compound in ("SOFT", "MEDIUM", "HARD"):
        assert compound in fitted.compound_offset
        assert compound in fitted.compound_wear
    assert {"HAM", "VER", "PER"} <= set(fitted.driver_pace)
    assert fitted.n_obs > 500
    assert fitted.r_squared > 0.7


def test_fuel_term_is_positive(fitted: fit.LapTimeFit):
    # Cars get faster as fuel burns off -> positive fuel_per_lap.
    assert fitted.fuel_per_lap > 0
    assert 0.02 < fitted.fuel_per_lap < 0.12


def test_wear_rates_non_negative(fitted: fit.LapTimeFit):
    assert all(w >= 0 for w in fitted.compound_wear.values())


def test_soft_is_fastest_compound(fitted: fit.LapTimeFit):
    assert fitted.compound_offset["SOFT"] == 0.0
    assert all(v >= 0 for v in fitted.compound_offset.values())


def test_soft_wears_fastest(fitted: fit.LapTimeFit):
    assert max(fitted.compound_wear, key=fitted.compound_wear.get) == "SOFT"


def test_driver_pace_matches_frontrunners(fitted: fit.LapTimeFit):
    order = sorted(fitted.driver_pace, key=fitted.driver_pace.get)
    assert order[0] in {"HAM", "VER"}  # the title protagonists were fastest
    assert {"HAM", "VER"} <= set(order[:5])


def test_noise_is_reasonable(fitted: fit.LapTimeFit):
    assert all(0 < n < 2.0 for n in fitted.driver_noise.values())


def test_predict_at_origin_equals_base_pace(fitted: fit.LapTimeFit):
    got = fit.predict(fitted, "HAM", "SOFT", tyre_age=0, lap=0)
    assert got == pytest.approx(fitted.driver_pace["HAM"])


def test_detect_cliff_structure(fitted: fit.LapTimeFit):
    laps = pd.read_parquet(ingest.raw_snapshot_path("abu-dhabi-2021"))
    clean_df, _, _ = clean.clean_laps(laps)
    cliffs = fit.detect_cliff(clean_df, fitted)
    assert set(cliffs) == set(fitted.compound_wear)
    for age in cliffs.values():
        assert age is None or isinstance(age, int)
    # Softs fall off a cliff within the first ~20 laps of a stint.
    assert cliffs["SOFT"] is not None and 10 <= cliffs["SOFT"] <= 30
