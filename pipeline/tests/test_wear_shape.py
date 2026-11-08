"""Quadratic tyre wear (Eras model fix S4, wear_shape.py): the fit's quadratic term and its
prior, the pooling by track and era, the sims' use of compounds[].degQuad and the tyre life it
gives, and its gating to Eras builds."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from pipeline import build, fit, rival_policy, sim_reference, wear_shape
from tests.make_wear_shape_fixture import GOLDEN, MODEL, golden, with_quad

ERA = "2014-2025"


def _laps(q: float, wear: float = 0.03, fuel: float = 0.05, seed: int = 0) -> pd.DataFrame:
    """Clean laps of 8 cars, two 30-lap MEDIUM stints each, wear + q x age^2 - fuel x lap."""
    rng = np.random.default_rng(seed)
    rows = []
    for i in range(8):
        for lap in range(1, 61):
            age = lap if lap <= 30 else lap - 30
            t = 90 + 0.2 * i + wear * age + q * age * age - fuel * lap + rng.normal(0, 0.2)
            rows.append(
                {
                    "Driver": f"D{i}",
                    "LapNumber": lap,
                    "LapTime": t,
                    "Compound": "MEDIUM",
                    "TyreLife": float(age),
                    "Stint": 1 if lap <= 30 else 2,
                }
            )
    return pd.DataFrame(rows)


def test_no_priors_no_quadratic():
    laps = _laps(0.002)
    a = fit.fit_lap_model(laps, era=ERA)
    b = fit.fit_lap_model(laps, era=ERA, quad_priors={})
    assert a.compound_quad == {} and b.compound_quad == {}
    assert a.compound_wear == b.compound_wear and a.driver_pace == b.driver_pace


def test_measure_recovers_the_term():
    measured, noise = fit.measure_quad(_laps(0.002), ERA)
    m = measured["MEDIUM"]
    assert abs(m.q - 0.002) < 3 * m.se and m.se < 0.0005
    assert m.laps == 480 and m.max_age == 30
    assert 0.1 < noise < 0.3


def test_prior_shrinks_the_term():
    laps = _laps(0.002)
    loose = fit.fit_lap_model(laps, era=ERA, quad_priors={"MEDIUM": fit.QuadPrior(0.0, 1.0, 0.2)})
    tight = fit.fit_lap_model(laps, era=ERA, quad_priors={"MEDIUM": fit.QuadPrior(0.0, 1e-6, 0.2)})
    assert loose.compound_quad["MEDIUM"] == pytest.approx(0.002, abs=0.0006)
    assert tight.compound_quad["MEDIUM"] < 1e-4
    # A term the data put below 0 is held at 0 (no tyre gets faster with age).
    neg = fit.fit_lap_model(
        _laps(-0.002, wear=0.15), era=ERA, quad_priors={"MEDIUM": fit.QuadPrior(0.0, 1.0, 0.2)}
    )
    assert neg.compound_quad["MEDIUM"] == pytest.approx(0.0, abs=1e-9)
    # predict carries it.
    p0 = fit.predict(loose, "D0", "MEDIUM", 0, 10)
    p20 = fit.predict(loose, "D0", "MEDIUM", 20, 10)
    lin = loose.compound_wear["MEDIUM"] * 20 + loose.compound_quad["MEDIUM"] * 400
    assert p20 - p0 == pytest.approx(lin)


def _table() -> dict:
    races = {
        "monaco-2014": {"era": ERA, "noise": 0.3, "compounds": {"SOFT": {"q": 0.003, "se": 1e-4}}},
        "monaco-2015": {"era": ERA, "noise": 0.4, "compounds": {"SOFT": {"q": 0.001, "se": 1e-4}}},
        "spain-2015": {"era": ERA, "noise": 0.2, "compounds": {"SOFT": {"q": -0.001, "se": 1e-4}}},
        "spain-2016": {"era": ERA, "noise": 0.2, "compounds": {"SOFT": {"q": 0.0, "se": 1e-4}}},
    }
    return wear_shape.pool(races)


def test_pool_and_leave_one_out():
    table = _table()
    g = table["groups"][ERA]["SOFT"]
    assert g["races"] == 4 and 0 < g["tau2Within"] <= g["tau2"]
    priors, note = wear_shape.quad_priors("monaco-2014", ERA, table)
    p = priors["SOFT"]
    # Its prior leans on Monaco 2015 (its own measurement left out), not on itself.
    assert 0.0005 < p.mean < 0.0015
    assert p.noise == 0.3 and "1 at monaco" in note
    # A track with no measured race: the era's mean at sd sqrt(tau2).
    other, _ = wear_shape.quad_priors("bahrain-2016", ERA, table)
    assert other["SOFT"].mean == pytest.approx(max(g["mean"], 0.0))
    assert other["SOFT"].sd == pytest.approx(math.sqrt(g["tau2"]))
    # An era with no measured race: no prior.
    assert wear_shape.quad_priors("monaco-1999", "1994-2009", table)[0] == {}


def test_committed_table_covers_the_eras():
    table = wear_shape.load_table()
    for era in ("1994-2009", "2010-2013", "2014-2025"):
        assert table["groups"][era]
    for era in table["groups"].values():
        for g in era.values():
            assert g["tau2"] > 0 and g["tau2Within"] <= g["tau2"]


def test_clean_lap_adds_the_term():
    c = {"MEDIUM": {"offset": 0.0, "degPerLap": 0.05, "cliffLap": 99}}
    car = sim_reference.Car("AAA", 90.0, 0.0, "MEDIUM", 20, 0.0)
    plain = sim_reference._clean_lap(car, c, 0.0, 1)
    c["MEDIUM"]["degQuad"] = 0.001
    assert sim_reference._clean_lap(car, c, 0.0, 1) - plain == pytest.approx(0.4)


def test_tyre_life_roots():
    c = {"offset": 0.0, "degPerLap": 0.05, "cliffLap": 60}
    assert rival_policy.tyre_life(c) == 40
    # 0.001 a^2 + 0.05 a = 2: a = 26.2.
    assert rival_policy.tyre_life({**c, "degQuad": 0.001}) == 26
    # Past a fitted cliff at 20 (+0.1 s a lap): 0.001 a^2 + 0.15 a = 4: a = 23.1.
    cliffed = {**c, "degQuad": 0.001, "cliffLap": 20, "cliffDegPerLap": 0.1}
    assert rival_policy.tyre_life(cliffed) == 23
    assert rival_policy.tyre_life({**c, "degQuad": 0.001, "provenLaps": 30}) == 30


def test_golden_fixture_is_current():
    assert json.loads(GOLDEN.read_text()) == json.loads(
        json.dumps(golden(json.loads(MODEL.read_text())))
    )
    model = with_quad(json.loads(MODEL.read_text()))
    assert all("degQuad" in c for c in model["compounds"].values())


def test_pool_race_builds_without_it(monkeypatch):
    """A Daily/Gauntlet race (an Eras overlay but shared) and a race without an overlay never
    ask for the priors and carry no degQuad."""
    asked = []
    monkeypatch.setattr(
        build.wear_shape_mod, "quad_priors", lambda *a, **k: asked.append(a) or ({}, "")
    )
    pool = sorted(build.shared_races())
    if not pool or not (build.RAW_DIR / f"{pool[0]}.parquet").exists():
        pytest.skip("no pool race snapshot")
    model, _ = build.build_race_model(pool[0])
    assert asked == []
    assert not any("degQuad" in c for c in model["compounds"].values())


def test_eras_build_carries_it():
    rid = "hungary-2014"
    if not (build.RAW_DIR / f"{rid}.parquet").exists():
        pytest.skip("no snapshot")
    res = build.build_race(rid)
    assert any("wear shape (S4)" in n for n in res.notes)
    assert res.fit.compound_quad
    for c, q in res.fit.compound_quad.items():
        if round(q, 7) > 0:
            assert res.model["compounds"][c]["degQuad"] == round(q, 7)
    off = build.build_race(rid, wear_shape=False)
    assert off.fit.compound_quad == {}
    assert not any("degQuad" in c for c in off.model["compounds"].values())
