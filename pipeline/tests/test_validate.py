"""Unit tests for the validation harness (Phase 1.7).

Checks the harness computes real gaps and runs the report. Gate G1 (passed == True) is NOT
asserted here — the model does not yet clear it (see the reference-sim notes).
"""

from __future__ import annotations

import pytest

from pipeline import build, validate


@pytest.fixture(scope="module")
def race():
    return build.build_race_model("abu-dhabi-2021")


def test_real_finishing_gaps(race):
    _, laps = race
    gaps = validate.real_finishing_gaps(laps)
    # Winner anchored at 0; Hamilton finished a couple of seconds back.
    assert min(gaps.values()) == 0.0
    assert 0 < gaps["HAM"] < 5
    assert gaps["VER"] == 0.0  # Verstappen won


def test_validate_race_runs_and_reports(race):
    model, laps = race
    report = validate.validate_race(model, validate.real_finishing_gaps(laps), runs=20)
    assert report.runs == 20
    assert report.contenders[0] == "VER"
    assert 0.0 <= report.order_match_rate <= 1.0
    assert set(report.contenders) <= set(report.mean_gap_error)
    assert isinstance(report.summary(), str)


def test_abu_dhabi_clears_gate_g1(race):
    """Gate G1 regression: the sim reproduces Abu Dhabi's podium order and gaps."""
    model, laps = race
    report = validate.validate_race(model, validate.real_finishing_gaps(laps), runs=150)
    assert report.order_match_rate >= 0.5  # VER/HAM/SAI podium in most runs
    assert max(report.mean_gap_error[c] for c in report.contenders[:3]) < 5.0
    assert report.passed
