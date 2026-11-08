"""Race reconstruction from anchors (eras build plan 4.6, roadmap P3).

The solver is tested on small made-up races (Anchors built in code) and end to end on
tests/fixtures/reconstruct: the 1994 Australian GP cut from the Jolpica dump, with copies of
its F1DB CSVs (see VERSION.txt there). A test drivers.json with no drivers keeps the codes
independent of data/drivers.json (Jolpica's code or reference is used).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import build, clean, cli, events, export, ingest, paths
from pipeline import reconstruct as rc
from pipeline.assemble import finishing_order

FIXTURE = Path(__file__).parent / "fixtures" / "reconstruct"
DUMP = FIXTURE / "jolpica-1994"
F1DB = FIXTURE / "f1db"
SRC = "test fixture"


def toy(year: int = 1990, stops: bool = False, sc: list[tuple[int, int]] | None = None):
    """A 50-lap race: 3 on the lead lap, lapped cars, a classified retirement, a pit-lane
    starter, a crash and a car out on lap 1."""
    base = 50 * 90.0 + sum(30.0 * (b - a + 1) for a, b in sc or [])  # SC laps are slow

    def car(code, grid, pos, status, laps, time, f, f_lap, classified=True, stop_laps=()):
        return rc.Car(
            driver=code,
            team=f"T{code}",
            number=None,
            grid=grid,
            position=pos,
            classified=classified,
            status=status,
            laps=laps,
            time=time,
            fastest_time=f,
            fastest_lap=f_lap,
            stops=[rc.Stop(n, 24.0, SRC) for n in stop_laps] if stops else [],
        )

    cars = [
        car("AAA", 2, 1, "finished", 50, base, 88.512, 40, stop_laps=(20,)),
        car("BBB", 1, 2, "finished", 50, base + 12.345, 88.401, 45, stop_laps=(18, 35)),
        car("CCC", 4, 3, "finished", 50, base + 40.1, 89.003, 12, stop_laps=(25,)),
        car("DDD", 3, 4, "lapped", 49, None, 89.9, 30, stop_laps=(22,)),
        car("EEE", 6, 5, "lapped", 49, None, 90.3, 3, stop_laps=(24,)),
        car("GGG", 0, 6, "lapped", 48, None, 91.0, 25, stop_laps=(26,)),
        car("FFF", 5, 7, "retired", 47, None, 89.5, 30, stop_laps=(21,)),
        car("HHH", 7, 8, "accident", 10, None, 90.0, 9, classified=False),
        car("III", 8, 9, "accident", 0, None, None, None, classified=False),
    ]
    return rc.Anchors(
        race_id=f"toy-{year}",
        year=year,
        laps=50,
        cars=cars,
        safety_cars=[rc.SafetyCar(a, b, SRC) for a, b in sc or []],
        stops_complete=stops,
        safety_cars_complete=year < 1993,
    )


@pytest.fixture(scope="module")
def solved() -> rc.Result:
    return rc.reconstruct(toy())


# --- The solver on fixtures -----------------------------------------------------------------


def test_every_anchor_passes(solved):
    assert rc.failures(solved.sidecar["anchors"]) == []
    assert solved.sidecar["solver"]["passed"]


def test_exact_finishing_order(solved):
    order = finishing_order(solved.laps)
    assert order[:7] == ["AAA", "BBB", "CCC", "DDD", "EEE", "GGG", "FFF"]


def test_lead_lap_gaps_within_two_seconds(solved):
    df = solved.laps
    end = df[df["LapNumber"] == 50].set_index("Driver")["Time"]
    assert abs((end["BBB"] - end["AAA"]) - 12.345) <= 2.0
    assert abs((end["CCC"] - end["AAA"]) - 40.1) <= 2.0
    assert abs(end["AAA"] - 4500.0) < 0.1  # the race time itself


def test_fastest_laps_on_their_laps(solved):
    df = solved.laps.dropna(subset=["LapTime"])
    for c in toy().cars:
        if c.fastest_time is None:
            continue
        mine = df[df["Driver"] == c.driver]
        best = mine.loc[mine["LapTime"].idxmin()]
        assert int(best["LapNumber"]) == c.fastest_lap, c.driver
        assert best["LapTime"] == pytest.approx(c.fastest_time, abs=5e-4)
        assert (mine["LapTime"] > c.fastest_time).sum() == len(mine) - 1  # strictly fastest


def test_retirement_laps_and_events(solved):
    df = solved.laps
    timed = df.dropna(subset=["LapTime"]).groupby("Driver").size()
    assert timed["FFF"] == 47 and timed["HHH"] == 10
    assert "III" not in timed  # out on lap 1: lap 1 untimed, at the start
    (row,) = df[df["Driver"] == "III"].itertuples()
    assert row.LapNumber == 1 and row.Time == 0.0
    retired = {e["driver"] for e in events.retirement_events(df, 50)}
    assert retired == {"FFF", "HHH", "III"}


def test_lapped_cars_are_their_laps_down(solved):
    df = solved.laps
    t_win = float(df[(df["Driver"] == "AAA") & (df["LapNumber"] == 50)]["Time"].iloc[0])
    for code, laps in (("DDD", 49), ("EEE", 49), ("GGG", 48)):
        t = df[df["Driver"] == code].sort_values("LapNumber")["Time"].to_numpy()
        assert len(t) == laps
        assert t[-2] < t_win < t[-1], code  # still racing at the flag, then finishes


def test_unclassified_cars_running_at_the_flag_are_lapped_not_retired():
    # As australia-1986's Tambay (70 of 82 laps) and Berg: running at the end, too few laps
    # to be classified. They must cross the line after the winner, not look retired.
    anchors = toy()
    for code, grid, laps in (("JJJ", 9, 40), ("KKK", 10, 31)):
        anchors.cars.append(
            rc.Car(code, f"T{code}", None, grid, None, False, "lapped", laps, None, 93.0, 20)
        )
    res = rc.reconstruct(anchors)
    assert rc.failures(res.sidecar["anchors"]) == []
    df = res.laps
    t_win = float(df[(df["Driver"] == "AAA") & (df["LapNumber"] == 50)]["Time"].iloc[0])
    for code, laps in (("JJJ", 40), ("KKK", 31)):
        t = df[df["Driver"] == code].sort_values("LapNumber")["Time"].to_numpy()
        assert len(t) == laps
        assert t[-2] < t_win < t[-1], code
    down = {r["subject"]: r for r in res.sidecar["anchors"] if r["anchor"] == "laps down"}
    assert down["JJJ"]["achieved"] == 10 and down["KKK"]["achieved"] == 19
    retired = {e["driver"] for e in events.retirement_events(df, 50)}
    assert not retired & {"JJJ", "KKK"}


def test_a_disqualified_car_ahead_on_the_road_fails_the_order_anchor():
    # As san-marino-1985's Prost: the full distance, no time, out of the classification. To
    # look retired with every lap done he'd be first on the road, heading the race file's
    # realResult, so the order anchor (the classified cars head the road order) fails.
    anchors = toy()
    anchors.cars.append(
        rc.Car("DQQ", "TDQQ", None, 9, None, False, "disqualified", 50, None, None, None)
    )
    res = rc.reconstruct(anchors)
    (order,) = [r for r in res.sidecar["anchors"] if r["anchor"] == "order"]
    assert order["pass"] is False and order["achieved"][0] == "DQQ"
    assert finishing_order(res.laps)[0] == "DQQ"


def test_grid_order_on_lap_one(solved):
    lap1 = solved.laps[solved.laps["LapNumber"] == 1].dropna(subset=["LapTime"])
    order = lap1.sort_values("Time")["Driver"].tolist()
    assert order == ["BBB", "AAA", "DDD", "CCC", "FFF", "EEE", "HHH", "GGG"]  # pit lane last


def test_raw_snapshot_shape(solved):
    df = solved.laps
    assert list(df.columns) == ingest.LAP_COLUMNS
    timed = df.dropna(subset=["LapTime"])
    for _, g in timed.groupby("Driver"):
        g = g.sort_values("LapNumber")
        assert np.allclose(g["LapTime"].cumsum(), g["Time"], atol=1e-6)
    assert set(df["TrackStatus"]) == {"1"}
    assert df["Compound"].isna().all()
    kept, _, _ = clean.clean_laps(df)
    assert len(kept) > 0.5 * len(df)


def test_deterministic_and_seeded():
    a = rc.reconstruct(toy()).laps
    b = rc.reconstruct(toy()).laps
    pd.testing.assert_frame_equal(a, b)
    c = rc.reconstruct(toy(), rc.Params(seed=7))
    assert not a["LapTime"].equals(c.laps["LapTime"])
    assert rc.failures(c.sidecar["anchors"]) == []


def test_real_stops_are_run():
    res = rc.reconstruct(toy(year=1994, stops=True))
    assert rc.failures(res.sidecar["anchors"]) == []
    df = res.laps
    bbb = df[df["Driver"] == "BBB"].set_index("LapNumber")
    assert bbb.loc[18.0, "PitInTime"] == bbb.loc[18.0, "Time"]
    assert bbb.loc[19.0, "Stint"] == 2 and bbb.loc[36.0, "Stint"] == 3
    assert bbb.loc[19.0, "TyreLife"] == 1
    assert bbb.loc[18.0, "Time"] < bbb.loc[19.0, "PitOutTime"] < bbb.loc[19.0, "Time"]
    assert clean.tyre_change_out_laps(df).sum() == 8
    stops = [r for r in res.sidecar["anchors"] if r["anchor"] == "stop"]
    assert len(stops) == 8 and all(r["pass"] for r in stops)


def test_safety_car_laps_and_queue():
    res = rc.reconstruct(toy(year=1993, sc=[(20, 23)]))
    assert rc.failures(res.sidecar["anchors"]) == []
    df = res.laps
    leader = df[df["Position"] == 1].set_index("LapNumber")
    assert sorted(leader.index[leader["TrackStatus"] == "4"].astype(int)) == [20, 21, 22, 23]
    assert [s["status"] for s in res.status] == ["1", "4", "1"]
    # The lead-lap cars queue up behind the safety car.
    end = df[df["LapNumber"] == 23].set_index("Driver")["Time"]
    assert end["BBB"] - end["AAA"] <= 1.0 + 1e-6 or end["AAA"] - end["BBB"] <= 1.0 + 1e-6
    sc_laps = df[df["TrackStatus"] == "4"]["LapTime"]
    assert sc_laps.median() > 1.2 * df[df["TrackStatus"] == "1"]["LapTime"].median()


def test_projection_keeps_total_and_floors():
    model = np.array([90.0, 91.0, 89.0, 95.0])
    floor = np.full(4, 89.5)
    x, ok = rc.project(model, floor, 370.0)
    assert ok and x.sum() == pytest.approx(370.0, abs=1e-9) and (x >= floor - 1e-9).all()
    _, ok = rc.project(model, floor, 300.0)
    assert not ok


# --- Provenance -----------------------------------------------------------------------------


def test_provenance_marks_the_race_reconstructed(solved):
    side = solved.sidecar
    assert side["reconstructed"] is True
    assert side["provenance"] == {
        "kind": "reconstructed",
        "estimated": ["compounds", "fuelLoads", "weather"],  # no SC before 1993
    }
    later = rc.reconstruct(toy(year=1993)).sidecar["provenance"]
    assert "safetyCars" in later["estimated"]  # 1993+, not every SC sourced
    base = json.loads((paths.RACES_DIR / "abu-dhabi-2021.json").read_text())
    marked = rc.mark_model(base, side)
    assert marked["reconstructed"] is True and marked["provenance"]["kind"] == "reconstructed"
    export.validate_model(marked)


def test_report_lists_target_achieved_and_pass(solved, tmp_path):
    written = rc.write("toy-1990", solved, tmp_path)
    assert [p.name for p in written] == [
        "toy-1990.parquet",
        "toy-1990.status.json",
        "toy-1990.reconstruction.json",
        "toy-1990.anchors.md",
    ]
    for row in solved.sidecar["anchors"]:
        assert set(row) == {"anchor", "subject", "target", "achieved", "pass"}
    kinds = {r["anchor"] for r in solved.sidecar["anchors"]}
    assert {"grid", "order", "gap", "fastest", "retirement", "laps down"} <= kinds
    md = (tmp_path / "toy-1990.anchors.md").read_text()
    assert "| fastest | AAA | [88.512, 40] | [88.512, 40] | pass |" in md


# --- Facts files ----------------------------------------------------------------------------


def _facts(tmp_path: Path, race_id: str, facts: dict) -> Path:
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / f"{race_id}.json").write_text(json.dumps(facts))
    return tmp_path


def test_facts_need_sources(tmp_path):
    d = _facts(tmp_path, "brazil-1993", {"stops": [{"driver": "X", "lap": 3, "source": ""}]})
    with pytest.raises(ValueError, match="no source"):
        rc.load_facts("brazil-1993", d)
    sc = {"safetyCars": [{"startLap": 2, "endLap": 3, "source": "a report"}]}
    with pytest.raises(ValueError, match="before 1993"):
        rc.load_facts("monaco-1988", _facts(tmp_path, "monaco-1988", sc))
    assert rc.load_facts("brazil-1993", _facts(tmp_path, "brazil-1993", sc))["safetyCars"]
    assert rc.load_facts("nowhere-1990", tmp_path) is None


def test_only_1983_to_1995():
    with pytest.raises(ValueError, match="1983-1995"):
        rc.load_anchors("australia-1996", dump_dir=DUMP)


# --- End to end on the 1994 Australian GP fixture -----------------------------------------


@pytest.fixture(scope="module")
def empty_drivers(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("drivers") / "drivers.json"
    path.write_text(json.dumps({"drivers": {}}))
    return path


@pytest.fixture(scope="module")
def aus94(empty_drivers) -> rc.Anchors:
    return rc.load_anchors(
        "australia-1994",
        dump_dir=DUMP,
        f1db_dir=F1DB,
        facts_dir=FIXTURE,
        drivers_path=empty_drivers,
    )


def test_loads_jolpica_and_f1db_anchors(aus94):
    assert aus94.laps == 81 and len(aus94.cars) == 26
    by = {c.driver: c for c in aus94.cars}
    msc = by["MSC"]  # Jolpica's own code (no drivers.json entry)
    assert (msc.grid, msc.laps, msc.status) == (2, 35, "accident")
    assert (msc.fastest_time, msc.fastest_lap) == (77.14, 29)
    assert [s.lap for s in msc.stops] == [18]
    assert sum(len(c.stops) for c in aus94.cars) == 45
    assert by["mansell"].time == pytest.approx(6471.4)
    assert aus94.stops_complete and not aus94.safety_cars_complete


def test_australia_1994_meets_its_anchors(aus94):
    res = rc.reconstruct(aus94)
    assert rc.failures(res.sidecar["anchors"]) == []
    order = [d for d in finishing_order(res.laps)][:12]
    assert order[:4] == ["mansell", "berger", "brundle", "BAR"]


def test_facts_stops_used_when_f1db_has_none(tmp_path, empty_drivers):
    f1db = tmp_path / "f1db"
    f1db.mkdir()
    (f1db / "australia-1994.fastest-laps.csv").write_text(
        (F1DB / "australia-1994.fastest-laps.csv").read_text()
    )
    facts = {
        "stops": [{"number": 5, "lap": 18, "laneTime": 22.5, "source": "a checked report"}],
        "safetyCars": [{"startLap": 70, "endLap": 72, "source": "a checked report"}],
        "complete": {"stops": False, "safetyCars": True},
    }
    d = _facts(tmp_path / "facts", "australia-1994", facts)
    a = rc.load_anchors(
        "australia-1994", dump_dir=DUMP, f1db_dir=f1db, facts_dir=d, drivers_path=empty_drivers
    )
    assert [(c.driver, s.lap, s.source) for c in a.cars for s in c.stops] == [
        ("MSC", 18, "a checked report")
    ]
    assert a.safety_cars == [rc.SafetyCar(70, 72, "a checked report")]
    res = rc.reconstruct(a)
    assert rc.failures(res.sidecar["anchors"]) == []
    assert "safetyCars" not in res.sidecar["provenance"]["estimated"]


def test_cli_reconstruct(tmp_path):
    out = tmp_path / "raw"
    args = ["reconstruct", "australia-1994", "--dump", str(DUMP), "--raw-dir", str(out)]
    result = CliRunner().invoke(cli.app, [*args, "--facts-dir", str(tmp_path)])
    assert result.exit_code == 0, result.output
    assert "fastest" in result.output and "26/26" in result.output
    assert ingest.raw_snapshot_path("australia-1994", out).exists()
    side = json.loads(rc.sidecar_path("australia-1994", out).read_text())
    assert side["solver"]["passed"] and side["reconstructed"]
    again = CliRunner().invoke(cli.app, args)
    assert "skipped" in again.output


# --- Building a reconstructed race -----------------------------------------------------------


def test_build_marks_a_reconstructed_race_and_fills_its_gaps(tmp_path, monkeypatch):
    # The toy race (no stops) written as `pipeline reconstruct` would, then `pipeline build`.
    rc.write("toy-1990", rc.reconstruct(toy()), tmp_path)
    entry = {**build.RACES["hungary-1986"], "year": 1990, "name": "toy", "user_side": "BBB"}
    monkeypatch.setitem(build.RACES, "toy-1990", {**entry, "rival": "AAA"})
    # HHH crashed on lap 11 (10 laps completed): a fault on that lap ran no laps to fit.
    crash = {"lap": 11, "type": "FAULT", "driver": "HHH", "fault": "tyre-failure"}
    result = build.build_race(
        "toy-1990", raw_dir=tmp_path, fault_facts=[crash], eras_dir=tmp_path / "eras"
    )
    model = result.model
    assert model["reconstructed"] is True
    assert model["provenance"] == {
        "kind": "reconstructed",
        "estimated": ["compounds", "fuelLoads", "weather"],
    }
    assert set(model["compounds"]) == {"MEDIUM"}  # step 2.4: one dry compound before 2007
    # No stop to measure: the reconstruction's own assumed loss (lane 25 s less 5 s bypassed).
    assert model["track"]["pitLoss"] == 20.0
    assert any("pitLoss: no stop in the reconstruction" in n for n in result.notes)
    assert not [e for e in model["events"] if e["type"] == "FAULT"]
    assert any("HHH tyre-failure on lap 11 ended the car's race" in s for s in result.estimates)
    assert result.estimates[0] == "reconstructed (eras build plan 4.6): anchors all pass"
