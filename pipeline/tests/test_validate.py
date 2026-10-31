"""Unit tests for the validation harness (Phase 1.7).

Checks the harness computes real gaps and runs the report, and locks in Gate G1 for Abu
Dhabi 2021. Spain 2021 does not yet clear G1 (BOT/PER gaps; traffic model open item).
"""

from __future__ import annotations

import pandas as pd
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
    report = validate.validate_race(model, validate.real_finishing_gaps(laps), runs=20, rival="VER")
    assert report.runs == 20
    assert report.contenders[0] == "VER"
    assert report.duel == ("HAM", "VER")
    assert 0.0 <= report.order_match_rate <= 1.0
    names = [c.name for c in report.checks]
    assert any(n.startswith("duel HAM vs VER") for n in names)
    assert any(n.startswith("podium") for n in names)
    assert report.passed == (not report.failures)
    assert isinstance(report.summary(), str)


def test_field_tolerance_scales_with_real_gap():
    # A car 60s back is held to 10% of its gap (6s), not the flat 5s.
    assert max(validate.GAP_TOLERANCE, validate.FIELD_RELATIVE_TOLERANCE * 60) == 6.0


def test_abu_dhabi_clears_gate_g1(race):
    """Gate G1 regression: duel, podium and scored field all within the bar."""
    model, laps = race
    meta = build.RACES["abu-dhabi-2021"]
    report = validate.validate_race(
        model,
        validate.real_finishing_gaps(laps),
        runs=300,
        rival=meta["rival"],
        score_positions=meta["score_positions"],
    )
    assert report.passed, report.summary()


def test_robust_status_uses_two_seed_sets(race):
    model, laps = race
    res = validate.robust_status(model, validate.real_finishing_gaps(laps), rival="VER", runs=40)
    assert res.status in {"pass", "borderline", "fail"}
    assert len(res.reports) == len(validate.ROBUST_SEEDS) == 2
    expected = {2: "pass", 1: "borderline", 0: "fail"}[sum(r.passed for r in res.reports)]
    assert res.status == expected


def test_diagnose_splits_the_error():
    from pipeline import diagnose

    model, laps = build.build_race_model("miami-2024")
    d = diagnose.diagnose(model, laps, score_positions=6, runs=20)
    assert abs(sum(d.share.values()) - 1) < 1e-9
    assert d.dominant in diagnose.LABELS
    assert d.line().startswith(diagnose.LABELS[d.dominant])


def test_broken_final_lap_is_repaired():
    # Bahrain 2018: the leaders' last laps carry no LapTime and a timestamp ~53s late.
    def driver(code, ends, last_lap_time):
        return [
            {
                "Driver": code,
                "LapNumber": i + 1,
                "Time": t,
                "LapTime": (last_lap_time if i == len(ends) - 1 else 96.0),
            }
            for i, t in enumerate(ends)
        ]

    rows = driver("VET", [100.0, 196.0, 346.0], float("nan"))  # 150s "lap": broken
    rows += driver("GAS", [104.0, 200.0, 299.0], 99.0)  # a real lap
    rows += driver("BOT", [101.0, 197.0, 300.0], float("nan"))  # no LapTime but plausible
    laps = pd.DataFrame(rows)
    gaps = validate.real_finishing_gaps(laps)
    assert gaps["VET"] == 0.0  # repaired: 196 + 96 = 292
    assert gaps["GAS"] == pytest.approx(7.0)
    assert gaps["BOT"] == pytest.approx(8.0)  # kept as recorded


def test_tie_groups_chain_near_ties():
    gaps = {"A": 0.0, "B": 0.7, "C": 1.5, "D": 9.0}
    assert validate.tie_groups(["A", "B", "C", "D"], gaps) == {"A": 0, "B": 0, "C": 0, "D": 1}
    assert validate.tie_groups(["A", "D"], gaps) == {"A": 0, "D": 1}


def test_near_tie_duel_drops_only_the_order_check(race):
    model, laps = race
    gaps = validate.real_finishing_gaps(laps)
    # Abu Dhabi 2021's HAM-VER gap is ~2.3s: not a near-tie, so both rules check the order.
    report = validate.validate_race(model, gaps, runs=20, rival="VER")
    names = [c.name for c in report.checks]
    assert names == [c.name for c in report.strict_checks]
    # Make it a near-tie: the order check goes, the gap check stays; strict keeps both.
    tied = {**gaps, "HAM": gaps["VER"] + 0.5}
    report = validate.validate_race(model, tied, runs=20, rival="VER")
    names = [c.name for c in report.checks]
    assert "duel HAM vs VER gap error" in names
    assert "duel HAM vs VER order rate" not in names
    assert "duel HAM vs VER order rate" in [c.name for c in report.strict_checks]
