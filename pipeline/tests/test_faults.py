"""Car faults (eras build plan 4.4; simulator roadmap R2): the fault facts reader, the fit of
their magnitudes from the car's real laps, the reference sim's rule, the TS parity vectors,
and canada-2014 built with both Mercedes' power losses (when the TUM database is present)."""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipeline import build, export, faults, incidents, sim_reference, tum
from pipeline.faults import FaultFitError, FaultState
from pipeline.paths import RACES_DIR

FIXTURES = Path(__file__).parent / "fixtures"
PARITY = FIXTURES / "fault_parity.json"
CANADA_FACTS = FIXTURES / "faults" / "canada-2014.json"
SOURCE = "https://en.wikipedia.org/wiki/2014_Canadian_Grand_Prix"


# --- the facts (data/incidents.json, step 2.6's format) -------------------------------------


def _write(tmp_path: Path, data: dict) -> Path:
    path = tmp_path / "incidents.json"
    path.write_text(json.dumps(data))
    return path


def test_fault_facts_read_the_fault_items_and_take_the_kind_from_the_status(tmp_path):
    path = _write(
        tmp_path,
        {
            "x-2014": [
                {"lap": 10, "type": "SC", "driver": "AAA", "status": "Accident"},
                {"lap": 36, "type": "FAULT", "driver": "HAM", "status": "Power Unit",
                 "detail": "MGU-K", "turn": 10, "source": SOURCE},
                {"lap": 22, "type": "FAULT", "driver": "MSC", "status": "Gearbox",
                 "source": SOURCE},
                {"lap": 6, "type": "FAULT", "driver": "HAM", "status": "Puncture",
                 "source": SOURCE},
                {"lap": 30, "type": "FAULT", "driver": "STR", "status": "Tyre", "source": SOURCE},
                {"lap": 40, "type": "FAULT", "driver": "BOT", "status": "Tyre",
                 "fault": "puncture", "laps": 3, "source": SOURCE},
            ]
        },
    )  # fmt: skip
    facts = incidents.fault_facts("x-2014", path)
    assert [(f["driver"], f["fault"]) for f in facts] == [
        ("HAM", "power-loss"),
        ("MSC", "gear-stuck"),
        ("HAM", "puncture"),
        ("STR", "tyre-failure"),
        ("BOT", "puncture"),  # its own `fault` overrides the status
    ]
    assert facts[0]["detail"] == "MGU-K"  # display fields kept
    assert incidents.fault_facts("other-race", path) == []
    assert incidents.fault_facts("x-2014", tmp_path / "missing.json") == []


def test_canada_fixture_is_step_2_6s_entry():
    facts = incidents.fault_facts("canada-2014", CANADA_FACTS)
    assert [(f["lap"], f["driver"], f["fault"]) for f in facts] == [
        (36, "HAM", "power-loss"),
        (37, "ROS", "power-loss"),
    ]
    assert all(f["source"] == SOURCE for f in facts)


@pytest.mark.parametrize(
    "bad",
    [
        {"status": "Power Unit"},  # no source
        {"status": "Power Unit", "source": "wikipedia"},  # not a URL
        {"status": "Accident", "source": SOURCE},  # not a fault kind
        {"status": "Power Unit", "source": SOURCE, "paceLoss": 1.2},  # a magnitude
        {"status": "Tyre", "source": SOURCE, "laps": 0},
        {"status": "Tyre", "source": SOURCE, "laps": 3, "untilStop": True},
        {"status": "Tyre", "source": SOURCE, "slowLap": 12.0},
        {"fault": "flat", "source": SOURCE},
    ],
)
def test_bad_fault_facts_are_rejected(tmp_path, bad):
    path = _write(tmp_path, {"r": [{"lap": 5, "type": "FAULT", "driver": "AAA", **bad}]})
    with pytest.raises(ValueError):
        incidents.fault_facts("r", path)


def test_the_kinds_match_the_fault_module():
    assert incidents.FAULT_KINDS == faults.FAULT_KINDS
    assert set(incidents.FAULT_STATUS.values()) == set(faults.FAULT_KINDS)


def test_writing_sc_causes_keeps_a_races_fault_facts(tmp_path):
    fact = {"lap": 36, "type": "FAULT", "driver": "HAM", "status": "Power Unit", "source": SOURCE}
    path = _write(tmp_path, {"r": [{"lap": 1, "type": "SC"}, fact]})
    incidents.write("r", [{"lap": 2, "type": "SC", "driver": "AAA"}], path)
    assert json.loads(path.read_text())["r"] == [{"lap": 2, "type": "SC", "driver": "AAA"}, fact]


def test_only_the_eras_fault_races_have_fault_facts():
    # data/incidents.json: the races built before step 4.4 build exactly as before; only an
    # Eras race registered for its faults (5.1: canada-2014, azerbaijan-2021, monaco-2008) has
    # any. The reconstructed brazil-1991, hungary-1992 and australia-1986 have facts too,
    # reported but not fitted (synthetic laps).
    with_faults = {race for race in build.RACES if incidents.fault_facts(race)}
    assert with_faults == {
        "canada-2014",
        "azerbaijan-2021",
        "monaco-2008",
        "brazil-1991",
        "hungary-1992",
        "australia-1986",
    }


# --- the fit ---------------------------------------------------------------------------------

COMPOUNDS = {"MEDIUM": {"offset": 0.0, "degPerLap": 0.05, "cliffLap": 60}}
FUEL = 0.05
FRESH = {"bonus": -0.1, "laps": 3}
BASE = {"AAA": 80.0, "BBB": 80.5}


def _laps(extra: dict[tuple[str, int], float], stops: dict[str, int], n: int = 30) -> pd.DataFrame:
    """Two cars running the sim's own clean laps (no noise), plus `extra` seconds on chosen
    laps; a stop at out-lap stops[code] (its in-lap gets 3 s of pit entry, its out-lap 16)."""
    rows = []
    for code, base in BASE.items():
        age, stint = 0, 1
        for lap in range(1, n + 1):
            out = stops.get(code) == lap
            if out:
                age, stint = 0, stint + 1
            car = sim_reference.Car(code, base, 0.0, "MEDIUM", age, 0.0)
            t = sim_reference._clean_lap(car, COMPOUNDS, FUEL, lap, FRESH)
            t += extra.get((code, lap), 0.0)
            is_in = stops.get(code) == lap + 1
            t += 3.0 if is_in else 16.0 if out else 0.0
            rows.append(
                {
                    "Driver": code,
                    "LapNumber": float(lap),
                    "LapTime": t,
                    "Compound": "MEDIUM",
                    "TyreLife": float(age + 1),
                    "Stint": float(stint),
                    "PitInTime": 1.0 if is_in else np.nan,
                    "PitOutTime": 1.0 if out else np.nan,
                    "TrackStatus": "1",
                }
            )
            age += 1
    return pd.DataFrame(rows)


def _fact(**kw) -> dict:
    return {"lap": 10, "type": "FAULT", "driver": "AAA", "source": SOURCE, **kw}


def _fit(laps, fact):
    return faults.fit_fault(laps, fact, BASE, COMPOUNDS, FUEL, FRESH)


def test_a_power_loss_is_the_mean_loss_over_the_laps_after_it():
    extra = {("AAA", lap): (2.0 if lap < 20 else 1.0) for lap in range(10, 31)}
    event = _fit(_laps(extra, {}), _fact(fault="power-loss"))
    # Laps 10-19 lose 2 s, 20-30 lose 1 s: the constant that keeps the car's time.
    assert event == {
        "lap": 10,
        "type": "FAULT",
        "driver": "AAA",
        "fault": "power-loss",
        "paceLoss": round((10 * 2.0 + 11 * 1.0) / 21, 3),
        "storylineEvent": True,
    }


def test_a_gear_fault_with_a_duration_is_fitted_over_those_laps_only():
    extra = {("AAA", lap): 0.7 for lap in range(10, 15)}
    event = _fit(_laps(extra, {}), _fact(fault="gear-stuck", laps=5))
    assert event["paceLoss"] == pytest.approx(0.7, abs=1e-3)
    assert event["laps"] == 5
    assert "untilStop" not in event and "slowLap" not in event


def test_a_puncture_has_a_slow_lap_and_its_limping_laps_until_the_stop():
    # Slow lap 10 (+12 s), two laps limping (+5 s), the in-lap 12, new tyres out on lap 13.
    extra = {("AAA", 10): 12.0, ("AAA", 11): 5.0, ("AAA", 12): 5.0, ("AAA", 13): 0.0}
    event = _fit(_laps(extra, {"AAA": 13, "BBB": 20}), _fact(fault="puncture"))
    assert event["untilStop"] is True
    assert event["paceLoss"] == pytest.approx(5.0, abs=1e-3)  # lap 11 (the in-lap isn't used)
    assert event["slowLap"] == pytest.approx(12.0 - 5.0, abs=1e-3)


def test_a_puncture_fixed_at_once_limps_at_its_slow_lap_cost():
    # The fault lap is the in-lap: the field's in-lap share (3 s of pit entry) comes off.
    laps = _laps({("AAA", 10): 9.0}, {"AAA": 11, "BBB": 20})
    event = _fit(laps, _fact(fault="tyre-failure"))
    assert event["slowLap"] == pytest.approx(9.0, abs=1e-3)
    assert event["paceLoss"] == event["slowLap"]


def test_too_few_laps_to_fit_raises():
    laps = _laps({}, {})
    with pytest.raises(FaultFitError, match="usable laps"):
        _fit(laps, _fact(lap=30, fault="power-loss", slowLap=True))  # no lap after it
    with pytest.raises(FaultFitError, match="no modelled laps"):
        _fit(laps, _fact(driver="ZZZ", fault="power-loss"))


def test_a_fault_whose_car_retired_on_its_lap_is_set_aside():
    # Baku 2021: Verstappen's tyre failed on lap 46 and he never finished the lap. Nothing to
    # fit, and his RETIREMENT event already takes him out: no FAULT event, a build note.
    laps = _laps({}, {})
    laps = laps[~((laps["Driver"] == "AAA") & (laps["LapNumber"] >= 20))]
    retired = _fact(lap=20, fault="tyre-failure")
    running = _fact(driver="BBB", lap=20, fault="power-loss")
    kept, notes = faults.split_retired(laps, [retired, running])
    assert kept == [running]
    assert notes == [
        "AAA tyre-failure on lap 20: the car retired on its fault lap (last lap 19), so its"
        " RETIREMENT event carries it; no FAULT event"
    ]
    # A fault on a lap the car completed is fitted as before (and still raises if it can't be).
    assert faults.split_retired(laps, [_fact(lap=19, fault="tyre-failure")])[1] == []


def test_fault_laps_are_left_out_of_the_cars_normal_pace():
    laps = _laps({}, {"AAA": 13})
    facts = [_fact(fault="puncture")]
    kept = faults.without_fault_laps(laps, facts)
    gone = laps.loc[laps.index.difference(kept.index)]
    assert set(gone["Driver"]) == {"AAA"}
    assert sorted(gone["LapNumber"]) == [10.0, 11.0, 12.0]  # to the in-lap
    assert faults.without_fault_laps(laps, []) is laps


def test_a_stop_made_with_a_fault_keeps_its_real_time():
    laps = _laps({}, {"AAA": 13})
    lasting = [{"lap": 5, "driver": "AAA", "paceLoss": 1.0, "type": "FAULT"}]
    assert faults.adjust_stop_losses({("AAA", 13): 20.0}, lasting, laps) == {("AAA", 13): 18.0}
    tyre = [{"lap": 10, "driver": "AAA", "paceLoss": 4.0, "slowLap": 6.0, "untilStop": True,
             "type": "FAULT"}]  # fmt: skip
    # In-lap 12 limps (4 s); the out-lap is on new tyres.
    assert faults.adjust_stop_losses({("AAA", 13): 20.0}, tyre, laps) == {("AAA", 13): 16.0}
    assert faults.adjust_stop_losses({("AAA", 13): 20.0}, [], laps) == {("AAA", 13): 20.0}


# --- the sim's rule --------------------------------------------------------------------------


def test_fault_state_costs():
    ev = {"lap": 10, "type": "FAULT", "driver": "AAA", "paceLoss": 2.0, "slowLap": 5.0,
          "untilStop": True}  # fmt: skip
    gear = {"lap": 10, "type": "FAULT", "driver": "BBB", "paceLoss": 1.0, "laps": 2}
    s = FaultState([ev, gear, {"lap": 3, "type": "SC", "laps": 2}])
    assert s.cost("AAA", 9, False, True) == (0.0, 0.0)
    assert s.cost("AAA", 10, True, True) == (2.0, 5.0)  # a stop on its own lap doesn't fix it
    assert s.cost("AAA", 11, False, False) == (0.0, 0.0)  # neutralized: no pace loss
    assert s.cost("AAA", 12, False, True) == (2.0, 0.0)
    assert s.cost("AAA", 13, True, True) == (0.0, 0.0)  # new tyres
    assert s.cost("AAA", 14, False, True) == (0.0, 0.0)  # stays fixed
    assert [s.cost("BBB", lap, False, True) for lap in (10, 11, 12)] == [
        (1.0, 0.0),
        (1.0, 0.0),
        (0.0, 0.0),
    ]
    assert s.cost("CCC", 10, False, True) == (0.0, 0.0)


def _abu() -> dict:
    return json.loads((RACES_DIR / "abu-dhabi-2021.json").read_text())


def test_a_lone_car_loses_exactly_its_faults_cost():
    model = _abu()
    model["drivers"] = [d for d in model["drivers"] if d["code"] == "SAI"]
    model["drivers"][0]["stateAtTakeover"]["gapAhead"] = 0.0
    model["events"] = [e for e in model["events"] if e["type"] != "RETIREMENT"]
    before = sim_reference.simulate(model, 3)["times"]["SAI"]
    model["events"].append(
        {"lap": 40, "type": "FAULT", "driver": "SAI", "fault": "power-loss", "paceLoss": 1.5,
         "slowLap": 4.0}
    )  # fmt: skip
    after = sim_reference.simulate(model, 3)["times"]["SAI"]
    green = [lap for lap in range(40, 59) if not (53 <= lap <= 57)]  # SC laps 53-57
    assert after - before == pytest.approx(1.5 * len(green) + 4.0, abs=2e-3)


# --- parity with the TS sim -------------------------------------------------------------------

PARITY_FAULTS = [
    # A puncture: slow lap, two laps limping, fixed at the real stop (out-lap 49).
    {"lap": 46, "type": "FAULT", "driver": "NOR", "fault": "puncture", "paceLoss": 5.5,
     "slowLap": 14.0, "untilStop": True, "storylineEvent": True},
    {"lap": 40, "type": "FAULT", "driver": "BOT", "fault": "gear-stuck", "paceLoss": 0.8,
     "laps": 10, "storylineEvent": True},
    # Struck on a VSC lap; lasts through the SC and a stop.
    {"lap": 38, "type": "FAULT", "driver": "GAS", "fault": "power-loss", "paceLoss": 1.1,
     "storylineEvent": True},
    # Never stops again: limps to the flag.
    {"lap": 50, "type": "FAULT", "driver": "SAI", "fault": "tyre-failure", "paceLoss": 4.0,
     "slowLap": 9.0, "untilStop": True, "storylineEvent": True},
    # Under the SC: the slow lap counts, the pace loss waits for green.
    {"lap": 54, "type": "FAULT", "driver": "OCO", "fault": "puncture", "paceLoss": 3.0,
     "slowLap": 6.0, "untilStop": True, "storylineEvent": True},
]  # fmt: skip
PARITY_SEEDS = list(range(1, 9))


def parity_model() -> dict:
    model = _abu()
    model["events"] = sorted(
        model["events"] + copy.deepcopy(PARITY_FAULTS), key=lambda e: (e["lap"], e["type"])
    )
    return model


def parity_vectors() -> dict:
    model = parity_model()
    return {
        "_comment": "Car-fault parity vectors (eras build plan 4.4): data/races/"
        "abu-dhabi-2021.json with these FAULT events added, run by the Python reference sim. "
        "Checked by pipeline/tests/test_faults.py and packages/sim/tests/faults.test.ts. "
        "Regenerate with FAULT_PARITY_WRITE=1.",
        "race": "abu-dhabi-2021",
        "faults": PARITY_FAULTS,
        "results": {str(s): sim_reference.simulate(model, s) for s in PARITY_SEEDS},
    }


def test_parity_vectors_are_the_reference_sims():
    want = parity_vectors()
    if os.environ.get("FAULT_PARITY_WRITE"):
        PARITY.write_text(json.dumps(want, indent=1) + "\n")
    assert json.loads(PARITY.read_text()) == json.loads(json.dumps(want))


def test_the_parity_model_is_schema_valid_and_the_faults_matter():
    model = parity_model()
    export.validate_model(model)
    plain = sim_reference.simulate(_abu(), 1)
    faulted = sim_reference.simulate(model, 1)
    # The SC (laps 53-57) closes most of it up again; the slow lap and lap 58 stay.
    assert faulted["times"]["SAI"] > plain["times"]["SAI"] + 4.0


# --- canada-2014: both Mercedes' power losses (TUM, offline) ----------------------------------

# The TUM database (pipeline cache; a worktree can point TUM_DB at the main checkout's).
TUM_DB = Path(os.environ.get("TUM_DB", tum.DEFAULT_DB))
needs_tum = pytest.mark.skipif(not TUM_DB.exists(), reason="TUM database not cached")


@pytest.fixture(scope="module")
def canada(tmp_path_factory):
    raw = tmp_path_factory.mktemp("raw")
    tum.ingest_tum("canada-2014", TUM_DB, raw)
    meta = {
        "year": 2014,
        "event": "Canada",
        "name": "Canada 2014: Rosberg vs Ricciardo",
        "era": "2014-2025",
        "takeover_lap": 30,
        "seed": 1,
        "user_side": "ROS",
        "rival": "RIC",
        "score_positions": 6,
        "split": "eras",
    }
    with pytest.MonkeyPatch.context() as mp:
        mp.setitem(build.RACES, "canada-2014", meta)
        facts = incidents.fault_facts("canada-2014", CANADA_FACTS)
        with_faults = build.build_race("canada-2014", raw_dir=raw, fault_facts=facts)
        without = build.build_race("canada-2014", raw_dir=raw, fault_facts=[])
    return raw, with_faults, without


def _replay_errors(model: dict, laps: pd.DataFrame, pairs) -> dict:
    """Noise-free replay: for each (car, lap n), the car's sim time at the end of lap n minus
    its real time (both from the leader at the takeover)."""
    m = copy.deepcopy(model)
    for d in m["drivers"]:
        d["noise"] = 0.0
    t0 = float(laps[laps["LapNumber"] == m["race"]["takeoverLap"]]["Time"].min())
    out = {}
    for c, n in pairs:
        mm = copy.deepcopy(m)
        mm["race"]["laps"] = n
        times = sim_reference.simulate(mm, 1)["times"]
        real = laps[(laps["Driver"] == c) & (laps["LapNumber"] == n)]["Time"].iloc[0]
        out[(c, n)] = times[c] - (float(real) - t0)
    return out


@needs_tum
def test_canada_2014_builds_with_both_mercedes_power_losses(canada, tmp_path):
    _, result, _ = canada
    model = result.model
    got = [e for e in model["events"] if e["type"] == "FAULT"]
    assert [(e["lap"], e["driver"], e["fault"]) for e in got] == [
        (36, "HAM", "power-loss"),
        (37, "ROS", "power-loss"),
    ]
    for e in got:
        assert e["storylineEvent"] is True
        assert 1.5 < e["paceLoss"] < 3.5  # the ~160 hp of boost they lost (fitted)
        assert "laps" not in e and "untilStop" not in e  # to the flag
    out = export.write_race(model, races_dir=tmp_path)
    assert json.loads(out.read_text())["events"] == model["events"]


@needs_tum
def test_canada_2014_replays_the_mercedes_real_race(canada):
    _, result, without = canada
    laps = result.laps
    pairs = [("ROS", 36), ("HAM", 36), ("HAM", 46), ("ROS", 67)]
    fit = _replay_errors(result.model, laps, pairs)
    old = _replay_errors(without.model, laps, pairs)
    # Before the faults the cars run their real pace (without the fault model their pace is
    # averaged with the slow laps: 9-11 s behind by lap 36).
    assert abs(fit[("ROS", 36)]) < 1.0 and abs(fit[("HAM", 36)]) < 2.5
    assert abs(old[("ROS", 36)]) > 5.0
    # HAM to his last lap and ROS to lap 67 (the SC lap 70 aside) end at their real times.
    assert abs(fit[("HAM", 46)]) < 1.0
    assert abs(fit[("ROS", 67)]) < 1.5


@pytest.mark.parametrize(
    "bad",
    [
        {"fault": "power-loss"},  # no paceLoss
        {"paceLoss": 1.0},  # no kind
        {"fault": "flat", "paceLoss": 1.0},
        {"fault": "puncture", "paceLoss": -1.0},
        {"fault": "puncture", "paceLoss": 1.0, "slowLap": "long"},
    ],
)
def test_the_schema_rejects_bad_fault_events(bad):
    import jsonschema

    model = _abu()
    model["events"].append({"lap": 40, "type": "FAULT", "driver": "SAI", **bad})
    with pytest.raises(jsonschema.ValidationError):
        export.validate_model(model)
