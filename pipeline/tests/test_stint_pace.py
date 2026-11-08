"""Pace by stint (Eras model fix M2, pace.stint_offsets): the fit, the sims' use of
drivers[].stintPace, and its gating to Eras builds."""

from __future__ import annotations

import copy
import json

import numpy as np
import pandas as pd
import pytest

from pipeline import build, pace, sim_reference
from tests.make_stint_pace_fixture import GOLDEN, MODEL, golden, with_stint_pace

COMPOUNDS = {"MEDIUM": {"offset": 0.0, "degPerLap": 0.0, "cliffLap": 99}}


def _laps(times: dict[str, list[float]], stops: dict[str, int]) -> pd.DataFrame:
    """A lap frame: each car's lap times from lap 1, one stop each (out-lap `stops[code]`),
    positions by cumulative time."""
    rows = []
    for code, lt in times.items():
        total = 0.0
        stop = stops.get(code)
        for i, t in enumerate(lt, start=1):
            total += t
            stint = 1 if stop is None or i < stop else 2
            age = i if stint == 1 else i - stop + 1
            rows.append(
                {
                    "Driver": code,
                    "LapNumber": i,
                    "LapTime": t,
                    "Time": total,
                    "Compound": "MEDIUM",
                    "TyreLife": float(age),
                    "Stint": stint,
                    "PitInTime": 1.0 if stop is not None and i == stop - 1 else np.nan,
                    "PitOutTime": 1.0 if stop is not None and i == stop else np.nan,
                    "TrackStatus": "1",
                }
            )
    df = pd.DataFrame(rows)
    df["Position"] = df.groupby("LapNumber")["Time"].rank().astype(int)
    return df


def _fit(laps, stops, base=None, **kw):
    base = {c: 80.0 for c in laps["Driver"].unique()} | (base or {})
    return pace.stint_offsets(laps, base, COMPOUNDS, 0.0, None, 1, stops, **kw)


def test_stint_key():
    assert pace.stint_key([], 30) == 0
    assert pace.stint_key([12, 30], 11) == 0
    assert pace.stint_key([12, 30], 12) == 12
    assert pace.stint_key([12, 30], 45) == 30


def test_real_stops_are_the_out_laps_after_the_takeover():
    strategy = {"A": [{"lap": 10, "to": "HARD"}, {"lap": 25, "to": "SOFT"}], "B": []}
    assert pace.real_stops(strategy, 10) == {"A": [25], "B": []}


def test_a_stint_s_offset_is_its_shrunk_mean_residual():
    # A in clear air: on its base pace to the stop, 0.6 s a lap slower after it.
    laps = _laps({"A": [80.0] * 10 + [80.6] * 10, "B": [90.0] * 20}, {"A": 11})
    table = _fit(laps, {"A": [11], "B": []})
    n = 9  # laps 12-20 (the out-lap 11 doesn't count)
    assert table.offsets["A"] == {11: round(0.6 * n / (n + pace.STINT_SHRINK_LAPS), 3)}
    assert table.entries("A") == [{"lap": 11, "offset": table.offsets["A"][11]}]
    assert table.on("A", 5) == 0.0 and table.on("A", 15) == table.offsets["A"][11]
    assert table.offsets["B"] == {0: round(3.0 * 19 / 24, 3)}  # 10 s a lap, clipped to 3


def test_one_lap_can_t_set_a_stint_s_pace():
    laps = _laps({"A": [80.0] * 9 + [95.0] + [80.0] * 10}, {})
    table = _fit(laps, {"A": []})
    assert table.offsets["A"][0] == round(3.0 / 19 * 19 / 24, 3)  # clipped to 3 s


def test_a_stint_run_in_traffic_gets_no_offset():
    # B (0.5 s a lap quicker on its pace) held 0.5 s behind A all race: its laps say how A ran.
    laps = _laps({"A": [80.0] * 20, "B": [80.5] + [80.0] * 19}, {})
    stops = {"A": [], "B": []}
    assert "B" not in _fit(laps, stops, {"B": 79.5}).offsets
    assert _fit(laps, stops, {"B": 79.5}, min_clear_share=0.0).offsets["B"][0] > 0


def test_short_stints_get_none():
    laps = _laps({"A": [80.0] * 17 + [81.0] * 3}, {"A": 18})
    assert "A" not in _fit(laps, {"A": [18]}).offsets  # 2 laps after the out-lap


def _model() -> dict:
    if not MODEL.exists():
        pytest.skip("no race file")
    return json.loads(MODEL.read_text())


def test_no_stint_pace_replays_as_before():
    model = _model()
    none, zero = copy.deepcopy(model), copy.deepcopy(model)
    for d in none["drivers"]:
        d.pop("stintPace", None)
    for d in zero["drivers"]:
        d["stintPace"] = []
    for seed in (1, 2, 3):
        assert sim_reference.simulate(zero, seed) == sim_reference.simulate(none, seed)


def test_an_offset_applies_only_while_its_stint_runs():
    model = _model()
    # OCO's real lap-24 stint, 0.3 s a lap quicker.
    fast = copy.deepcopy(model)
    oco = next(d for d in fast["drivers"] if d["code"] == "OCO")
    oco["stintPace"] = [{"lap": 24, "offset": -0.3}]
    quick, plain = sim_reference.simulate(fast, 1), sim_reference.simulate(model, 1)
    assert quick["times"]["OCO"] < plain["times"]["OCO"] - 5.0
    # A stint begun on a lap the real car didn't stop on runs at 0: the same race as without it.
    moved = {"OCO": [{"lap": 27, "to": "MEDIUM"}]}
    assert sim_reference.simulate(fast, 1, copy.deepcopy(moved)) == sim_reference.simulate(
        model, 1, copy.deepcopy(moved)
    )


def test_fixture_golden_is_current():
    assert json.loads(GOLDEN.read_text()) == golden(_model())


def test_the_fixture_model_validates():
    from pipeline.export import validate_model

    validate_model(with_stint_pace(_model()))


def test_assemble_leaves_it_out_unless_asked(monkeypatch):
    """Daily/Gauntlet and non-Eras builds never carry stintPace (assemble's stint_pace off), and
    build_race asks for it only on an Eras build of a timed race."""
    import inspect

    from pipeline import assemble

    assert inspect.signature(assemble.assemble_race_model).parameters["stint_pace"].default is False
    seen = {}
    real = assemble.assemble_race_model

    def spy(**kw):
        seen["stint_pace"] = kw["stint_pace"]
        return real(**kw)

    monkeypatch.setattr(assemble, "assemble_race_model", spy)
    pool = sorted(build.shared_races())
    if not pool or not (build.RAW_DIR / f"{pool[0]}.parquet").exists():
        pytest.skip("no pool race snapshot")
    model, _ = build.build_race_model(pool[0])
    assert seen["stint_pace"] is False
    assert not any("stintPace" in d for d in model["drivers"])
