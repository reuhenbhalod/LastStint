"""Unit tests for fit (Phase 1.3).

Fits the lap-time model on the committed snapshots (offline) and checks the sanity
properties from the Phase 1 spec, including the physical compound ordering, which the fit
enforces and shrinks toward pipeline/config/compound_priors.json.
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


def test_compounds_in_physical_order(fitted: fit.LapTimeFit):
    off, wear = fitted.compound_offset, fitted.compound_wear
    # Softer is faster and wears faster, strictly (the prior keeps steps apart).
    assert off["SOFT"] < off["MEDIUM"] < off["HARD"]
    assert wear["SOFT"] > wear["MEDIUM"] > wear["HARD"] >= 0


def test_prior_notes_flag_collapsed_steps(fitted: fit.LapTimeFit):
    # Abu Dhabi alone can't separate medium from hard pace; the fit must say so.
    assert any("MEDIUM->HARD" in note for note in fitted.prior_notes)


def test_cliff_structure(fitted: fit.LapTimeFit):
    assert set(fitted.compound_cliff) == set(fitted.compound_wear)
    for hinge in fitted.compound_cliff.values():
        if hinge is not None:
            age, slope = hinge
            assert isinstance(age, int) and slope > 0
    # Softs fall off a cliff within the first ~20 laps of a stint.
    soft = fitted.compound_cliff["SOFT"]
    assert soft is not None and 10 <= soft[0] <= 30


def test_predict_includes_cliff(fitted: fit.LapTimeFit):
    age, slope = fitted.compound_cliff["SOFT"]
    before = fit.predict(fitted, "HAM", "SOFT", tyre_age=age, lap=0)
    after = fit.predict(fitted, "HAM", "SOFT", tyre_age=age + 1, lap=0)
    assert after - before == pytest.approx(fitted.compound_wear["SOFT"] + slope)


def test_unknown_era_raises():
    with pytest.raises(KeyError):
        fit.load_compound_priors("1950s")


def test_spain_two_compound_order():
    laps = pd.read_parquet(ingest.raw_snapshot_path("spain-2021"))
    clean_df, _, _ = clean.clean_laps(laps)
    f = fit.fit_lap_model(clean_df)
    assert f.compound_offset["SOFT"] < f.compound_offset["MEDIUM"]
    assert f.compound_wear["SOFT"] > f.compound_wear["MEDIUM"]
