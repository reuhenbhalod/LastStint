"""Eras sim fixes: stops with no tyre change, the fitted SC queue, no-unlapping queues, the free
tyre change when the cars stop on the grid, and the robust green pit loss."""

from __future__ import annotations

import copy
import json

import pandas as pd
import pytest

from pipeline import pace, redflag, sc_queue, sim_reference, track
from pipeline.paths import RACES_DIR, RAW_DIR


def _raw(race_id: str) -> pd.DataFrame:
    path = RAW_DIR / f"{race_id}.parquet"
    if not path.exists():
        pytest.skip(f"no raw snapshot for {race_id}")
    return pd.read_parquet(path)


# --- fix 1: stops with no tyre change ---------------------------------------------------------


def test_baku_2017_service_stops_are_found():
    """HAM's headrest stop (in on lap 31) and VET's stop-go (in on lap 33) changed no tyres."""
    found = {(d, int(o["LapNumber"])) for d, _, o in track.service_stops(_raw("azerbaijan-2017"))}
    assert {("HAM", 32), ("VET", 34)} <= found


def test_pit_lane_passes_under_the_sc_are_not_service_stops():
    """Hungary 2015 laps 45-46: the field through the pit lane under the SC, same tyres."""
    found = {(d, int(o["LapNumber"])) for d, _, o in track.service_stops(_raw("hungary-2015"))}
    assert not any(lap in (45, 46, 47) for _, lap in found)
    assert ("HAM", 55) in found  # his drive-through


def test_service_stops_aren_t_tyre_stops():
    laps = _raw("azerbaijan-2017")
    tyre = {(d, int(o["LapNumber"])) for d, _, o in track.pit_stops(laps)}
    service = {(d, int(o["LapNumber"])) for d, _, o in track.service_stops(laps)}
    assert not tyre & service


def _model(race_id: str) -> dict:
    path = RACES_DIR / f"{race_id}.json"
    if not path.exists():
        pytest.skip(f"no race file for {race_id}")
    return json.loads(path.read_text())


def test_the_sim_charges_a_service_stop_and_keeps_the_set():
    model = _model("spain-2016")
    code = model["drivers"][0]["code"]
    lap = model["race"]["takeoverLap"] + 3
    model["race"]["laps"] = lap
    base = sim_reference.simulate(model, 1)
    served = copy.deepcopy(model)
    served["drivers"][0]["serviceStops"] = [{"lap": lap, "loss": 25.0}]
    got = sim_reference.simulate(served, 1)
    assert got["times"][code] == pytest.approx(base["times"][code] + 25.0, abs=1e-6)


def test_sim_frame_losses_price_the_service_stops():
    """The sim-frame loss of a stop with no tyre change: positive, at about a pit loss."""
    laps = _raw("azerbaijan-2017")
    model = _model("azerbaijan-2017")
    pace_of = {d["code"]: d["basePace"] for d in model["drivers"]}
    losses = pace.sim_frame_losses(
        laps,
        pace_of,
        model["compounds"],
        model["fuelEffectPerLap"],
        model["freshTyre"],
        model["race"]["takeoverLap"],
        service=True,
    )
    assert 15.0 < losses[("HAM", 32)] < 45.0
    assert 15.0 < losses[("VET", 34)] < 45.0


# --- fix 2: the SC queue ----------------------------------------------------------------------


def test_committed_sc_queue_fit_matches_the_snapshots():
    missing = [r for r in sc_queue.FIT_RACES if not (RAW_DIR / f"{r}.parquet").exists()]
    if missing:
        pytest.skip(f"raw snapshots missing: {missing}")
    got = sc_queue.fit()
    assert (got["spacing"], got["keep"]) == (sc_queue.SC_QUEUE_SPACING, sc_queue.SC_QUEUE_KEEP)
    assert got["laps"] == 79


def test_close_queue_keeps_the_excess_over_the_spacing():
    gaps = sc_queue.close_queue(pd.Series([0.0, 1.0, 11.0]).to_numpy(), 1.7, 0.34)
    assert list(gaps) == pytest.approx([0.0, 1.0, 1.0 + 1.7 + 0.34 * (10.0 - 1.7)])


class _Car:
    def __init__(self, t: float):
        self.total_time = t


def test_eras_middle_lap_closes_gap_by_gap():
    cars = {"A": _Car(0.0), "B": _Car(10.0), "C": _Car(40.0)}
    sim_reference._bunch(["A", "B", "C"], cars, 90.0, sim_reference.SC_GAP_KEEP, None, True)
    b = 1.7 + 0.34 * (10.0 - 1.7)
    assert cars["B"].total_time == pytest.approx(b)
    assert cars["C"].total_time == pytest.approx(b + 1.7 + 0.34 * (30.0 - 1.7))
    # Without a rules block (Daily/Gauntlet), the old rule: car by car toward BUNCH_GAP.
    old = {"A": _Car(0.0), "B": _Car(10.0), "C": _Car(40.0)}
    sim_reference._bunch(["A", "B", "C"], old, 90.0, sim_reference.SC_GAP_KEEP, None, False)
    assert old["B"].total_time == pytest.approx(0.5 + 0.34 * 9.5)


# --- fix 3 and 4: red flags -------------------------------------------------------------------


def test_stop_losses_free_on_the_lap_after_a_grid_stoppage():
    laps = pd.DataFrame(
        {
            "Driver": ["AAA", "AAA", "AAA"],
            "LapNumber": [9, 10, 11],
            "Time": [900.0, 1000.0, 1100.0],
            "Position": [1, 1, 1],
            "Compound": ["SOFT", "SOFT", "HARD"],
            "TyreLife": [9, 10, 1],
            "PitInTime": [None, 1000.0, None],
            "PitOutTime": [None, None, 1020.0],
            "LapTime": [100.0, 100.0, 100.0],
            "TrackStatus": ["1", "5", "1"],
        }
    )
    events = [{"lap": 10, "type": "RED", "laps": 1}]
    got = redflag.stop_losses(laps, events, None, 22.0, 12.0, 15.0)
    assert got == {("AAA", 11): 0.0}


def test_no_unlapping_sc_queue_keeps_road_order():
    # Lap 100 s: B is 30 s back on the lead lap, L a lap down 10 s behind A on the road.
    cars = {"A": _Car(0.0), "B": _Car(30.0), "L": _Car(110.0)}
    sim_reference._bunch(["A", "B", "L"], cars, 100.0, 0.0, "none", True)
    assert cars["L"].total_time == pytest.approx(100.5)
    assert cars["B"].total_time == pytest.approx(1.0)


# --- fix 5: the robust pit loss ---------------------------------------------------------------


def test_saudi_2021_pit_loss_leaves_out_the_damage_stops():
    laps = _raw("saudi-arabia-2021")
    assert track.pit_loss(laps) == pytest.approx(48.916, abs=0.01)
    assert track.pit_loss(laps, guard=True) == pytest.approx(23.935, abs=0.01)
    assert {("RAI", 27), ("TSU", 24)} <= track.damage_stops(laps)


# --- stop-loss fixes (integration 5) ----------------------------------------------------------


def test_back_to_back_stops_count_their_shared_lap_once():
    """canada-2011 MAS: in on 52 (out 53) and in on 53 (out 54). Lap 53 is the first stop's
    out-lap; an Eras build measures the second on lap 54 alone."""
    laps = _raw("canada-2011")
    assert ("MAS", 53) in track.chained_in_laps(laps)
    old = {r["out_lap"]: r for r in track.stop_records(laps) if r["driver"] == "MAS"}
    new = {r["out_lap"]: r for r in track.stop_records(laps, True) if r["driver"] == "MAS"}
    assert new[53]["loss"] == pytest.approx(old[53]["loss"])
    assert new[54]["in_loss"] == 0.0
    assert new[54]["loss"] == pytest.approx(old[54]["loss"] - old[54]["in_loss"])
    assert new[54]["loss"] < 15.0 < old[54]["loss"]
    # Stops that aren't back to back measure as before.
    assert new[22]["loss"] == pytest.approx(old[22]["loss"])


def _frame(race_id: str, eras_stops: bool) -> dict:
    laps = _raw(race_id)
    model = _model(race_id)
    pace_of = {d["code"]: d["basePace"] for d in model["drivers"]}
    return pace.sim_frame_losses(
        laps,
        pace_of,
        model["compounds"],
        model["fuelEffectPerLap"],
        model["freshTyre"],
        model["race"]["takeoverLap"],
        model.get("weather"),
        None,
        {d["code"]: d["wetPace"] for d in model["drivers"] if "wetPace" in d},
        eras_stops=eras_stops,
    )


def test_sim_frame_charges_a_back_to_back_stop_its_out_lap_only():
    laps = _raw("canada-2011")
    old, new = _frame("canada-2011", False), _frame("canada-2011", True)
    lap = laps[(laps["Driver"] == "MAS")].set_index("LapNumber")
    assert new[("MAS", 53)] == pytest.approx(old[("MAS", 53)])
    # Old: lap 53 (already in the first stop's loss) plus lap 54; new: lap 54's excess only.
    assert new[("MAS", 54)] < old[("MAS", 54)]
    assert new[("MAS", 54)] < float(lap.loc[54, "LapTime"]) - float(lap.loc[56, "LapTime"]) + 10.0
    assert new[("MAS", 53)] + new[("MAS", 54)] < 75.0 < old[("MAS", 53)] + old[("MAS", 54)]


def test_partly_yellow_stops_are_priced_in_the_sim_frame():
    """Stops whose in- or out-lap was partly under a local yellow ("12", "21") were left to
    the field-median figure; an Eras build prices them in the sim frame, like green ones."""
    laps = _raw("canada-2011")
    yellow = {
        (d, int(o["LapNumber"]))
        for d, i, o in track.pit_stops(laps)
        if {str(i["TrackStatus"]), str(o["TrackStatus"])} - {"1"}
        and all(track.racing_status(r["TrackStatus"]) for r in (i, o))
    }
    old, new = _frame("canada-2011", False), _frame("canada-2011", True)
    model = _model("canada-2011")
    running = {d["code"] for d in model["drivers"]}
    after = {k for k in yellow if k[1] > model["race"]["takeoverLap"] + 1 and k[0] in running}
    assert after
    assert not after & set(old)
    assert after <= set(new)
    # Green stops price as before (back-to-back ones aside).
    chained = track.chained_in_laps(laps)
    for key, loss in old.items():
        if (key[0], key[1] - 1) not in chained:
            assert new[key] == pytest.approx(loss)


def test_racing_status():
    assert [track.racing_status(s) for s in ("1", "12", "21", "2", "124", "4", "", None)] == [
        True,
        True,
        True,
        False,
        False,
        False,
        False,
        False,
    ]
