"""Eras dirty-air model (dirty_air.py): the measurement, the pooled fit, the build gating and
the banded cost in the reference sim."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from pipeline import build, dirty_air, sim_reference


def test_bands_by_start_gap():
    assert dirty_air.band_of(0.2) == "0.0-0.5"
    assert dirty_air.band_of(0.5) == "0.5-1.0"
    assert dirty_air.band_of(1.99) == "1.5-2.0"
    assert dirty_air.band_of(2.5) == "2.0-3.0"
    assert dirty_air.band_of(3.0) == "clear"
    assert dirty_air.band_of(float("nan")) is None
    assert dirty_air.band_of(-0.1) is None


def test_the_sims_cost_is_flat_without_bands_and_banded_with_them():
    flat = {"dirtyAirPenalty": 0.3}
    assert sim_reference.dirty_air_cost(flat, 0.5) == 0.3
    assert sim_reference.dirty_air_cost(flat, 1.0) == 0.0
    assert sim_reference.dirty_air_cost(flat, 0.0) == 0.0
    bands = [
        {"upTo": 0.5, "penalty": 0.9},
        {"upTo": 1.0, "penalty": 0.4},
        {"upTo": 2.0, "penalty": 0.1},
    ]
    banded = {"dirtyAirPenalty": 0.3, "dirtyAirBands": bands}
    assert sim_reference.dirty_air_cost(banded, 0.2) == 0.9
    assert sim_reference.dirty_air_cost(banded, 0.5) == 0.4
    assert sim_reference.dirty_air_cost(banded, 1.7) == 0.1
    assert sim_reference.dirty_air_cost(banded, 2.0) == 0.0
    assert dirty_air.cost(bands, 0.7) == 0.4 and dirty_air.cost(None, 0.7) == 0.0


def synthetic_rows(seed: int, scale: float, stints: int = 60) -> pd.DataFrame:
    """Laps of `stints` stints, each at its own clear-air level, the residual rising by a known
    loss (the drs shape x scale) in each gap band."""
    rng = np.random.default_rng(seed)
    loss = {"0.0-0.5": 0.7, "0.5-1.0": 0.5, "1.0-1.5": 0.25, "1.5-2.0": 0.12}
    rows = []
    for s in range(stints):
        level = rng.normal(0, 0.5)
        for _ in range(30):
            gap = float(rng.choice([0.3, 0.8, 1.2, 1.8, 2.5, 4.0, 6.0]))
            band = dirty_air.band_of(gap)
            res = level + scale * loss.get(band, 0.0) + rng.normal(0, 0.3)
            rows.append({"stint": f"S{s}", "gap": gap, "residual": res})
    return pd.DataFrame(rows)


def test_band_losses_are_relative_to_the_stints_clear_air_level():
    losses = dirty_air.band_losses(synthetic_rows(1, 1.0))
    assert losses["0.0-0.5"]["loss"] == pytest.approx(0.7, abs=0.08)
    assert losses["1.0-1.5"]["loss"] == pytest.approx(0.25, abs=0.08)
    assert losses["clear"]["loss"] == pytest.approx(0.0, abs=1e-9)
    assert 0 < losses["0.5-1.0"]["se"] < 0.1


def test_the_fit_finds_the_group_shape_and_the_layout_scales():
    rows = {
        "spain-2016": synthetic_rows(2, 0.6),
        "spain-2020": synthetic_rows(3, 0.6),
        "monaco-2016": synthetic_rows(4, 2.0),
        "monaco-2017": synthetic_rows(5, 2.0),
    }
    table = dirty_air.fit(rows)
    drs = table["groups"]["drs"]
    assert [b["upTo"] for b in drs["bands"]] == [0.5, 1.0, 1.5, 2.0]
    easy = table["layouts"]["catalunya@2007"]["drs"]["scale"]
    hard = table["layouts"]["monaco"]["drs"]["scale"]
    assert hard / easy == pytest.approx(2.0 / 0.6, rel=0.2)
    assert table["layouts"]["monaco"]["drs"]["races"] == ["monaco-2016", "monaco-2017"]


TABLE = {
    "groups": {
        "drs": {
            "bands": [
                {"upTo": 0.5, "loss": 0.7},
                {"upTo": 1.0, "loss": 0.5},
                {"upTo": 1.5, "loss": 0.25},
                {"upTo": 2.0, "loss": 0.12},
            ],
            "tauRace": 0.2,
            "tauLayout": 0.25,
            "simOffset": [0.1, 0.1, 0.1, 0.1],
        }
    },
    "layouts": {"monaco": {"drs": {"scale": 2.0, "races": ["monaco-2017"]}}},
}


def test_a_race_with_no_laps_takes_its_layouts_scale_less_the_sim_offset():
    block, note = dirty_air.eras_dirty_air("monaco-2025", None, TABLE)
    assert [b["penalty"] for b in block["bands"]] == [1.3, 0.9, 0.4, 0.14]
    assert "layout monaco" in note


def test_a_race_with_laps_is_shrunk_toward_its_layout():
    block, note = dirty_air.eras_dirty_air("monaco-2025", synthetic_rows(6, 1.0), TABLE)
    first = block["bands"][0]["penalty"] + 0.1
    assert 0.6 < first < 1.4  # its own (about 0.7), pulled toward its layout's (1.4)
    assert "weight" in note
    # A layout with no fitted race: the group's shape (scale 1).
    alone, _ = dirty_air.eras_dirty_air("bahrain-2014", None, TABLE)
    assert alone["bands"][0]["penalty"] == pytest.approx(0.6)


def test_start_gaps_are_the_gap_at_the_line_a_lap_earlier():
    laps = pd.DataFrame(
        {
            "Driver": ["A", "B", "A", "B"],
            "LapNumber": [1, 1, 2, 2],
            "Position": [1, 2, 1, 2],
            "Time": [100.0, 100.8, 190.0, 191.5],
        }
    )
    start = dirty_air.start_gaps(laps)
    assert math.isnan(start.iloc[1]) and start.iloc[3] == pytest.approx(0.8)


def test_the_committed_table_is_well_formed():
    table = dirty_air.load_table()
    for g in ("drs", "noDrs"):
        grp = table["groups"][g]
        losses = [b["loss"] for b in grp["bands"]]
        assert losses == sorted(losses, reverse=True) and losses[-1] > 0
        assert len(grp["simOffset"]) == len(grp["bands"])
    assert len(table["fitRaces"]) >= 80


def test_off_by_default_every_race_file_replays_as_committed():
    """The model is measured and not adopted (docs/g1-report.md, "Eras sim fix W3"): with the
    switch off a Daily/Gauntlet race and an Eras race both build to their committed files."""
    from pipeline import paths

    assert dirty_air.IN_ERAS_BUILDS is False
    for rid in (sorted(build.shared_races())[0], "monaco-2017"):
        model = build.build_race(rid).model
        assert "dirtyAirBands" not in model["track"]
        committed = (paths.RACES_DIR / f"{rid}.json").read_text()
        assert json.dumps(model, indent=2) == committed


def test_switched_on_only_an_eras_build_of_a_timed_race_gets_the_bands(monkeypatch):
    monkeypatch.setattr(dirty_air, "IN_ERAS_BUILDS", True)
    pool = sorted(build.shared_races())[0]
    daily = build.build_race(pool).model
    assert "dirtyAirBands" not in daily["track"]
    assert "heldGap" not in daily["track"]["overtakeModel"]
    eras = build.build_race("monaco-2017")
    bands = eras.model["track"]["dirtyAirBands"]
    assert [b["upTo"] for b in bands] == [0.5, 1.0, 1.5, 2.0]
    assert any("Eras dirty-air model" in n for n in eras.notes)


def test_no_pass_without_a_roll():
    """rollOnly: a car that beat the car ahead of it on time without a won roll stays behind."""
    from pipeline.sim_reference import Car, _resolve_order

    def cars(times):
        return {
            c: Car(code=c, base_pace=90.0, noise=0.0, compound="SOFT", tyre_age=0, total_time=t)
            for c, t in times.items()
        }

    om = {"intercept": -50.0, "paceCoef": 1.0, "gapCoef": -1.0}  # no roll ever wins
    prev = {"A": 0.0, "B": 3.0}  # B 3 s back: no roll, but a lap 4 s faster
    for roll, ahead in ((False, "B"), (True, "A")):
        cs = cars({"A": 90.0, "B": 89.0})
        order = ["A", "B"]

        class Never:
            def next(self):
                return 1.0

        _resolve_order(
            order,
            cs,
            {"A": 90.0, "B": 86.0},
            {"A": Never(), "B": Never()},
            {**om, **({"rollOnly": True} if roll else {})},
            prev,
            set(),
        )
        assert order[0] == ahead


def test_the_ts_parity_fixture_is_current():
    """packages/sim/tests/fixtures/eras-dirty-air.json replays on today's reference sim (else
    run tests/make_dirty_air_fixture.py)."""
    from tests.make_dirty_air_fixture import FIXTURE, golden

    doc = json.loads(FIXTURE.read_text())
    assert json.loads(json.dumps(golden(doc["models"]))) == doc["golden"]
    for model in doc["models"].values():
        assert "dirtyAirBands" in model["track"]
    assert doc["models"]["spain-2021-held-roll"]["track"]["overtakeModel"]["rollOnly"] is True
