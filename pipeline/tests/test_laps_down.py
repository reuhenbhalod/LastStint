"""Job 1.5: a no-unlapping race's SC and red-flag queues take the scripted cars' real laps down
(restart.laps_down / with_laps_down, the events' `lapsDown`, redflag.road_order's `known`), and
the TS parity vectors (fixtures/laps_down_parity.json, checked by
packages/sim/tests/laps-down.test.ts)."""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pandas as pd
import pytest

from pipeline import export, redflag, restart, sim_reference
from pipeline.paths import RACES_DIR, RAW_DIR
from pipeline.sim_reference import Car

FIXTURES = Path(__file__).parent / "fixtures"
PARITY = FIXTURES / "laps_down_parity.json"
SEEDS = list(range(1, 9))


def _laps(rows: list[tuple[str, int, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        [{"Driver": d, "LapNumber": n, "Time": t, "Position": None} for d, n, t in rows]
    )


def test_laps_down_counts_laps_not_gaps():
    # The leader's lap 3 ends at 300 s. B is 95 s behind (more than a 90 s lap) but has done
    # lap 2: the lead lap. C has done one lap: a lap down. D was out before then.
    laps = _laps(
        [("A", 1, 100), ("A", 2, 200), ("A", 3, 300), ("A", 4, 400)]
        + [("B", 1, 110), ("B", 2, 205), ("B", 3, 395)]
        + [("C", 1, 150), ("C", 2, 310), ("C", 3, 470)]
        + [("D", 1, 120), ("D", 2, 260)]
    )
    assert restart.laps_down(laps, 3) == {"A": 0, "B": 0, "C": 1}
    assert restart.laps_down(laps, 9) == {}


def _model(unlap: str | None) -> dict:
    return {
        "race": {"takeoverLap": 1, **({"scUnlap": unlap} if unlap else {})},
        "drivers": [{"code": c} for c in "ABC"],
        "events": [
            {"lap": 2, "type": "SC", "laps": 2},
            {"lap": 3, "type": "RETIREMENT", "driver": "C"},
        ],
    }


def test_with_laps_down_takes_the_most_over_the_event():
    # C is a lap down at the end of lap 3, not lap 2 (lapped as the queue formed): 1.
    laps = _laps(
        [("A", 1, 100), ("A", 2, 200), ("A", 3, 300)]
        + [("B", 1, 110), ("B", 2, 210), ("B", 3, 310)]
        + [("C", 1, 150), ("C", 2, 310), ("C", 3, 450)]
    )
    out, lines = restart.with_laps_down(_model("none"), laps)
    assert out["events"][0]["lapsDown"] == {"A": 0, "B": 0, "C": 1}
    assert "lapsDown" not in out["events"][1]
    assert lines == ["  SC laps 2-3: real laps down C 1"]
    # A race whose lapped cars unlap behind the SC is left alone.
    same, none = restart.with_laps_down(_model(None), laps)
    assert same == _model(None) and none == []


def _cars(times: dict[str, float]) -> dict[str, Car]:
    return {
        c: Car(code=c, base_pace=90, noise=0, compound="M", tyre_age=0, total_time=t)
        for c, t in times.items()
    }


def test_road_order_takes_the_known_laps_down():
    cars = _cars({"A": 0.0, "B": 10.0, "H": 95.0, "L": 30.0})
    # Its own gaps (a 90 s lap): H a lap down, 5 s behind the leader on the road.
    road, down, on_road = redflag.road_order(list(cars), cars, 90.0)
    assert road == ["A", "H", "B", "L"] and down["H"] == 1 and on_road["H"] == 5.0
    # Really H on the lead lap (it joins the back of the queue) and L a lap down (it keeps its
    # place on the road and loses the lap).
    road, down, on_road = redflag.road_order(list(cars), cars, 90.0, {"H": 0, "L": 1})
    assert road == ["A", "B", "L", "H"]
    assert (down["H"], down["L"], on_road["H"], on_road["L"]) == (0, 1, 95.0, 30.0)
    redflag.line_up(list(cars), cars, 0.5, 90.0, {"H": 0, "L": 1})
    assert {c: cars[c].total_time for c in cars} == {"A": 0.0, "B": 0.5, "L": 91.0, "H": 1.5}


def test_real_laps_down_skips_overridden_cars():
    events = [
        {"lap": 5, "type": "SC", "laps": 2, "lapsDown": {"A": 0, "B": 1}},
        {"lap": 9, "type": "RED", "lapsDown": {"B": 2}},
        {"lap": 12, "type": "SC", "laps": 1},
    ]
    got = redflag.real_laps_down(events, {"B"})
    assert got == {5: {"A": 0}, 6: {"A": 0}, 9: {}}


# --- monaco-2011 and the TS parity ------------------------------------------------------------


def parity_model() -> dict:
    path, raw = RACES_DIR / "monaco-2011.json", RAW_DIR / "monaco-2011.parquet"
    if not path.exists() or not raw.exists():
        pytest.skip("no monaco-2011 race file or snapshot")
    model = json.loads(path.read_text())
    model["events"] = [{k: v for k, v in e.items() if k != "lapsDown"} for e in model["events"]]
    out, _ = restart.with_laps_down(model, pd.read_parquet(raw))
    return out


def parity_vectors() -> dict:
    model = parity_model()
    ham = next(d for d in model["drivers"] if d["code"] == "HAM")["realStrategy"]
    return {
        "_comment": "Job 1.5 parity vectors: data/races/monaco-2011.json with each SC and RED "
        "event's real laps down (lapsDown, restart.with_laps_down), run by the Python reference "
        "sim; `overridden`: HAM's strategy passed in (so his laps down come from his gaps). "
        "Checked by pipeline/tests/test_laps_down.py and packages/sim/tests/laps-down.test.ts. "
        "Regenerate with LAPS_DOWN_PARITY_WRITE=1.",
        "race": "monaco-2011",
        "lapsDown": {
            str(i): e["lapsDown"] for i, e in enumerate(model["events"]) if "lapsDown" in e
        },
        "results": {str(s): sim_reference.simulate(model, s) for s in SEEDS},
        "overridden": {
            str(s): sim_reference.simulate(model, s, {"HAM": copy.deepcopy(ham)}) for s in SEEDS
        },
    }


def test_parity_vectors_are_the_reference_sims():
    want = parity_vectors()
    if os.environ.get("LAPS_DOWN_PARITY_WRITE"):
        PARITY.write_text(json.dumps(want, indent=1) + "\n")
    assert json.loads(PARITY.read_text()) == json.loads(json.dumps(want))


def test_monaco_2011_keeps_hamilton_and_webber_on_the_lead_lap():
    model = parity_model()
    export.validate_model(model)
    red = next(e for e in model["events"] if e["type"] == "RED")
    assert red["lapsDown"]["HAM"] == 0 and red["lapsDown"]["WEB"] == 0
    assert red["lapsDown"]["SUT"] == 1
    plain = copy.deepcopy(model)
    plain["events"] = [{k: v for k, v in e.items() if k != "lapsDown"} for e in plain["events"]]
    lapped = lambda m: sum(  # noqa: E731
        sim_reference.simulate(m, s)["gaps"]["HAM"] > 60 for s in range(1, 41)
    )
    assert lapped(model) == 0 < lapped(plain)
