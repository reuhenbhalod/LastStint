"""Eras overtake model (overtaking.py): the pooled fit, the layouts, the build gating and the
train term in the reference sim."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from pipeline import build, overtaking, sim_reference, track
from pipeline.track import _sigmoid


def synthetic_events(n: int, seed: int, intercept: float, train_coef: float) -> pd.DataFrame:
    """Opportunities drawn from a known model (paceCoef 1.5, gapCoef -4)."""
    rng = np.random.default_rng(seed)
    adv = rng.normal(0.1, 0.6, n)
    gap = rng.uniform(0.05, 2.0, n)
    leader_gap = rng.uniform(0.0, 3.0, n)
    z = intercept + 1.5 * adv - 4.0 * gap + train_coef * (leader_gap < 1.0)
    passed = rng.uniform(size=n) < 1 / (1 + np.exp(-z))
    return pd.DataFrame(
        {"adv": adv, "gap": gap, "leader_gap": leader_gap, "passed": passed, "gap_next": gap}
    )


def test_layouts_split_where_the_track_changed():
    assert overtaking.layout_of("spain-2021") == "catalunya@2007"
    assert overtaking.layout_of("spain-2023") == "catalunya@2023"
    assert overtaking.layout_of("spain-1996") == "catalunya"
    assert overtaking.layout_of("monaco-2017") == overtaking.layout_of("monaco-2025") == "monaco"
    assert overtaking.layout_of("sakhir-2020") == "bahrain_outer"
    assert overtaking.layout_of("bahrain-2014") == "bahrain"
    assert overtaking.layout_of("abu-dhabi-2012") != overtaking.layout_of("abu-dhabi-2021")


def test_era_groups_follow_drs():
    assert overtaking.group_of(2010) == "noDrs"
    assert overtaking.group_of(2011) == "drs"
    assert overtaking.group_of(2006) == "noDrs"
    assert overtaking.group_of(2025) == "drs"


def test_the_pooled_fit_recovers_the_slopes_and_the_train_term():
    # Two layouts of one era group, one easy and one hard to pass on.
    opps = {
        "spain-2016": synthetic_events(6000, 1, 0.5, -0.9),
        "monaco-2016": synthetic_events(6000, 2, -1.5, -0.9),
    }
    table = overtaking.fit(opps)
    drs = table["groups"]["drs"]
    assert drs["paceCoef"] == pytest.approx(1.5, abs=0.25)
    assert drs["gapCoef"] == pytest.approx(-4.0, abs=0.4)
    assert drs["trainCoef"] == pytest.approx(-0.9, abs=0.3)
    easy = table["layouts"]["catalunya@2007"]["drs"]["intercept"]
    hard = table["layouts"]["monaco"]["drs"]["intercept"]
    assert easy - hard == pytest.approx(2.0, abs=0.4)
    assert table["layouts"]["monaco"]["drs"]["races"] == ["monaco-2016"]


def test_a_layout_intercept_matches_its_pass_rate():
    ev = overtaking.features(synthetic_events(3000, 3, -0.5, -0.9))
    slopes = {"paceCoef": 1.5, "gapCoef": -4.0, "trainCoef": -0.9}
    b = overtaking.matched_intercept(ev, slopes)
    p = [
        _sigmoid(b + 1.5 * a - 4.0 * g - 0.9 * t)
        for a, g, t in zip(ev["adv"], ev["gap"], ev["train"], strict=True)
    ]
    rate = (ev["passed"].sum() + 0.5) / (len(ev) + 1)
    assert sum(p) / len(p) == pytest.approx(rate, rel=1e-6)


TABLE = {
    "trainGap": 1.0,
    "shrinkPasses": 10.0,
    "groups": {
        "drs": {"intercept": 0.1, "paceCoef": 1.8, "gapCoef": -3.9, "trainCoef": -0.9},
        "noDrs": {"intercept": -0.9, "paceCoef": 0.8, "gapCoef": -4.1, "trainCoef": -0.05},
    },
    "layouts": {"monaco": {"drs": {"intercept": -2.0, "races": ["monaco-2017"], "passes": 3}}},
}


def test_the_eras_model_takes_its_layouts_intercept():
    model, note = overtaking.eras_model("monaco-2025", None, TABLE)
    assert model == {"intercept": -2.0, "paceCoef": 1.8, "gapCoef": -3.9, "trainCoef": -0.9}
    assert "layout monaco" in note


def test_a_race_with_its_own_passes_is_shrunk_toward_its_layout():
    own = synthetic_events(400, 5, 0.5, -0.9)
    mine = overtaking.matched_intercept(overtaking.features(own), TABLE["groups"]["drs"])
    model, note = overtaking.eras_model("monaco-2025", own, TABLE)
    w = own["passed"].sum() / (own["passed"].sum() + 10.0)
    assert model["intercept"] == pytest.approx(w * mine + (1 - w) * -2.0)
    assert -2.0 < model["intercept"] < mine and "weight" in note


def test_the_shrinkage_is_one_over_the_true_within_layout_variance():
    own = [("a", "drs", 0.0, 100.0), ("a", "drs", 1.0, 100.0), ("b", "drs", 5.0, 3.0)]
    # Within-layout variance 0.5 (unbiased, layout a), sampling 1 / 100.5.
    assert overtaking.shrink_passes(own) == pytest.approx(1 / (0.5 - 1 / 100.5))


def test_without_a_fitted_layout_the_race_uses_its_own_rate_or_the_groups():
    own = synthetic_events(500, 4, -1.0, -0.05)
    model, note = overtaking.eras_model("brazil-2006", own, TABLE)
    assert model["paceCoef"] == 0.8 and "own pass rate" in note
    assert math.isfinite(model["intercept"])
    model, note = overtaking.eras_model("brazil-1991", None, TABLE)
    assert model["intercept"] == -0.9 and "era group" in note


def test_the_committed_table_is_well_formed():
    table = overtaking.load_table()
    for g in ("drs", "noDrs"):
        grp = table["groups"][g]
        assert grp["paceCoef"] > 0 and grp["gapCoef"] < 0
    # DRS trains are much harder to pass in; before DRS a train barely matters.
    assert table["groups"]["drs"]["trainCoef"] < -0.5
    assert abs(table["groups"]["noDrs"]["trainCoef"]) < 0.3
    assert table["trainGap"] == sim_reference.TRAIN_GAP
    # Monaco is the hardest layout of the DRS era.
    drs = {k: v["drs"]["intercept"] for k, v in table["layouts"].items() if "drs" in v}
    assert min(drs, key=drs.get) == "monaco"
    assert len(table["fitRaces"]) >= 80


def test_pass_opportunities_carry_the_train_and_next_gap(monkeypatch):
    laps = pd.DataFrame(
        {
            "Driver": ["A", "B", "C"] * 2,
            "LapNumber": [1, 1, 1, 2, 2, 2],
            "Position": [1, 2, 3, 1, 2, 3],
            "Time": [100.0, 100.5, 101.0, 200.0, 200.4, 201.5],
            "LapTime": [90.0, 90.0, 90.0, 100.0, 99.9, 100.5],
            "PitInTime": [pd.NaT] * 6,
            "PitOutTime": [pd.NaT] * 6,
            "Compound": ["SOFT"] * 6,
            "TyreLife": [1.0, 1.0, 1.0, 2.0, 2.0, 2.0],
        }
    )

    class Fit:
        driver_pace = {"A": 90.0, "B": 89.5, "C": 90.0}

    monkeypatch.setattr(track, "predict", lambda fit, d, c, age, lap: fit.driver_pace[d])
    ev = track.pass_opportunities(laps, Fit())
    c = ev[ev["follower"] == "C"].iloc[0]
    assert c["leader"] == "B" and c["leader_gap"] == pytest.approx(0.5)
    assert c["gap_next"] == pytest.approx(1.1)
    b = ev[ev["follower"] == "B"].iloc[0]
    assert b["adv"] == pytest.approx(0.5) and np.isnan(b["leader_gap"])


def test_the_train_term_makes_the_car_ahead_harder_to_pass():
    om = {"intercept": 0.0, "paceCoef": 1.8, "gapCoef": -3.9, "trainCoef": -0.9}
    free = sim_reference.pass_probability(om, 0.5, 0.5)
    train = sim_reference.pass_probability(om, 0.5, 0.5, train=True)
    assert train < free
    classic = {k: om[k] for k in ("intercept", "paceCoef", "gapCoef")}
    assert sim_reference.pass_probability(classic, 0.5, 0.5, train=True) == free


def test_only_an_eras_build_gets_the_pooled_model():
    from pipeline import paths

    pool = sorted(build.shared_races())[0]
    daily = build.build_race(pool).model
    assert "trainCoef" not in daily["track"]["overtakeModel"]
    # A Daily/Gauntlet race builds to its committed file, byte for byte.
    committed = (paths.RACES_DIR / f"{pool}.json").read_text()
    assert json.dumps(daily, indent=2) == committed
    eras = build.build_race("monaco-2017")
    om = eras.model["track"]["overtakeModel"]
    table = overtaking.load_table()
    assert om["trainCoef"] == table["groups"]["drs"]["trainCoef"]
    note = next(n for n in eras.notes if "Eras pooled model" in n)
    assert "layout monaco" in note and "weight" in note


def test_the_ts_parity_fixture_is_current():
    """packages/sim/tests/fixtures/eras-overtaking.json replays on today's reference sim (else
    run tests/make_overtaking_fixture.py)."""
    from tests.make_overtaking_fixture import FIXTURE, golden

    doc = json.loads(FIXTURE.read_text())
    assert json.loads(json.dumps(golden(doc["models"]))) == doc["golden"]
    for model in doc["models"].values():
        assert "trainCoef" in model["track"]["overtakeModel"]
